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
 *   C) Bで見つかった最新年度の個別ページ（現状 44461.html。archiveCrawlerTargets.jsonの
 *      id="finance"と同一URL）を core/fetch.mjs の fetchWithRetry で動的に取得し
 *      （bills/update-bills.mjsのprobeNewDocumentと同じ「動的に見つかった資料をcore/fetch.mjsで
 *      確認する」設計）、本文に明記された実質公債費比率・将来負担比率の実数値と前年度比較値を
 *      抽出する（優先度3：市債・基金等の明確な数値。OCR不要、HTML本文に平文で記載されている）。
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

/** 本番データ（読み取り専用）financeDashboard.jsonから、健全化判断比率の既知最新決算年度を取得する。 */
function loadKnownLatestSettlementYear() {
  const dash = JSON.parse(readFileSync(FINANCE_DASHBOARD_PATH, "utf8"));
  const label = dash.financialIndicators?.fiscalYearLabel ?? "";
  const m = label.match(/令和(\d+)年度/);
  return m ? Number(m[1]) + REIWA_ERA_OFFSET : null;
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

/**
 * 本文中の「{label}は{値}%で、前年度({前年値}%)と比較すると」という定型文から、
 * 当年値・前年値を抽出する（延岡市「健全化判断比率等の公表」ページの実際の文面パターン）。
 */
function extractRatioWithPriorYear(text, label) {
  const i = text.indexOf(`${label}は`);
  if (i === -1) return null;
  const window = text.slice(i, i + 100);
  const m = window.match(/は([-0-9.]+)[%％][^\d]*?前年度\(([-0-9.]+)/);
  if (!m) return null;
  return { current: Number(m[1]), prior: Number(m[2]) };
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

/** 優先度3：健全化判断比率の実数値抽出＋異常値検知（本文の平文記載を利用、OCR不要）。 */
function detectRatioAnomaly(ratio, label) {
  if (!ratio) {
    return { anomalyDetected: true, severity: "RED", reason: `${label}の数値を本文から抽出できませんでした（空値への上書き、またはページ構造変化の疑い）` };
  }
  if (ratio.current < -10 || ratio.current > 60) {
    return { anomalyDetected: true, severity: "RED", reason: `${label}が想定範囲外の値です（${ratio.current}%、制度上想定される範囲を大きく外れている）` };
  }
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
      const text = htmlToText(buf.toString("utf8"));
      const realDebtServiceRatio = extractRatioWithPriorYear(text, "実質公債費比率");
      const futureBurdenRatio = extractRatioWithPriorYear(text, "将来負担比率");

      const anomalyA = detectRatioAnomaly(realDebtServiceRatio, "実質公債費比率");
      const anomalyB = detectRatioAnomaly(futureBurdenRatio, "将来負担比率");
      const anomalies = [anomalyA, anomalyB].filter((a) => a.anomalyDetected);
      const redAnomaly = anomalies.find((a) => a.severity === "RED");
      const yellowAnomaly = anomalies.find((a) => a.severity === "YELLOW");

      // outcomeはローカルの前回ハッシュではなく、本番データ（financeDashboard.json、読み取り専用）の
      // 既存登録値と比較して決める（初回実行でも「本番に既に反映済みか」を正しく判定できるため）。
      let outcome;
      if (settlementResult.outcome === "new") {
        outcome = "new"; // Bの年度別一覧で新年度と判定済み（同一の新年度イベント）。
      } else {
        const dash = JSON.parse(readFileSync(FINANCE_DASHBOARD_PATH, "utf8"));
        const fi = dash.financialIndicators ?? {};
        const matchesProduction =
          realDebtServiceRatio &&
          futureBurdenRatio &&
          fi.realDebtServiceRatioPercent === realDebtServiceRatio.current &&
          fi.futureBurdenRatioPercent === futureBurdenRatio.current;
        outcome = matchesProduction ? "unchanged" : "updated";
      }
      if (outcome === "new") circuitBreakerNewCount += 1;

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
        requiresHumanReview: outcome === "updated",
        humanReviewReason: outcome === "updated" ? "同一年度ページの本文が変化（数値修正の可能性）のため人間確認が必要。" : undefined,
        anomalyDetected: Boolean(redAnomaly),
        anomalyReason: redAnomaly?.reason,
      });
      let level = result.level;
      let reason = result.reason;
      if (!redAnomaly && yellowAnomaly && level === "GREEN") {
        level = "YELLOW";
        reason = yellowAnomaly.reason;
      } else if (anomalies.length > 0) {
        reason = `${reason}／${anomalies.map((a) => a.reason).join("／")}`;
      }

      entries.push({
        sourceUrl: detailUrl,
        sourceType: "健全化判断比率 個別年度ページ（延岡市公式、実質公債費比率・将来負担比率の実数値）",
        sessionId: null,
        outcome,
        lastCheckedAt: startedAt,
        httpStatus: res.status,
        contentHash,
        parserVersion: PARSER_VERSION,
        extractionStatus: `実質公債費比率=${realDebtServiceRatio ? `${realDebtServiceRatio.current}%(前年度${realDebtServiceRatio.prior}%)` : "抽出失敗"} 将来負担比率=${futureBurdenRatio ? `${futureBurdenRatio.current}%(前年度${futureBurdenRatio.prior}%)` : "抽出失敗"}`,
        validationStatus: validation.valid ? "schema_valid" : "schema_invalid",
        validationErrors: validation.errors,
        level,
        reason,
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
    previousKnownTotal: 5, // 監視対象resourceは常に5件（A〜E）。
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
