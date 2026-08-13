// Phase114：WAITING_EXTERNAL（会議録公開待ち）タスクの自動再確認スクリプト。
//
// 目的：TASK-004（令和8年5月臨時会・6月定例会の会議録待ち）について、会議録検索システム
// （kensakusystem.jp）に該当会期がまだ現れていないかを、既存の低レベルクライアント
// （scripts/lib/minutes-source.mjs）を使って確認する。サイト閲覧時（ユーザーアクセス時）に
// 毎回外部サイトへアクセスする設計は禁止のため、この確認はビルド時・自動更新ワークフロー
// （.github/workflows/update-council-documents.yml）側でのみ実行する。
//
// 【重要】このスクリプトは「新しい会期が現れたかどうか」を検知するだけで、billVotes.jsonの
// voteMethod・committee等を自動抽出・自動登録することはしない（Phase101/107で行った
// 発言者ラベル抽出・氏名照合は、誤登録防止のため人手（AI含む）による確認を伴う個別作業として
// 維持する）。検知した場合は、blockedTaskClassification.jsonのnotesへ「新しい会期を検出した」
// という事実だけを追記し、status自体はWAITING_EXTERNALのまま変更しない
// （実際の抽出・確認が完了するまでconfirmedへは進めない）。
//
// 実行方法：node --experimental-strip-types scripts/check-pending-council-minutes.mjs
// 失敗時（ネットワークエラー等）も自動更新ワークフロー全体を止めないよう、常にexit 0とする。

import { readFileSync, writeFileSync } from "fs";
import { listSessionsForYear } from "./lib/minutes-source.mjs";

const CODE = "48o046ot0cia1xvtw7";
const BLOCKED_TASKS_PATH = "./src/data/blockedTaskClassification.json";

async function main() {
  const data = JSON.parse(readFileSync(BLOCKED_TASKS_PATH, "utf8"));
  const task004 = data.find((t) => t.taskId === "TASK-004");
  if (!task004 || task004.status !== "WAITING_EXTERNAL") {
    console.log("[check-pending-council-minutes] TASK-004が見つからないか、既にWAITING_EXTERNALではありません。何もしません。");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  let sessions;
  try {
    sessions = await listSessionsForYear({ code: CODE, year: 2026 });
  } catch (e) {
    console.log(`[check-pending-council-minutes] 確認に失敗しました（ネットワークエラー等の可能性）: ${e.message}`);
    console.log("[check-pending-council-minutes] blockedTaskClassification.jsonは変更しません（次回の自動実行で再試行します）。");
    return;
  }

  // 令和8年5月臨時会・6月定例会に相当する会期ラベルが新たに現れたかを、キーワードで判定する
  // （既存のparseSessionLabel()が返すlabelには「令和8年 第◯回定例会」等の表記が含まれる）。
  const knownAsOf20260813 = new Set(["令和 8年 第24回定例会"]);
  const newSessions = sessions.filter((s) => !knownAsOf20260813.has(s.label?.trim()));

  task004.lastCheckedAt = today;
  task004.attemptCount = (task004.attemptCount ?? 0) + 1;

  if (newSessions.length > 0) {
    const labels = newSessions.map((s) => s.label).join("、");
    console.log(`[check-pending-council-minutes] 新しい会期を検出しました: ${labels}`);
    task004.notes = `${task004.notes}\n【自動確認 ${today}】check-pending-council-minutes.mjsが新しい会期を検出しました（${labels}）。実際の議案別voteMethod・committeeの抽出・登録は、Phase101/107と同様の手動確認プロセス（氏名照合を伴う）で別途対応する必要があります。`;
  } else {
    console.log("[check-pending-council-minutes] 新しい会期は検出されませんでした（引き続きWAITING_EXTERNAL）。");
  }

  writeFileSync(BLOCKED_TASKS_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`[check-pending-council-minutes] lastCheckedAt=${today}, attemptCount=${task004.attemptCount}`);
}

main().catch((e) => {
  console.log(`[check-pending-council-minutes] 予期しないエラー（ワークフロー全体は継続します）: ${e.message}`);
});
