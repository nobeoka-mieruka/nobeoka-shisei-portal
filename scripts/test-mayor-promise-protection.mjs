/**
 * Phase273：市長公約の「変更してはいけない部分」が意図せず書き換わっていないことの自動比較。
 *
 * ■ 守る対象（reports/mayor-promise-protection-snapshot.json と突き合わせる）
 * - 個別公約の件数・ID・所属政策分野・公約本文（promiseText）・状況ラベル
 * - 個別施策の件数
 * - 一次資料から転記した指標の値（指標名・単位・年度・値・実績／予定の区分）
 *
 * ■ 守らない（増やしてよい）対象
 * 出典（evidenceItems・sources）、関連議案・一般質問・記者会見の参照、進捗履歴など、
 * 調査が進めば増えていく項目はスナップショットに含めない。出典を追加する作業で
 * 本文や数値が巻き込まれて変わっていないことを確認するのが、このテストの目的である。
 *
 * ■ 正当に変更する場合
 * 一次資料に基づいて本文や指標の値を直す場合は、変更の根拠をコミットメッセージへ記録し、
 * node scripts/generate-mayor-promise-protection-snapshot.mjs でスナップショットを更新する。
 * 更新を忘れるとこのテストが落ちるため、無自覚な書き換えを検出できる。
 *
 * 使い方: node scripts/test-mayor-promise-protection.mjs
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

const snapshot = readJson("reports/mayor-promise-protection-snapshot.json");
const promisesData = readJson("src/data/mayorPromises.json");
const measures = readJson("src/data/mayorPromiseMeasures.json");

const UPDATE_HINT =
  "正当な変更であれば node scripts/generate-mayor-promise-protection-snapshot.mjs でスナップショットを更新してください";

console.log("\n市長公約の変更禁止項目の照合");
console.log(`  スナップショット作成日：${snapshot.generatedAt}`);
console.log(`  公約${snapshot.promiseCount}件／施策${snapshot.measureCount}件／指標の値${snapshot.indicatorValues.length}件`);

check("政策分野・個別公約・個別施策の件数が変わっていない", () => {
  assert.equal(promisesData.categories.length, snapshot.categoryCount, `政策分野の件数が変わっています。${UPDATE_HINT}`);
  assert.equal(promisesData.promises.length, snapshot.promiseCount, `個別公約の件数が変わっています。${UPDATE_HINT}`);
  assert.equal(measures.length, snapshot.measureCount, `個別施策の件数が変わっています。${UPDATE_HINT}`);
});

check("公約のID・所属政策分野・公約本文・状況ラベルが1件も変わっていない", () => {
  const current = promisesData.promises.map((p) => ({
    id: p.id,
    categoryId: p.categoryId,
    promiseText: p.promiseText,
    statusLabel: p.statusLabel,
  }));
  const differences = [];
  for (const expected of snapshot.promises) {
    const actual = current.find((p) => p.id === expected.id);
    if (!actual) {
      differences.push(`公約${expected.id}が見つかりません`);
      continue;
    }
    for (const key of ["categoryId", "promiseText", "statusLabel"]) {
      if (actual[key] !== expected[key]) {
        differences.push(`公約${expected.id}の${key}が変わっています（記録：${expected[key]} → 現在：${actual[key]}）`);
      }
    }
  }
  for (const actual of current) {
    if (!snapshot.promises.some((p) => p.id === actual.id)) differences.push(`未記録の公約が追加されています: ${actual.id}`);
  }
  assert.deepEqual(differences, [], `${differences.join(" / ")}。${UPDATE_HINT}`);
});

check("一次資料から転記した指標の値が1件も変わっていない", () => {
  const current = measures
    .flatMap((m) =>
      (m.indicators ?? []).flatMap((indicator) =>
        indicator.values.map((v) => ({
          measureId: m.measureId,
          indicatorId: indicator.id,
          label: indicator.label,
          unit: indicator.unit,
          fiscalYear: v.fiscalYear,
          value: v.value,
          kind: v.kind,
        })),
      ),
    )
    .sort((a, b) => a.indicatorId.localeCompare(b.indicatorId) || a.fiscalYear.localeCompare(b.fiscalYear));
  assert.equal(current.length, snapshot.indicatorValues.length, `指標の値の件数が変わっています。${UPDATE_HINT}`);
  const differences = [];
  for (const [i, expected] of snapshot.indicatorValues.entries()) {
    const actual = current[i];
    for (const key of ["measureId", "indicatorId", "label", "unit", "fiscalYear", "value", "kind"]) {
      if (actual[key] !== expected[key]) {
        differences.push(`${expected.indicatorId}（${expected.fiscalYear}）の${key}：${expected[key]} → ${actual[key]}`);
      }
    }
  }
  assert.deepEqual(differences, [], `指標の値が変わっています：${differences.join(" / ")}。${UPDATE_HINT}`);
});

check("出典（evidenceItems）はスナップショットの対象外＝追加してもこのテストは落ちない", () => {
  // この確認自体がテストの意図の明文化。スナップショットに出典が含まれていないことを保証する。
  const snapshotText = JSON.stringify(snapshot);
  assert.ok(!snapshotText.includes("evidenceItems"), "スナップショットに出典が含まれています（出典追加ができなくなります）");
  assert.ok(!snapshotText.includes("documentKey"), "スナップショットに出典の資料キーが含まれています");
});

console.log(`\n${passCount}件のチェックがすべて成功しました。`);
