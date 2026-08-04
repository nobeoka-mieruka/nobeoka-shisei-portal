/**
 * フェーズ10A：自動巡回基盤（ダミー実装）のCI実行スクリプト。
 *
 * src/lib/archiveCrawler.ts（TypeScript）と同じ判定ロジックをここでミラー実装している。
 * このプロジェクトのscripts/配下は他のファイルも同様に、ビルド前のTypeScriptを直接importできない
 * ため（scripts/lib/public-routes.mjsの既存コメントを参照）、プレーンJSとして複製している。
 * ロジックを変更する場合は src/lib/archiveCrawler.ts 側もあわせて更新すること。
 *
 * 実際のHTTP取得・差分の自動反映は行わない。120時間ゲート判定・対象読込・ダミー巡回・
 * state更新・ログ出力（コンソールのみ、logs/への永続化は今回未実装）だけを行う。
 *
 * --force で120時間ゲートを無視して実行する。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalState, saveLocalState, shouldRun, appendHistory } from "./lib/sync-state.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const TARGETS_PATH = join(root, "src", "data", "archiveCrawlerTargets.json");
const STATE_PATH = join(root, "src", "data", "archiveCrawlerState.json");
// sync-council-data.mjsとゲート状態を共有しないよう、専用のローカル状態ファイルを使う。
const GATE_STATE_PATH = join(root, "scripts", "_archive-crawler-sync-state.json");

const isForce = process.argv.includes("--force");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function runDummyCrawl(targets, now = new Date()) {
  const checkedAt = now.toISOString();
  const results = targets.map((target) => {
    if (target.existingImplementation) {
      return {
        targetId: target.id,
        status: "skipped",
        checkedAt,
        contentHash: null,
        errorMessage: `既存実装（${target.existingImplementation}）で取得済みのため、このダミー巡回ではスキップしました。`,
      };
    }
    if (!target.url) {
      return {
        targetId: target.id,
        status: "skipped",
        checkedAt,
        contentHash: null,
        errorMessage: "監視対象の公式URLが未確認のためスキップしました。",
      };
    }
    return { targetId: target.id, status: "unchanged", checkedAt, contentHash: null };
  });

  return {
    runAt: checkedAt,
    results,
    summary: {
      total: results.length,
      changed: results.filter((r) => r.status === "changed").length,
      unchanged: results.filter((r) => r.status === "unchanged").length,
      errors: results.filter((r) => r.status === "error").length,
      skipped: results.filter((r) => r.status === "skipped").length,
    },
  };
}

function mergeCrawlerState(previous, log) {
  const byId = new Map(previous.targets.map((t) => [t.targetId, t]));
  for (const result of log.results) {
    const prev = byId.get(result.targetId);
    byId.set(result.targetId, {
      targetId: result.targetId,
      lastCheckedAt: result.checkedAt,
      lastSuccessfulAt: result.status === "error" ? (prev?.lastSuccessfulAt ?? null) : result.checkedAt,
      lastStatus: result.status,
      lastContentHash: result.contentHash ?? prev?.lastContentHash ?? null,
    });
  }
  const hadErrors = log.summary.errors > 0;
  return {
    lastRunAt: log.runAt,
    lastSuccessfulRunAt: hadErrors ? previous.lastSuccessfulRunAt : log.runAt,
    targets: [...byId.values()],
    totalCount: log.summary.total,
    changedCount: log.summary.changed,
    errorCount: log.summary.errors,
  };
}

function main() {
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
  const log = runDummyCrawl(targets);
  const nextState = mergeCrawlerState(previousState, log);

  writeFileSync(STATE_PATH, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");

  console.log(
    `[archive-crawler] 巡回完了：対象${log.summary.total}件（変更${log.summary.changed}／変更なし${log.summary.unchanged}／スキップ${log.summary.skipped}／エラー${log.summary.errors}）`,
  );
  for (const result of log.results) {
    if (result.errorMessage) console.log(`  - ${result.targetId}: ${result.status}（${result.errorMessage}）`);
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const lines = [
      "## 自動巡回基盤（フェーズ10A・ダミー実行）",
      "",
      `- 実行日時: ${log.runAt}`,
      `- 対象件数: ${log.summary.total}`,
      `- 変更あり: ${log.summary.changed} / 変更なし: ${log.summary.unchanged} / スキップ: ${log.summary.skipped} / エラー: ${log.summary.errors}`,
      "",
      "実際のHTTP取得・差分の自動反映はまだ行っていません（フェーズ10Aは基盤のみ）。",
      "",
    ];
    writeFileSync(summaryPath, `${lines.join("\n")}\n`, { flag: "a" });
  }

  const nowIso = log.runAt;
  const updatedGateState = appendHistory(
    { ...gateState, lastAttemptAt: nowIso, lastSuccessfulRunAt: log.summary.errors > 0 ? gateState.lastSuccessfulRunAt : nowIso },
    { runAt: nowIso, total: log.summary.total, changed: log.summary.changed, errors: log.summary.errors },
  );
  saveLocalState(updatedGateState, GATE_STATE_PATH);

  console.log("SYNC_RAN=true");
}

main();
