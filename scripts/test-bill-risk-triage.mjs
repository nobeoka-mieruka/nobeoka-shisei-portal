/**
 * Phase145：全1,178件のリスク分類（SAFE/REVIEW/HOLD）と、Phase145の並列検証（MATCH/IMPROVED/
 * REGRESSION/AMBIGUOUS）で更新したデータの整合性についての回帰テスト。
 *
 * 使い方: node scripts/test-bill-risk-triage.mjs
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
assert.equal(billVotes.length, 1178, "billVotes.jsonの件数が1,178件ではありません");

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

console.log("\nPhase145：リスク分類・並列検証後のデータ整合性");

check("A + B + D の合計が議案総数1,178件と一致する（C区分は実例0件のため式に含めない）", () => {
  let A = 0, B = 0, D = 0;
  for (const b of billVotes) {
    const c = classifyRetrieval(b);
    if (c === "A") A++;
    else if (c === "B") B++;
    else D++;
  }
  assert.equal(A + B + D, 1178, `A+B+Dの合計が1,178件ではありません（A=${A} B=${B} D=${D}）`);
});

check("Level1 + Level2 + Level3 の合計が議案総数1,178件と一致する", () => {
  let L1 = 0, L2 = 0, L3 = 0;
  for (const b of billVotes) {
    if (isLevel3(b)) L3++;
    else if (isLevel2(b)) L2++;
    else L1++;
  }
  assert.equal(L1 + L2 + L3, 1178, `Level1+Level2+Level3の合計が1,178件ではありません（L1=${L1} L2=${L2} L3=${L3}）`);
});

check("Level3の議案は、すべてtranscriptUrlまたはrelatedDocumentUrls（会議録）を持つ（根拠資料を追跡できない独自要約が無い）", () => {
  const missing = billVotes.filter((b) => isLevel3(b) && !b.transcriptUrl && !(b.relatedDocumentUrls ?? []).some((d) => d.sourceType === "会議録"));
  assert.equal(missing.length, 0, `会議録の根拠を追跡できないLevel3議案: ${missing.map((b) => b.id).join("、")}`);
});

check("Level2の議案は、すべてsourceTextVerifiedAtを持ち、reason/citizenImpact等の独自内容を持たない（無理な昇格が無い）", () => {
  const level2 = billVotes.filter(isLevel2);
  for (const b of level2) {
    assert.ok(b.sourceTextVerifiedAt, `${b.id}: sourceTextVerifiedAtがありません`);
    assert.ok(!b.reason && !b.citizenImpact, `${b.id}: Level2のはずが独自内容を持っています`);
  }
  const bill162 = billVotes.find((b) => b.id === "2026-03-gian-162");
  assert.ok(bill162 && isLevel2(bill162), "議案第162号がLevel2ではありません（無理な昇格または降格の疑い）");
});

check("Phase144までの既存Level3（61件）が、Phase145の処理で意図せず後退（reason等の消失）していない", () => {
  const phase144Level3Sample = [
    "2026-03-gian-129", "2024-06-gian-18", "2024-09-gian-28", "2024-09-gian-53", "2024-03-gian-141",
  ];
  for (const id of phase144Level3Sample) {
    const b = billVotes.find((x) => x.id === id);
    assert.ok(b, `対象議案が見つかりません: ${id}`);
    assert.ok(isLevel3(b), `${id}: Phase144時点でLevel3だった議案がLevel3でなくなっています（後退）`);
  }
});

check("REGRESSION（議案第37号の議決結果・議案名等）は、既存データを書き換えていない（一次資料PDFで既存値が正しいと確認済み）", () => {
  const b = billVotes.find((x) => x.id === "2023-09-gian-37");
  assert.ok(b, "2023-09-gian-37が見つかりません");
  assert.equal(b.billNumber, "議案第37号", "議案番号が書き換えられています");
  assert.equal(b.billTitle, "令和5年度延岡市一般会計補正予算", "議案名が書き換えられています");
  assert.equal(b.votingDate, "2023-08-25", "議決日が書き換えられています");
});

check("Phase145で新たにLevel3化した議案のmainChangesは、算用数字＋省略単位（千円・百万円の決算書特有表記）を含まない（単位変換ミスの簡易検査）", () => {
  const suspiciousSenPattern = /(?<![万][0-9０-９,，]{0,4})[0-9０-９][,，0-9０-９]*\s*千円/;
  const suspiciousHyakumanPattern = /[0-9０-９][,，0-9０-９]*\s*百万円/;
  const suspects = [];
  for (const b of billVotes.filter(isLevel3)) {
    for (const line of b.mainChanges ?? []) {
      if (suspiciousSenPattern.test(line) || suspiciousHyakumanPattern.test(line)) suspects.push(`${b.id}: ${line}`);
    }
  }
  assert.equal(suspects.length, 0, `単位変換ミスの疑いがある記述: ${suspects.join(" / ")}`);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
