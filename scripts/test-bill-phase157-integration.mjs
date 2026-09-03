/**
 * Phase157：Phase153（条例96件）・Phase154（その他48件）の統合結果、および
 * Phase155（SOURCE_LINK_MISSING最終整理）・Phase156（R3/HOLD設計、データ変更なし）の
 * 回帰テスト。
 *
 * 使い方: node scripts/test-bill-phase157-integration.mjs
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
const billById = new Map(billVotes.map((b) => [b.id, b]));
const risk = JSON.parse(readFileSync(join(ROOT, "reports/phase145-bill-risk-classification.json"), "utf8"));

function isLevel3(b) {
  return b.summarySource === "manual" && Boolean(b.reason || (b.mainChanges && b.mainChanges.length > 0) || b.citizenImpact);
}
function isLevel2(b) {
  return Boolean(b.sourceTextVerifiedAt) && !isLevel3(b);
}

console.log("\nPhase157：Phase153〜156統合結果の現況");

check("Phase153（条例96件）：全件Level3化されている（実証済み30件と重複しない、310件全体への拡張はしていない）", () => {
  /*
   * Phase207による更新（なぜ動いたか）：
   * (1) Phase207 も同じ日付（2026-09-03）で、Phase160 が保留していた56件へ
   *     sourceTextVerifiedAt を記録した。そのため日付だけでは Phase153・154 の対象と
   *     区別できない。56件は sharedProposalStatement.generatedFrom に取得元
   *     （reports/phase160-held-for-future-56.json）を必ず記録しているため、それで除外する。
   * (2) Phase153・154 が「対象のみ確認できた」としてLevel2に据え置いた22件は、
   *     verificationNote に会議録原文の引用が既に転記されていた。Phase206 でその引用を
   *     再点検したところ、いずれも議案名の言い換えではなく、議案名からは分からない事実を
   *     含むこの議案固有の記述だったため、Phase207 で原文をそのまま提出理由として登録した
   *     （要約・言い換えなし。原文完全一致は test-bill-phase206-explainability.mjs で検証）。
   *     その結果 Level3 が 122→144、Level2 が 22→0 になった。
   */
  const isPhase207HeldRecord = (b) =>
    (b.sharedProposalStatement?.generatedFrom ?? "").includes("phase160-held-for-future-56.json");
  const touched = billVotes.filter((b) => b.sourceTextVerifiedAt === "2026-09-03" && !isPhase207HeldRecord(b));
  // Phase153の96件＋Phase154の48件＝144件がこの日付で変更されたはず。
  assert.equal(touched.length, 144, `sourceTextVerifiedAtが2026-09-03の議案が144件ではありません（${touched.length}件）`);
  const l3Count = touched.filter(isLevel3).length;
  const l2Count = touched.filter(isLevel2).length;
  assert.equal(l3Count, 144, `Phase153・154対象のうちLevel3が144件ではありません（${l3Count}件）`);
  assert.equal(l2Count, 0, `Phase153・154対象のうちLevel2が0件ではありません（${l2Count}件）`);
});

check("Level1+Level2+Level3の合計が議案総数1,177件と一致し、Level3総数はPhase157完了時点（510件）を下限とする", () => {
  let l1 = 0, l2 = 0, l3 = 0;
  for (const b of billVotes) {
    if (isLevel3(b)) l3++;
    else if (isLevel2(b)) l2++;
    else l1++;
  }
  assert.equal(l1 + l2 + l3, 1177, `Level1+2+3の合計が1,177件ではありません（${l1 + l2 + l3}件）`);
  // Phase158以降でさらにLevel3化が進むため、厳密な固定値ではなく下限チェックとする。
  // Phase158〜162時点の正確な値はtest-bill-phase162-integration.mjs側で検証する。
  assert.ok(l3 >= 510, `Level3の総数が510件を下回っています（${l3}件）`);
  assert.ok(l2 >= 65, `Level2の総数が65件を下回っています（${l2}件）`);
});

check("sourceTextVerifiedとLevel2+Level3の関係：sourceTextVerifiedAtを持つ議案は必ずLevel2かLevel3のいずれかであり、その逆（Level2/3なのにsourceTextVerifiedAtが無い）は存在しない", () => {
  const verified = billVotes.filter((b) => Boolean(b.sourceTextVerifiedAt));
  const notLevel23 = verified.filter((b) => !isLevel2(b) && !isLevel3(b));
  assert.equal(notLevel23.length, 0, `sourceTextVerifiedAtがあるのにLevel2でもLevel3でもない議案があります: ${notLevel23.map((b) => b.id).join("、")}`);
  const level23 = billVotes.filter((b) => isLevel2(b) || isLevel3(b));
  const missingVerified = level23.filter((b) => !b.sourceTextVerifiedAt);
  assert.equal(missingVerified.length, 0, `Level2/3なのにsourceTextVerifiedAtが無い議案があります: ${missingVerified.map((b) => b.id).join("、")}`);
});

check("R2 583件は総数不変。うちPhase149〜150・153〜154で処理済みの件数を動的に算出できる（固定値ではない）", () => {
  const STRUCTURED = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);
  function titleStem(t) { return t.replace(/[（(].*$/, "").trim(); }
  const sessionCategoryCount = new Map();
  const sessionTitleStemCount = new Map();
  for (const b of billVotes) {
    const k1 = `${b.session}|${b.category}`;
    sessionCategoryCount.set(k1, (sessionCategoryCount.get(k1) ?? 0) + 1);
    const k2 = `${b.session}|${titleStem(b.billTitle)}`;
    sessionTitleStemCount.set(k2, (sessionTitleStemCount.get(k2) ?? 0) + 1);
  }
  function isLikelyBatch(b) {
    const c1 = sessionCategoryCount.get(`${b.session}|${b.category}`) ?? 0;
    const c2 = sessionTitleStemCount.get(`${b.session}|${titleStem(b.billTitle)}`) ?? 0;
    return c1 >= 4 || c2 >= 3;
  }
  function tierOf(b) {
    if (b.category === "人事") return "R3";
    if (b.proposerType === "committee") return "R3";
    if (isLikelyBatch(b)) return "R2";
    return "R1";
  }
  const reviewBills = risk.REVIEW.map((id) => billById.get(id));
  const r2Bills = reviewBills.filter((b) => tierOf(b) === "R2");
  assert.equal(r2Bills.length, 583, `R2が583件ではありません（${r2Bills.length}件）`);
  const r2Processed = r2Bills.filter((b) => isLevel2(b) || isLevel3(b));
  const r2Unprocessed = r2Bills.filter((b) => !isLevel2(b) && !isLevel3(b));
  assert.equal(r2Processed.length + r2Unprocessed.length, 583, "R2処理済み＋未処理の合計が583件と一致しません");
  // Phase148（専決処分4件、R2）＋Phase149/153（条例、R2のうちordinance分）＋Phase150/154（その他、R2のうちnarrative分）
  // の累計が「処理済み」に該当するはずで、0件ではないことだけを確認する（具体的な内訳はreports側で管理）。
  assert.ok(r2Processed.length > 0, "R2処理済み件数が0件です（Phase148〜154の反映が正しく行われていない可能性）");
});

check("SOURCE_LINK_MISSING（20件）の最終分類：RESOLVED 10件（うち議案第9号は資料到達済み・要約は編集方針上見送り）、NOT_YET_PUBLISHED 10件、SOURCE_UNRESOLVED 0件で合計20件", () => {
  const STRUCTURED = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);
  function primaryReasonCode(b) {
    if (b.category === "人事") return "PERSONNEL";
    if (STRUCTURED.has(b.category) && b.proposerType === "mayor") return "SOURCE_LINK_MISSING";
    if (b.category === "条例") return "ORDINANCE_COMPLEX";
    return "OTHER_NARRATIVE";
  }
  const reviewBills = risk.REVIEW.map((id) => billById.get(id));
  const slm = reviewBills.filter((b) => primaryReasonCode(b) === "SOURCE_LINK_MISSING");
  assert.equal(slm.length, 20, `SOURCE_LINK_MISSINGが20件ではありません（${slm.length}件）`);
  const unpublishedSessionIds = new Set(["2026-06", "2026-05-extraordinary"]);
  let resolved = 0, unpublished = 0, unresolved = 0;
  for (const b of slm) {
    if (b.id === "2023-07-extraordinary-01-gian-9") { resolved++; continue; } // 資料到達済み・要約見送り
    if (b.sourceTextVerifiedAt) resolved++;
    else if (unpublishedSessionIds.has(b.sessionId)) unpublished++;
    else unresolved++;
  }
  assert.equal(resolved, 10, `SOURCE_LINK_MISSINGのうち解決済みが10件ではありません（${resolved}件）`);
  assert.equal(unpublished, 10, `SOURCE_LINK_MISSINGのうち会議録未公開が10件ではありません（${unpublished}件）`);
  assert.equal(unresolved, 0, `SOURCE_LINK_MISSINGのうち未解決が0件ではありません（${unresolved}件）`);
});

check("R3（102件）・HOLD（69件）はPhase153〜157でデータ変更されていない（Phase156は設計フェーズでデータ変更0件）", () => {
  function titleStem(t) { return t.replace(/[（(].*$/, "").trim(); }
  const STRUCTURED = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);
  const sessionCategoryCount = new Map();
  const sessionTitleStemCount = new Map();
  for (const b of billVotes) {
    const k1 = `${b.session}|${b.category}`;
    sessionCategoryCount.set(k1, (sessionCategoryCount.get(k1) ?? 0) + 1);
    const k2 = `${b.session}|${titleStem(b.billTitle)}`;
    sessionTitleStemCount.set(k2, (sessionTitleStemCount.get(k2) ?? 0) + 1);
  }
  function isLikelyBatch(b) {
    const c1 = sessionCategoryCount.get(`${b.session}|${b.category}`) ?? 0;
    const c2 = sessionTitleStemCount.get(`${b.session}|${titleStem(b.billTitle)}`) ?? 0;
    return c1 >= 4 || c2 >= 3;
  }
  function tierOf(b) {
    if (b.category === "人事") return "R3";
    if (b.proposerType === "committee") return "R3";
    if (isLikelyBatch(b)) return "R2";
    return "R1";
  }
  const reviewBills = risk.REVIEW.map((id) => billById.get(id));
  const r3Bills = reviewBills.filter((b) => tierOf(b) === "R3");
  const holdBills = risk.HOLD.map((id) => billById.get(id));
  assert.equal(r3Bills.length, 102, `R3が102件ではありません（${r3Bills.length}件）`);
  assert.equal(holdBills.length, 69, `HOLDが69件ではありません（${holdBills.length}件）`);
  const touchedR3 = r3Bills.filter((b) => b.sourceTextVerifiedAt === "2026-09-03");
  const touchedHold = holdBills.filter((b) => b.sourceTextVerifiedAt === "2026-09-03");
  assert.equal(touchedR3.length, 0, `R3にPhase153〜157で変更された議案があります: ${touchedR3.map((b) => b.id).join("、")}`);
  assert.equal(touchedHold.length, 0, `HOLDにPhase153〜157で変更された議案があります: ${touchedHold.map((b) => b.id).join("、")}`);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
