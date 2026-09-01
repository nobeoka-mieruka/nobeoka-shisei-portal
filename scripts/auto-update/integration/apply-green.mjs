#!/usr/bin/env node
/**
 * GREEN自動反映エンジン（Workstream F：統合・安全装置）。
 *
 * 【このスクリプトの役割】
 * 各Updater（B：一般質問／C：議案／D：財政・人口）が reports/auto-update/run-<target>-*.json へ
 * 書き出したレポートを読み取り、
 *   1. GREEN判定のentriesを一覧表示する（listApplicableGreenItems）
 *   2. reports/auto-update/status.json の連続正常実行実績と当該レポートを突き合わせて、
 *      「将来のGREEN自動反映」に対する最終的な適用可否を判定する（isEligibleForAutoApply）
 *   3. 実際の本番データ書き込みは、今回は一切行わない（意図的に未実装）。
 *
 * 【AUTO_APPLY_GREEN フィーチャーフラグ】
 * 環境変数 AUTO_APPLY_GREEN が文字列 "true" の場合のみ有効（それ以外＝未設定・"false"・
 * 任意の他の値は、すべて無効として扱う＝安全側）。
 * 今回の実装では、AUTO_APPLY_GREEN=true であっても実際の書き込みは行わない
 * （書き込みロジック自体を意図的に実装していない）。true/false のいずれでも、
 * 実行結果として出力されるのは「反映されたであろう内容」のログ・レポートのみであり、
 * これは常に dry-run 相当の動作である。
 *
 * 【対象external I/O】
 * - 読み取りのみ： reports/auto-update/run-<target>-*.json, reports/auto-update/status.json
 * - 書き込み： reports/auto-update/dry-run-apply-<target>-<timestamp>.json
 *   （「反映されたであろう内容」の記録。本番データ src/data/*.json は一切書き換えない）
 *
 * 使い方:
 *   node scripts/auto-update/integration/apply-green.mjs --target=bills
 *   node scripts/auto-update/integration/apply-green.mjs --report=reports/auto-update/run-bills-xxx.json
 *   AUTO_APPLY_GREEN=true node scripts/auto-update/integration/apply-green.mjs --target=bills
 *     （trueにしても、今回の実装では書き込みは行われず、ログ・レポート出力のみ）
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { AUTO_UPDATE_DIR, STATUS_PATH, readStatus } from "../core/report.mjs";

/**
 * AUTO_APPLY_GREEN フィーチャーフラグを読み取る。
 * デフォルトfalse。文字列 "true" の場合のみtrue（大文字小文字を区別する厳格一致）。
 * @returns {boolean}
 */
export function readAutoApplyGreenFlag(env = process.env) {
  return env.AUTO_APPLY_GREEN === "true";
}

/**
 * レポート内のGREEN判定entriesだけを抽出する。
 * @param {{ entries: Array<{ level: string }> }} report AutoUpdateRunReport相当
 * @returns {Array<object>}
 */
export function listApplicableGreenItems(report) {
  if (!report || !Array.isArray(report.entries)) return [];
  return report.entries.filter((entry) => entry.level === "GREEN");
}

/**
 * 「将来のGREEN自動反映」に対する最終適用可否を判定する。
 * core/report.mjs の updateStatus が計算する eligibleForAutoApply（連続正常実行3回以上・
 * YELLOW件数0）と整合させつつ、ここでは「今まさに渡されたこのレポート」自体も
 * RED0件・YELLOW0件・サーキットブレーカー未発動であることを追加で要求する
 * （statusは過去の実行履歴の集計であり、直近のレポート自体が異常でないことは別途確認が必要なため）。
 *
 * @param {{ consecutiveSuccessfulRuns?: number } | undefined | null} status
 *   reports/auto-update/status.json の対象target分（AutoUpdateStatus相当）
 * @param {{ summary?: { red?: number, yellow?: number }, circuitBreakerTripped?: boolean } | undefined | null} report
 *   AutoUpdateRunReport相当
 * @returns {boolean}
 */
export function isEligibleForAutoApply(status, report) {
  if (!status || !report || !report.summary) return false;
  const consecutiveSuccessfulRuns = status.consecutiveSuccessfulRuns ?? 0;
  const { red = 0, yellow = 0 } = report.summary;
  const circuitBreakerTripped = report.circuitBreakerTripped === true;
  return consecutiveSuccessfulRuns >= 3 && red === 0 && yellow === 0 && !circuitBreakerTripped;
}

/** reports/auto-update/ 配下から指定targetの最新run-<target>-*.jsonのパスを探す。 */
function findLatestReportPathForTarget(target) {
  if (!existsSync(AUTO_UPDATE_DIR)) return null;
  const prefix = `run-${target}-`;
  const candidates = readdirSync(AUTO_UPDATE_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort(); // ファイル名にISO8601タイムスタンプを含むため文字列ソートで新しい順に並ぶ
  if (candidates.length === 0) return null;
  return join(AUTO_UPDATE_DIR, candidates[candidates.length - 1]);
}

function loadReport(reportPath) {
  return JSON.parse(readFileSync(reportPath, "utf8"));
}

function loadStatusForTarget(target) {
  const status = readStatus();
  return status[target] ?? null;
}

/** CLI引数（--target=xxx / --report=path）を解釈する。 */
function parseArgs(argv) {
  const args = { target: null, report: null };
  for (const arg of argv) {
    if (arg.startsWith("--target=")) args.target = arg.slice("--target=".length);
    else if (arg.startsWith("--report=")) args.report = arg.slice("--report=".length);
  }
  return args;
}

/**
 * 「反映されたであろう内容」を dry-run 記録として reports/auto-update/ 配下へ書き出す。
 * 本番データ（src/data/*.json）への書き込みではない。
 */
function writeDryRunApplyRecord(target, record) {
  mkdirSync(AUTO_UPDATE_DIR, { recursive: true });
  const fileName = `dry-run-apply-${target}-${record.generatedAt.replace(/[:.]/g, "-")}.json`;
  const outPath = join(AUTO_UPDATE_DIR, fileName);
  writeFileSync(outPath, JSON.stringify(record, null, 2) + "\n", "utf8");
  return outPath;
}

async function main() {
  const { target, report: reportPathArg } = parseArgs(process.argv.slice(2));
  const autoApplyGreen = readAutoApplyGreenFlag();

  let reportPath = reportPathArg;
  if (!reportPath) {
    if (!target) {
      console.error("[apply-green] --target=<target> または --report=<path> のいずれかを指定してください。");
      process.exitCode = 1;
      return;
    }
    reportPath = findLatestReportPathForTarget(target);
    if (!reportPath) {
      console.error(`[apply-green] target="${target}" のレポートが reports/auto-update/ に見つかりません。`);
      process.exitCode = 1;
      return;
    }
  }

  if (!existsSync(reportPath)) {
    console.error(`[apply-green] レポートファイルが見つかりません: ${reportPath}`);
    process.exitCode = 1;
    return;
  }

  const report = loadReport(reportPath);
  const resolvedTarget = target ?? report.target;
  const status = loadStatusForTarget(resolvedTarget);
  const greenItems = listApplicableGreenItems(report);
  const eligible = isEligibleForAutoApply(status, report);

  console.log(`[apply-green] レポート: ${reportPath}`);
  console.log(`[apply-green] target=${resolvedTarget} AUTO_APPLY_GREEN=${autoApplyGreen}`);
  console.log(
    `[apply-green] GREEN=${greenItems.length}件 YELLOW=${report.summary?.yellow ?? "?"}件 RED=${report.summary?.red ?? "?"}件 ` +
      `連続正常実行=${status?.consecutiveSuccessfulRuns ?? 0}回 最終適用可否(isEligibleForAutoApply)=${eligible}`,
  );

  if (greenItems.length === 0) {
    console.log("[apply-green] GREEN判定の項目はありません。反映対象なし。");
  } else if (!autoApplyGreen) {
    console.log(
      `[apply-green] ${greenItems.length}件のGREEN項目がありますが、AUTO_APPLY_GREEN=falseのため何も反映していません（dry-run）。`,
    );
  } else {
    console.log(
      `[apply-green] ${greenItems.length}件のGREEN項目があります。AUTO_APPLY_GREEN=trueですが、` +
        "本番データへの書き込みロジックは今回のスクリプトには実装されていないため、依然として何も反映していません（dry-run相当）。",
    );
  }

  if (!eligible) {
    console.log(
      "[apply-green] isEligibleForAutoApply=false のため、AUTO_APPLY_GREENの値によらず自動反映の対象外です " +
        "（連続正常実行3回未満、または当該レポートにYELLOW/RED、またはサーキットブレーカー発動あり）。",
    );
  }

  const record = {
    target: resolvedTarget,
    generatedAt: new Date().toISOString(),
    sourceReportPath: reportPath,
    autoApplyGreenFlag: autoApplyGreen,
    isEligibleForAutoApply: eligible,
    statusSnapshot: status,
    greenItemCount: greenItems.length,
    // 「反映されたであろう内容」のプレビュー。実際の書き込みは行っていない。
    wouldApplyItems: greenItems.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sessionId: entry.sessionId ?? null,
      outcome: entry.outcome,
      reason: entry.reason,
    })),
    note:
      "このレコードはdry-run結果であり、本番データ（src/data/*.json）への書き込みは一切行っていない。" +
      "実際の書き込みロジックは意図的に未実装（将来、人間承認プロセスとあわせて別途実装する）。",
  };
  const outPath = writeDryRunApplyRecord(resolvedTarget, record);
  console.log(`[apply-green] dry-run記録を書き出し: ${outPath}`);
  console.log(`[apply-green] status.json参照元: ${STATUS_PATH}`);
}

// `node scripts/auto-update/integration/apply-green.mjs`として直接実行された場合のみ実行する
// （回帰テスト等からreadAutoApplyGreenFlag／listApplicableGreenItems／isEligibleForAutoApplyの
// みをimportして使う場合に、CLI引数必須のmain()が副作用として実行されないようにするため）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
