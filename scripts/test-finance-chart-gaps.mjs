/**
 * Phase216：財政の折れ線グラフが「資料未確認の年度」を補間しないことを保証する回帰テスト。
 *
 * 【背景】/finance/funds の基金総額グラフでは、基金の値を確認できた年度が1989年度と
 * 2009〜2024年度しかないのに、FinanceMetricSectionがnullの年度をグラフへ渡す前に
 * 取り除いていたため、資料が無い19年分が横軸1目盛りへ圧縮され、1989年度と2009年度が
 * 直線で結ばれていた。線で結ぶことは「その間も同じように推移した」という意味に読めるため、
 * 確認していない期間について事実でない印象を与える。
 *
 * このテストで守ること：
 * 1. continuousFiscalYearSeriesが値を1件も生成しないこと（補間生成数＝0）
 * 2. 年度が飛んでいる点どうしを同じ線分（セグメント）に入れないこと
 * 3. 実データ（archiveFiscalYears.json）の全折れ線指標で、同一線分内の隣接点の年度差が必ず1であること
 * 4. コンポーネント側が「nullを事前に除外した配列」をグラフへ渡していないこと（原因の再発防止）
 *
 * 使い方: node --experimental-strip-types scripts/test-finance-chart-gaps.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
const readText = (relPath) => readFileSync(join(ROOT, relPath), "utf8");

const { continuousFiscalYearSeries, financeLineSegments, financeLineGaps, formatFiscalYearRanges } = await import(
  "../src/lib/financeChartSeries.ts"
);
/*
 * archiveFinanceMetrics.tsは拡張子なしのimportを含むためNodeから直接importできない。
 * 折れ線指標の値の取り出し方をここに写し、キーの一覧がソースと一致することを検証することで、
 * 指標が追加されたときにこのテストの更新漏れが起きないようにする。
 */
const LINE_METRIC_ACCESSORS = {
  population: (y) => y.population?.population ?? null,
  households: (y) => y.population?.households ?? null,
  debtBalanceGeneral: (y) => y.debt?.balance?.generalAccountBondBalanceYen ?? null,
  debtBalanceOrdinary: (y) => y.debt?.balance?.ordinaryAccountLocalBondBalanceYen ?? null,
  fundTotal: (y) => y.fund?.balance?.totalYen ?? null,
  fiscalAdjustmentFund: (y) => y.fund?.balance?.fiscalAdjustmentFundYen ?? null,
  fiscalReserveFund: (y) => y.fund?.balance?.fiscalReserveFundYen ?? null,
  financialStrengthIndex: (y) => y.finance?.financialStrengthIndex ?? null,
  currentAccountRatio: (y) => y.finance?.currentAccountRatioPercent ?? null,
  realDebtServiceRatio: (y) => y.finance?.realDebtServiceRatioPercent ?? null,
  futureBurdenRatio: (y) => y.finance?.futureBurdenRatioPercent ?? null,
};

const years = readJson("src/data/archiveFiscalYears.json");
const label = (year) => `${year}年度`;

let passCount = 0;
function check(name, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${name}`);
}

// --- 1. 値を生成しないこと -------------------------------------------------

/** 系列に「元データに無い数値」が1件でも現れたら、その件数を返す（0でなければ補間が起きている）。 */
function countFabricatedValues(input, output) {
  const source = new Map(input.filter((p) => p.value != null).map((p) => [p.year, p.value]));
  let fabricated = 0;
  for (const point of output) {
    if (point.value == null) continue;
    if (!source.has(point.year) || source.get(point.year) !== point.value) fabricated += 1;
  }
  return fabricated;
}

check("continuousFiscalYearSeriesは欠損年度の値を生成しない（補間生成数0）", () => {
  const input = [
    { year: 1989, label: label(1989), value: 100 },
    { year: 2001, label: label(2001), value: null },
    { year: 2009, label: label(2009), value: 300 },
    { year: 2010, label: label(2010), value: 310 },
  ];
  const output = continuousFiscalYearSeries(input, label);
  assert.equal(countFabricatedValues(input, output), 0);
  assert.equal(output.length, 2010 - 1989 + 1);
  const filled = output.filter((p) => !input.some((i) => i.year === p.year));
  assert.ok(filled.length > 0, "補った年度が1件も無い");
  assert.ok(
    filled.every((p) => p.value === null),
    "補った年度にnull以外の値が入っている",
  );
});

check("先頭・末尾の未確認年度は表示範囲から外す（内側の欠損は残す）", () => {
  const input = [
    { year: 2000, label: label(2000), value: null },
    { year: 2001, label: label(2001), value: 10 },
    { year: 2003, label: label(2003), value: 30 },
    { year: 2004, label: label(2004), value: null },
  ];
  const output = continuousFiscalYearSeries(input, label);
  assert.deepEqual(
    output.map((p) => [p.year, p.value]),
    [
      [2001, 10],
      [2002, null],
      [2003, 30],
    ],
  );
});

check("確認済みの値が1件も無い系列は年度順に並べ替えるだけ", () => {
  const input = [
    { year: 2003, label: label(2003), value: null },
    { year: 2001, label: label(2001), value: null },
  ];
  const output = continuousFiscalYearSeries(input, label);
  assert.deepEqual(
    output.map((p) => p.year),
    [2001, 2003],
  );
  assert.equal(countFabricatedValues(input, output), 0);
});

// --- 2. 線分の分割 ---------------------------------------------------------

check("未確認（null）の年度をまたいで線をつながない", () => {
  const points = [
    { year: 2001, value: 1 },
    { year: 2002, value: null },
    { year: 2003, value: 3 },
  ];
  assert.deepEqual(financeLineSegments(points), [[0], [2]]);
});

check("年度が飛んでいる点どうしを同じ線分に入れない（比較ページのように年度を選んだ場合）", () => {
  const points = [
    { year: 1989, value: 1 },
    { year: 2010, value: 2 },
    { year: 2011, value: 3 },
  ];
  assert.deepEqual(financeLineSegments(points), [[0], [1, 2]]);
});

check("年度を持たない系列（国勢調査など）は従来どおり隣接点を結ぶ", () => {
  const points = [{ value: 1 }, { value: 2 }, { value: 3 }];
  assert.deepEqual(financeLineSegments(points), [[0, 1, 2]]);
});

check("欠損区間には、その間の未確認年度が列挙される", () => {
  const points = [
    { year: 1989, value: 1 },
    { year: 1990, value: null },
    { year: 1991, value: null },
    { year: 1992, value: 4 },
  ];
  const gaps = financeLineGaps(points);
  assert.equal(gaps.length, 1);
  assert.deepEqual(gaps[0].missingYears, [1990, 1991]);
  assert.equal(gaps[0].fromIndex, 0);
  assert.equal(gaps[0].toIndex, 3);
});

check("年度の羅列を区間へまとめる", () => {
  assert.equal(formatFiscalYearRanges([1990, 1991, 1992, 2017, 2025]), "1990〜1992年度、2017年度、2025年度");
  assert.equal(formatFiscalYearRanges([]), "");
});

// --- 3. 実データでの検証 ---------------------------------------------------

/** archiveFinanceMetrics.tsのソースから、chartKindが"line"の指標キーを読み取る。 */
function lineMetricKeysFromSource() {
  const source = readText("src/lib/archiveFinanceMetrics.ts");
  const keys = [];
  const entryPattern = /key:\s*"([^"]+)"[\s\S]*?chartKind:\s*"(line|bar)"/g;
  let match;
  while ((match = entryPattern.exec(source)) !== null) {
    if (match[2] === "line") keys.push(match[1]);
  }
  return keys;
}

const lineMetricKeys = lineMetricKeysFromSource();
assert.ok(lineMetricKeys.length > 0, "折れ線指標が1件も見つからない");

check("テストが把握している折れ線指標の一覧が、archiveFinanceMetrics.tsと一致する", () => {
  assert.deepEqual([...lineMetricKeys].sort(), Object.keys(LINE_METRIC_ACCESSORS).sort());
});

const lineMetrics = lineMetricKeys.map((key) => ({ key, getValue: LINE_METRIC_ACCESSORS[key] }));

/** ページと同じ手順で、ある指標の折れ線グラフ用の系列を作る。 */
function seriesFor(metric, rows) {
  return continuousFiscalYearSeries(
    rows.map((y) => ({ year: y.fiscalYear, label: label(y.fiscalYear), value: metric.getValue(y) })),
    label,
  );
}

const sortedYears = [...years].sort((a, b) => a.fiscalYear - b.fiscalYear);
const fundRows = sortedYears.filter((y) => !!y.fund);
const debtRows = sortedYears.filter((y) => !!y.debt);

console.log("\n実データの欠損状況（グラフ表示範囲内で値を確認できていない年度数）：");
for (const metric of lineMetrics) {
  const series = seriesFor(metric, sortedYears);
  const missing = series.filter((p) => p.value == null).length;
  const gaps = financeLineGaps(series).length;
  console.log(`  ${metric.key}：表示${series.length}年度／未確認${missing}年度／線を切る区間${gaps}か所`);
}

check("すべての折れ線指標で、同じ線分内の隣接点は必ず1年度違い（補間なし）", () => {
  for (const metric of lineMetrics) {
    const series = seriesFor(metric, sortedYears);
    for (const segment of financeLineSegments(series)) {
      for (let i = 1; i < segment.length; i += 1) {
        const prev = series[segment[i - 1]];
        const curr = series[segment[i]];
        assert.equal(
          curr.year - prev.year,
          1,
          `${metric.key}：${prev.year}年度と${curr.year}年度を1本の線で結んでいる`,
        );
      }
    }
  }
});

check("すべての折れ線指標で、値を生成していない（補間生成数0）", () => {
  for (const metric of lineMetrics) {
    const input = sortedYears.map((y) => ({ year: y.fiscalYear, label: label(y.fiscalYear), value: metric.getValue(y) }));
    assert.equal(countFabricatedValues(input, seriesFor(metric, sortedYears)), 0, metric.key);
  }
});

check("/finance/funds の基金総額：1989年度と2009年度が同じ線で結ばれていない", () => {
  const fundTotal = lineMetrics.find((m) => m.key === "fundTotal");
  assert.ok(fundTotal, "fundTotal指標が見つからない");
  const series = seriesFor(fundTotal, fundRows);
  const indexOf = (year) => series.findIndex((p) => p.year === year);
  const segments = financeLineSegments(series);
  const segmentOf = (index) => segments.findIndex((s) => s.includes(index));
  assert.ok(indexOf(1989) >= 0 && indexOf(2009) >= 0, "1989年度・2009年度が表示範囲に無い");
  assert.notEqual(segmentOf(indexOf(1989)), segmentOf(indexOf(2009)));
  const gaps = financeLineGaps(series);
  assert.ok(gaps.length >= 1, "欠損区間が検出されていない");
  assert.ok(gaps[0].missingYears.includes(1995), "1990年代の未確認年度が欠損区間に含まれていない");
});

check("/finance/funds の財源調整用基金：未確認年度を0として描いていない", () => {
  const series = continuousFiscalYearSeries(
    fundRows.map((y) => ({
      year: y.fiscalYear,
      label: label(y.fiscalYear),
      value: y.fund?.balance?.fiscalAdjustmentFundYen ?? null,
    })),
    label,
  );
  assert.ok(
    series.every((p) => p.value === null || p.value > 0),
    "未確認年度が0として入っている",
  );
});

check("/finance/debt の折れ線：値のある年度が連続しているため、線を切る区間は生じない", () => {
  const debtBalance = lineMetrics.find((m) => m.key === "debtBalanceGeneral");
  assert.ok(debtBalance, "debtBalanceGeneral指標が見つからない");
  const series = seriesFor(debtBalance, debtRows);
  assert.equal(financeLineGaps(series).length, 0);
});

// --- 4. 原因の再発防止（コンポーネント側の受け渡し） -----------------------

check("FinanceMetricSectionはnullを事前除外した配列を折れ線グラフへ渡していない", () => {
  const source = readText("src/components/finance/FinanceMetricSection.tsx");
  const chartCall = source.slice(source.indexOf("<FinanceLineChart"), source.indexOf("formatValue={(v) => metric.formatValue(v)}"));
  assert.ok(chartCall.length > 0, "FinanceLineChartの呼び出しが見つからない");
  assert.ok(
    !chartCall.includes("nonNullPoints"),
    "nonNullPoints（null除外済み）をFinanceLineChartへ渡している。欠損年度が1目盛りへ圧縮され、直線で結ばれる",
  );
  assert.ok(chartCall.includes("linePoints"), "linePoints（未確認年度を含む系列）を渡していない");
});

check("FinanceLineChartは線分の分割を共通ロジック（financeLineSegments）に委ねている", () => {
  const source = readText("src/components/finance/FinanceLineChart.tsx");
  assert.ok(source.includes("financeLineSegments("), "financeLineSegmentsを使っていない");
  assert.ok(source.includes("financeLineGaps("), "financeLineGapsを使っていない");
});

console.log(`\n財政グラフ欠損年度テスト：${passCount}件すべて成功`);
