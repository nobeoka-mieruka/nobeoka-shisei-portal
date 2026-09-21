/**
 * 類似団体比較で表示する順位が、母数の取り違えによって実態と食い違わないことを検証する。
 *
 * 背景：総務省「全市町村の主要財政指標」では、将来負担額が充当可能財源等を下回る団体の
 * 将来負担比率が「-」と表記され、比率そのものが算定されない。これは「該当なし」であって
 * 0%でも未確認でもない。59団体中32団体がこれに当たるため、区別せずに「値がある団体だけ」を
 * 母数にして順位を出すと、順位が実態と食い違って見える。
 *
 * このプロジェクトには専用のテストランナーが無いため、既存のscripts/test-*.mjsと同じ
 * 「プレーンなNode＋assert」方式に揃えている。
 *
 * 使い方: node scripts/test-similar-municipality-ranking.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const data = readJson("src/data/similarMunicipalityFinanceComparison.json");
const municipalities = data.municipalities;
const confirmed = municipalities.filter((m) => m.futureBurdenRatioStatus === "CONFIRMED");
const notApplicable = municipalities.filter((m) => m.futureBurdenRatioStatus === "NOT_APPLICABLE");

console.log(
  `\n類似団体の将来負担比率：${municipalities.length}団体中 算定あり${confirmed.length}団体／該当なし${notApplicable.length}団体（実データから再計算）`,
);

check("すべての団体に将来負担比率の取得状況が入っている", () => {
  const missing = municipalities.filter(
    (m) => m.futureBurdenRatioStatus !== "CONFIRMED" && m.futureBurdenRatioStatus !== "NOT_APPLICABLE",
  );
  assert.equal(missing.length, 0, `取得状況が不明な団体: ${missing.map((m) => m.municipalityName).join("、")}`);
});

check("「該当なし」の団体に数値が入っていない（0%として扱っていない）", () => {
  const withValue = notApplicable.filter((m) => m.futureBurdenRatioPercent != null);
  assert.equal(withValue.length, 0, `該当なしなのに値がある団体: ${withValue.map((m) => m.municipalityName).join("、")}`);
});

check("「算定あり」の団体には必ず数値が入っている", () => {
  const withoutValue = confirmed.filter((m) => typeof m.futureBurdenRatioPercent !== "number");
  assert.equal(withoutValue.length, 0, `算定ありなのに値が無い団体: ${withoutValue.map((m) => m.municipalityName).join("、")}`);
});

check("該当なしの団体が1件でもあるなら、母数の説明が用意されている", () => {
  if (notApplicable.length === 0) return;
  assert.ok(
    typeof data.futureBurdenRatioNote === "string" && data.futureBurdenRatioNote.length >= 40,
    "futureBurdenRatioNoteに、該当なしの意味と順位の母数の扱いの説明がありません",
  );
  assert.ok(data.futureBurdenRatioNote.includes("該当なし"), "説明文に「該当なし」という言葉がありません");
  assert.ok(/0%|０%/.test(data.futureBurdenRatioNote), "説明文に「0%ではない」旨の記載がありません");
});

check("原本と突き合わせた日が記録されている", () => {
  assert.ok(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(data.futureBurdenRatioVerifiedAt ?? ""), "futureBurdenRatioVerifiedAtが日付ではありません");
});

check("延岡市の行はちょうど1件で、将来負担比率が算定されている", () => {
  const nobeoka = municipalities.filter((m) => m.isNobeoka);
  assert.equal(nobeoka.length, 1, `isNobeoka=trueの行が${nobeoka.length}件あります`);
  assert.equal(nobeoka[0].futureBurdenRatioStatus, "CONFIRMED");
  assert.equal(typeof nobeoka[0].futureBurdenRatioPercent, "number");
});

/**
 * 故障注入：「該当なし」を取りこぼして未取得と同じ扱いに戻してしまった場合に、
 * 上のどれかの検査が必ず失敗することを確かめる（検査自体が形骸化していないことの確認）。
 */
check("該当なしの区別を消すと検査が失敗する（故障注入）", () => {
  const broken = JSON.parse(JSON.stringify(data));
  for (const m of broken.municipalities) delete m.futureBurdenRatioStatus;
  const missing = broken.municipalities.filter(
    (m) => m.futureBurdenRatioStatus !== "CONFIRMED" && m.futureBurdenRatioStatus !== "NOT_APPLICABLE",
  );
  assert.ok(missing.length > 0, "取得状況を消しても検出できませんでした");
});

check("該当なしの団体に0%を補うと検査が失敗する（故障注入）", () => {
  const broken = JSON.parse(JSON.stringify(data));
  for (const m of broken.municipalities) {
    if (m.futureBurdenRatioStatus === "NOT_APPLICABLE") m.futureBurdenRatioPercent = 0;
  }
  const withValue = broken.municipalities.filter(
    (m) => m.futureBurdenRatioStatus === "NOT_APPLICABLE" && m.futureBurdenRatioPercent != null,
  );
  assert.ok(withValue.length > 0, "0%を補っても検出できませんでした");
});

console.log(`\n${passCount}件成功\n`);
