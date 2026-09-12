#!/usr/bin/env node
/**
 * 自動更新パイプライン（Workstream D：財政・人口 のうち人口統計）。
 *
 * 【重要：既存資産の再利用】
 * 公式サイトへのHTTP取得（許可ドメイン制限・429/403/5xx処理・タイムアウト・SHA-256ハッシュ）は、
 * 既存の scripts/lib/city-site-fetch.mjs をそのままimportして使う。取得ロジック自体は
 * 一切再実装しない（.github/workflows/civic-archive-sync.yml・scripts/run-archive-crawler.mjsが
 * 財政・人口・基金の巡回で既に使っている、同じ低レベルヘルパー）。
 * xls（Excel形式）の解析も、package.jsonに既存の依存として入っている`xlsx`パッケージを
 * そのままimportして使う（scripts/lib/import-shared.mjsのreadTable()と同じライブラリ、
 * 独自のバイナリExcelパーサーは書かない）。
 * GREEN/YELLOW/RED判定・サーキットブレーカー・スキーマ検証・統一レポート出力は
 * core/classify.mjs・core/validate.mjs・core/report.mjsをそのまま使う（bills/update-bills.mjsと
 * 同じ構造）。
 *
 * 対象resource：
 *   - 人口・世帯数統計xls（src/data/archiveCrawlerTargets.jsonの id="population" と同一URL。
 *     「現住人口及び世帯数の推移」、月次データ。実際に公開されている列（年月・人口・男・女・世帯数）
 *     のみを読み取る。存在しない項目は取得しない）。
 *   - 出典URLは固定せず、公式「延岡市の統計」ページ（/soshiki/1/1364.html）から
 *     現住人口系列のExcelリンクを解決する（Phase249、resolve-population-source.mjs）。
 *     延岡市は統計ファイルを更新するたびに添付ファイルIDを変え、古いIDを404にするため、
 *     IDを固定すると差し替えのたびにパイプラインが止まる。一覧ページ側が壊れた場合は
 *     既知URL（PINNED_POPULATION_XLS_URL）へフォールバックする。
 *     404・301/302・ファイル差し替え・添付ID変更・HTML誤認・古い版への逆戻りを検出する。
 *
 * 判定方針（新しい期間の追加を原則とする）：
 *   - xlsの最新行（人口>0の最終行）の基準日が、本番データ（src/data/archiveFiscalYears.json、
 *     読み取り専用）に登録済みの最新基準日より新しい → outcome="new"（新しい月を追加する候補）。
 *   - 基準日が同じで値が異なる → outcome="updated"（既存データの修正候補、必ずYELLOW以上）。
 *   - 基準日・値とも同じ → outcome="unchanged"。
 *   - 基準日が既存より古い → 解析ミスの疑いとして異常値扱い（RED）。
 *
 * 本番データ（src/data/*.json）は一切書き換えない。読み取り専用でarchiveFiscalYears.jsonを
 * 参照し、既存の最新値との比較にのみ使う。
 * 使い方: node scripts/auto-update/population/update-population.mjs [--verbose]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchCitySiteText, fetchCitySiteWithMeta, sha256OfBuffer, ALLOWED_HOSTS as CITY_SITE_ALLOWED_HOSTS } from "../../lib/city-site-fetch.mjs";
import { resolvePopulationSource, highestSeverity, PINNED_POPULATION_XLS_URL, POPULATION_STATS_PAGE_URL } from "./resolve-population-source.mjs";
import { fetchWithRetry } from "../core/fetch.mjs";
import { classifyItem, checkCircuitBreaker } from "../core/classify.mjs";
import { validateEntry } from "../core/validate.mjs";
import { writeRunReport, updateStatus, ROOT } from "../core/report.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = "population";
const PARSER_VERSION = "update-population.mjs@2026-09（出典URL自動解決対応）";
const verbose = process.argv.includes("--verbose");

// src/data/archiveCrawlerTargets.json の id="population" と同一URL（推測で新規URLを作らない）。
const POPULATION_XLS_URL = PINNED_POPULATION_XLS_URL;
// archiveCrawlerTargets.jsonのpopulation.notesに記載された、添付ファイルID変更時の確認起点ページ。
const POPULATION_STATS_FALLBACK_URL = POPULATION_STATS_PAGE_URL;

const ARCHIVE_FISCAL_YEARS_PATH = join(ROOT, "src", "data", "archiveFiscalYears.json");
const STATE_DIR = join(__dirname, "state");
const STATE_PATH = join(STATE_DIR, "population-state.json");

function log(...args) {
  if (verbose) console.log(...args);
}

function loadLocalState() {
  if (!existsSync(STATE_PATH)) return { population: null };
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { population: null };
  }
}

function saveLocalState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

/** 本番データ（読み取り専用）から、既に登録済みの最新人口エントリを取得する。 */
function loadProductionBaseline() {
  const years = JSON.parse(readFileSync(ARCHIVE_FISCAL_YEARS_PATH, "utf8"));
  let latest = null;
  for (const y of years) {
    const p = y.population;
    if (!p || p.population == null || !p.referenceDate) continue;
    if (!latest || p.referenceDate > latest.referenceDate) {
      latest = { referenceDate: p.referenceDate, population: p.population, households: p.households ?? null, fiscalYear: y.fiscalYear };
    }
  }
  return latest;
}

const REIWA_ERA_OFFSET = 2018; // 令和1年 = 2019年

/**
 * 「現住人口及び世帯数の推移」xlsの実データ範囲から、人口が実際に記録された最終行を読み取る。
 * 列位置（実データを目視確認して固定）：
 *   col1=平成/令和年（年始の行にのみ記載）, col2=月日（例:"8月1日"）, col3=人口,
 *   col4=男, col6=女, col9=世帯数。
 * 年度末までの未到来月は人口=0のプレースホルダー行になっているため、人口>0の行のみを対象とする
 * （実際に公開されていない将来月のデータを0として扱わない＝空値への上書き防止）。
 */
function parsePopulationXls(buffer, XLSX) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  let latestIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (typeof r[3] === "number" && r[3] > 0 && typeof r[2] === "string" && /^\d{1,2}月\d{1,2}日$/.test(r[2])) {
      latestIdx = i;
    }
  }
  if (latestIdx === -1) {
    return { parsed: null, error: "人口>0かつ月日形式の行を検出できませんでした（シート構造が変化した可能性）" };
  }

  // 直近の行から遡って、年始（1月1日）行のcol1（元号年）を探す。
  let eraYearText = null;
  for (let i = latestIdx; i >= 0; i--) {
    if (typeof rows[i][1] === "string" && /^\d+年$/.test(rows[i][1])) {
      eraYearText = rows[i][1];
      break;
    }
  }
  if (!eraYearText) {
    return { parsed: null, error: "元号年（令和N年）の行を検出できませんでした" };
  }
  const reiwaYear = Number(eraYearText.replace("年", ""));
  const gregorianYear = reiwaYear + REIWA_ERA_OFFSET;

  const row = rows[latestIdx];
  const monthDayMatch = row[2].match(/^(\d{1,2})月(\d{1,2})日$/);
  const month = Number(monthDayMatch[1]);
  const day = Number(monthDayMatch[2]);
  const referenceDate = `${gregorianYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const population = row[3];
  const male = typeof row[4] === "number" ? row[4] : null;
  const female = typeof row[6] === "number" ? row[6] : null;
  const households = typeof row[9] === "number" ? row[9] : null;

  // 前年同月（12行前）の人口。シート内に存在しない場合はnull（推測しない）。
  const yoyRow = latestIdx - 12 >= 0 ? rows[latestIdx - 12] : null;
  const yoyPopulation = yoyRow && typeof yoyRow[3] === "number" && yoyRow[3] > 0 ? yoyRow[3] : null;

  return {
    parsed: { referenceDate, population, male, female, households, yoyPopulation, rowIndex: latestIdx },
    error: null,
  };
}

/** 異常値検知：人口前年比±20%以上→YELLOW、±50%以上・桁数異常・空値上書き・日付逆行→RED。 */
function detectAnomaly(live, baseline) {
  if (!live.population || live.population <= 0) {
    return { anomalyDetected: true, severity: "RED", reason: "取得した最新人口値が0または空値です（空値への上書きの疑いのため自動反映不可）" };
  }
  if (baseline) {
    if (live.referenceDate < baseline.referenceDate) {
      return {
        anomalyDetected: true,
        severity: "RED",
        reason: `取得した最新データの基準日(${live.referenceDate})が既存データ(${baseline.referenceDate})より古い（解析ミスの可能性）`,
      };
    }
    const liveDigits = String(Math.trunc(live.population)).length;
    const baseDigits = String(Math.trunc(baseline.population)).length;
    if (Math.abs(liveDigits - baseDigits) >= 2) {
      return {
        anomalyDetected: true,
        severity: "RED",
        reason: `桁数異常の疑い：既存値${baseline.population}（${baseDigits}桁）に対し新値${live.population}（${liveDigits}桁）。単位変更等の可能性`,
      };
    }
  }
  if (live.yoyPopulation) {
    const ratio = (live.population - live.yoyPopulation) / live.yoyPopulation;
    const pct = (ratio * 100).toFixed(1);
    if (Math.abs(ratio) >= 0.5) {
      return { anomalyDetected: true, severity: "RED", reason: `人口が前年同月比${pct}%変動（極端な変化のため自動反映不可）` };
    }
    if (Math.abs(ratio) >= 0.2) {
      return { anomalyDetected: true, severity: "YELLOW", reason: `人口が前年同月比${pct}%変動（±20%以上のため人間確認を推奨）` };
    }
  }
  return { anomalyDetected: false };
}

function determineOutcome(live, baseline) {
  if (!baseline) return "new"; // 本番側に既存の人口データが一切ない場合（通常は起こらない想定）。
  if (live.referenceDate > baseline.referenceDate) return "new";
  if (live.referenceDate === baseline.referenceDate) {
    return live.population === baseline.population ? "unchanged" : "updated";
  }
  return "error"; // 日付逆行（異常値として別途RED判定される）。
}

async function probeFallback() {
  const allowedHosts = new Set([new URL(POPULATION_STATS_FALLBACK_URL).host]);
  try {
    const res = await fetchWithRetry(POPULATION_STATS_FALLBACK_URL, { allowedHosts, maxRetries: 2 });
    return { httpStatus: res.status, reachable: res.ok, error: null };
  } catch (e) {
    return { httpStatus: null, reachable: false, error: e.message };
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[update-population] 開始: ${startedAt}`);

  const state = loadLocalState();
  const baseline = loadProductionBaseline();
  log("[update-population] 本番データの既知最新値:", baseline);

  // Phase249：固定の添付ファイルIDを直接叩くのをやめ、公式「延岡市の統計」ページから
  // 現住人口系列のExcelを解決する。IDが差し替わっても自動更新が止まらないようにするため。
  // 既知URL（PINNED_POPULATION_XLS_URL）は一覧ページ側が壊れたときのfallbackとしてのみ使う。
  const resolution = await resolvePopulationSource({
    fetchText: (url) => fetchCitySiteText(url),
    fetchBinary: async (url) => {
      const meta = await fetchCitySiteWithMeta(url);
      return { buffer: meta.buffer, finalUrl: meta.finalUrl };
    },
    pinnedUrl: POPULATION_XLS_URL,
    statsPageUrl: POPULATION_STATS_FALLBACK_URL,
    baselineReferenceDate: baseline?.referenceDate ?? null,
    // Phase255：まず一覧ページの表記から最新基準日だけを確認し、既存データと同じで
    // 出典URLも変わっていなければExcelを取得しない（差分方式）。基準日が新しくなった場合や
    // 添付ファイルIDが変わった場合は従来どおり取得して全項目を検証する。
    skipDownloadWhenUnchanged: true,
  });
  const resolvedUrl = resolution.resolvedUrl ?? POPULATION_XLS_URL;
  const resolutionSeverity = highestSeverity(resolution.issues);
  for (const issue of resolution.issues) {
    console.log(`[update-population] [${issue.severity}] ${issue.code}: ${issue.message}`);
  }
  log("[update-population] 出典URL解決:", {
    resolvedUrl,
    resolvedFrom: resolution.resolvedFrom,
    label: resolution.linkLabel,
    labelReferenceDate: resolution.labelReferenceDate,
    diagnostics: resolution.diagnostics,
  });

  const fetchResult = resolution.ok
    ? { buffer: resolution.buffer, error: null }
    : {
        buffer: null,
        error: resolution.issues
          .filter((i) => i.severity === "RED")
          .map((i) => `${i.code}: ${i.message}`)
          .join(" / ") || "出典URLを解決できませんでした",
      };

  const entries = [];
  let circuitBreakerNewCount = 0;

  if (resolution.downloadSkipped) {
    // Phase255：一覧ページの最新基準日が既存データと同じで、出典URLも変わっていない。
    // このときExcelの中身は既存データと同じであることが確定しているため、取得・解析せずに
    // 「変更なし」として終了する（毎回26年度分を読み直さない差分方式）。
    // ローカル状態（contentHash）は取得していないので更新しない＝次に取得したときに正しく比較できる。
    const validation = validateEntry(
      { sourceUrl: resolvedUrl, outcome: "unchanged" },
      { allowedHosts: CITY_SITE_ALLOWED_HOSTS, requireSessionId: false, requiredFields: ["outcome"] },
    );
    const result = classifyItem({
      schemaValid: validation.valid,
      schemaErrors: validation.errors,
      outcome: "unchanged",
      isOfficialPrimarySource: true,
      reachable: true,
      httpStatus: 200,
      requiresHumanReview: false,
      anomalyDetected: false,
    });
    console.log(
      `[update-population] 最新基準日=${resolution.labelReferenceDate}（既存データと同じ）。Excelの取得を省略し、変更なしとして終了します。`,
    );
    entries.push({
      sourceUrl: resolvedUrl,
      sourceType: "人口・世帯数統計xls（延岡市公式）",
      sessionId: null,
      outcome: "unchanged",
      lastCheckedAt: startedAt,
      httpStatus: 200,
      contentHash: state.population?.contentHash ?? null,
      parserVersion: PARSER_VERSION,
      extractionStatus: `reference_date_unchanged: 一覧ページの基準日=${resolution.labelReferenceDate}／既存データの最新基準日=${baseline?.referenceDate ?? "未登録"}（Excel未取得）`,
      validationStatus: validation.valid ? "schema_valid" : "schema_invalid",
      validationErrors: validation.errors,
      level: result.level,
      reason: result.reason,
    });
  } else if (fetchResult.error) {
    console.log(`[update-population] 主資料の取得に失敗: ${fetchResult.error}。フォールバックページを確認します。`);
    const fallback = await probeFallback();
    const validation = validateEntry(
      { sourceUrl: resolvedUrl, outcome: "error" },
      { allowedHosts: CITY_SITE_ALLOWED_HOSTS, requireSessionId: false, requiredFields: ["outcome"] },
    );
    const result = classifyItem({
      schemaValid: validation.valid,
      schemaErrors: validation.errors,
      outcome: "error",
      isOfficialPrimarySource: true,
      reachable: false,
      httpStatus: null,
      requiresHumanReview: true,
      humanReviewReason: `主資料xls取得失敗（${fetchResult.error}）。フォールバックページ到達性=${fallback.reachable}（${POPULATION_STATS_FALLBACK_URL}）を人間が確認し、添付ファイルIDの更新が必要か判断してください。`,
      anomalyDetected: false,
    });
    entries.push({
      sourceUrl: resolvedUrl,
      sourceType: "人口・世帯数統計xls（延岡市公式）",
      sessionId: null,
      outcome: "error",
      lastCheckedAt: startedAt,
      httpStatus: null,
      contentHash: null,
      parserVersion: PARSER_VERSION,
      extractionStatus: `fetch_failed: ${fetchResult.error}`,
      validationStatus: validation.valid ? "schema_valid" : "schema_invalid",
      validationErrors: validation.errors,
      level: result.level,
      reason: result.reason,
    });
  } else {
    const contentHash = sha256OfBuffer(fetchResult.buffer);
    const previousHash = state.population?.contentHash ?? null;
    const fileChangedSincePreviousRun = previousHash !== null && previousHash !== contentHash;

    const XLSX = await import("xlsx");
    const parseResult = parsePopulationXls(fetchResult.buffer, XLSX);

    if (parseResult.error) {
      const result = classifyItem({
        schemaValid: false,
        schemaErrors: [parseResult.error],
        outcome: "error",
        isOfficialPrimarySource: true,
        reachable: true,
        httpStatus: 200,
        requiresHumanReview: true,
        anomalyDetected: false,
      });
      entries.push({
        sourceUrl: resolvedUrl,
        sourceType: "人口・世帯数統計xls（延岡市公式）",
        sessionId: null,
        outcome: "error",
        lastCheckedAt: startedAt,
        httpStatus: 200,
        contentHash,
        parserVersion: PARSER_VERSION,
        extractionStatus: `parse_failed: ${parseResult.error}`,
        validationStatus: "schema_invalid",
        validationErrors: [parseResult.error],
        level: result.level,
        reason: result.reason,
      });
    } else {
      const live = parseResult.parsed;
      const outcome = determineOutcome(live, baseline);
      const anomaly = detectAnomaly(live, baseline);
      if (outcome === "new") circuitBreakerNewCount += 1;

      const validation = validateEntry(
        { sourceUrl: resolvedUrl, outcome },
        { allowedHosts: CITY_SITE_ALLOWED_HOSTS, requireSessionId: false, requiredFields: ["outcome"] },
      );

      const requiresHumanReview = outcome === "new" || outcome === "updated" || outcome === "error";
      const result = classifyItem({
        schemaValid: validation.valid,
        schemaErrors: validation.errors,
        outcome: outcome === "error" ? "error" : outcome,
        isOfficialPrimarySource: true,
        reachable: true,
        httpStatus: 200,
        requiresHumanReview,
        humanReviewReason:
          outcome === "new"
            ? `新しい基準日(${live.referenceDate})の人口データを検出。既存年度を書き換えず、新しいエントリとして追加する候補（人間確認が必要）。`
            : outcome === "updated"
              ? `既存基準日(${baseline?.referenceDate})の人口データが既存登録値(${baseline?.population})と異なる値(${live.population})を検出。既存データの修正候補のため人間確認が必要。`
              : outcome === "error"
                ? "取得した基準日が既存データより古く、解析ミスの可能性があるため人間確認が必要。"
                : undefined,
        anomalyDetected: anomaly.anomalyDetected && anomaly.severity === "RED",
        anomalyReason: anomaly.anomalyDetected ? anomaly.reason : undefined,
      });

      // RED専用のanomalyDetectedとは別に、YELLOW相当の異常（前年比20-50%）はrequiresHumanReview経由で反映する。
      let level = result.level;
      let reason = result.reason;
      if (anomaly.anomalyDetected && anomaly.severity === "YELLOW" && level === "GREEN") {
        level = "YELLOW";
        reason = anomaly.reason;
      }

      entries.push({
        sourceUrl: resolvedUrl,
        sourceType: "人口・世帯数統計xls（延岡市公式、現住人口及び世帯数の推移）",
        sessionId: null,
        outcome: outcome === "error" ? "error" : outcome,
        lastCheckedAt: startedAt,
        httpStatus: 200,
        contentHash,
        parserVersion: PARSER_VERSION,
        extractionStatus: `referenceDate=${live.referenceDate} population=${live.population} male=${live.male ?? "未公開"} female=${live.female ?? "未公開"} households=${live.households ?? "未公開"}（fileChangedSincePreviousRun=${fileChangedSincePreviousRun}）`,
        validationStatus: validation.valid ? "schema_valid" : "schema_invalid",
        validationErrors: validation.errors,
        level,
        reason: anomaly.anomalyDetected ? `${reason}／${anomaly.reason}` : reason,
      });
    }

    saveLocalState({ population: { contentHash, lastCheckedAt: startedAt } });
  }

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
    previousKnownTotal: 1, // 監視対象resourceは常に1件（人口xls）。
  });

  // Phase249：出典URL解決の段階で検出した異常（リダイレクト・添付ID変更・逆戻り等）も総合判定へ反映する。
  // INFO（添付ファイルIDが変わったが一覧ページから解決できた）はGREENのままにする
  // ＝IDの差し替えだけで自動更新が止まらないことが、この改善の目的であるため。
  const baseLevel = circuitBreaker.tripped ? "RED" : summary.red > 0 ? "RED" : summary.yellow > 0 ? "YELLOW" : "GREEN";
  const overallLevel =
    baseLevel === "RED" || resolutionSeverity === "RED"
      ? "RED"
      : baseLevel === "YELLOW" || resolutionSeverity === "YELLOW"
        ? "YELLOW"
        : "GREEN";

  const report = {
    target: TARGET,
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: true,
    watchedSource: resolvedUrl,
    watchedSourceResolution: {
      resolvedFrom: resolution.resolvedFrom,
      statsPageUrl: POPULATION_STATS_FALLBACK_URL,
      pinnedUrl: POPULATION_XLS_URL,
      linkLabel: resolution.linkLabel,
      labelReferenceDate: resolution.labelReferenceDate,
      attachmentIdChanged: resolution.attachmentIdChanged,
      bufferKind: resolution.bufferKind,
      severity: resolutionSeverity,
      issues: resolution.issues,
      diagnostics: resolution.diagnostics,
    },
    baseScriptExitCode: 0,
    overallLevel,
    summary,
    entries,
    circuitBreakerTripped: circuitBreaker.tripped,
    circuitBreakerReason: circuitBreaker.reason,
    note:
      "dryRun=trueのため、本番データ（src/data/archiveFiscalYears.json等）への書き込みは一切行っていない。" +
      "新しい基準日を検出した場合も、既存年度の書き換えではなく新規エントリ追加の候補として報告するのみで、" +
      "自動反映は行わない（別途、人間の確認とAUTO_APPLY_GREENフラグの有効化が必要）。",
  };

  const outPath = writeRunReport(report);
  const status = updateStatus(TARGET, report);

  console.log(
    `[update-population] 検出=${summary.detected} GREEN=${summary.green} YELLOW=${summary.yellow} RED=${summary.red} ` +
      `総合判定=${overallLevel} サーキットブレーカー=${circuitBreaker.tripped ? "発動" : "正常"} 連続正常実行=${status.consecutiveSuccessfulRuns}`,
  );
  console.log(`[update-population] レポート書き出し: ${outPath}`);
  process.exitCode = summary.red > 0 ? 1 : 0;
}

main();
