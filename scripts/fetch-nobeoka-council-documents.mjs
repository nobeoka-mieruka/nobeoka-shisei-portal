/**
 * 延岡市議会公式サイト「議案等審議結果」ページを確認し、新しい定例会・臨時会PDFを検出して
 * src/data/councilSessions.json / public/council-documents/ へ反映する。
 *
 * このスクリプト自体はGitへのコミット・pushを行わない（.github/workflows/update-council-documents.yml
 * が、このスクリプト実行後にnpm run generate:council-documents・validate:data・build を経て
 * 差分がある場合のみコミットする）。
 *
 * 安全のための基本方針：
 * - 取得先ドメインは www.city.nobeoka.miyazaki.jp / city.nobeoka.miyazaki.jp のみ許可する。
 * - 公式ページのHTML構造が変わり、PDFリンクが0件、または前回から50%以上減少した場合は
 *   異常とみなし、既存データを一切変更せずに終了する。
 * - 資料の内容（PDFのバイナリ）は一切加工しない。ファイル名の整理のみ行う。
 * - --dry-run 指定時は、検出結果の報告のみ行い、ファイル書き込み・データ変更は一切行わない。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calendarYearFromFiscalYear,
  eraYearFor,
  parseEraFiscalYearHeading,
  sha256OfBuffer,
  titleFor,
} from "./lib/council-shared.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const RESULTS_PAGE_URL = "https://www.city.nobeoka.miyazaki.jp/site/gikai/1456.html";
const BASE_URL = "https://www.city.nobeoka.miyazaki.jp";
const ALLOWED_HOSTS = new Set(["www.city.nobeoka.miyazaki.jp", "city.nobeoka.miyazaki.jp"]);
/** プロジェクトの初期登録対象方針（令和5年5月以降）に合わせ、これより前の年度は対象外とする。 */
const MIN_FISCAL_YEAR = 2023;
const USER_AGENT =
  "Nobeoka-Shisei-Portal/1.0 (Council document update checker; +https://nobeoka-shisei-portal.pages.dev/contact)";
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
/** 前回の既知件数からこの割合以上減少した場合は、HTML構造の変化等を疑い自動更新を中止する。 */
const REMOVAL_ABORT_RATIO = 0.5;

const isDryRun = process.argv.includes("--dry-run");

const sessionsPath = join(root, "src", "data", "councilSessions.json");
const sourcesPath = join(root, "src", "data", "councilDocumentSources.json");
const updateHistoryPath = join(root, "src", "data", "updateHistory.json");
const reportsDir = join(root, "reports");
const reportPath = join(reportsDir, "council-document-update-report.json");

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** 許可ドメイン内かどうかを確認する（リダイレクト先も含む）。 */
function isAllowedUrl(url) {
  try {
    return ALLOWED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** タイムアウト・リトライ・User-Agent・許可ドメインチェック付きのfetch。 */
async function fetchWithRetry(url, init = {}) {
  if (!isAllowedUrl(url)) {
    throw new Error(`許可されていないドメインです（取得を中止しました）: ${url}`);
  }
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...init,
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
      });
      clearTimeout(timer);
      if (!isAllowedUrl(res.url || url)) {
        throw new Error(`許可されていないドメインへリダイレクトされました: ${res.url}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

/**
 * 「議案等審議結果」ページのHTMLから、年度見出し（<h2>令和N年度</h2>）と
 * PDFリンク（<li><a href="...">テキスト</a></li>）を順に読み取る、単純な構造専用パーサー。
 * 公式ページのマークアップが単純なリスト構造であることを前提にしており、
 * 大幅な構造変更があった場合は抽出0件となり、呼び出し側の安全チェックで検知される。
 */
function parseResultsPageHtml(html) {
  const entries = [];
  let currentFiscalYear = null;

  const tagRe = /<h2>([^<]*)<\/h2>|<a\s+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = tagRe.exec(html))) {
    const [, heading, href, rawLinkText] = match;
    if (heading) {
      currentFiscalYear = parseEraFiscalYearHeading(heading.trim());
      continue;
    }
    if (!href) continue;
    if (currentFiscalYear === null || currentFiscalYear < MIN_FISCAL_YEAR) continue;

    // ゼロ幅スペース等の不可視文字を除去してから解析する。
    const linkText = rawLinkText.replace(/[​-‍﻿]/g, "").trim();
    const detail = linkText.match(
      /第(\d+)回延岡市議会(定例会|臨時会)[（(]\s*(\d{1,2})月(定例会|臨時会)\s*[）)]/,
    );
    if (!detail) {
      entries.push({ href, linkText, fiscalYear: currentFiscalYear, unparsed: true });
      continue;
    }
    const [, kaijiStr, , monthStr, sessionTypeLabel] = detail;
    const sizeMatch = linkText.match(/PDFファイル[／/]\s*([\d.]+)\s*(KB|MB)/i);

    entries.push({
      href,
      linkText,
      fiscalYear: currentFiscalYear,
      kaijiNumber: Number(kaijiStr),
      month: Number(monthStr),
      sessionType: sessionTypeLabel === "臨時会" ? "臨時会" : "定例会",
      fileSizeLabel: sizeMatch ? `${sizeMatch[1]}${sizeMatch[2].toUpperCase()}` : undefined,
    });
  }
  return entries;
}

/** 同一年・同一月・同一区分の臨時会が複数ある場合、回次の昇順で連番(seq)を割り当てる。 */
function assignSequenceNumbers(entries) {
  const groups = new Map();
  for (const e of entries) {
    if (e.unparsed) continue;
    const calendarYear = calendarYearFromFiscalYear(e.fiscalYear, e.month);
    const key = `${calendarYear}-${e.month}-${e.sessionType}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    if (list.length <= 1) continue;
    list.sort((a, b) => a.kaijiNumber - b.kaijiNumber);
    list.forEach((e, i) => {
      e.seq = i + 1;
    });
  }
  return entries;
}

function deriveSessionId(calendarYear, month, sessionType, seq) {
  const monthPart = String(month).padStart(2, "0");
  const base = `${calendarYear}-${monthPart}`;
  if (sessionType !== "臨時会") return base;
  return seq ? `${base}-extraordinary-${String(seq).padStart(2, "0")}` : `${base}-extraordinary`;
}

function findDocumentBySourceUrl(sessions, sourceUrl) {
  for (const session of sessions) {
    const doc = (session.documents ?? []).find((d) => d.sourceUrl === sourceUrl);
    if (doc) return { session, doc };
  }
  return undefined;
}

/** 要確認状態の既存セッションのうち、同じ年月・区分でsourceUrl未設定の資料を探す（取り違え防止のための照合）。 */
function findReconcilableSession(sessions, calendarYear, month, sessionType) {
  for (const session of sessions) {
    if (session.status !== "要確認") continue;
    if (session.year !== calendarYear || session.sessionType !== sessionType) continue;
    const idInfo = session.id.match(/^\d{4}-(\d{2})/);
    if (!idInfo || Number(idInfo[1]) !== month) continue;
    const doc = (session.documents ?? []).find((d) => !d.sourceUrl);
    if (doc) return { session, doc };
  }
  return undefined;
}

async function main() {
  const report = {
    checkedAt: new Date().toISOString(),
    watchedPage: RESULTS_PAGE_URL,
    dryRun: isDryRun,
    detected: 0,
    new: 0,
    reconciled: 0,
    updated: 0,
    unchanged: 0,
    removed: 0,
    errors: 0,
    published: 0,
    pendingReview: 0,
    storageBase: "/council-documents",
    entries: [],
  };

  console.log(`[fetch-council-documents] ${isDryRun ? "dry-run" : "通常実行"}: ${RESULTS_PAGE_URL} を確認します`);

  let html;
  try {
    const res = await fetchWithRetry(RESULTS_PAGE_URL);
    html = await res.text();
  } catch (e) {
    console.error(`[fetch-council-documents] 公式ページの取得に失敗しました。処理を中止します: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  let entries;
  try {
    entries = assignSequenceNumbers(parseResultsPageHtml(html));
  } catch (e) {
    console.error(`[fetch-council-documents] HTML解析でエラーが発生しました。処理を中止します: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  const parsedEntries = entries.filter((e) => !e.unparsed);
  const unparsedCount = entries.length - parsedEntries.length;
  report.detected = parsedEntries.length;
  if (unparsedCount > 0) {
    console.warn(`[fetch-council-documents] 形式を判定できなかったリンクが${unparsedCount}件あります（対象外としてスキップ）。`);
  }

  if (parsedEntries.length === 0) {
    console.error(
      "[fetch-council-documents] PDFリンクを1件も検出できませんでした。公式ページの構造が変わった可能性があるため、既存データは変更せず中止します。",
    );
    process.exitCode = 1;
    return;
  }

  const sources = readJson(sourcesPath, []);
  let sessions;
  try {
    sessions = readJson(sessionsPath, []);
    if (!Array.isArray(sessions)) throw new Error("配列ではありません");
  } catch (e) {
    console.error(`[fetch-council-documents] councilSessions.jsonの読み込みに失敗しました。中止します: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  const sessionsBefore = sessions.length;

  // --- 削除検知（既存の"取得済み"件数と比較して、急激な減少がないかを先に確認する） ---
  const previousActiveSources = sources.filter((s) => s.status !== "removed");
  const currentUrls = new Set(parsedEntries.map((e) => resolveUrl(e.href)));
  const stillPresent = previousActiveSources.filter((s) => currentUrls.has(s.sourceUrl));
  const missing = previousActiveSources.filter((s) => !currentUrls.has(s.sourceUrl));

  if (previousActiveSources.length >= 4) {
    const remainingRatio = stillPresent.length / previousActiveSources.length;
    if (remainingRatio < 1 - REMOVAL_ABORT_RATIO) {
      console.error(
        `[fetch-council-documents] 既知のPDF${previousActiveSources.length}件中${missing.length}件が一度に見つからなくなりました（${Math.round(
          (1 - remainingRatio) * 100,
        )}%減少）。公式ページの構造変更等の可能性があるため、既存データを変更せず中止します。`,
      );
      process.exitCode = 1;
      return;
    }
  }

  // --- 分類・処理 ---
  for (const entry of parsedEntries) {
    const sourceUrl = resolveUrl(entry.href);
    entry.sourceUrl = sourceUrl;
    const calendarYear = calendarYearFromFiscalYear(entry.fiscalYear, entry.month);
    const sessionId = deriveSessionId(calendarYear, entry.month, entry.sessionType, entry.seq);

    const existing = findDocumentBySourceUrl(sessions, sourceUrl);
    if (existing) {
      const outcome = await handleExistingDocument({ existing, entry, sources, isDryRun });
      report[outcome]++;
      report.entries.push({ sourceUrl, sessionId: existing.session.id, outcome });
      continue;
    }

    const reconciled = findReconcilableSession(sessions, calendarYear, entry.month, entry.sessionType);
    if (reconciled) {
      reconcileSession({ reconciled, entry, sourceUrl });
      updateSourceRecord(sources, { sourceUrl, entry, status: "new" });
      report.reconciled++;
      report.published++;
      report.entries.push({ sourceUrl, sessionId: reconciled.session.id, outcome: "reconciled" });
      continue;
    }

    // 完全に新規のPDF。
    if (isDryRun) {
      report.new++;
      report.entries.push({ sourceUrl, sessionId, outcome: "new (dry-run: 未保存)" });
      continue;
    }

    try {
      const created = await downloadAndRegisterNewDocument({ sessions, entry, sourceUrl, calendarYear, sessionId });
      updateSourceRecord(sources, {
        sourceUrl,
        entry,
        status: "new",
        filePath: created.filePath,
        fileHash: created.fileHash,
        downloadedAt: todayIso(),
      });
      report.new++;
      report.published++;
      report.entries.push({ sourceUrl, sessionId, outcome: "new" });
    } catch (e) {
      console.error(`[fetch-council-documents] PDF取得エラー（スキップします）: ${sourceUrl} - ${e.message}`);
      updateSourceRecord(sources, { sourceUrl, entry, status: "error" });
      report.errors++;
      report.entries.push({ sourceUrl, sessionId, outcome: `error: ${e.message}` });
    }
  }

  // --- 削除検知の反映（サイト内PDFは削除しない。要確認状態にするのみ） ---
  for (const s of missing) {
    if (s.status === "removed") continue;
    report.removed++;
    if (isDryRun) continue;
    s.status = "removed";
    s.lastCheckedAt = todayIso();
    const found = findDocumentBySourceUrl(sessions, s.sourceUrl);
    if (found) found.doc.publicationStatus = "removedPendingReview";
  }

  // --- 安全確認：既存の定例会件数が減っていないか（バグによるデータ消失を防ぐ最終チェック） ---
  if (sessions.length < sessionsBefore) {
    console.error(
      `[fetch-council-documents] 処理後に定例会データが減少しました（${sessionsBefore}→${sessions.length}）。安全のため書き込みを中止します。`,
    );
    process.exitCode = 1;
    return;
  }

  for (const s of sessions) {
    for (const d of s.documents ?? []) {
      if (d.publicationStatus === undefined || d.publicationStatus === "published") report.published++;
      else report.pendingReview++;
    }
  }

  if (!isDryRun) {
    writeJson(sessionsPath, sessions);
    writeJson(sourcesPath, sources);
    appendUpdateHistoryIfNeeded(report);
  }

  mkdirSync(reportsDir, { recursive: true });
  writeJson(reportPath, report);

  printReport(report);
}

async function handleExistingDocument({ existing, entry, sources, isDryRun }) {
  const { doc } = existing;
  const sourceUrl = entry.sourceUrl;

  if (doc.storageType !== "local") {
    if (!isDryRun) updateSourceRecord(sources, { sourceUrl, entry, status: "unchanged" });
    return "unchanged";
  }

  // ローカル保存資料は、公式サイト側の内容と実ファイルのハッシュを比較して判定する
  // （sources.json の記録有無に依存せず、常に実ファイルを基準にすることで自己修復的にする）。
  const absPath = join(root, "public", doc.filePath.replace(/^\//, ""));
  const localBuffer = existsSync(absPath) ? readFileSync(absPath) : null;
  const localHash = localBuffer ? sha256OfBuffer(localBuffer) : null;

  try {
    const remoteBuffer = await downloadPdf(sourceUrl);
    const remoteHash = sha256OfBuffer(remoteBuffer);

    if (localHash === remoteHash) {
      // 内容が一致（初回はここでベースラインとしてハッシュを記録する）。
      if (!isDryRun) {
        updateSourceRecord(sources, { sourceUrl, entry, status: "unchanged", filePath: doc.filePath, fileHash: remoteHash });
      }
      return "unchanged";
    }

    // 内容が異なる（初めて確認する資料、またはローカルファイルが公式最新版と異なる）。
    if (isDryRun) return "updated";
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, remoteBuffer);
    doc.publicationStatus = "updatedPendingReview";
    updateSourceRecord(sources, {
      sourceUrl,
      entry,
      status: "updated",
      filePath: doc.filePath,
      fileHash: remoteHash,
      downloadedAt: todayIso(),
    });
    return "updated";
  } catch (e) {
    console.error(`[fetch-council-documents] 既存資料の再確認に失敗しました（スキップ）: ${sourceUrl} - ${e.message}`);
    if (!isDryRun) updateSourceRecord(sources, { sourceUrl, entry, status: "error" });
    return "errors";
  }
}

function reconcileSession({ reconciled, entry, sourceUrl }) {
  const { session, doc } = reconciled;
  // "要確認"（機械的な仮登録）のセッション・資料のみ、公式ページの記載で上書き補正する。
  session.sessionNumber = `第${entry.kaijiNumber}回`;
  session.title = titleFor(session.year, entry.month, entry.sessionType === "臨時会", entry.seq);
  session.eraYear = eraYearFor(session.year);
  session.lastVerified = todayIso();
  doc.sourceUrl = sourceUrl;
  doc.sourcePageUrl = RESULTS_PAGE_URL;
  if (doc.category === "other") doc.category = "results";
  if (!doc.title || doc.verificationStatus === "要確認") doc.title = "議案等審議結果";
  doc.verificationStatus = "自動取得";
  doc.verifiedAt = todayIso();
}

async function downloadPdf(url) {
  const res = await fetchWithRetry(url);
  const contentType = res.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error("ダウンロードしたPDFが0バイトです");
  if (contentType && !/pdf/i.test(contentType)) {
    throw new Error(`Content-Typeが不正です（PDFではありません）: ${contentType}`);
  }
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("PDFの先頭が正常なPDF形式ではありません");
  }
  return buffer;
}

async function downloadAndRegisterNewDocument({ sessions, entry, sourceUrl, calendarYear, sessionId }) {
  const buffer = await downloadPdf(sourceUrl);
  const fileHash = sha256OfBuffer(buffer);

  let session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    session = {
      id: sessionId,
      year: calendarYear,
      fiscalYear: entry.fiscalYear,
      eraYear: eraYearFor(calendarYear),
      title: titleFor(calendarYear, entry.month, entry.sessionType === "臨時会", entry.seq),
      sessionType: entry.sessionType,
      sessionNumber: `第${entry.kaijiNumber}回`,
      folderPath: `/council-documents/${entry.fiscalYear}/${sessionId}`,
      documents: [],
      officialSessionUrl: RESULTS_PAGE_URL,
      status: "自動取得",
    };
    sessions.push(session);
  }

  const existingResultsCount = session.documents.filter((d) => d.category === "results").length;
  const filename =
    existingResultsCount === 0
      ? "deliberation-results.pdf"
      : `deliberation-results-${String(existingResultsCount + 1).padStart(2, "0")}.pdf`;
  const relDir = `/council-documents/${entry.fiscalYear}/${sessionId}/results`;
  const filePath = `${relDir}/${filename}`;
  const absDir = join(root, "public", relDir.replace(/^\//, ""));
  mkdirSync(absDir, { recursive: true });
  writeFileSync(join(root, "public", filePath.replace(/^\//, "")), buffer);

  session.documents.push({
    id: `${sessionId}-results-${existingResultsCount + 1}`,
    category: "results",
    title: "議案等審議結果",
    storageType: "local",
    filePath,
    fileType: "PDF",
    sourceUrl,
    sourcePageUrl: RESULTS_PAGE_URL,
    fileSize: entry.fileSizeLabel,
    verifiedAt: todayIso(),
    isOfficial: true,
    verificationStatus: "自動取得",
    publicationStatus: "published",
  });
  session.lastVerified = todayIso();

  return { filePath, fileHash };
}

function updateSourceRecord(sources, { sourceUrl, entry, status, filePath, fileHash, downloadedAt }) {
  let record = sources.find((s) => s.sourceUrl === sourceUrl);
  const now = todayIso();
  if (!record) {
    record = {
      sourceUrl,
      sourcePageUrl: RESULTS_PAGE_URL,
      sourceTitle: entry.linkText,
      firstDetectedAt: now,
      lastCheckedAt: now,
      downloadedAt: downloadedAt ?? null,
      filePath: filePath ?? null,
      fileHash: fileHash ?? null,
      fileSizeBytes: null,
      status,
    };
    sources.push(record);
  } else {
    record.lastCheckedAt = now;
    record.status = status;
    if (filePath) record.filePath = filePath;
    if (fileHash) record.fileHash = fileHash;
    if (downloadedAt) record.downloadedAt = downloadedAt;
  }
  return record;
}

function resolveUrl(href) {
  return new URL(href, BASE_URL).toString();
}

function appendUpdateHistoryIfNeeded(report) {
  const newlyPublished = report.entries.filter((e) => e.outcome === "new");
  if (newlyPublished.length === 0) return;

  const history = readJson(updateHistoryPath, []);
  const existingIds = new Set(history.map((h) => h.id));
  let nextNum =
    history.reduce((max, h) => {
      const m = /^u(\d+)$/.exec(h.id ?? "");
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0) + 1;

  const title = `延岡市議会公式サイトの議会資料を自動更新しました（${newlyPublished.length}件）`;
  const alreadyLogged = history.some((h) => h.date === todayIso() && h.title === title);
  if (alreadyLogged) return;

  const entry = {
    id: `u${nextNum}`,
    date: todayIso(),
    title,
    description:
      "延岡市議会公式サイト「議案等審議結果」ページを自動確認し、新しく公開された定例会・臨時会の審議結果PDFを追加しました。",
    targetPages: ["定例会・議会資料"],
    category: "議会資料",
    type: "automatic",
    linkUrl: "/council-documents",
    linkLabel: "定例会・議会資料を見る",
  };
  if (!existingIds.has(entry.id)) {
    history.unshift(entry);
    writeJson(updateHistoryPath, history);
  }
}

function printReport(report) {
  console.log(
    `[fetch-council-documents] 検出=${report.detected} 新規=${report.new} 照合補完=${report.reconciled} 更新=${report.updated} 変更なし=${report.unchanged} 削除検知=${report.removed} エラー=${report.errors}`,
  );
  console.log(`[fetch-council-documents] 公開中=${report.published} 確認待ち=${report.pendingReview}`);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const lines = [
      "## 延岡市議会 議会資料 自動更新レポート",
      "",
      `- 確認日時: ${report.checkedAt}`,
      `- 監視ページ: ${report.watchedPage}`,
      `- 検出PDF件数: ${report.detected}`,
      `- 新規: ${report.new} / 照合補完: ${report.reconciled} / 更新: ${report.updated} / 変更なし: ${report.unchanged}`,
      `- 削除検知: ${report.removed} / エラー: ${report.errors}`,
      `- 公開中の資料: ${report.published} / 確認待ちの資料: ${report.pendingReview}`,
      "",
    ];
    try {
      writeFileSync(summaryPath, `${lines.join("\n")}\n`, { flag: "a" });
    } catch {
      // Step Summaryへの書き込みに失敗しても、レポート自体は既にreports/へ保存済みなので継続する。
    }
  }
}

main().catch((e) => {
  console.error(`[fetch-council-documents] 予期しないエラーで中止しました: ${e.stack ?? e.message}`);
  process.exitCode = 1;
});
