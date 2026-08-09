/**
 * フェーズ10A・10B：自動巡回基盤のCI実行スクリプト。
 *
 * src/lib/archiveCrawler.ts（TypeScript）と同じ判定ロジックをここでミラー実装している。
 * このプロジェクトのscripts/配下は他のファイルも同様に、ビルド前のTypeScriptを直接importできない
 * ため（scripts/lib/public-routes.mjsの既存コメントを参照）、プレーンJSとして複製している。
 * ロジックを変更する場合は src/lib/archiveCrawler.ts 側もあわせて更新すること。
 *
 * 対象の扱い方（重複実装を避けるための整理）：
 * - existingImplementationが設定された対象（一般質問・議員名簿・議案・条例・請願・陳情）は
 *   再取得せず、既存スクリプトが生成したレポート（reports/配下）を読み込んで統合する。
 * - urlが未確認（null）の対象、または許可ドメイン外のURLの対象はスキップする（推測でアクセスしない）。
 * - それ以外（財政・人口・基金）は、既存のscripts/lib/city-site-fetch.mjs
 *   （許可ドメイン制限・429/403/5xx処理・SHA-256ハッシュ）を使って実際にHTTP取得する。
 *
 * --force で120時間ゲートを無視して実行する。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalState, saveLocalState, shouldRun, appendHistory } from "./lib/sync-state.mjs";
import { fetchCitySiteBuffer, sha256OfBufferForDiff, isAllowedUrl, stats as fetchStats } from "./lib/city-site-fetch.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const TARGETS_PATH = join(root, "src", "data", "archiveCrawlerTargets.json");
const STATE_PATH = join(root, "src", "data", "archiveCrawlerState.json");
// sync-council-data.mjsとゲート状態を共有しないよう、専用のローカル状態ファイルを使う。
const GATE_STATE_PATH = join(root, "scripts", "_archive-crawler-sync-state.json");

const SYNC_COUNCIL_REPORT_PATH = join(root, "reports", "sync-council-data-report.json");
const COUNCIL_DOCUMENT_REPORT_PATH = join(root, "reports", "council-document-update-report.json");

const isForce = process.argv.includes("--force");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonSafe(path) {
  try {
    return readJson(path);
  } catch (e) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
}

function determineFetchStatus(previousHash, newHash) {
  if (previousHash == null) return "new";
  return previousHash === newHash ? "unchanged" : "changed";
}

function shouldFlagAsPossiblyRemoved(consecutiveNotFoundCount, hasAlternateUrlCandidate) {
  return consecutiveNotFoundCount >= 2 && !hasAlternateUrlCandidate;
}

function summarizeResults(results) {
  return {
    total: results.length,
    new: results.filter((r) => r.status === "new").length,
    changed: results.filter((r) => r.status === "changed").length,
    unchanged: results.filter((r) => r.status === "unchanged").length,
    possiblyRemoved: results.filter((r) => r.status === "possiblyRemoved").length,
    errors: results.filter((r) => r.status === "error").length,
    skipped: results.filter((r) => r.status === "skipped").length,
  };
}

function mergeCrawlerState(previous, log) {
  const byId = new Map(previous.targets.map((t) => [t.targetId, t]));
  for (const result of log.results) {
    const prev = byId.get(result.targetId);
    const isFailure = result.status === "error" || result.status === "possiblyRemoved";
    const consecutiveNotFoundCount = isFailure ? (prev?.consecutiveNotFoundCount ?? 0) + 1 : 0;
    byId.set(result.targetId, {
      targetId: result.targetId,
      lastCheckedAt: result.checkedAt,
      lastSuccessfulAt: isFailure ? (prev?.lastSuccessfulAt ?? null) : result.checkedAt,
      lastUpdatedAt: result.status === "new" || result.status === "changed" ? result.checkedAt : (prev?.lastUpdatedAt ?? null),
      lastStatus: result.status,
      lastContentHash: result.contentHash ?? (result.status === "unchanged" ? (prev?.lastContentHash ?? null) : null),
      consecutiveNotFoundCount,
    });
  }
  const summary = summarizeResults(log.results);
  return {
    lastRunAt: log.runAt,
    lastSuccessfulRunAt: summary.errors > 0 ? previous.lastSuccessfulRunAt : log.runAt,
    targets: [...byId.values()],
    totalCount: summary.total,
    changedCount: summary.new + summary.changed,
    removedCount: summary.possiblyRemoved,
    errorCount: summary.errors,
  };
}

/** ネットワークエラー（タイムアウト等）のみ1回だけ再試行する。429/403/5xxの再試行はfetchCitySite側が担う。 */
async function fetchWithRetry(url, maxNetworkRetries = 1) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchCitySiteBuffer(url);
    } catch (e) {
      if (!e.message.startsWith("ネットワークエラー") || attempt >= maxNetworkRetries) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/** 一般質問（question-notice）・議員名簿（member-roster-watch）：sync-council-data.mjsのレポートを統合する。 */
function resultFromSyncCouncilReport(target, checkedAt) {
  const report = readJsonSafe(SYNC_COUNCIL_REPORT_PATH);
  if (!report) {
    return { targetId: target.id, status: "error", checkedAt, contentHash: null, errorMessage: `既存実装（${target.existingImplementation}）のレポートが見つかりませんでした（未実行の可能性）。` };
  }
  const categoryKey = target.id === "general-question" ? "question-notice" : "member-roster-watch";
  const entry = report.categories?.find((c) => c.category === categoryKey);
  if (!entry || entry.status !== "ok") {
    return { targetId: target.id, status: "error", checkedAt, contentHash: null, errorMessage: `既存実装のレポートに有効な結果が見つかりませんでした（category=${categoryKey}）。` };
  }
  if (target.id === "member-roster") {
    return {
      targetId: target.id,
      status: entry.changed ? "changed" : "unchanged",
      checkedAt,
      contentHash: null,
      errorMessage: `既存実装（${target.existingImplementation}）の結果を統合（changed=${Boolean(entry.changed)}）。実行日時: ${report.runAt}`,
    };
  }
  const status = (entry.new ?? 0) > 0 ? "new" : (entry.updated ?? 0) > 0 ? "changed" : "unchanged";
  return {
    targetId: target.id,
    status,
    checkedAt,
    contentHash: null,
    errorMessage: `既存実装（${target.existingImplementation}）の結果を統合（検出${entry.detected}／新規${entry.new}／更新${entry.updated}／変更なし${entry.unchanged}）。実行日時: ${report.runAt}`,
  };
}

/** 議案・条例・請願・陳情：fetch-nobeoka-council-documents.mjsのレポートを統合する（4対象とも同一ページを共有）。 */
function resultFromCouncilDocumentReport(target, checkedAt) {
  const report = readJsonSafe(COUNCIL_DOCUMENT_REPORT_PATH);
  if (!report) {
    return { targetId: target.id, status: "error", checkedAt, contentHash: null, errorMessage: `既存実装（${target.existingImplementation}）のレポートが見つかりませんでした（未実行の可能性）。` };
  }
  const status = (report.new ?? 0) > 0 ? "new" : (report.updated ?? 0) > 0 || (report.reconciled ?? 0) > 0 ? "changed" : "unchanged";
  return {
    targetId: target.id,
    status,
    checkedAt,
    contentHash: null,
    errorMessage: `既存実装（${target.existingImplementation}）の結果を統合（検出${report.detected}／新規${report.new}／更新${report.updated}／変更なし${report.unchanged}／削除${report.removed}）。議案・条例・請願・陳情は同一ページの合算値です。実行日時: ${report.checkedAt}`,
  };
}

async function fetchRealTarget(target, prevTargetState, checkedAt) {
  if (!isAllowedUrl(target.url)) {
    return { targetId: target.id, status: "skipped", checkedAt, contentHash: null, errorMessage: `許可ドメイン外のURLのため取得しません: ${target.url}` };
  }
  try {
    const buffer = await fetchWithRetry(target.url);
    const hash = sha256OfBufferForDiff(buffer);
    const status = determineFetchStatus(prevTargetState?.lastContentHash ?? null, hash);
    return { targetId: target.id, status, checkedAt, contentHash: hash };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.startsWith("HTTP 404")) {
      const consecutive = (prevTargetState?.consecutiveNotFoundCount ?? 0) + 1;
      const status = shouldFlagAsPossiblyRemoved(consecutive, false) ? "possiblyRemoved" : "error";
      return { targetId: target.id, status, checkedAt, contentHash: null, errorMessage: `HTTP 404（連続${consecutive}回）` };
    }
    return { targetId: target.id, status: "error", checkedAt, contentHash: null, errorMessage: message };
  }
}

async function runCrawl(targets, previousState, now) {
  const checkedAt = now.toISOString();
  const stateByTarget = new Map(previousState.targets.map((t) => [t.targetId, t]));
  const results = [];

  for (const target of targets) {
    if (target.existingImplementation) {
      results.push(
        target.category === "bill" || target.category === "ordinance" || target.category === "petition" || target.category === "request"
          ? resultFromCouncilDocumentReport(target, checkedAt)
          : resultFromSyncCouncilReport(target, checkedAt),
      );
      continue;
    }
    if (!target.url) {
      results.push({ targetId: target.id, status: "skipped", checkedAt, contentHash: null, errorMessage: "監視対象の公式URLが未確認のためスキップしました。" });
      continue;
    }
    results.push(await fetchRealTarget(target, stateByTarget.get(target.id), checkedAt));
  }

  return { runAt: checkedAt, results, summary: summarizeResults(results) };
}

async function main() {
  const gateState = loadLocalState(GATE_STATE_PATH);
  const gate = shouldRun({ force: isForce, lastSuccessfulRunAt: gateState.lastSuccessfulRunAt });

  console.log(
    `[archive-crawler] 前回正常実行: ${gateState.lastSuccessfulRunAt ?? "記録なし"}／経過時間: ${
      gate.hoursSinceLast != null ? `${gate.hoursSinceLast.toFixed(1)}時間` : "不明"
    }／判定: ${gate.run ? "実行する" : "スキップ"}（理由: ${gate.reason}）`,
  );

  if (!gate.run) {
    console.log("SYNC_RAN=false");
    return;
  }

  const targets = readJson(TARGETS_PATH);
  const previousState = readJson(STATE_PATH);
  const now = new Date();
  const log = await runCrawl(targets, previousState, now);
  const nextState = mergeCrawlerState(previousState, log);

  writeFileSync(STATE_PATH, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");

  console.log(
    `[archive-crawler] 巡回完了：対象${log.summary.total}件（新規${log.summary.new}／変更${log.summary.changed}／変更なし${log.summary.unchanged}／削除候補${log.summary.possiblyRemoved}／スキップ${log.summary.skipped}／エラー${log.summary.errors}）`,
  );
  console.log(`[archive-crawler] 実HTTP取得統計：checked=${fetchStats.checked} 429=${fetchStats.count429} 403=${fetchStats.count403} 5xx=${fetchStats.count5xx} errors=${fetchStats.errors}`);
  for (const result of log.results) {
    if (result.errorMessage) console.log(`  - ${result.targetId}: ${result.status}（${result.errorMessage}）`);
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const lines = [
      "## 自動巡回基盤（フェーズ10B）",
      "",
      `- 実行日時: ${log.runAt}`,
      `- 対象件数: ${log.summary.total}`,
      `- 新規: ${log.summary.new} / 変更: ${log.summary.changed} / 変更なし: ${log.summary.unchanged} / 削除候補: ${log.summary.possiblyRemoved} / スキップ: ${log.summary.skipped} / エラー: ${log.summary.errors}`,
      `- 実HTTP取得: checked=${fetchStats.checked} 429=${fetchStats.count429} 403=${fetchStats.count403} 5xx=${fetchStats.count5xx}`,
      "",
    ];
    writeFileSync(summaryPath, `${lines.join("\n")}\n`, { flag: "a" });
  }

  const nowIso = log.runAt;
  const updatedGateState = appendHistory(
    { ...gateState, lastAttemptAt: nowIso, lastSuccessfulRunAt: log.summary.errors > 0 ? gateState.lastSuccessfulRunAt : nowIso },
    { runAt: nowIso, total: log.summary.total, changed: log.summary.new + log.summary.changed, errors: log.summary.errors },
  );
  saveLocalState(updatedGateState, GATE_STATE_PATH);

  console.log("SYNC_RAN=true");
}

main();
