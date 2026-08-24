/**
 * 自動更新パイプライン共通のレポート・ステータス管理ヘルパー（Workstream A：共通コア）。
 * 各Updater（B：一般質問／C：議案／D：財政・人口）は、このモジュールを使って
 * reports/auto-update/ 配下へ統一形式のレポートを書き出す（台帳を乱立させない）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..", "..", "..");
export const AUTO_UPDATE_DIR = join(ROOT, "reports", "auto-update");
export const STATUS_PATH = join(AUTO_UPDATE_DIR, "status.json");

function ensureDir() {
  mkdirSync(AUTO_UPDATE_DIR, { recursive: true });
}

/**
 * 実行結果（AutoUpdateRunReport相当、src/lib/auto-update/types.tsのAutoUpdateRunReportと同じ形）を
 * reports/auto-update/run-<target>-<timestamp>.json へ書き出す。
 */
export function writeRunReport(report) {
  ensureDir();
  const fileName = `run-${report.target}-${report.startedAt.replace(/[:.]/g, "-")}.json`;
  const outPath = join(AUTO_UPDATE_DIR, fileName);
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return outPath;
}

/** target別の「連続正常実行」記録を読み込む（無ければ空の初期状態を返す）。 */
export function readStatus() {
  if (!existsSync(STATUS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATUS_PATH, "utf8"));
  } catch {
    return {};
  }
}

/**
 * 実行結果を踏まえてtargetの連続正常実行回数を更新する。
 * 「正常」＝RED件数0・circuitBreakerTripped=false。
 * dry-run実行でもカウントする（本番反映の可否判断のための実績値であり、
 * dry-runかどうかは判定基準にしない）。
 */
export function updateStatus(target, report) {
  const status = readStatus();
  const prev = status[target] ?? { consecutiveSuccessfulRuns: 0, lastSuccessfulRunAt: null };
  const isSuccessful = report.summary.red === 0 && report.summary.error === 0 && !report.circuitBreakerTripped;

  const next = {
    target,
    lastRunAt: report.startedAt,
    lastSuccessfulRunAt: isSuccessful ? report.startedAt : prev.lastSuccessfulRunAt,
    consecutiveSuccessfulRuns: isSuccessful ? (prev.consecutiveSuccessfulRuns ?? 0) + 1 : 0,
  };
  next.eligibleForAutoApply = next.consecutiveSuccessfulRuns >= 3 && report.summary.yellow === 0;

  status[target] = next;
  ensureDir();
  writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2) + "\n", "utf8");
  return next;
}
