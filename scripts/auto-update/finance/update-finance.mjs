#!/usr/bin/env node
/**
 * 自動更新パイプライン（Workstream D：財政・人口 のうち財政）。
 *
 * 【重要：既存資産の再利用】
 * 公式サイトへのHTTP取得（許可ドメイン制限・429/403/5xx処理・タイムアウト・SHA-256ハッシュ）は、
 * 既存の scripts/lib/city-site-fetch.mjs をそのままimportして使う（財政・人口・基金の巡回で
 * .github/workflows/civic-archive-sync.yml・scripts/run-archive-crawler.mjsが既に使っている、
 * 同じ低レベルヘルパー）。GREEN/YELLOW/RED判定・サーキットブレーカー・スキーマ検証・
 * 統一レポート出力は core/classify.mjs・core/validate.mjs・core/report.mjs をそのまま使う
 * （bills/update-bills.mjsと同じ構造）。
 *
 * 【スコープを絞った理由】
 * 財政指標は膨大（予算・決算・市債・基金・健全化判断比率…）だが、今回は
 * 「1.当初予算資料の新年度検知 2.決算資料の新年度検知 3.市債・基金等の明確な数値」の優先順位に従い、
 * city-site-fetch.mjsで到達可能なHTMLページのハッシュ・リンクテキスト比較だけで
 * 「新年度資料の存在」を検知できるものに限定した。PDF・xlsxそのものの中身の自動抽出（特に
 * 画像スキャンPDFのOCR）は行わない（検知できてもYELLOW＝人間確認としている）。
 *
 * 監視対象（すべて延岡市公式サイト、財政課ページ）：
 *   A) https://www.city.nobeoka.miyazaki.jp/soshiki/18/ … 財政課トップ。「令和N年度予算」
 *      リンクの年度で当初予算資料の新年度公開を検知する（優先度1）。
 *   B) https://www.city.nobeoka.miyazaki.jp/soshiki/18/48507.html … 「健全化判断比率」年度別
 *      一覧ページ。「令和N年度健全化判断比率等の公表」リンクの年度で決算資料の新年度公開を
 *      検知する（優先度2）。
 *   C) Bで見つかった最新年度の個別ページ（令和7年度分は 51957.html）を core/fetch.mjs の
 *      fetchWithRetry で動的に取得し（bills/update-bills.mjsのprobeNewDocumentと同じ「動的に
 *      見つかった資料をcore/fetch.mjsで確認する」設計）、scripts/lib/soundness-ratio-page.mjs で
 *      5指標（実質赤字比率・連結実質赤字比率・実質公債費比率・将来負担比率・資金不足比率）・
 *      法定基準・前年度比較値を抽出する（OCR不要、HTML本文に平文で記載されている）。
 *      Phase260：表と本文の値の食い違い・行の欠落・年度の不一致・前年度値と登録済みデータの
 *      不一致はRED（誤った数値を自動反映しない＝要確認）。新年度・内容変化を検出し問題が無い場合は、
 *      archiveFiscalYears.json の finance と同じ形の updateCandidate をレポートに添付する
 *      （人間が公式ページと照合してから登録する。本番データへは書き込まない）。
 *   D) https://www.city.nobeoka.miyazaki.jp/soshiki/18/48504.html … 「財政状況資料集」（xlsx）
 *      年度別一覧ページ。「令和N年度財政状況資料集」リンクの年度で新年度資料の存在を検知する
 *      （優先度3の補助。xlsxの中身は開かない＝検知のみ）。
 *   E) https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/24913.pdf …
 *      archiveCrawlerTargets.jsonのid="fund"と同一URL（当初予算編成方針、基金残高の出典PDF）。
 *      PDF本体のハッシュ変更のみ検知する（内容抽出はしない＝OCRが必要な資料と同様にYELLOW）。
 *
 * 判定方針（新しい年度資料の追加を原則とする）：
 *   - 各年度別一覧ページ（A/B/D）で検出した最新年度が、本番データ（src/data/archiveFiscalYears.json・
 *     src/data/financeDashboard.json、読み取り専用）の既知最新年度より新しい → outcome="new"
 *     （新しい年度をarchiveFiscalYears.jsonへ追加する候補。書き換えではなく追加）。
 *   - 検出年度は既知と同じだが、そのページの本文ハッシュが変化した → outcome="updated"
 *     （既存年度の修正版の可能性。必ずYELLOW以上）。
 *   - 変化なし → outcome="unchanged"。
 *   - 検出年度が既知より古い、同一最新年度のリンクが複数（重複）検出、期待するリンクパターンが
 *     0件（ページ構造変化） → 異常値としてRED。
 *
 * 本番データ（src/data/*.json）は一切書き換えない。
 * 使い方: node scripts/auto-update/finance/update-finance.mjs [--verbose]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchCitySiteBuffer,
  sha256OfBuffer,
  sha256OfBufferForDiff,
  ALLOWED_HOSTS as CITY_SITE_ALLOWED_HOSTS,
} from "../../lib/city-site-fetch.mjs";
import { fetchWithRetry } from "../core/fetch.mjs";
import { classifyItem, checkCircuitBreaker } from "../core/classify.mjs";
import { validateEntry } from "../core/validate.mjs";
import { writeRunReport, updateStatus, ROOT } from "../core/report.mjs";
import { parseSoundnessRatioPage } from "../../lib/soundness-ratio-page.mjs";
import { classifyBudgetListing } from "../../lib/budget-listing.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = "finance";
const PARSER_VERSION = "update-finance.mjs@2026-08";
const verbose = process.argv.includes("--verbose");
const REIWA_ERA_OFFSET = 2018; // 令和1年 = 2019年

const BUDGET_INDEX_URL = "https://www.city.nobeoka.miyazaki.jp/soshiki/18/";
const SETTLEMENT_RATIO_INDEX_URL = "https://www.city.nobeoka.miyazaki.jp/soshiki/18/48507.html";
const FISCAL_MATERIALS_INDEX_URL = "https://www.city.nobeoka.miyazaki.jp/soshiki/18/48504.html";
// archiveCrawlerTargets.jsonのid="fund"と同一URL（推測で新規URLを作らない）。
const FUND_POLICY_PDF_URL = "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/24913.pdf";

const ARCHIVE_FISCAL_YEARS_PATH = join(ROOT, "src", "data", "archiveFiscalYears.json");
const FINANCE_DASHBOARD_PATH = join(ROOT, "src", "data", "financeDashboard.json");
const STATE_DIR = join(__dirname, "state");
const STATE_PATH = join(STATE_DIR, "finance-state.json");

function log(...args) {
  if (verbose) console.log(...args);
}

function loadLocalState() {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveLocalState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function htmlToText(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** ヘッダー・フッター・アクセス解析タグ等のノイズを除き、本文領域だけを対象にハッシュ・抽出する。 */
function extractMainContentText(html) {
  const text = htmlToText(html);
  const startMarker = "現在地";
  const endMarker = "このページに関するお問い合わせ先";
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) return text; // マーカーが見つからない場合は全文を対象にする（フェイルセーフ）。
  return text.slice(start, end);
}

function extractLinks(html) {
  const matches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/g)];
  return matches.map((m) => ({ href: m[1], text: m[2].replace(/\s+/g, " ").trim() })).filter((l) => l.text);
}

/** リンクテキストから「令和N年度〜」パターンの年度（西暦）を抽出し、最新（最大）年度とそのリンクを返す。 */
function findLatestYearLink(links, pattern) {
  const matched = [];
  for (const l of links) {
    const m = l.text.match(pattern);
    if (m) matched.push({ ...l, reiwaYear: Number(m[1]), gregorianYear: Number(m[1]) + REIWA_ERA_OFFSET });
  }
  if (matched.length === 0) return { matched: [], latest: null, duplicateAtLatest: false };
  const maxYear = Math.max(...matched.map((m) => m.gregorianYear));
  const atMax = matched.filter((m) => m.gregorianYear === maxYear);
  // 同一年度で異なるURLが複数存在する場合のみ「重複」とみなす（同一URLへの重複リンクは無害）。
  const distinctHrefsAtMax = new Set(atMax.map((m) => m.href));
  return { matched, latest: atMax[0], duplicateAtLatest: distinctHrefsAtMax.size > 1 };
}

function resolveUrl(href, base) {
  return new URL(href, base).toString();
}

/** 本番データ（読み取り専用）から、当初予算・最終予算のいずれかが登録済みの最新fiscalYearを取得する。 */
function loadKnownLatestBudgetYear() {
  const years = JSON.parse(readFileSync(ARCHIVE_FISCAL_YEARS_PATH, "utf8"));
  let max = null;
  for (const y of years) {
    const b = y.budget;
    if (!b) continue;
    if (b.generalAccountInitialBudgetYen != null || b.generalAccountFinalBudgetYen != null) {
      if (max === null || y.fiscalYear > max) max = y.fiscalYear;
    }
  }
  return max;
}

/**
 * 本番データ（読み取り専用）から、健全化判断比率の既知最新決算年度を取得する。
 * Phase260：単一情報源である archiveFiscalYears.json の finance.soundness（「健全化判断比率等の公表」
 * ページ由来の登録）を優先し、未登録の場合のみ従来どおり financeDashboard.json のラベルを見る。
 */
function loadKnownLatestSettlementYear() {
  const years = JSON.parse(readFileSync(ARCHIVE_FISCAL_YEARS_PATH, "utf8"));
  const withSoundness = years.filter((y) => y.finance?.soundness).map((y) => y.fiscalYear);
  if (withSoundness.length > 0) return Math.max(...withSoundness);
  const dash = JSON.parse(readFileSync(FINANCE_DASHBOARD_PATH, "utf8"));
  const label = dash.financialIndicators?.fiscalYearLabel ?? "";
  const m = label.match(/令和(\d+)年度/);
  return m ? Number(m[1]) + REIWA_ERA_OFFSET : null;
}

/** 本番データ（読み取り専用）archiveFiscalYears.jsonの指定年度のfinance。 */
function loadArchiveFinance(fiscalYear) {
  const years = JSON.parse(readFileSync(ARCHIVE_FISCAL_YEARS_PATH, "utf8"));
  return years.find((y) => y.fiscalYear === fiscalYear)?.finance ?? null;
}

/**
 * 解析結果が本番データ（archiveFiscalYears.json）の登録内容と一致するか。
 * 値（実質公債費比率・将来負担比率）・5指標の区分・法定基準・資金不足比率の会計まで比較する。
 */
function soundnessMatchesProduction(parsed, finance) {
  if (!finance?.soundness) return false;
  const s = finance.soundness;
  const r = parsed.ratios;
  const sameStd = (a, b) =>
    a.earlyWarningStandardPercent === b.earlyWarningStandardPercent && a.reconstructionStandardPercent === b.reconstructionStandardPercent;
  if (finance.realDebtServiceRatioPercent !== r.realDebtServiceRatio.percent) return false;
  if (finance.futureBurdenRatioPercent !== r.futureBurdenRatio.percent) return false;
  for (const key of ["actualDeficitRatio", "consolidatedActualDeficitRatio", "realDebtServiceRatio", "futureBurdenRatio"]) {
    if (s[key].status !== r[key].status || !sameStd(s[key], r[key])) return false;
  }
  for (const key of ["actualDeficitRatio", "consolidatedActualDeficitRatio"]) {
    if (s[key].percent !== r[key].percent) return false;
  }
  if (s.fundShortageRatios.length !== parsed.fundShortageRatios.length) return false;
  return parsed.fundShortageRatios.every((f) => {
    const known = s.fundShortageRatios.find((k) => k.accountName === f.accountName);
    return known && known.status === f.status && known.percent === f.percent && known.managementSoundnessStandardPercent === f.managementSoundnessStandardPercent;
  });
}

/**
 * 人間確認用の更新候補（archiveFiscalYears.json の finance レコードと同じ形）。本番データへは書き込まない。
 * 経常収支比率・財政力指数・公債費負担比率はこのページに記載がないため null（確認中）のまま。
 */
function buildSoundnessCandidate(parsed, detailUrl, accessedAt) {
  const reiwa = parsed.fiscalYear - REIWA_ERA_OFFSET;
  const sourceRef = {
    sourceUrl: detailUrl,
    sourceTitle: `令和${reiwa}年度健全化判断比率等の公表`,
    sourceOrganization: "延岡市",
    trustLevel: "PRIMARY",
    sourceUpdatedDate: parsed.updatedDate,
    accessedAt,
    extractionMethod: "other",
    verificationStatus: "needsReview",
    notes: `自動巡回（${PARSER_VERSION}）で表と本文を解析した更新候補。人が公式ページと照合してから登録すること。`,
  };
  const pick = ({ status, earlyWarningStandardPercent, reconstructionStandardPercent }) => ({
    status,
    earlyWarningStandardPercent,
    reconstructionStandardPercent,
  });
  return {
    fiscalYear: parsed.fiscalYear,
    debtServiceRatioPercent: null,
    realDebtServiceRatioPercent: parsed.ratios.realDebtServiceRatio.percent,
    futureBurdenRatioPercent: parsed.ratios.futureBurdenRatio.percent,
    currentAccountRatioPercent: null,
    financialStrengthIndex: null,
    sourceRefs: [sourceRef],
    soundness: {
      actualDeficitRatio: parsed.ratios.actualDeficitRatio,
      consolidatedActualDeficitRatio: parsed.ratios.consolidatedActualDeficitRatio,
      realDebtServiceRatio: pick(parsed.ratios.realDebtServiceRatio),
      futureBurdenRatio: pick(parsed.ratios.futureBurdenRatio),
      fundShortageRatios: parsed.fundShortageRatios,
      sourceRef,
    },
  };
}

/**
 * 公表ページの「前年度(x%)」が、本番データに登録済みの前年度の値と一致するか。
 * 一致しない場合は、前年度値の修正（再算定）か解析ミスのいずれかであり、自動反映できない。
 */
function priorYearMismatches(parsed) {
  const prev = loadArchiveFinance(parsed.fiscalYear - 1);
  if (!prev) return [];
  const mismatches = [];
  for (const [key, field, label] of [
    ["realDebtServiceRatio", "realDebtServiceRatioPercent", "実質公債費比率"],
    ["futureBurdenRatio", "futureBurdenRatioPercent", "将来負担比率"],
  ]) {
    const prior = parsed.priorYear[key];
    if (prior != null && prev[field] != null && prior !== prev[field]) {
      mismatches.push(`${label}の前年度値がページ（${prior}%）と登録済みデータ（${prev[field]}%）で一致しません`);
    }
  }
  return mismatches;
}

/** 本番データ（読み取り専用）financeDashboard.jsonのdebtBalanceTrend出典から、財政状況資料集の既知最新年度を取得する。 */
function loadKnownLatestFiscalMaterialsYear() {
  const dash = JSON.parse(readFileSync(FINANCE_DASHBOARD_PATH, "utf8"));
  const source = (dash.sources ?? []).find((s) => s.section === "debtBalanceTrend");
  if (!source) return null;
  const matches = [...(source.title ?? "").matchAll(/令和(\d+)年度版/g)];
  if (matches.length === 0) return null;
  return Math.max(...matches.map((m) => Number(m[1]) + REIWA_ERA_OFFSET));
}

/** 年度別一覧ページ（優先度1・2・3補助）に共通の判定ロジック。 */
async function evaluateYearIndexTarget({ url, sourceType, linkPattern, knownLatestYear, stateKey, state }) {
  let buffer;
  try {
    buffer = await fetchCitySiteBuffer(url);
  } catch (e) {
    return { fetchError: e.message, url };
  }
  const html = buffer.toString("utf8");
  const contentText = extractMainContentText(html);
  const contentHash = sha256OfBufferForDiff(Buffer.from(contentText, "utf8"));
  const previousHash = state[stateKey]?.contentHash ?? null;

  const links = extractLinks(html);
  const { matched, latest, duplicateAtLatest } = findLatestYearLink(links, linkPattern);

  if (matched.length === 0) {
    return {
      url,
      sourceType,
      contentHash,
      schemaValid: false,
      schemaErrors: [`年度リンクパターン（${linkPattern}）に一致するリンクが0件でした（ページ構造変化の可能性）`],
      outcome: "error",
      anomalyDetected: false,
    };
  }

  if (duplicateAtLatest) {
    return {
      url,
      sourceType,
      contentHash,
      schemaValid: true,
      schemaErrors: [],
      outcome: "error",
      anomalyDetected: true,
      anomalyReason: `最新年度（令和${latest.reiwaYear}年度）に対応するリンクが異なるURLで複数検出されました（年度重複の疑い）`,
      detectedLatestYear: latest.gregorianYear,
      latestUrl: resolveUrl(latest.href, url),
    };
  }

  if (knownLatestYear != null && latest.gregorianYear < knownLatestYear) {
    return {
      url,
      sourceType,
      contentHash,
      schemaValid: true,
      schemaErrors: [],
      outcome: "error",
      anomalyDetected: true,
      anomalyReason: `検出された最新年度（${latest.gregorianYear}）が本番データの既知最新年度（${knownLatestYear}）より古い（解析ミスの可能性）`,
      detectedLatestYear: latest.gregorianYear,
      latestUrl: resolveUrl(latest.href, url),
    };
  }

  let outcome;
  if (knownLatestYear == null || latest.gregorianYear > knownLatestYear) {
    outcome = "new";
  } else if (previousHash !== null && previousHash !== contentHash) {
    outcome = "updated";
  } else {
    outcome = "unchanged";
  }

  return {
    url,
    sourceType,
    contentHash,
    schemaValid: true,
    schemaErrors: [],
    outcome,
    anomalyDetected: false,
    detectedLatestYear: latest.gregorianYear,
    latestUrl: resolveUrl(latest.href, url),
    knownLatestYear,
    linkCount: matched.length,
  };
}

/** バイナリ資料（PDF等）のハッシュのみを監視する（内容抽出はしない＝常にYELLOW扱い）。 */
async function evaluateBinaryHashTarget({ url, sourceType, stateKey, state }) {
  let buffer;
  try {
    buffer = await fetchCitySiteBuffer(url);
  } catch (e) {
    return { fetchError: e.message, url };
  }
  const contentHash = sha256OfBuffer(buffer);
  const previousHash = state[stateKey]?.contentHash ?? null;
  const outcome = previousHash === null ? "new" : previousHash === contentHash ? "unchanged" : "updated";
  return { url, sourceType, contentHash, schemaValid: true, schemaErrors: [], outcome, anomalyDetected: false };
}

const BUDGET_REVISIONS_PATH = join(ROOT, "src", "data", "budgetRevisions.json");

/**
 * 年度の予算ページから、企業会計等の別ページ（リンク文言「掲載はこちら」、同一ホストのHTML）を探す。
 * 令和8年度は「企業会計 掲載はこちら」→ soshiki/55/48610.html（水道・下水道の予算書）。
 */
function findSubListingUrls(html, baseUrl) {
  return extractLinks(html)
    .filter((l) => l.text.includes("掲載はこちら") && /\.html$/.test(l.href))
    .map((l) => resolveUrl(l.href, baseUrl))
    .filter((u, i, arr) => arr.indexOf(u) === i && new URL(u).host === new URL(baseUrl).host);
}

async function evaluateBudgetListingPage(url, fiscalYear, startedAt, { sourceType: sourceTypeOverride, collectSubListings = false } = {}) {
  const sourceType = sourceTypeOverride ?? "年度の予算ページ（延岡市公式、当初予算・補正予算の資料一覧。段階ごとの登録漏れ検知）";
  let html;
  let status = null;
  try {
    const buffer = await fetchCitySiteBuffer(url);
    html = buffer.toString("utf8");
    status = 200;
  } catch (e) {
    const result = classifyItem({
      schemaValid: true,
      schemaErrors: [],
      outcome: "error",
      isOfficialPrimarySource: true,
      reachable: false,
      httpStatus: null,
      requiresHumanReview: true,
      humanReviewReason: `取得失敗: ${e.message}`,
      anomalyDetected: false,
    });
    return {
      sourceUrl: url,
      sourceType,
      sessionId: null,
      outcome: "error",
      lastCheckedAt: startedAt,
      httpStatus: null,
      contentHash: null,
      parserVersion: PARSER_VERSION,
      extractionStatus: `fetch_failed: ${e.message}`,
      validationStatus: "schema_invalid",
      validationErrors: [e.message],
      level: result.level,
      reason: result.reason,
    };
  }
  const links = extractLinks(html).map((l) => ({ text: l.text, url: resolveUrl(l.href, url) }));
  const revisions = JSON.parse(readFileSync(BUDGET_REVISIONS_PATH, "utf8"));
  const registeredUrls = new Set(revisions.flatMap((r) => r.sources.map((s) => s.url)));
  const { stages, unregistered, duplicates } = classifyBudgetListing(links, registeredUrls);
  const structureBroken = stages.length === 0;
  const outcome = structureBroken ? "error" : unregistered.length > 0 ? "new" : "unchanged";
  const validation = validateEntry(
    { sourceUrl: url, outcome },
    { allowedHosts: CITY_SITE_ALLOWED_HOSTS, requireSessionId: false, requiredFields: ["outcome"] },
  );
  const result = classifyItem({
    schemaValid: validation.valid && !structureBroken,
    schemaErrors: structureBroken ? ["資料リンク（「○○（概要書）」「○○（予算書）」）が1件も見つかりませんでした（ページ構造変化の可能性）"] : validation.errors,
    outcome,
    isOfficialPrimarySource: true,
    reachable: true,
    httpStatus: status,
    requiresHumanReview: outcome === "new",
    humanReviewReason:
      outcome === "new"
        ? `budgetRevisions.json に未登録の段階を検出：${unregistered.map((s) => `${s.stageLabel}（${s.kind}${s.round > 1 ? `・${s.round}次分` : ""}・${s.accountScope}）`).join("、")}。概要書・予算書を開いて補正前・補正額・補正後・議案番号を確認してから登録すること。`
        : undefined,
    // 同じ段階・同じ資料種別に別のPDFが複数ある場合は差し替え・重複掲載の疑い（誤った資料を登録しないためRED）。
    anomalyDetected: duplicates.length > 0,
    anomalyReason:
      duplicates.length > 0
        ? `同じ段階に同じ種類の資料が複数掲載されています（重複・差し替えの疑い）：${duplicates.map((s) => s.stageLabel).join("、")}`
        : undefined,
  });
  const subListingUrls = collectSubListings ? findSubListingUrls(html, url) : [];
  return {
    subListingUrls,
    sourceUrl: url,
    sourceType,
    sessionId: null,
    outcome,
    lastCheckedAt: startedAt,
    httpStatus: status,
    contentHash: sha256OfBufferForDiff(Buffer.from(stages.map((s) => `${s.stageLabel}:${s.documents.map((d) => d.url).join(",")}`).join("|"), "utf8")),
    parserVersion: PARSER_VERSION,
    extractionStatus: `年度=${fiscalYear ?? "不明"} 段階=${stages.length}件（未登録${unregistered.length}件）`,
    validationStatus: validation.valid && !structureBroken ? "schema_valid" : "schema_invalid",
    validationErrors: validation.errors,
    level: result.level,
    reason: result.reason,
    // 人間確認用の候補。数値は資料を開いて確認するまで入れない（null）。
    ...(unregistered.length > 0
      ? {
          updateCandidates: unregistered.map((s) => ({
            fiscalYear,
            label: s.stageLabel,
            documents: s.documents,
            beforeThousandYen: null,
            supplementaryThousandYen: null,
            afterThousandYen: null,
            billNumber: null,
          })),
        }
      : {}),
  };
}

function formatExtracted(ratio) {
  if (!ratio) return "抽出失敗";
  const current = ratio.current === null ? "該当なし" : `${ratio.current}%`;
  return ratio.prior === null ? current : `${current}(前年度${ratio.prior}%)`;
}

/** 優先度3：健全化判断比率の実数値抽出＋異常値検知（本文の平文記載を利用、OCR不要）。 */
function detectRatioAnomaly(ratio, label, { max = 60 } = {}) {
  if (!ratio) {
    return { anomalyDetected: true, severity: "RED", reason: `${label}の数値を本文から抽出できませんでした（空値への上書き、またはページ構造変化の疑い）` };
  }
  // 当年が「該当なし」（―）の場合は比率が算定されていないため、範囲・変動幅の判定対象外。
  if (ratio.current === null) return { anomalyDetected: false };
  // 範囲の上限は指標ごとに変える（将来負担比率は市町村の早期健全化基準が350%で、過去に142.5%の年度もある）。
  if (ratio.current < -10 || ratio.current > max) {
    return { anomalyDetected: true, severity: "RED", reason: `${label}が想定範囲外の値です（${ratio.current}%、制度上想定される範囲を大きく外れている）` };
  }
  // 前年度が「該当なし」だった年はページに前年度比較が無い（prior===null）ため、変動幅は判定しない。
  if (ratio.prior === null) return { anomalyDetected: false };
  const pointDiff = Math.abs(ratio.current - ratio.prior);
  if (pointDiff >= 40) {
    return { anomalyDetected: true, severity: "RED", reason: `${label}が前年度から${pointDiff.toFixed(1)}ポイント変動（極端な変化のため自動反映不可）` };
  }
  if (pointDiff >= 10) {
    return { anomalyDetected: true, severity: "YELLOW", reason: `${label}が前年度から${pointDiff.toFixed(1)}ポイント変動（要人間確認）` };
  }
  return { anomalyDetected: false };
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[update-finance] 開始: ${startedAt}`);

  const state = loadLocalState();
  const knownLatestBudgetYear = loadKnownLatestBudgetYear();
  const knownLatestSettlementYear = loadKnownLatestSettlementYear();
  const knownLatestFiscalMaterialsYear = loadKnownLatestFiscalMaterialsYear();
  log("[update-finance] 既知最新年度:", { knownLatestBudgetYear, knownLatestSettlementYear, knownLatestFiscalMaterialsYear });

  const entries = [];
  let circuitBreakerNewCount = 0;
  const nextState = { ...state };

  function pushEntryFromIndexResult(r, { requireYellowOnUpdated = true } = {}) {
    if (r.fetchError) {
      const result = classifyItem({
        schemaValid: true,
        schemaErrors: [],
        outcome: "error",
        isOfficialPrimarySource: true,
        reachable: false,
        httpStatus: null,
        requiresHumanReview: true,
        humanReviewReason: `取得失敗: ${r.fetchError}`,
        anomalyDetected: false,
      });
      entries.push({
        sourceUrl: r.url,
        sourceType: "財政課ページ（延岡市公式）",
        sessionId: null,
        outcome: "error",
        lastCheckedAt: startedAt,
        httpStatus: null,
        contentHash: null,
        parserVersion: PARSER_VERSION,
        extractionStatus: `fetch_failed: ${r.fetchError}`,
        validationStatus: "schema_invalid",
        validationErrors: [r.fetchError],
        level: result.level,
        reason: result.reason,
      });
      return;
    }

    const validation = validateEntry(
      { sourceUrl: r.url, outcome: r.outcome },
      { allowedHosts: CITY_SITE_ALLOWED_HOSTS, requireSessionId: false, requiredFields: ["outcome"] },
    );
    const schemaValid = r.schemaValid && validation.valid;
    const schemaErrors = [...r.schemaErrors, ...validation.errors];

    if (r.outcome === "new") circuitBreakerNewCount += 1;
    const requiresHumanReview = r.outcome === "new" || (r.outcome === "updated" && requireYellowOnUpdated);

    const result = classifyItem({
      schemaValid,
      schemaErrors,
      outcome: r.outcome,
      isOfficialPrimarySource: true,
      reachable: true,
      httpStatus: 200,
      requiresHumanReview,
      humanReviewReason:
        r.outcome === "new"
          ? `新しい年度（${r.detectedLatestYear}年度）の資料公開を検出。既存年度を書き換えず、新しいエントリとして追加する候補（人間確認が必要）。リンク先: ${r.latestUrl}`
          : r.outcome === "updated"
            ? `既知最新年度（${r.knownLatestYear}年度）のページ内容に変更を検出。既存年度の修正版の可能性があるため人間確認が必要。`
            : undefined,
      anomalyDetected: r.anomalyDetected,
      anomalyReason: r.anomalyReason,
    });

    entries.push({
      sourceUrl: r.url,
      sourceType: r.sourceType,
      sessionId: null,
      outcome: r.outcome,
      lastCheckedAt: startedAt,
      httpStatus: 200,
      contentHash: r.contentHash,
      parserVersion: PARSER_VERSION,
      extractionStatus:
        r.detectedLatestYear != null
          ? `検出最新年度=${r.detectedLatestYear}（既知=${r.knownLatestYear ?? "未登録"}）／年度リンク${r.linkCount ?? 0}件`
          : r.anomalyReason ?? "年度リンク検出失敗",
      validationStatus: schemaValid ? "schema_valid" : "schema_invalid",
      validationErrors: schemaErrors,
      level: result.level,
      reason: result.reason,
    });
  }

  // A) 当初予算資料の新年度検知（優先度1）
  const budgetResult = await evaluateYearIndexTarget({
    url: BUDGET_INDEX_URL,
    sourceType: "財政課トップページ（延岡市公式、当初予算資料の新年度検知）",
    linkPattern: /令和(\d+)年度予算/,
    knownLatestYear: knownLatestBudgetYear,
    stateKey: "budgetIndex",
    state,
  });
  pushEntryFromIndexResult(budgetResult);
  if (!budgetResult.fetchError) nextState.budgetIndex = { contentHash: budgetResult.contentHash, lastCheckedAt: startedAt };

  // F) Phase261：年度の予算ページ（例：令和8年度予算 48542.html）に掲載された当初予算・補正予算・専決処分等の
  //    資料リンクを「段階名」ごとにまとめ、budgetRevisions.json に未登録の段階を検出する。
  //    9月補正と9月補正（2次分）のように同じ月に複数の補正があっても、段階名（リンク文言）で区別するため
  //    上書き・取り違えは起きない。資料の中身（PDF）は開かない＝新しい段階は必ずYELLOW（人が概要書と照合して登録）。
  if (!budgetResult.fetchError && budgetResult.latestUrl) {
    const { subListingUrls, ...listingEntry } = await evaluateBudgetListingPage(budgetResult.latestUrl, budgetResult.detectedLatestYear, startedAt, {
      collectSubListings: true,
    });
    entries.push(listingEntry);
    // Phase265：企業会計（水道・下水道）の予算書は別ページに掲載されるため、1階層だけたどって同じ判定を行う。
    for (const subUrl of subListingUrls) {
      const { subListingUrls: _ignored, ...subEntry } = await evaluateBudgetListingPage(subUrl, budgetResult.detectedLatestYear, startedAt, {
        sourceType: "年度の予算ページからリンクされた資料一覧（延岡市公式、企業会計等の予算書。段階ごとの登録漏れ検知）",
      });
      entries.push(subEntry);
    }
  }

  // B) 決算資料（健全化判断比率）の新年度検知（優先度2）
  const settlementResult = await evaluateYearIndexTarget({
    url: SETTLEMENT_RATIO_INDEX_URL,
    sourceType: "健全化判断比率 年度別一覧ページ（延岡市公式、決算資料の新年度検知）",
    linkPattern: /令和(\d+)年度健全化判断比率等の公表/,
    knownLatestYear: knownLatestSettlementYear,
    stateKey: "settlementIndex",
    state,
  });
  pushEntryFromIndexResult(settlementResult);
  if (!settlementResult.fetchError) nextState.settlementIndex = { contentHash: settlementResult.contentHash, lastCheckedAt: startedAt };

  // C) Bで見つかった最新年度個別ページから、実質公債費比率・将来負担比率の実数値を抽出（優先度3）
  if (!settlementResult.fetchError && settlementResult.latestUrl) {
    const detailUrl = settlementResult.latestUrl;
    const allowedHosts = new Set([new URL(detailUrl).host]);
    try {
      const res = await fetchWithRetry(detailUrl, { allowedHosts, maxRetries: 2 });
      const buf = Buffer.from(await res.arrayBuffer());
      const contentHash = sha256OfBufferForDiff(buf);
      // Phase260：表（5指標・法定基準・資金不足比率）と本文の定型文を共通パーサーで読む。
      // 表と本文の値の食い違い・行の欠落・年度の読み取り失敗は parsed.errors に入り、RED（自動反映不可）にする。
      const parsed = parseSoundnessRatioPage(buf.toString("utf8"));
      const ratioOf = (key) => {
        const r = parsed.ratios[key];
        if (!r) return null;
        return { current: r.percent, prior: parsed.priorYear[key] ?? null };
      };
      const realDebtServiceRatio = ratioOf("realDebtServiceRatio");
      const futureBurdenRatio = ratioOf("futureBurdenRatio");

      const anomalyA = detectRatioAnomaly(realDebtServiceRatio, "実質公債費比率");
      const anomalyB = detectRatioAnomaly(futureBurdenRatio, "将来負担比率", { max: 400 });
      const structuralProblems = [...parsed.errors];
      if (parsed.fiscalYear !== null && parsed.fiscalYear !== settlementResult.detectedLatestYear) {
        structuralProblems.push(
          `一覧ページのリンク年度（${settlementResult.detectedLatestYear}）と個別ページ本文の年度（${parsed.fiscalYear}）が一致しません`,
        );
      }
      if (parsed.fiscalYear !== null && parsed.errors.length === 0) structuralProblems.push(...priorYearMismatches(parsed));
      const anomalies = [
        anomalyA,
        anomalyB,
        ...structuralProblems.map((reason) => ({ anomalyDetected: true, severity: "RED", reason: `${reason}（誤った数値を自動反映しないため要確認）` })),
      ].filter((a) => a.anomalyDetected);
      const redAnomaly = anomalies.find((a) => a.severity === "RED");
      const yellowAnomaly = anomalies.find((a) => a.severity === "YELLOW");

      // outcomeはローカルの前回ハッシュではなく、本番データ（archiveFiscalYears.json、読み取り専用）の
      // 既存登録値と比較して決める（初回実行でも「本番に既に反映済みか」を正しく判定できるため）。
      let outcome;
      if (settlementResult.outcome === "new") {
        outcome = "new"; // Bの年度別一覧で新年度と判定済み（同一の新年度イベント）。
      } else {
        const known = parsed.fiscalYear !== null ? loadArchiveFinance(parsed.fiscalYear) : null;
        outcome = parsed.errors.length === 0 && soundnessMatchesProduction(parsed, known) ? "unchanged" : "updated";
      }
      if (outcome === "new") circuitBreakerNewCount += 1;
      // 新年度・内容変化があり、構造上の問題も無い場合だけ、人間確認用の更新候補を作る（本番データへは書かない）。
      const updateCandidate =
        outcome !== "unchanged" && !redAnomaly && parsed.fiscalYear !== null ? buildSoundnessCandidate(parsed, detailUrl, startedAt.slice(0, 10)) : null;

      const validation = validateEntry(
        { sourceUrl: detailUrl, outcome },
        { allowedHosts: CITY_SITE_ALLOWED_HOSTS, requireSessionId: false, requiredFields: ["outcome"] },
      );

      const result = classifyItem({
        schemaValid: validation.valid,
        schemaErrors: validation.errors,
        outcome,
        isOfficialPrimarySource: true,
        reachable: res.ok,
        httpStatus: res.status,
        requiresHumanReview: outcome !== "unchanged",
        humanReviewReason:
          outcome === "updated"
            ? "公表ページの内容が登録済みデータと一致しない（数値修正の可能性）ため人間確認が必要。"
            : outcome === "new"
              ? "新しい年度の健全化判断比率を検出。updateCandidateを公式ページと照合してからarchiveFiscalYears.jsonへ追加すること。"
              : undefined,
        anomalyDetected: Boolean(redAnomaly),
        anomalyReason: redAnomaly?.reason,
      });
      let level = result.level;
      let reason = result.reason;
      // Phase255：前年度比の大きな変動（YELLOW）は「公表値が既存データと一致しているか」で扱いを分ける。
      // この変動幅はページに公表されている数値そのものから計算されるため、資料が更新されていなくても
      // 毎回同じ値になる。実際、令和6年度の将来負担比率15.9%（前年度2.1%）は既にfinanceDashboard.jsonへ
      // 登録済み＝人が一次資料と突き合わせて確認済みであるにもかかわらず、毎回YELLOWが立ち続けていた。
      // 毎回鳴る通知は「変化があったときの通知」として機能しないため、outcome==="unchanged"
      // （＝公表値が登録済みの値と一致し、ページも新年度ではない）の場合はGREENのままにし、
      // 変動の事実は reason へ記録するだけにする。新年度・値の変化・RED異常は従来どおり検出する。
      const ratioAlreadyConfirmed = outcome === "unchanged";
      if (!redAnomaly && yellowAnomaly && level === "GREEN" && !ratioAlreadyConfirmed) {
        level = "YELLOW";
        reason = yellowAnomaly.reason;
      } else if (!redAnomaly && yellowAnomaly && level === "GREEN" && ratioAlreadyConfirmed) {
        reason = `${reason}／${yellowAnomaly.reason}（公表値は登録済みの値と一致するため確認済みとして扱う）`;
      } else if (anomalies.length > 0) {
        reason = `${reason}／${anomalies.map((a) => a.reason).join("／")}`;
      }

      entries.push({
        sourceUrl: detailUrl,
        sourceType: "健全化判断比率 個別年度ページ（延岡市公式、5指標・法定基準・資金不足比率）",
        sessionId: null,
        outcome,
        lastCheckedAt: startedAt,
        httpStatus: res.status,
        contentHash,
        parserVersion: PARSER_VERSION,
        extractionStatus: `年度=${parsed.fiscalYear ?? "読取失敗"} 実質公債費比率=${formatExtracted(realDebtServiceRatio)} 将来負担比率=${formatExtracted(futureBurdenRatio)} 資金不足比率の会計=${parsed.fundShortageRatios.length}件`,
        validationStatus: validation.valid && parsed.errors.length === 0 ? "schema_valid" : "schema_invalid",
        validationErrors: [...validation.errors, ...parsed.errors],
        level,
        reason,
        ...(updateCandidate ? { updateCandidate } : {}),
      });
      nextState.settlementDetail = { contentHash, lastCheckedAt: startedAt };
    } catch (e) {
      const result = classifyItem({
        schemaValid: true,
        schemaErrors: [],
        outcome: "error",
        isOfficialPrimarySource: true,
        reachable: false,
        httpStatus: null,
        requiresHumanReview: true,
        humanReviewReason: `取得失敗: ${e.message}`,
        anomalyDetected: false,
      });
      entries.push({
        sourceUrl: detailUrl,
        sourceType: "健全化判断比率 個別年度ページ（延岡市公式）",
        sessionId: null,
        outcome: "error",
        lastCheckedAt: startedAt,
        httpStatus: null,
        contentHash: null,
        parserVersion: PARSER_VERSION,
        extractionStatus: `fetch_failed: ${e.message}`,
        validationStatus: "schema_invalid",
        validationErrors: [e.message],
        level: result.level,
        reason: result.reason,
      });
    }
  }

  // D) 財政状況資料集（xlsx、市債・基金の元資料）の新年度検知（優先度3の補助、xlsx内容は開かない）
  const materialsResult = await evaluateYearIndexTarget({
    url: FISCAL_MATERIALS_INDEX_URL,
    sourceType: "財政状況資料集 年度別一覧ページ（延岡市公式、xlsx。市債・基金等の元資料の新年度検知。内容は未抽出）",
    linkPattern: /令和(\d+)年度財政状況資料集/,
    knownLatestYear: knownLatestFiscalMaterialsYear,
    stateKey: "fiscalMaterialsIndex",
    state,
  });
  // xlsxの中身は開かない方針のため、new/updatedであっても常にYELLOW（GREEN自動確定にはしない）。
  // 「変更なし」の場合はpushEntryFromIndexResult内のclassifyItemが通常通りGREENと判定する。
  pushEntryFromIndexResult(materialsResult, { requireYellowOnUpdated: true });
  if (!materialsResult.fetchError) nextState.fiscalMaterialsIndex = { contentHash: materialsResult.contentHash, lastCheckedAt: startedAt };

  // E) 基金・財政状況PDF（本市の財政状況について）のハッシュ監視のみ（内容抽出はしない＝OCR資料と同様にYELLOW方針）
  const fundResult = await evaluateBinaryHashTarget({
    url: FUND_POLICY_PDF_URL,
    sourceType: "本市の財政状況について（延岡市公式PDF、基金残高等。内容は未抽出のため変更検知のみ）",
    stateKey: "fundPolicyPdf",
    state,
  });
  if (fundResult.fetchError) {
    const result = classifyItem({
      schemaValid: true,
      schemaErrors: [],
      outcome: "error",
      isOfficialPrimarySource: true,
      reachable: false,
      httpStatus: null,
      requiresHumanReview: true,
      humanReviewReason: `取得失敗: ${fundResult.fetchError}`,
      anomalyDetected: false,
    });
    entries.push({
      sourceUrl: FUND_POLICY_PDF_URL,
      sourceType: "本市の財政状況について（延岡市公式PDF）",
      sessionId: null,
      outcome: "error",
      lastCheckedAt: startedAt,
      httpStatus: null,
      contentHash: null,
      parserVersion: PARSER_VERSION,
      extractionStatus: `fetch_failed: ${fundResult.fetchError}`,
      validationStatus: "schema_invalid",
      validationErrors: [fundResult.fetchError],
      level: result.level,
      reason: result.reason,
    });
  } else {
    if (fundResult.outcome === "new") circuitBreakerNewCount += 1;
    const validation = validateEntry(
      { sourceUrl: FUND_POLICY_PDF_URL, outcome: fundResult.outcome },
      { allowedHosts: CITY_SITE_ALLOWED_HOSTS, requireSessionId: false, requiredFields: ["outcome"] },
    );
    // PDFは内容未抽出のため、new/updatedはOCR要資料と同様に必ずYELLOW（人間確認）とする。
    const result = classifyItem({
      schemaValid: validation.valid,
      schemaErrors: validation.errors,
      outcome: fundResult.outcome,
      isOfficialPrimarySource: true,
      reachable: true,
      httpStatus: 200,
      requiresHumanReview: fundResult.outcome === "new" || fundResult.outcome === "updated",
      humanReviewReason:
        fundResult.outcome !== "unchanged"
          ? "PDF本文の内容抽出は行っていないため、変更検知後は人間がPDFを開いて内容を確認する必要がある。"
          : undefined,
      anomalyDetected: false,
    });
    entries.push({
      sourceUrl: FUND_POLICY_PDF_URL,
      sourceType: "本市の財政状況について（延岡市公式PDF、基金残高等。内容は未抽出のため変更検知のみ）",
      sessionId: null,
      outcome: fundResult.outcome,
      lastCheckedAt: startedAt,
      httpStatus: 200,
      contentHash: fundResult.contentHash,
      parserVersion: PARSER_VERSION,
      extractionStatus: `contentHashのみ監視（PDF本文抽出なし）`,
      validationStatus: validation.valid ? "schema_valid" : "schema_invalid",
      validationErrors: validation.errors,
      level: result.level,
      reason: result.reason,
    });
    nextState.fundPolicyPdf = { contentHash: fundResult.contentHash, lastCheckedAt: startedAt };
  }

  saveLocalState(nextState);

  const summary = {
    detected: entries.length,
    green: entries.filter((e) => e.level === "GREEN").length,
    yellow: entries.filter((e) => e.level === "YELLOW").length,
    red: entries.filter((e) => e.level === "RED").length,
    error: 0,
  };

  const circuitBreaker = checkCircuitBreaker({
    target: TARGET,
    newCount: circuitBreakerNewCount,
    updatedCount: 0,
    removedCandidateCount: 0,
    detectedTotal: entries.length,
    previousKnownTotal: 6, // 監視対象resourceの最低件数（A〜F）。予算ページからリンクされた資料一覧の分は年度により増える。
  });

  const overallLevel = circuitBreaker.tripped ? "RED" : summary.red > 0 ? "RED" : summary.yellow > 0 ? "YELLOW" : "GREEN";

  const report = {
    target: TARGET,
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: true,
    watchedSource: BUDGET_INDEX_URL,
    baseScriptExitCode: 0,
    overallLevel,
    summary,
    entries,
    circuitBreakerTripped: circuitBreaker.tripped,
    circuitBreakerReason: circuitBreaker.reason,
    note:
      "dryRun=trueのため、本番データ（src/data/archiveFiscalYears.json・src/data/financeDashboard.json等）への" +
      "書き込みは一切行っていない。新しい年度の資料公開を検出した場合も、既存年度の書き換えではなく" +
      "新規エントリ追加の候補として報告するのみで、自動反映は行わない。PDF・xlsxの本文内容は抽出していない" +
      "（HTMLページのリンクテキスト・本文平文の年度検知・数値抽出のみ）。",
  };

  const outPath = writeRunReport(report);
  const status = updateStatus(TARGET, report);

  console.log(
    `[update-finance] 検出=${summary.detected} GREEN=${summary.green} YELLOW=${summary.yellow} RED=${summary.red} ` +
      `総合判定=${overallLevel} サーキットブレーカー=${circuitBreaker.tripped ? "発動" : "正常"} 連続正常実行=${status.consecutiveSuccessfulRuns}`,
  );
  console.log(`[update-finance] レポート書き出し: ${outPath}`);
  process.exitCode = summary.red > 0 ? 1 : 0;
}

main();
