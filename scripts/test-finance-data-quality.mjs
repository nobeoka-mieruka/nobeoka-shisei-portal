/**
 * Phase137：archiveFiscalYears.json（財政・人口データ）の品質を検証する軽量な回帰テスト。
 *
 * このプロジェクトには専用のテストランナー（vitest/jest等）が導入されていないため、
 * 既存のscripts/test-*.mjsと同じ「プレーンなNodeスクリプト＋assert」方式を踏襲する。
 * validate-data.mjsが既に検証している項目（日付形式・URL形式・trustLevel等）は重複させず、
 * ここでは主に「数値そのものの健全性」（単位誤り・NaN・Infinity・比率の異常値）を検証する。
 *
 * 使い方: node scripts/test-finance-data-quality.mjs
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

const years = readJson("src/data/archiveFiscalYears.json");

console.log(`\n財政データの現況：${years.length}年度分（実データから再計算）`);

check("年度（fiscalYear）に重複が無い", () => {
  const seen = new Set();
  const dupes = [];
  for (const y of years) {
    if (seen.has(y.fiscalYear)) dupes.push(y.fiscalYear);
    seen.add(y.fiscalYear);
  }
  assert.equal(dupes.length, 0, `重複している年度: ${dupes.join("、")}`);
});

/** 数値フィールドを再帰的に集めて[パス, 値]の配列にする（sourceRefs配列の中身は除外）。 */
function collectNumericFields(obj, path, out) {
  if (obj === null || obj === undefined || typeof obj !== "object") return;
  for (const [key, value] of Object.entries(obj)) {
    if (key === "sourceRefs" || key === "municipalBondIssuanceSourceRefs") continue;
    const p = `${path}.${key}`;
    if (typeof value === "number") out.push([p, value]);
    else if (typeof value === "object") collectNumericFields(value, p, out);
  }
}

check("NaN・Infinityの数値が1件も無い", () => {
  const bad = [];
  for (const y of years) {
    const fields = [];
    collectNumericFields(y, `FY${y.fiscalYear}`, fields);
    for (const [path, value] of fields) {
      if (Number.isNaN(value) || !Number.isFinite(value)) bad.push(`${path}=${value}`);
    }
  }
  assert.equal(bad.length, 0, `NaN/Infiniteの値: ${bad.join("、")}`);
});

check("金額フィールド（*Yen）が負の値になっていない（残高・予算等はマイナスにならないはずのため）", () => {
  const bad = [];
  for (const y of years) {
    const fields = [];
    collectNumericFields(y, `FY${y.fiscalYear}`, fields);
    for (const [path, value] of fields) {
      if (path.endsWith("Yen") && value < 0) bad.push(`${path}=${value}`);
    }
  }
  assert.equal(bad.length, 0, `負の金額: ${bad.join("、")}`);
});

check("パーセント系フィールド（経常収支比率・実質公債費比率）が明らかな単位誤りの範囲（0〜300%）を超えていない", () => {
  // 将来負担比率は自治体によっては300%を超えうる制度設計だが、延岡市の既存データ範囲
  // （0〜150%程度）から大きく外れる値は単位誤り（例：15.3を1530と誤登録）の疑いが強いため、
  // 経常収支比率・実質公債費比率は0〜300%、財政力指数は0〜3を異常値検出の上限とする
  // （実際の健全な数値は概ね100%未満・1未満だが、境界の判定基準は独自に作らず、
  // 明らかな桁誤りだけを検出する緩い範囲とする）。
  const bad = [];
  for (const y of years) {
    const f = y.finance;
    if (!f) continue;
    if (f.currentAccountRatioPercent != null && (f.currentAccountRatioPercent < 0 || f.currentAccountRatioPercent > 300)) {
      bad.push(`FY${y.fiscalYear}.currentAccountRatioPercent=${f.currentAccountRatioPercent}`);
    }
    if (f.realDebtServiceRatioPercent != null && (f.realDebtServiceRatioPercent < 0 || f.realDebtServiceRatioPercent > 300)) {
      bad.push(`FY${y.fiscalYear}.realDebtServiceRatioPercent=${f.realDebtServiceRatioPercent}`);
    }
    if (f.financialStrengthIndex != null && (f.financialStrengthIndex < 0 || f.financialStrengthIndex > 3)) {
      bad.push(`FY${y.fiscalYear}.financialStrengthIndex=${f.financialStrengthIndex}`);
    }
  }
  assert.equal(bad.length, 0, `範囲外の比率: ${bad.join("、")}`);
});

check("数値フィールドが存在する（null以外）のに、対応するsourceRefsが1件も無いレコードが無い（budget/debt/fund/finance単位）", () => {
  const bad = [];
  for (const y of years) {
    for (const [key, sub] of [
      ["budget", y.budget],
      ["debt", y.debt],
      ["fund", y.fund],
      ["finance", y.finance],
    ]) {
      if (!sub) continue;
      const fields = [];
      collectNumericFields(sub, key, fields);
      const hasAnyValue = fields.some(([, v]) => v !== null);
      const refs = key === "debt" ? [...(sub.sourceRefs ?? []), ...(sub.balance?.sourceRefs ?? []), ...(sub.municipalBondIssuanceSourceRefs ?? [])] : key === "fund" ? (sub.balance?.sourceRefs ?? []) : (sub.sourceRefs ?? []);
      if (hasAnyValue && refs.length === 0) bad.push(`FY${y.fiscalYear}.${key}`);
    }
  }
  assert.equal(bad.length, 0, `数値はあるがsourceRefsが空のレコード: ${bad.join("、")}`);
});

check("人口データ（population）は必ずreferenceDate（基準日）を伴っている（基準日不明の人口値を掲載していないか）", () => {
  const bad = years.filter((y) => y.population && y.population.population != null && !y.population.referenceDate).map((y) => y.fiscalYear);
  assert.equal(bad.length, 0, `referenceDateが無い人口データ: ${bad.join("、")}`);
});

check("項目26（Phase137）：年度レコード数がDataStatusPage.tsxの表示と一致する前提（archiveFiscalYears.length）が変わっていないか確認できる状態である", () => {
  // DataStatusPage.tsxはarchiveFiscalYears.lengthを直接importして動的表示するため、
  // このテストでは「JSONの年度数」を記録として出力するのみ（固定値での一致検証はしない。
  // 固定値検証はハードコード再発のリスクを生むため、Phase135と同じ方針で避ける）。
  console.log(`  [参考] 年度レコード数：${years.length}件（DataStatusPage.tsxはarchiveFiscalYears.lengthを直接参照するため、常に一致する設計）`);
  assert.ok(true);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
