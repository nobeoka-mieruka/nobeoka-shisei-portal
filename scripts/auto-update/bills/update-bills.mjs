#!/usr/bin/env node
/**
 * 自動更新パイプライン（Workstream C：議案・議決結果）。
 *
 * 【重要：既存資産の再利用】
 * 公式サイトの取得・HTML解析・新規/変更/削除の判定・異常検知（50%以上の急減で中止）・
 * リトライ・タイムアウト・ドメイン許可リストは、すべて既存の
 * scripts/fetch-nobeoka-council-documents.mjs（.github/workflows/update-council-documents.yml
 * が既に毎日実行している本番スクリプト）をdry-runモードでサブプロセス実行して再利用する。
 * このスクリプト自身は取得ロジックを重複実装しない。
 *
 * このスクリプトが新規に追加するのは以下の3点のみ：
 *   1. 新規検出された資料について、実際にGETリクエストで到達性とハッシュを確認する
 *      （本番JSONへの書き込みは行わない。読み取りのみ）。
 *   2. スキーマ検証（sessionId形式・sourceUrlのドメイン・必須フィールド） … core/validate.mjs
 *   3. GREEN/YELLOW/RED判定・サーキットブレーカー・統一レポート出力 … core/classify.mjs, core/report.mjs
 *
 * 本番データ（src/data/*.json）は一切書き換えない。
 * 使い方: node scripts/auto-update/bills/update-bills.mjs [--verbose]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256OfBuffer } from "../../lib/council-shared.mjs";
import { fetchWithRetry } from "../core/fetch.mjs";
import { classifyItem, checkCircuitBreaker } from "../core/classify.mjs";
import { validateEntry } from "../core/validate.mjs";
import { writeRunReport, updateStatus, ROOT } from "../core/report.mjs";

const TARGET = "bills";
const ALLOWED_HOSTS = new Set(["www.city.nobeoka.miyazaki.jp", "city.nobeoka.miyazaki.jp"]);
const PARSER_VERSION = "fetch-nobeoka-council-documents.mjs@2026-08";
const verbose = process.argv.includes("--verbose");

function log(...args) {
  if (verbose) console.log(...args);
}

/** 既存の本番スクリプトをdry-runで実行する（このスクリプトは取得ロジックを持たない）。 */
function runBaseFetchDryRun() {
  const scriptPath = join(ROOT, "scripts", "fetch-nobeoka-council-documents.mjs");
  let stdout = "";
  let exitCode = 0;
  try {
    stdout = execFileSync("node", [scriptPath, "--dry-run"], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
  } catch (e) {
    stdout = (e.stdout ?? "") + (e.stderr ?? "");
    exitCode = e.status ?? 1;
  }
  const reportPath = join(ROOT, "reports", "council-document-update-report.json");
  const baseReport = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : null;
  return { stdout, exitCode, baseReport };
}

/**
 * 新規検出資料について、実際にHTTPで到達性・ハッシュを確認する（読み取りのみ、保存しない）。
 * dry-runの基底スクリプトはHTML一覧ページの解析のみを行い、新規PDF自体の中身までは
 * 取得しないため、ここで初めてPDF本体へアクセスしてhttpStatus/contentHashを埋める。
 */
async function probeNewDocument(sourceUrl) {
  try {
    const res = await fetchWithRetry(sourceUrl, { allowedHosts: ALLOWED_HOSTS, maxRetries: 2 });
    const buf = Buffer.from(await res.arrayBuffer());
    return { httpStatus: res.status, contentHash: res.ok ? sha256OfBuffer(buf) : null, error: null };
  } catch (e) {
    return { httpStatus: null, contentHash: null, error: e.message };
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[update-bills] 開始: ${startedAt}`);

  const { stdout, exitCode, baseReport } = runBaseFetchDryRun();
  log(stdout);

  if (exitCode !== 0 || !baseReport) {
    const report = {
      target: TARGET,
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun: true,
      baseScriptExitCode: exitCode,
      overallLevel: "RED",
      summary: { detected: 0, green: 0, yellow: 0, red: 0, error: 1 },
      entries: [],
      circuitBreakerTripped: false,
      circuitBreakerReason: null,
      note: "基底スクリプト（fetch-nobeoka-council-documents.mjs）が異常終了しました。詳細はbaseScriptOutputを参照。",
      baseScriptOutput: stdout,
    };
    const outPath = writeRunReport(report);
    updateStatus(TARGET, report);
    console.error(`[update-bills] 基底スクリプトが異常終了しました（exitCode=${exitCode}）。RUN全体をREDとして記録: ${outPath}`);
    process.exitCode = 1;
    return;
  }

  const classifiedEntries = [];
  for (const entry of baseReport.entries) {
    const validation = validateEntry(entry, { allowedHosts: ALLOWED_HOSTS, requiredFields: ["outcome"] });
    let probe = null;
    if (validation.valid && entry.outcome.startsWith("new")) {
      console.log(`[update-bills] 新規資料への到達確認: ${entry.sourceUrl}`);
      probe = await probeNewDocument(entry.sourceUrl);
    }

    const outcome = entry.outcome.startsWith("new") ? "new" : entry.outcome;
    const reachable = probe ? probe.error === null && probe.httpStatus !== null : outcome === "unchanged" ? true : null;
    const result = classifyItem({
      schemaValid: validation.valid,
      schemaErrors: validation.errors,
      outcome,
      isOfficialPrimarySource: true, // 延岡市議会公式サイトのみを対象とするスクリプトのため常にtrue
      reachable,
      httpStatus: probe?.httpStatus ?? null,
      requiresHumanReview: outcome === "reconciled" || outcome === "updated",
      humanReviewReason:
        outcome === "reconciled"
          ? "要確認セッションとの照合を伴うため人間確認を推奨"
          : outcome === "updated"
            ? "既存資料のハッシュ変更（内容差し替えの可能性）のため人間確認を推奨"
            : undefined,
      anomalyDetected: false,
    });

    classifiedEntries.push({
      sourceUrl: entry.sourceUrl,
      sourceType: "議案等審議結果PDF（延岡市議会公式）",
      sessionId: entry.sessionId,
      outcome,
      lastCheckedAt: startedAt,
      httpStatus: probe?.httpStatus ?? null,
      contentHash: probe?.contentHash ?? null,
      parserVersion: PARSER_VERSION,
      extractionStatus: entry.outcome === "unchanged" ? "not_reextracted（変更なしのため再解析していない）" : "detected",
      validationStatus: validation.valid ? "schema_valid" : "schema_invalid",
      validationErrors: validation.errors,
      level: result.level,
      reason: result.reason,
    });
  }

  const summary = {
    detected: baseReport.detected,
    green: classifiedEntries.filter((e) => e.level === "GREEN").length,
    yellow: classifiedEntries.filter((e) => e.level === "YELLOW").length,
    red: classifiedEntries.filter((e) => e.level === "RED").length,
    error: 0,
  };

  const circuitBreaker = checkCircuitBreaker({
    target: TARGET,
    newCount: baseReport.new + baseReport.reconciled,
    updatedCount: baseReport.updated,
    removedCandidateCount: baseReport.removed,
    detectedTotal: baseReport.detected,
    previousKnownTotal: baseReport.published, // 直近の「公開中」件数を既知件数の基準にする
  });

  const overallLevel = circuitBreaker.tripped ? "RED" : summary.red > 0 ? "RED" : summary.yellow > 0 ? "YELLOW" : "GREEN";

  const report = {
    target: TARGET,
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: true,
    watchedSource: baseReport.watchedPage,
    baseScriptExitCode: 0,
    overallLevel,
    summary,
    entries: classifiedEntries,
    circuitBreakerTripped: circuitBreaker.tripped,
    circuitBreakerReason: circuitBreaker.reason,
    note:
      "dryRun=trueのため、本番データ（src/data/councilSessions.json・councilDocumentSources.json等）への" +
      "書き込みは一切行っていない。GREEN判定であっても、このレポート自体が自動で本番反映を行うことはない" +
      "（別途、明示的な本番実行コマンドと人間の承認、およびAUTO_APPLY_GREENフラグの有効化が必要）。",
  };

  const outPath = writeRunReport(report);
  const status = updateStatus(TARGET, report);

  console.log(
    `[update-bills] 検出=${summary.detected} GREEN=${summary.green} YELLOW=${summary.yellow} RED=${summary.red} ERROR=${summary.error} ` +
      `総合判定=${overallLevel} サーキットブレーカー=${circuitBreaker.tripped ? "発動" : "正常"} 連続正常実行=${status.consecutiveSuccessfulRuns}`,
  );
  console.log(`[update-bills] レポート書き出し: ${outPath}`);
  process.exitCode = summary.red > 0 ? 1 : 0;
}

main();
