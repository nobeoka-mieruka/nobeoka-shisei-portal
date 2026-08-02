/**
 * pendingReview状態の議案データを確認したうえで公開する（publicationStatus: "published"へ変更する）ための
 * 補助スクリプト。データそのものは書き換えず、公開可否の判定に必要な確認だけを行う。
 *
 * 使い方：
 *   node scripts/approve-council-data.mjs --bill=2026-06-gian-42
 *   node scripts/approve-council-data.mjs --bill=2026-06-gian-42 --dry-run
 *   node scripts/approve-council-data.mjs --session=2026-06   （そのセッションの確認待ちを一括承認）
 *   node scripts/approve-council-data.mjs --list              （確認待ち一覧を表示するだけ）
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
const billId = (args.find((a) => a.startsWith("--bill=")) ?? args.find((a) => a.startsWith("--proposal=")))?.split("=")[1];
const sessionId = args.find((a) => a.startsWith("--session="))?.split("=")[1];

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

function runChecks(bill) {
  const checks = [];
  const check = (label, ok, detail) => checks.push({ label, ok, detail });

  const duplicateCount = billVotes.filter((b) => b.id === bill.id).length;
  check("議案IDの重複確認", duplicateCount === 1, duplicateCount === 1 ? "重複なし" : `${duplicateCount}件の重複ID`);

  if ((bill.memberVotes ?? []).length > 0) {
    const missing = bill.memberVotes.filter((v) => !memberIds.has(v.memberId));
    const dupVoters = bill.memberVotes.map((v) => v.memberId).filter((id, i, arr) => arr.indexOf(id) !== i);
    check("memberIdの存在確認", missing.length === 0, missing.length === 0 ? "全員一致" : `不明なmemberId: ${missing.map((v) => v.memberId).join(", ")}`);
    check("議員の重複確認", dupVoters.length === 0, dupVoters.length === 0 ? "重複なし" : `重複: ${dupVoters.join(", ")}`);
  } else {
    check("memberIdの存在確認", true, "対象外（このデータには議員別賛否が含まれていません）");
    check("議員の重複確認", true, "対象外（同上）");
  }

  check("表決人数の整合性確認", true, "対象外（審議結果PDFには議員別賛否が記載されていないため）");
  check("出席議員数との整合性確認", true, "対象外（同上）");
  check("議長・欠席・除斥の扱い確認", true, "対象外（同上）");

  const hasSource = !!bill.sourceFilePath || !!bill.resultDocumentUrl;
  check("出典PDFの確認", hasSource, hasSource ? `${bill.sourceFilePath ?? bill.resultDocumentUrl}` : "出典PDFが設定されていません");
  check("出典ページ番号の確認", bill.sourcePage != null, bill.sourcePage != null ? `${bill.sourcePage}ページ目` : "ページ番号が未設定です（確認のうえ承認してください）");

  return checks;
}

function approveOne(bill) {
  console.log(`\n[approve-council-data] ${bill.id}（${bill.billNumber} ${bill.billTitle}）の承認前チェック:`);
  const checks = runChecks(bill);
  let allOk = true;
  for (const c of checks) {
    console.log(`  ${c.ok ? "OK" : "NG"}  ${c.label}: ${c.detail}`);
    if (!c.ok) allOk = false;
  }
  if (!allOk) {
    console.error(`[approve-council-data] ${bill.id}: 確認に失敗した項目があるため承認しませんでした。`);
    return false;
  }
  if (isDryRun) {
    console.log(`[approve-council-data] ${bill.id}: --dry-run のため実際の変更は行いませんでした。`);
    return true;
  }
  bill.publicationStatus = "published";
  delete bill.extractionNotes;
  console.log(`[approve-council-data] ${bill.id} を publicationStatus: "published" に変更しました。`);
  return true;
}

if (shouldList) {
  const pending = billVotes.filter(isPending);
  if (pending.length === 0) {
    console.log("[approve-council-data] 確認待ちの議案はありません。");
  } else {
    console.log(`[approve-council-data] 確認待ち ${pending.length}件:`);
    for (const b of pending) {
      console.log(
        `  --bill=${b.id}  ${b.billNumber} ${b.billTitle}  結果=${b.result}  理由=${b.extractionNotes ?? "(理由未記録)"}`,
      );
    }
  }
  process.exit(0);
}

if (sessionId) {
  const targets = billVotes.filter((b) => b.sessionId === sessionId && isPending(b));
  if (targets.length === 0) {
    console.log(`[approve-council-data] ${sessionId} に確認待ちの議案はありません。`);
    process.exit(0);
  }
  let approvedCount = 0;
  for (const bill of targets) {
    if (approveOne(bill)) approvedCount++;
  }
  if (!isDryRun) writeJson(billVotesPath, billVotes);
  console.log(`\n[approve-council-data] ${sessionId}: ${approvedCount}/${targets.length}件を承認しました。`);
  process.exit(0);
}

if (!billId) {
  console.error("[approve-council-data] --bill=<議案ID> または --session=<定例会ID> または --list を指定してください。");
  process.exit(1);
}

const bill = billVotes.find((b) => b.id === billId);
if (!bill) {
  console.error(`[approve-council-data] 議案が見つかりません: ${billId}`);
  process.exit(1);
}
if (!isPending(bill)) {
  console.log(`[approve-council-data] この議案は確認待ちではありません（publicationStatus: ${bill.publicationStatus ?? "published"}）。`);
  process.exit(0);
}

const ok = approveOne(bill);
if (!ok) process.exit(1);
if (!isDryRun) writeJson(billVotesPath, billVotes);
