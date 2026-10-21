/**
 * 自動更新パイプライン dry-run（.github/workflows/auto-update-dryrun.yml）の最終判定。
 *
 * 各Updaterと品質監査のステップは continue-on-error: true で最後まで実行させ、レポートを
 * 残したうえで、このスクリプトが結果を集計してジョブの成否を決める。
 * 以前は品質監査（validate:data / typecheck / lint）の失敗しか見ておらず、Updaterが
 * 終了コード1で終わったり、レポートの総合判定がRED・サーキットブレーカー発動だったりしても
 * ワークフロー全体はSuccessになっていた（2026-10-20のdry-run #61）。
 *
 * 次のいずれかに該当すれば失敗（終了コード1）とする。
 * - Updaterのステップが failure（終了コード0以外）
 * - いずれかのレポートの overallLevel が "RED"
 * - いずれかのレポートで circuitBreakerTripped が true
 * - いずれかのレポートで summary.error が1以上、またはレポートを読めない
 * - 品質監査（validate:data / typecheck / lint / build）のいずれかが failure・cancelled
 *
 * 使い方：node scripts/auto-update/core/gate.mjs <今回生成したrun-*.jsonの一覧ファイル>
 * ステップの結果は環境変数（BILLS_OUTCOME 等。GitHub Actions の steps.<id>.outcome）で受け取る。
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const UPDATER_TARGETS = ["bills", "questions", "finance", "population"];
export const AUDIT_STEPS = ["validate", "typecheck", "lint", "build"];

const FAILED_OUTCOMES = new Set(["failure", "cancelled"]);

/**
 * @param {{
 *   updaterOutcomes: Record<string, string | undefined>,
 *   auditOutcomes: Record<string, string | undefined>,
 *   reports: Array<Record<string, any>>,
 * }} input
 * @returns {{ failed: boolean, reasons: string[] }}
 */
export function evaluateDryRunGate({ updaterOutcomes, auditOutcomes, reports }) {
  const reasons = [];
  for (const [target, outcome] of Object.entries(updaterOutcomes)) {
    if (FAILED_OUTCOMES.has(outcome)) reasons.push(`Updater ${target} が終了コード0以外で終了（outcome=${outcome}）`);
  }
  for (const r of reports) {
    const target = r.target ?? "不明";
    if (r.parseError) {
      reasons.push(`レポート ${target} を読み込めない（${r.parseError}）`);
      continue;
    }
    if (r.overallLevel === "RED") reasons.push(`${target}: 総合判定RED`);
    if (r.circuitBreakerTripped === true) {
      reasons.push(`${target}: サーキットブレーカー発動（${r.circuitBreakerReason ?? "理由不明"}）`);
    }
    if ((r.summary?.error ?? 0) > 0) reasons.push(`${target}: error ${r.summary.error}件`);
  }
  for (const [step, outcome] of Object.entries(auditOutcomes)) {
    if (FAILED_OUTCOMES.has(outcome)) reasons.push(`品質監査 ${step} が失敗（outcome=${outcome}）`);
  }
  return { failed: reasons.length > 0, reasons };
}

export function readReports(listPath) {
  if (!listPath || !existsSync(listPath)) return [];
  const files = readFileSync(listPath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
  return files.map((f) => {
    try {
      return JSON.parse(readFileSync(f, "utf8"));
    } catch (e) {
      return { target: f, parseError: e.message };
    }
  });
}

function main() {
  const env = process.env;
  const updaterOutcomes = Object.fromEntries(UPDATER_TARGETS.map((t) => [t, env[`${t.toUpperCase()}_OUTCOME`]]));
  const auditOutcomes = Object.fromEntries(AUDIT_STEPS.map((s) => [s, env[`${s.toUpperCase()}_OUTCOME`]]));
  const reports = readReports(process.argv[2]);
  const { failed, reasons } = evaluateDryRunGate({ updaterOutcomes, auditOutcomes, reports });

  const lines = ["", "### 最終判定", ""];
  lines.push(`- 集計したレポート: ${reports.length}件`);
  for (const r of reports) {
    lines.push(
      `  - ${r.target}: 総合判定=${r.overallLevel ?? "不明"} / サーキットブレーカー=${r.circuitBreakerTripped ? "発動" : "正常"}` +
        (Array.isArray(r.excludedResolvedEntries) && r.excludedResolvedEntries.length > 0
          ? ` / 既知の除外対象（removed-confirmed）${r.excludedResolvedEntries.length}件`
          : ""),
    );
  }
  lines.push(failed ? "- 結果: **Failure**" : "- 結果: Success");
  for (const reason of reasons) lines.push(`  - ${reason}`);
  const text = lines.join("\n") + "\n";
  console.log(text);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, text);
  if (failed) {
    for (const reason of reasons) console.error(`::error::${reason}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
