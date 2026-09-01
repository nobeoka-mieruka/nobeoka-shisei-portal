/**
 * Phase152：Phase148（SOURCE_LINK_MISSING）・Phase149（ORDINANCE_COMPLEX実証）・
 * Phase150（OTHER_NARRATIVE実証）の統合結果の回帰テスト。
 *
 * 使い方: node scripts/test-bill-phase152-integration.mjs
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

function isLevel3(b) {
  return b.summarySource === "manual" && Boolean(b.reason || (b.mainChanges && b.mainChanges.length > 0) || b.citizenImpact);
}
function isLevel2(b) {
  return Boolean(b.sourceTextVerifiedAt) && !isLevel3(b);
}

console.log("\nPhase152：Phase148〜150統合結果の現況");

check("Phase148（専決処分4件）は、全てtranscriptUrl設定済み・Level3（reason/mainChanges付き）へ昇格している", () => {
  const ids = ["2023-05-extraordinary-gian-2", "2023-05-extraordinary-gian-3", "2023-05-extraordinary-gian-4", "2023-05-extraordinary-gian-5"];
  for (const id of ids) {
    const b = billById.get(id);
    assert.ok(b?.transcriptUrl, `${id}にtranscriptUrlが設定されていません`);
    assert.ok(isLevel3(b), `${id}がLevel3になっていません`);
  }
});

check("Phase149（条例）：30件実証のうち、重大修正1件（議案第17号）は既存維持（Level1のまま）、完全一致25件＋修正済み2件（第147号・第115号）の27件がLevel3、対象のみ確認できた2件（第16号・第11号）がLevel2", () => {
  const level3Ids = [
    "2019-06-gian-7", "2019-06-gian-11", "2019-06-gian-15", "2020-03-gian-97", "2020-03-gian-102", "2020-03-gian-107",
    "2021-06-gian-8", "2021-06-gian-12", "2022-03-gian-120", "2022-03-gian-124", "2022-03-gian-128",
    "2022-09-gian-40", "2022-09-gian-43", "2023-06-gian-14", "2023-12-gian-74", "2023-12-gian-102",
    "2024-06-gian-6", "2024-06-gian-9", "2024-06-gian-12", "2025-03-gian-118", "2025-03-gian-123", "2025-03-gian-128",
    "2025-12-gian-77", "2025-12-gian-81", "2026-03-gian-136", "2026-03-gian-147", "2025-12-gian-115",
  ];
  assert.equal(level3Ids.length, 27, "Phase149 Level3固定リストの件数が27件ではありません");
  for (const id of level3Ids) {
    const b = billById.get(id);
    assert.ok(b && isLevel3(b), `${id}はPhase149でLevel3化されているはずですが、Level3条件を満たしていません`);
  }
  const level2Ids = ["2021-06-gian-16", "2023-06-gian-11"];
  for (const id of level2Ids) {
    const b = billById.get(id);
    assert.ok(b && isLevel2(b), `${id}はPhase149でLevel2止まりとしたはずですが、Level2条件を満たしていません`);
  }
  const untouched = billById.get("2023-06-gian-17");
  assert.ok(untouched && !isLevel2(untouched) && !isLevel3(untouched), "議案第17号（国民健康保険税条例）は重大修正が検出されたため既存維持（Level1）のはずが変化しています");
});

check("Phase150（その他）：30件実証は全件完全一致。理由が本文にある24件がLevel3、対象のみ確認できた6件がLevel2", () => {
  const level3Ids = [
    "2020-12-gian-84", "2024-03-gian-138", "2020-03-gian-129", "2021-12-gian-86", "2021-12-gian-90", "2022-12-gian-86",
    "2023-06-gian-23", "2023-12-gian-80", "2024-06-gian-22", "2025-06-gian-29", "2021-09-gian-54", "2023-03-gian-136",
    "2023-06-gian-25", "2024-06-gian-23", "2025-12-gian-86", "2020-03-gian-134", "2022-09-gian-61", "2024-03-gian-139",
    "2025-06-gian-32", "2021-09-gian-52", "2022-12-gian-92", "2023-12-gian-92", "2020-03-gian-131", "2025-12-gian-114",
  ];
  assert.equal(level3Ids.length, 24, "Phase150 Level3固定リストの件数が24件ではありません");
  for (const id of level3Ids) {
    const b = billById.get(id);
    assert.ok(b && isLevel3(b), `${id}はPhase150でLevel3化されているはずですが、Level3条件を満たしていません`);
  }
  const level2Ids = ["2019-12-gian-78", "2022-12-gian-89", "2023-12-gian-82", "2023-12-gian-86", "2024-12-gian-92", "2024-12-gian-96"];
  assert.equal(level2Ids.length, 6, "Phase150 Level2固定リストの件数が6件ではありません");
  for (const id of level2Ids) {
    const b = billById.get(id);
    assert.ok(b && isLevel2(b), `${id}はPhase150でLevel2止まりとしたはずですが、Level2条件を満たしていません`);
  }
});

check("sourceTextVerifiedAt=2026-09-02の議案は合計69件（Phase147のR1残存6件＋Phase152のPhase148の4件＋Phase149の29件＋Phase150の30件）で、それ以外のR2/R3/HOLD議案は変更されていない", () => {
  // Phase147（R1残存6件の解決）とPhase152（Phase148〜150統合）は同じ日付（2026-09-02）で
  // 実行されたため、sourceTextVerifiedAtの値だけでは両者を区別できない。ここでは合算した
  // 69件（6+63）を検証する（Phase147分の内訳はtest-bill-phase147-r1-recount.mjsを参照）。
  const touched = billVotes.filter((b) => b.sourceTextVerifiedAt === "2026-09-02");
  assert.equal(touched.length, 69, `sourceTextVerifiedAtが2026-09-02の議案が69件ではありません（${touched.length}件）`);
});

check("Level1+Level2+Level3の合計が議案総数1,177件と一致する", () => {
  let l1 = 0, l2 = 0, l3 = 0;
  for (const b of billVotes) {
    if (isLevel3(b)) l3++;
    else if (isLevel2(b)) l2++;
    else l1++;
  }
  assert.equal(l1 + l2 + l3, 1177, `Level1+2+3の合計が1,177件ではありません（${l1 + l2 + l3}件）`);
  assert.equal(l3, 388, `Level3の総数が388件ではありません（${l3}件）`);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
