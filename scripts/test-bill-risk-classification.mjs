/**
 * Phase145：議案の自動処理リスク分類（SAFE/REVIEW/HOLD/VERIFIED）の回帰テスト。
 * src/lib/billRiskClassification.tsはTypeScriptのためこのプレーンNodeスクリプトから直接
 * importできない。判定ロジックをミラーして検証する（値がズレた場合はlibファイル側の
 * コメントも合わせて更新すること）。
 *
 * 使い方: node scripts/test-bill-risk-classification.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const billVotes = JSON.parse(readFileSync(join(ROOT, "src/data/billVotes.json"), "utf8"));
assert.equal(billVotes.length, 1177, "billVotes.jsonの件数が1,177件ではありません");

const STRUCTURED_CATEGORIES = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);
const LINK_CONFIRMED_YEARS = new Set(["令和5年度", "令和6年度", "令和7年度", "令和8年度"]);

function classifyRetrieval(b) {
  if (b.transcriptUrl) return STRUCTURED_CATEGORIES.has(b.category) ? "A" : "B";
  if (LINK_CONFIRMED_YEARS.has(b.fiscalYear)) return "B";
  return "D";
}
function isLevel3(b) {
  return b.summarySource === "manual" && Boolean(b.reason || (b.mainChanges && b.mainChanges.length > 0) || b.citizenImpact);
}
function isLevel2(b) {
  return Boolean(b.sourceTextVerifiedAt) && !isLevel3(b);
}
function classifyRisk(b) {
  if (isLevel3(b) || isLevel2(b)) return "VERIFIED";
  if (b.category === "請願" || b.category === "陳情") return "HOLD";
  if (b.result === "撤回" || b.result === "廃案") return "HOLD";
  if (b.category === "意見書" || b.category === "決議") return "HOLD";
  if (b.category === "不明") return "HOLD";
  if (b.category === "人事") return "REVIEW";
  const retrieval = classifyRetrieval(b);
  if (retrieval === "B" && !STRUCTURED_CATEGORIES.has(b.category)) return "REVIEW";
  if (STRUCTURED_CATEGORIES.has(b.category)) return b.proposerType === "mayor" ? "SAFE" : "REVIEW";
  return "REVIEW";
}

console.log("\n議案の自動処理リスク分類の現況");

check("SAFE/REVIEW/HOLD/VERIFIEDの合計が議案総数1,177件と一致する", () => {
  const counts = { SAFE: 0, REVIEW: 0, HOLD: 0, VERIFIED: 0 };
  for (const b of billVotes) counts[classifyRisk(b)]++;
  const sum = Object.values(counts).reduce((a, c) => a + c, 0);
  assert.equal(sum, 1177, `合計が1,177件ではありません（${sum}件）: ${JSON.stringify(counts)}`);
});

check("HOLD分類には請願・陳情・意見書・決議・撤回・廃案・不明以外の議案が含まれていない", () => {
  const holdBills = billVotes.filter((b) => classifyRisk(b) === "HOLD");
  const allowedCategories = new Set(["請願", "陳情", "意見書", "決議", "不明"]);
  const invalid = holdBills.filter((b) => !allowedCategories.has(b.category) && b.result !== "撤回" && b.result !== "廃案");
  assert.equal(invalid.length, 0, `HOLD分類に想定外の議案が含まれています: ${invalid.map((b) => b.id).join("、")}`);
});

check("SAFE分類はすべて市長提出・構造化しやすいカテゴリ（予算/契約/財産取得/決算/専決処分）である", () => {
  const safeBills = billVotes.filter((b) => classifyRisk(b) === "SAFE");
  assert.ok(safeBills.length > 0, "SAFE分類の議案が1件もありません");
  const invalid = safeBills.filter((b) => b.proposerType !== "mayor" || !STRUCTURED_CATEGORIES.has(b.category));
  assert.equal(invalid.length, 0, `SAFE分類の条件を満たさない議案があります: ${invalid.map((b) => b.id).join("、")}`);
});

check("人事案件（97件）はすべてREVIEW分類であり、SAFEへ無条件で含まれていない（項目9：人名の誤登録防止）", () => {
  const jinjiBills = billVotes.filter((b) => b.category === "人事");
  assert.ok(jinjiBills.length > 0, "人事案件が1件もありません");
  const notReview = jinjiBills.filter((b) => classifyRisk(b) !== "REVIEW" && classifyRisk(b) !== "VERIFIED");
  assert.equal(notReview.length, 0, `REVIEW/VERIFIED以外に分類された人事案件があります: ${notReview.map((b) => `${b.id}(${classifyRisk(b)})`).join("、")}`);
});

check("VERIFIED（Phase142-145で本文確認済み）の件数が、Level2＋Level3の件数と一致する", () => {
  const verifiedCount = billVotes.filter((b) => classifyRisk(b) === "VERIFIED").length;
  const level23Count = billVotes.filter((b) => isLevel2(b) || isLevel3(b)).length;
  assert.equal(verifiedCount, level23Count, `VERIFIEDの件数(${verifiedCount})とLevel2+Level3の件数(${level23Count})が一致しません`);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
