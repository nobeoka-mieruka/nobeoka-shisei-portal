/**
 * 誤抽出と判断した議案データを却下する（publicationStatus: "rejected"へ変更する）。
 * 却下したデータは、以後の自動抽出（scripts/extract-council-pdf-data.mjs）で
 * 内容が変わらない限り無条件に復活しない（人が明示的に取り消すまで却下状態を維持する）。
 *
 * データは削除しない（誤って却下した場合に内容を確認できるよう残す）。
 *
 * 使い方：
 *   node scripts/reject-council-data.mjs --bill=2026-06-gian-42
 *   node scripts/reject-council-data.mjs --bill=2026-06-gian-42 --reason="件名が誤って抽出されている"
 *   node scripts/reject-council-data.mjs --bill=2026-06-gian-42 --undo   （却下を取り消す＝pendingReviewへ戻す）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const billVotesPath = join(root, "src", "data", "billVotes.json");

const args = process.argv.slice(2);
const billId = (args.find((a) => a.startsWith("--bill=")) ?? args.find((a) => a.startsWith("--proposal=")))?.split("=")[1];
const reason = args.find((a) => a.startsWith("--reason="))?.split("=").slice(1).join("=");
const isUndo = args.includes("--undo");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

if (!billId) {
  console.error("[reject-council-data] --bill=<議案ID> を指定してください。");
  process.exit(1);
}

const billVotes = readJson(billVotesPath);
const bill = billVotes.find((b) => b.id === billId);
if (!bill) {
  console.error(`[reject-council-data] 議案が見つかりません: ${billId}`);
  process.exit(1);
}

if (isUndo) {
  if (bill.publicationStatus !== "rejected") {
    console.log(`[reject-council-data] ${billId} は却下状態ではありません（publicationStatus: ${bill.publicationStatus ?? "published"}）。`);
    process.exit(0);
  }
  bill.publicationStatus = "pendingReview";
  writeJson(billVotesPath, billVotes);
  console.log(`[reject-council-data] ${billId} の却下を取り消し、確認待ち（pendingReview）へ戻しました。`);
  process.exit(0);
}

bill.publicationStatus = "rejected";
if (reason) bill.extractionNotes = reason;
writeJson(billVotesPath, billVotes);
console.log(`[reject-council-data] ${billId}（${bill.billNumber} ${bill.billTitle}）を publicationStatus: "rejected" に変更しました。`);
console.log("[reject-council-data] このデータは以後の自動抽出で内容が変わらない限り再登録されません。データ自体は削除していません。");
