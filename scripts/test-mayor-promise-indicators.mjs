/**
 * Phase267：個別施策の「指標（indicators）」＝指標ごと・年度ごとの数値の回帰テスト。
 *
 * ■ このテストで守ること
 * 1. 旧表示（quantitativeValue / previousYearResult 等の文章）と新しい指標が意味的に一致すること。
 *    指標の値は必ず一次資料の転記文に現れる数値であり、当サイトが合算・推定した数値を
 *    持ち込んでいないことを機械的に確認する。
 * 2. 単位・年度・実績／予定が混ざらないこと。
 * 3. 故障注入（指標の削除・単位の変更・年度の重複・出典の削除・値の改変・0埋め・
 *    代表値との食い違い）を validate:data と同じ判定ロジックで検出できること。
 * 4. 既存フィールドを壊していないこと（後方互換）。
 *
 * 判定ロジックは src/lib/mayorPromiseIndicators.ts に集約し、
 * scripts/validate-data.mjs と本テストが同じ関数を使う（判定の二重実装を作らない）。
 *
 * 使い方: node --experimental-strip-types scripts/test-mayor-promise-indicators.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { validateMeasureIndicators, summarizeMeasureIndicators } from "../src/lib/mayorPromiseIndicators.ts";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const measures = readJson("src/data/mayorPromiseMeasures.json");
const promises = readJson("src/data/mayorPromises.json").promises;
const clone = () => JSON.parse(JSON.stringify(measures));

/** 故障注入したデータで、指定した文言を含むエラーが出ることを確かめる。 */
function expectIssue(label, mutate, expectedFragment) {
  check(label, () => {
    const injected = clone();
    mutate(injected);
    const issues = validateMeasureIndicators(injected);
    const matched = issues.filter((i) => i.message.includes(expectedFragment));
    assert.ok(
      matched.length > 0,
      `「${expectedFragment}」を含むエラーが検出されませんでした（検出されたエラー：${
        issues.map((i) => i.message).join(" / ") || "なし"
      }）`,
    );
  });
}

const summary = summarizeMeasureIndicators(measures);

console.log("\n個別施策の指標の現況（実データから再計算、固定値は使わない）");
console.log(`  指標を登録した施策：${summary.measuresWithIndicators}／${summary.measureTotal}件`);
console.log(`  指標：${summary.indicatorTotal}件（うち2年度以上の推移を持つ指標：${summary.multiYearIndicatorTotal}件）`);
console.log(`  年度別の値：${summary.valueTotal}件（実績${summary.resultValueTotal}件／予定${summary.planValueTotal}件）`);
console.log(`  収録年度：${summary.fiscalYears.join("、")}`);

console.log("\n項目1：現行データが検証を通ること");

check("現行の指標データに検証エラーが無い", () => {
  const issues = validateMeasureIndicators(measures);
  assert.deepEqual(
    issues.map((i) => `${i.tag}: ${i.message}`),
    [],
  );
});

check("指標を持つ施策が1件以上あり、年度をまたぐ推移を追える指標がある", () => {
  assert.ok(summary.measuresWithIndicators > 0, "指標を登録した施策が1件もありません");
  assert.ok(summary.multiYearIndicatorTotal > 0, "2年度以上の値を持つ指標が1件もありません");
});

check("すべての指標が、実在する公約に紐づく施策に属している", () => {
  const promiseIds = new Set(promises.map((p) => p.id));
  for (const m of measures) {
    if ((m.indicators ?? []).length === 0) continue;
    assert.ok(promiseIds.has(m.promiseId), `施策${m.measureId}が存在しない公約IDを参照しています: ${m.promiseId}`);
  }
});

console.log("\n項目2：旧表示と新しい指標が意味的に一致する（後方互換）");

check("代表値（quantitativeValue）を持つ施策では、同じ値の指標が必ず存在する", () => {
  for (const m of measures) {
    if (typeof m.quantitativeValue !== "number" || (m.indicators ?? []).length === 0) continue;
    const values = m.indicators.flatMap((i) => i.values.map((v) => v.value));
    assert.ok(
      values.includes(m.quantitativeValue),
      `施策${m.measureId}の代表値${m.quantitativeValue}に一致する指標の値がありません`,
    );
  }
});

check("指標を追加しても、既存フィールド（転記文・出典・状況）が残っている", () => {
  for (const m of measures) {
    if ((m.indicators ?? []).length === 0) continue;
    assert.ok(m.sourceUrl && m.sourceTitle, `施策${m.measureId}の出典が失われています`);
    assert.ok(m.status && m.fiscalYear && m.snapshotDate, `施策${m.measureId}の状況・年度・基準日が失われています`);
    const hasNarrative = Boolean(m.previousYearResult || m.currentYearResult || m.currentYearPlan);
    assert.ok(hasNarrative, `施策${m.measureId}の転記文（前年度実績・今年度実績／予定）が失われています`);
  }
});

check("単位に年度・予定・実績を混ぜていない（旧quantitativeUnitの「件（令和8年度予定）」形式を持ち込まない）", () => {
  for (const m of measures) {
    for (const indicator of m.indicators ?? []) {
      assert.doesNotMatch(
        indicator.unit,
        /(年度|予定|実績)/,
        `施策${m.measureId}の指標${indicator.id}の単位に年度・予定・実績が混ざっています: ${indicator.unit}`,
      );
    }
  }
});

check("実績（result）と予定（plan）の両方が区別して登録されている", () => {
  assert.ok(summary.resultValueTotal > 0, "実績の値が1件もありません");
  assert.ok(summary.planValueTotal > 0, "予定の値が1件もありません");
});

console.log("\n項目3：故障注入（壊れ方を検出できること）");

expectIssue(
  "指標の単位に年度を混ぜると検出する",
  (data) => {
    const m = data.find((x) => (x.indicators ?? []).length > 0);
    m.indicators[0].unit = "件（令和8年度予定）";
  },
  "unitには単位のみを書いてください",
);

expectIssue(
  "同じ指標に同じ年度・同じ区分の値を重複登録すると検出する",
  (data) => {
    const m = data.find((x) => (x.indicators ?? []).length > 0);
    const first = m.indicators[0].values[0];
    m.indicators[0].values.push({ ...first });
  },
  "年度と区分（実績／予定）が重複しています",
);

expectIssue(
  "指標の値を一次資料に無い数値へ書き換えると検出する（合算・推定の混入防止）",
  (data) => {
    const m = data.find((x) => (x.indicators ?? []).length > 0);
    m.indicators[0].values[0].value = 987654;
  },
  "一次資料の転記文に現れない数値です",
);

expectIssue(
  "未確認の値を0で埋めても、一次資料に無い数値として検出する",
  (data) => {
    const m = data.find((x) => (x.indicators ?? []).length > 0 && typeof x.quantitativeValue !== "number");
    m.indicators[0].values[0].value = 0;
  },
  "一次資料の転記文に現れない数値です",
);

expectIssue(
  "代表値を持つ施策から、その値の指標だけを削除すると食い違いとして検出する",
  (data) => {
    // 指標が1件しか無い施策で全削除すると「指標を持たない施策」（＝旧構造のまま）になり、
    // 後方互換上それは正常な状態のため、指標が複数ある施策で一部だけ消した場合を検証する。
    const m = data.find(
      (x) =>
        typeof x.quantitativeValue === "number" &&
        (x.indicators ?? []).length > 1 &&
        x.indicators.some((i) => i.values.some((v) => v.value === x.quantitativeValue)) &&
        x.indicators.some((i) => !i.values.some((v) => v.value === x.quantitativeValue)),
    );
    m.indicators = m.indicators.filter((i) => !i.values.some((v) => v.value === m.quantitativeValue));
  },
  "と一致する指標の値がありません",
);

expectIssue(
  "指標から年度別の値をすべて削除すると検出する",
  (data) => {
    const m = data.find((x) => (x.indicators ?? []).length > 0);
    m.indicators[0].values = [];
  },
  "年度別の値（values）がありません",
);

expectIssue(
  "年度の表記を崩すと検出する",
  (data) => {
    const m = data.find((x) => (x.indicators ?? []).length > 0);
    m.indicators[0].values[0].fiscalYear = "2026年";
  },
  "fiscalYearの形式が不正です",
);

expectIssue(
  "実績／予定の区分を不正な値にすると検出する",
  (data) => {
    const m = data.find((x) => (x.indicators ?? []).length > 0);
    m.indicators[0].values[0].kind = "confirmed";
  },
  "kindはresult（実績）かplan（予定）のいずれかです",
);

expectIssue(
  "指標名（label）を空にすると検出する",
  (data) => {
    const m = data.find((x) => (x.indicators ?? []).length > 0);
    m.indicators[0].label = "";
  },
  "指標のlabel（指標名）が空です",
);

expectIssue(
  "指標IDを他の指標と重複させると検出する",
  (data) => {
    const withIndicators = data.filter((x) => (x.indicators ?? []).length > 0);
    withIndicators[1].indicators[0].id = withIndicators[0].indicators[0].id;
  },
  "指標のidが重複しています",
);

check("指標を1件削除しても、集計値がその分だけ減る（集計が固定値でない）", () => {
  const injected = clone();
  const target = injected.find((x) => (x.indicators ?? []).length > 0);
  const removed = target.indicators.shift();
  const after = summarizeMeasureIndicators(injected);
  assert.equal(after.indicatorTotal, summary.indicatorTotal - 1);
  assert.equal(after.valueTotal, summary.valueTotal - removed.values.length);
});

console.log("\n項目4：一次資料の出典が指標と切り離されていない");

check("指標を持つ施策の出典は、すべて延岡市の公式ドメインかつ一次資料（PRIMARY）である", () => {
  for (const m of measures) {
    if ((m.indicators ?? []).length === 0) continue;
    assert.match(m.sourceUrl, /^https:\/\/www\.city\.nobeoka\.miyazaki\.jp\//, `施策${m.measureId}の出典URL: ${m.sourceUrl}`);
    assert.equal(m.trustLevel, "PRIMARY", `施策${m.measureId}の出典が一次資料ではありません`);
  }
});

check("公約詳細ページが、指標を年度・実績／予定つきで表示している", () => {
  const page = readFileSync(join(ROOT, "src/pages/MayorPromiseDetailPage.tsx"), "utf8");
  assert.ok(page.includes("m.indicators"), "公約詳細ページが指標を表示していません");
  assert.ok(page.includes("MEASURE_INDICATOR_KIND_LABEL"), "実績／予定の区別が表示されていません");
  assert.ok(page.includes("v.fiscalYear"), "年度が表示されていません");
});

console.log(`\n${passCount}件のチェックがすべて成功しました。`);
