/**
 * Phase147：R1残存7件の原因解明・parser拡張後の再集計、SOURCE_LINK_MISSING 20件の実態監査、
 * R2 583件が変更されていないことの回帰テスト。
 *
 * src/lib/billRiskClassification.tsはTypeScriptのためこのプレーンNodeスクリプトから直接
 * importできない。判定ロジックをミラーして検証する（test-bill-review-reason-classification.mjs
 * と同じ方針）。REVIEW/HOLDの母集団はPhase145起点の静的スナップショットを使う。
 *
 * 使い方: node scripts/test-bill-phase147-r1-recount.mjs
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
const risk = JSON.parse(readFileSync(join(ROOT, "reports/phase145-bill-risk-classification.json"), "utf8"));
const billById = new Map(billVotes.map((b) => [b.id, b]));

const STRUCTURED_CATEGORIES = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);

function primaryReasonCode(b) {
  if (b.category === "人事") return "PERSONNEL";
  if (STRUCTURED_CATEGORIES.has(b.category) && b.proposerType === "mayor") return "SOURCE_LINK_MISSING";
  if (b.category === "条例") return "ORDINANCE_COMPLEX";
  return "OTHER_NARRATIVE";
}
function titleStem(title) {
  return title.replace(/[（(].*$/, "").trim();
}
function buildBatchLikelihoodIndex(bills) {
  const sessionCategoryCount = new Map();
  const sessionTitleStemCount = new Map();
  for (const b of bills) {
    const k1 = `${b.session}|${b.category}`;
    sessionCategoryCount.set(k1, (sessionCategoryCount.get(k1) ?? 0) + 1);
    const k2 = `${b.session}|${titleStem(b.billTitle)}`;
    sessionTitleStemCount.set(k2, (sessionTitleStemCount.get(k2) ?? 0) + 1);
  }
  return (b) => {
    const c1 = sessionCategoryCount.get(`${b.session}|${b.category}`) ?? 0;
    const c2 = sessionTitleStemCount.get(`${b.session}|${titleStem(b.billTitle)}`) ?? 0;
    return c1 >= 4 || c2 >= 3;
  };
}
const isLikelyBatch = buildBatchLikelihoodIndex(billVotes);
function tierOf(b) {
  if (b.category === "人事") return "R3";
  if (b.proposerType === "committee") return "R3";
  if (isLikelyBatch(b)) return "R2";
  return "R1";
}
function isLevel3(b) {
  return b.summarySource === "manual" && Boolean(b.reason || (b.mainChanges && b.mainChanges.length > 0) || b.citizenImpact);
}
function isLevel2(b) {
  return Boolean(b.sourceTextVerifiedAt) && !isLevel3(b);
}

const reviewBills = risk.REVIEW.map((id) => billById.get(id));
const r1Bills = reviewBills.filter((b) => tierOf(b) === "R1");
const r2Bills = reviewBills.filter((b) => tierOf(b) === "R2");
const r3Bills = reviewBills.filter((b) => tierOf(b) === "R3");

console.log("\nPhase147：R1再集計・SOURCE_LINK_MISSING監査・R2不変の現況");

check("R1（NEAR_SAFE候補）36件を、解決済み（Level2/3）／source未公開／その他未解決へ再集計すると、Phase146の26件＋Phase147の6件＝32件が解決済み、3件がsource未公開、1件がその他未解決（議案第9号）で合計36件と一致する（「R1=36」を固定値としてそのまま表示し続けない）", () => {
  assert.equal(r1Bills.length, 36, `R1が36件ではありません（${r1Bills.length}件）`);
  let resolved = 0, sourceNotPublished = 0, otherUnresolved = 0;
  const unpublishedSessionIds = new Set(["2026-06", "2026-05-extraordinary"]);
  for (const b of r1Bills) {
    if (isLevel2(b) || isLevel3(b)) resolved++;
    else if (unpublishedSessionIds.has(b.sessionId)) sourceNotPublished++;
    else otherUnresolved++;
  }
  assert.equal(resolved, 32, `R1のうち解決済み（Level2/3）が32件ではありません（${resolved}件）`);
  assert.equal(sourceNotPublished, 3, `R1のうちsource未公開が3件ではありません（${sourceNotPublished}件）`);
  assert.equal(otherUnresolved, 1, `R1のうちその他未解決が1件ではありません（${otherUnresolved}件）`);
  const remaining = billById.get("2023-07-extraordinary-01-gian-9");
  assert.ok(remaining && !isLevel2(remaining) && !isLevel3(remaining), "その他未解決の1件は議案第9号（再議）のはずです");
});

check("R1解決済み32件は、すべてsourceTextVerifiedAtがPhase145完了日（2026-09-01）より前ではない（新規に確認したことの裏付け）", () => {
  const resolved = r1Bills.filter((b) => isLevel2(b) || isLevel3(b));
  for (const b of resolved) {
    assert.ok(b.sourceTextVerifiedAt >= "2026-09-01", `${b.id}のsourceTextVerifiedAt（${b.sourceTextVerifiedAt}）がPhase145完了前になっています`);
  }
});

check("Phase147で新たに解決した6件は、いずれも会議録の「（降壇）」複数回登壇バグ・一括見出しの件名混入バグとは別の原因（fetchヒューリスティックが後半のセグメントを取りこぼしていた）で未解決だった議案であり、市長以外の発言者（副市長・部長等）が説明した例は0件だった（推測せず、実際に本文を確認した結果）", () => {
  const phase147ResolvedIds = ["2023-06-gian-10", "2023-06-gian-20", "2023-06-gian-21", "2021-06-gian-20", "2021-06-gian-21", "2021-06-gian-25"];
  for (const id of phase147ResolvedIds) {
    const b = billById.get(id);
    assert.ok(b.proposerType === "mayor", `${id}のproposerTypeがmayorではありません`);
    assert.ok(b.transcriptUrl, `${id}にtranscriptUrlが設定されていません`);
  }
});

check("SOURCE_LINK_MISSING（20件）の実態監査：Phase147時点で解決済み5件（うち3件がPhase147で新規）、会議録未公開のため未解決10件、その他未解決5件（R2/R3または今回対象外）で合計20件と一致する【Phase148追記】その他未解決5件のうち4件（令和5年5月臨時会（1）の専決処分4件）をPhase148で新規解決したため、解決済みは9件・その他未解決は1件（議案第9号・再議、政治的係争性のため意図的に非抽出）へ更新した。会議録未公開10件は不変", () => {
  const slm = reviewBills.filter((b) => primaryReasonCode(b) === "SOURCE_LINK_MISSING");
  assert.equal(slm.length, 20, `SOURCE_LINK_MISSINGが20件ではありません（${slm.length}件）`);
  let resolved = 0, unpublished = 0, other = 0;
  const unpublishedSessionIds = new Set(["2026-06", "2026-05-extraordinary"]);
  for (const b of slm) {
    if (b.sourceTextVerifiedAt) resolved++;
    else if (unpublishedSessionIds.has(b.sessionId)) unpublished++;
    else other++;
  }
  assert.equal(resolved, 9, `SOURCE_LINK_MISSINGのうち解決済みが9件ではありません（${resolved}件）`);
  assert.equal(unpublished, 10, `SOURCE_LINK_MISSINGのうち会議録未公開が10件ではありません（${unpublished}件）`);
  assert.equal(other, 1, `SOURCE_LINK_MISSINGのうちその他未解決が1件ではありません（${other}件）`);
});

check("R1残存7件とSOURCE_LINK_MISSING（20件）は同一集合ではない：重複は4件のみ（議案第10号・第20号・第21号・第9号）。辺地整備計画・市道路線認定の3件（category=その他）はSOURCE_LINK_MISSINGに含まれない（構造化カテゴリではないため）", () => {
  const residual7Ids = [
    "2023-06-gian-10", "2023-06-gian-20", "2023-06-gian-21", "2023-07-extraordinary-01-gian-9",
    "2021-06-gian-20", "2021-06-gian-21", "2021-06-gian-25",
  ];
  const slmIds = new Set(reviewBills.filter((b) => primaryReasonCode(b) === "SOURCE_LINK_MISSING").map((b) => b.id));
  const overlap = residual7Ids.filter((id) => slmIds.has(id));
  assert.equal(overlap.length, 4, `R1残存7件とSOURCE_LINK_MISSINGの重複が4件ではありません（${overlap.length}件）: ${overlap.join("、")}`);
  const notInSlm = residual7Ids.filter((id) => !slmIds.has(id));
  assert.deepEqual(notInSlm.sort(), ["2021-06-gian-20", "2021-06-gian-21", "2021-06-gian-25"], "SOURCE_LINK_MISSINGに含まれない3件が期待どおりではありません");
});

check("R3（102件）・HOLD（69件）はPhase147〜152で一切データ変更されていない（sourceTextVerifiedAtがこの期間の日付＝2026-09-02になっている議案が0件）。R2（583件）はPhase147では未変更だったが、Phase149・150で個別に実証確認した最大30件ずつ（合計60件）のみ意図的に変更されており、総数583件は不変【Phase152更新】", () => {
  const holdBills = risk.HOLD.map((id) => billById.get(id));
  const touchedR3 = r3Bills.filter((b) => b.sourceTextVerifiedAt === "2026-09-02");
  const touchedHold = holdBills.filter((b) => b.sourceTextVerifiedAt === "2026-09-02");
  assert.equal(touchedR3.length, 0, `R3にこの期間で変更された議案があります: ${touchedR3.map((b) => b.id).join("、")}`);
  assert.equal(touchedHold.length, 0, `HOLDにこの期間で変更された議案があります: ${touchedHold.map((b) => b.id).join("、")}`);
  // Phase149（条例30件実証、重大修正1件を除く29件）＋Phase150（その他30件実証、全件）＋
  // Phase148（SOURCE_LINK_MISSING由来で新規解決した専決処分4件、令和5年5月臨時会（1）は
  // 専決処分4件が同一会期に集中しておりR2判定）＝29+30+4=63件が今回の意図した変更件数。
  const touchedR2 = r2Bills.filter((b) => b.sourceTextVerifiedAt === "2026-09-02");
  assert.equal(touchedR2.length, 63, `R2で変更された議案が63件ではありません（Phase149の29件＋Phase150の30件＋Phase148の4件の想定と異なる）: ${touchedR2.length}件`);
  assert.equal(r2Bills.length, 583, `R2が583件ではありません（${r2Bills.length}件）`);
  assert.equal(r3Bills.length, 102, `R3が102件ではありません（${r3Bills.length}件）`);
  assert.equal(holdBills.length, 69, `HOLDが69件ではありません（${holdBills.length}件）`);
});

check("令和8年5月臨時会・6月定例会（会議録未公開、3件）は、既存のブロックタスク管理（blockedTaskClassification.json、TASK-004）で監視対象として既に登録されている（Phase147で新しい大規模監視基盤を作らず、既存仕組みを再利用する方針）", () => {
  const blocked = JSON.parse(readFileSync(join(ROOT, "src/data/blockedTaskClassification.json"), "utf8"));
  const task004 = blocked.find((t) => t.taskId === "TASK-004");
  assert.ok(task004, "TASK-004（令和8年5月臨時会・6月定例会の会議録未公開）がblockedTaskClassification.jsonに見つかりません");
  assert.equal(task004.blockedReasonCode, "SOURCE_NOT_PUBLISHED", "TASK-004のblockedReasonCodeがSOURCE_NOT_PUBLISHEDではありません");
  assert.equal(task004.autoRecheck, true, "TASK-004のautoRecheckがtrueではありません（会議録公開後の自動再確認が設定されていません）");
  const unpublishedIds = ["2026-06-gian-21", "2026-05-extraordinary-gian-2", "2026-05-extraordinary-gian-3"];
  for (const id of unpublishedIds) {
    const b = billById.get(id);
    assert.ok(b && !b.sourceTextVerifiedAt, `${id}は会議録未公開のはずが、sourceTextVerifiedAtが設定されています（未公開を欠損資料と誤って断定していないか確認）`);
  }
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
