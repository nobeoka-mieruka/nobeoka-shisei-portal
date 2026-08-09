/**
 * BLOCKEDタスクの安全な自動再開判定。
 *
 * src/data/blockedTaskWatch.json（BLOCKEDタスクごとの監視レジストリ）と
 * src/data/archiveCrawlerState.json（scripts/run-archive-crawler.mjsが更新する巡回結果）を
 * 突き合わせ、監視対象URLの内容が「前回人が確認・承認した状態（lastAcknowledgedHash）」から
 * 変化していないかを機械的に確認する。
 *
 * 重要な安全設計：
 * - このスクリプトは絶対に status を "ready" へは変更しない。変更できるのは
 *   "blocked" → "review_required" のみ（新しい一次資料が公開された可能性を検知したら、
 *   人による内容確認が必要というフラグを立てるだけ）。
 * - lastAcknowledgedHash はこのスクリプトからは更新しない（人が実際に内容を確認し、
 *   関連するタスク・データを処理した上で、次回の再登録時にのみ更新する）。
 *   そのため、一度 review_required になったエントリは、人が対応するまで
 *   同じ差分で何度もフラグが再送されることはない（既にreview_requiredのエントリは
 *   このスクリプトが素通りする＝冪等）。
 * - crawlerTargetIdが設定されていない、またはdetectionModeが"hash"以外のエントリは
 *   処理対象外（監視できない・別の仕組みで既にカバーされている、のいずれか）。
 * - 実際のデータ（人物経歴・金額・日付等）を取得・登録することは一切行わない
 *   （REVIEW_REQUIREDへの状態変更のみ。内容の解釈・登録は人またはClaude Codeの別セッションが行う）。
 *
 * 使い方：
 *   node scripts/check-blocked-resume.mjs
 *
 * 終了時、標準出力へ BLOCKED_RESUME_CHANGED=true|false を出力する
 * （呼び出し側のワークフローが、後続のcommit/pushステップを実行するかどうかの判定に使う）。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const WATCH_PATH = join(root, "src/data/blockedTaskWatch.json");
const CRAWLER_STATE_PATH = join(root, "src/data/archiveCrawlerState.json");
const REPORT_PATH = join(root, "reports/blocked-resume-check-report.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const watchList = readJson(WATCH_PATH);
const crawlerState = readJson(CRAWLER_STATE_PATH);

const checkedAt = new Date().toISOString();
const results = [];
let anyTransition = false;

for (const entry of watchList) {
  if (entry.detectionMode !== "hash" || !entry.crawlerTargetId) {
    results.push({ taskId: entry.taskId, action: "skipped", reason: `detectionMode=${entry.detectionMode}（監視対象URLなし、または既存の別の仕組みでカバー済み）` });
    continue;
  }

  const targetState = crawlerState.targets?.find((t) => t.targetId === entry.crawlerTargetId);
  if (!targetState) {
    results.push({ taskId: entry.taskId, action: "skipped", reason: `archiveCrawlerState.jsonに${entry.crawlerTargetId}の記録がありません（未実行の可能性）` });
    continue;
  }

  if (targetState.lastStatus === "error" || targetState.lastStatus === "skipped") {
    results.push({ taskId: entry.taskId, action: "skipped", reason: `巡回対象の直近ステータスが${targetState.lastStatus}のため判定を見送りました` });
    continue;
  }

  if (entry.status === "review_required") {
    // 既にフラグ済み。人が対応するまで再送しない（冪等性の担保）。
    results.push({ taskId: entry.taskId, action: "already_flagged", reason: "既にreview_required状態です（人による対応待ち）" });
    continue;
  }

  const currentHash = targetState.lastContentHash ?? null;
  if (!currentHash) {
    results.push({ taskId: entry.taskId, action: "skipped", reason: "巡回対象にcontentHashがありません（フェッチ失敗の可能性）" });
    continue;
  }

  if (currentHash === entry.lastAcknowledgedHash) {
    results.push({ taskId: entry.taskId, action: "no_change", reason: "前回承認済みハッシュと一致（変化なし）" });
    continue;
  }

  // ここに到達するのは「blocked状態」かつ「承認済みハッシュと異なる新しいコンテンツを検知した」場合のみ。
  entry.status = "review_required";
  entry.lastTransitionAt = checkedAt;
  entry.lastCheckedAt = checkedAt;
  anyTransition = true;
  results.push({
    taskId: entry.taskId,
    action: "transitioned_to_review_required",
    reason: `監視対象（${entry.crawlerTargetId}）のコンテンツハッシュが変化しました（旧: ${entry.lastAcknowledgedHash ?? "なし"} → 新: ${currentHash}）。内容の確認・承認（lastAcknowledgedHashの更新）は人が行ってください。`,
    previousHash: entry.lastAcknowledgedHash,
    newHash: currentHash,
  });
}

// lastCheckedAtは「実際にステータスが変化した」エントリのみ更新する（req #9：状態変更が発生した場合のみ
// 後続処理を起動する、という設計に合わせ、変化のないエントリの見かけ上の差分でcommitが発生しないようにする）。

if (anyTransition) {
  writeFileSync(WATCH_PATH, `${JSON.stringify(watchList, null, 2)}\n`, "utf8");
}

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(
  REPORT_PATH,
  `${JSON.stringify({ checkedAt, anyTransition, results }, null, 2)}\n`,
  "utf8",
);

console.log(`[check-blocked-resume] 判定完了：対象${watchList.length}件中、状態変化${results.filter((r) => r.action === "transitioned_to_review_required").length}件`);
for (const r of results) {
  console.log(`  - ${r.taskId}: ${r.action}（${r.reason}）`);
}
console.log(`BLOCKED_RESUME_CHANGED=${anyTransition}`);
