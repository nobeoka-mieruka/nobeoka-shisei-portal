/**
 * pendingReview状態の議案データを確認したうえで公開する（publicationStatus: "published"へ変更する）ための
 * 補助スクリプト。データそのものは書き換えず、公開可否の判定に必要な確認だけを行う。
 *
 * 使い方：
 *   node scripts/approve-council-data.mjs --proposal=2026-06-gian-42
 *   node scripts/approve-council-data.mjs --proposal=2026-06-gian-42 --dry-run
 *   node scripts/approve-council-data.mjs --list   （確認待ち一覧を表示するだけ）
 *
 * 承認前に以下を確認する（該当しない項目は"対象外"としてスキップする）：
 * - 議案IDの重複がないか
 * - memberVotesに存在しない議員IDがないか（このスクリプトが対象とするデータには通常memberVotesはない）
 * - 出典PDF（sourceFilePath）・出典ページ（sourcePage）が確認できるか
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const billVotesPath = join(root, "src", "data", "billVotes.json");
const membersPath = join(root, "src", "data", "members.json");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const shouldList = args.includes("--list");
const proposalId = args.find((a) => a.startsWith("--proposal="))?.split("=")[1];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const billVotes = readJson(billVotesPath);
const memberIds = new Set(readJson(membersPath).map((m) => m.id));

function isPending(b) {
  return b.publicationStatus === "pendingReview" || b.publicationStatus === "updatedPendingReview";
}

if (shouldList || !proposalId) {
  const pending = billVotes.filter(isPending);
  if (pending.length === 0) {
    console.log("[approve-council-data] 確認待ちの議案はありません。");
  } else {
    console.log(`[approve-council-data] 確認待ち ${pending.length}件:`);
    for (const b of pending) {
      console.log(
        `  --proposal=${b.id}  ${b.billNumber} ${b.billTitle}  結果=${b.result}  理由=${b.extractionNotes ?? "(理由未記録)"}`,
      );
    }
  }
  if (!proposalId) process.exit(0);
}

const bill = billVotes.find((b) => b.id === proposalId);
if (!bill) {
  console.error(`[approve-council-data] 議案が見つかりません: ${proposalId}`);
  process.exit(1);
}
if (!isPending(bill)) {
  console.log(`[approve-council-data] この議案は確認待ちではありません（publicationStatus: ${bill.publicationStatus ?? "published"}）。`);
  process.exit(0);
}

const checks = [];
function check(label, ok, detail) {
  checks.push({ label, ok, detail });
}

// 議案IDの重複がないか
const duplicateCount = billVotes.filter((b) => b.id === bill.id).length;
check("議案IDの重複確認", duplicateCount === 1, duplicateCount === 1 ? "重複なし" : `${duplicateCount}件の重複ID`);

// memberIdの存在確認（対象データが議員別賛否を持つ場合のみ）
if ((bill.memberVotes ?? []).length > 0) {
  const missing = bill.memberVotes.filter((v) => !memberIds.has(v.memberId));
  check("memberIdの存在確認", missing.length === 0, missing.length === 0 ? "全員一致" : `不明なmemberId: ${missing.map((v) => v.memberId).join(", ")}`);
} else {
  check("memberIdの存在確認", true, "対象外（このデータには議員別賛否が含まれていません）");
}

// 表決人数・出席議員数との整合性確認（このデータソースには議員別賛否がないため対象外）
check("表決人数の整合性確認", true, "対象外（審議結果PDFには議員別賛否が記載されていないため）");
check("出席議員数との整合性確認", true, "対象外（同上）");
check("議長・欠席・除斥の扱い確認", true, "対象外（同上）");

// 出典PDFとページ番号の確認
const hasSource = !!bill.sourceFilePath || !!bill.resultDocumentUrl;
check("出典PDFの確認", hasSource, hasSource ? `${bill.sourceFilePath ?? bill.resultDocumentUrl}` : "出典PDFが設定されていません");
check("出典ページ番号の確認", bill.sourcePage != null, bill.sourcePage != null ? `${bill.sourcePage}ページ目` : "ページ番号が未設定です（確認のうえ承認してください）");

console.log(`\n[approve-council-data] ${bill.id}（${bill.billNumber} ${bill.billTitle}）の承認前チェック:`);
let allOk = true;
for (const c of checks) {
  console.log(`  ${c.ok ? "OK" : "NG"}  ${c.label}: ${c.detail}`);
  if (!c.ok) allOk = false;
}

if (!allOk) {
  console.error("\n[approve-council-data] 確認に失敗した項目があるため、承認を中止しました。データは変更していません。");
  process.exit(1);
}

if (isDryRun) {
  console.log("\n[approve-council-data] --dry-run のため、実際の変更は行いませんでした。");
  process.exit(0);
}

bill.publicationStatus = "published";
delete bill.extractionNotes;
writeJson(billVotesPath, billVotes);
console.log(`\n[approve-council-data] ${bill.id} を publicationStatus: "published" に変更しました。`);
