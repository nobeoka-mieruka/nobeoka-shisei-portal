#!/usr/bin/env node
/**
 * 財政単位異常（円/千円/百万円混在の疑い）・前年比異常変動検出
 *
 * 対象: src/data/archiveFiscalYears.json（年度別の時系列財政データ）。
 * このファイルの数値フィールドは "xxxYen"（円単位、末尾Yenで明示）という命名規則が
 * 徹底されている（例: generalAccountInitialBudgetYen）。単位（円/千円/百万円）自体は
 * フィールド名で自己文書化されているため、「別の単位の値を間違えて円単位のフィールドに
 * 入力してしまった」場合、前後の年度と比べて概ね1000倍・100万倍のような桁違いの値になる
 * ことが多い。本スクリプトはこれを「前年比の異常倍率」として検出する。
 *
 * 【既存資産との重複回避】
 * scripts/validate-data.mjsは個々の数値の型・非負性等は検証しているが、
 * 「同一フィールドの年度間比較による桁ズレ検知」は行っていない（新規）。
 *
 * 設計上の注意：
 * - 市町村合併・制度改正・大規模事業（庁舎建設等）による正当な急変動もありうるため、
 *   本スクリプトの出力は「要確認候補」であり、即エラーではない。
 * - 比較は「直前の非null値」との比較とする（欠番年度をまたいでも比較できるようにするため）。
 * 読み取り専用。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJson, walk } from "./_lib.mjs";

const RATIO_HIGH = 5; // 前年の5倍以上
const RATIO_LOW = 1 / 5; // 前年の1/5以下
const MIN_ABS_VALUE = 100_000; // 小さすぎる値のノイズ（誤差レベルの変動）を除外するための下限（円）

let fiscalYears;
try {
  fiscalYears = readJson("src/data/archiveFiscalYears.json");
} catch (e) {
  console.error("[check-finance-unit-anomalies] archiveFiscalYears.jsonを読み込めませんでした:", e.message);
  process.exit(0);
}

// フィールドパス（例: "budget.generalAccountInitialBudgetYen"）ごとに { fiscalYear, value } の時系列を作る。
const seriesByField = new Map();

for (const record of fiscalYears) {
  const fy = record.fiscalYear;
  if (typeof fy !== "number") continue;
  walk(record, (node, path) => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (!/Yen$/.test(key)) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const fieldPath = `${path}.${key}`.replace(/^\$\./, "");
      if (!seriesByField.has(fieldPath)) seriesByField.set(fieldPath, []);
      seriesByField.get(fieldPath).push({ fiscalYear: fy, value });
    }
  });
}

const anomalies = [];
for (const [fieldPath, series] of seriesByField.entries()) {
  const sorted = [...series].sort((a, b) => a.fiscalYear - b.fiscalYear);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (Math.abs(prev.value) < MIN_ABS_VALUE || Math.abs(cur.value) < MIN_ABS_VALUE) continue;
    if (prev.value === 0) continue;
    const ratio = cur.value / prev.value;
    if (ratio >= RATIO_HIGH || ratio <= RATIO_LOW) {
      anomalies.push({
        fieldPath,
        prevFiscalYear: prev.fiscalYear,
        prevValue: prev.value,
        curFiscalYear: cur.fiscalYear,
        curValue: cur.value,
        ratio: Math.round(ratio * 1000) / 1000,
        yearGap: cur.fiscalYear - prev.fiscalYear,
        suspectedUnitMixupRatio1000: ratio >= 800 && ratio <= 1200 ? "up" : ratio >= 1 / 1200 && ratio <= 1 / 800 ? "down" : null,
      });
    }
  }
}
anomalies.sort((a, b) => Math.abs(Math.log(b.ratio || 1)) - Math.abs(Math.log(a.ratio || 1)));

// financeDashboard.json（単年度スナップショット）の内部整合性チェック：内訳の合計 ≈ 総額（±3%程度は端数として許容）。
const internalConsistency = [];
try {
  const fd = readJson("src/data/financeDashboard.json");
  const checks = [
    { label: "歳入内訳合計 vs totalThousandYen", items: fd.revenue, totalField: fd.generalAccount?.totalThousandYen, amountKey: "amountThousandYen" },
    { label: "歳出内訳合計 vs totalThousandYen", items: fd.expenditure, totalField: fd.generalAccount?.totalThousandYen, amountKey: "amountThousandYen" },
  ];
  for (const c of checks) {
    if (!Array.isArray(c.items) || typeof c.totalField !== "number") continue;
    const sum = c.items.reduce((acc, x) => acc + (typeof x[c.amountKey] === "number" ? x[c.amountKey] : 0), 0);
    const diffPercent = c.totalField === 0 ? null : Math.round((Math.abs(sum - c.totalField) / c.totalField) * 1000) / 10;
    internalConsistency.push({ label: c.label, sum, total: c.totalField, diffPercent, flagged: diffPercent !== null && diffPercent > 3 });
  }
} catch {
  // financeDashboard.jsonが読めない/構造が異なる場合はスキップ
}

const findings = {
  generatedAt: new Date().toISOString(),
  fieldsAnalyzed: seriesByField.size,
  anomalyCount: anomalies.length,
  anomalies,
  financeDashboardInternalConsistency: internalConsistency,
  thresholds: { ratioHigh: RATIO_HIGH, ratioLow: RATIO_LOW, minAbsValueYen: MIN_ABS_VALUE },
  note:
    "anomaliesは前年比5倍以上/5分の1以下の変動を機械的に抽出したもの。制度改正・大規模事業等による" +
    "正当な変動を含みうるため、即エラーではなく要確認候補として扱う。suspectedUnitMixupRatio1000が" +
    "up/downの場合、比率が概ね1000倍/1000分の1に近く、円/千円の桁違い入力を特に疑う価値が高い。" +
    "yearGapが大きい（間の年度が未収集で比較が数十年離れている）場合は、単純な経済成長・インフレでも" +
    "大きな比率になりうるため、yearGapが5年を超えるanomalyは優先度を下げてよい。",
};

const outPath = join(ROOT, "reports", "qa-checks", "_out-finance-unit-anomalies.json");
writeFileSync(outPath, JSON.stringify(findings, null, 2) + "\n", "utf8");

console.log(`[check-finance-unit-anomalies] fieldsAnalyzed=${seriesByField.size} anomalies=${anomalies.length}`);
console.log("  上位5件:", anomalies.slice(0, 5).map((a) => `${a.fieldPath} ${a.prevFiscalYear}->${a.curFiscalYear} x${a.ratio}`));
console.log("  financeDashboard内部整合性:", internalConsistency);
process.exitCode = 0; // 要確認候補の提示に留めるため常に正常終了
