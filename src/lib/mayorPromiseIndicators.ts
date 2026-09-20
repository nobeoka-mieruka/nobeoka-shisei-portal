/**
 * Phase267：個別施策の「指標（indicators）」＝ 指標ごと・年度ごとの数値の検証と集計。
 *
 * ■ 背景
 * 従来 mayorPromiseMeasures.json は quantitativeValue / quantitativeUnit に
 * 「代表値1件」しか持てず、次の3つが1つの文字列・1つの数値に潰れていた。
 *   1. 1つの施策に複数の数値がある（例：開催会場数と相談件数）
 *   2. 年度が違う数値がある（例：令和7年度の実績と令和8年度の予定）
 *   3. 実績と予定の区別（単位側に「件（令和8年度予定）」と書かれていた）
 * indicators は、この3つを label / unit ／ fiscalYear ／ kind に分けて持つための構造。
 *
 * ■ 絶対に守ること（このモジュールが機械的に守らせる）
 * - 単位（unit）に年度・予定・実績等を混ぜない。
 * - 同じ指標の中で「年度＋区分（実績／予定）」が重複しない（年度履歴の二重登録を防ぐ）。
 * - 値は必ず数値。未確認を0で埋めない（未確認なら値自体を登録しない）。
 * - 既存の代表値（quantitativeValue）と食い違わない（旧表示と新指標の不整合を防ぐ）。
 * - 一次資料の転記文（previousYearResult / currentYearResult / currentYearPlan）に
 *   現れない数値を登録しない（合算・按分・推定の混入を防ぐ）。
 *
 * ■ leafモジュール方針
 * JSON importも値の相対importも持たないため、scripts/validate-data.mjs と
 * scripts/test-mayor-promise-indicators.mjs の双方から
 * `node --experimental-strip-types` で直接importできる。
 */
import type { MayorPromiseIndicator, MayorPromiseMeasureSnapshot } from "../types";

/** 検証の指摘1件。tagは既存validate-data.mjsの出力形式に合わせるための識別子。 */
export interface IndicatorIssue {
  tag: string;
  message: string;
}

/** 年度ラベルの形式（例：令和8年度）。 */
const FISCAL_YEAR_RE = /^(令和|平成|昭和)\d+年度$/;

/** 単位に混ぜてはいけない語。年度はfiscalYear、実績／予定はkindで表す。 */
const UNIT_FORBIDDEN_RE = /(年度|予定|実績|見込|累計|時点)/;

const VALID_KINDS = new Set(["result", "plan"]);

const isBlank = (value: unknown): boolean => typeof value !== "string" || value.trim().length === 0;

/**
 * 施策の転記文に現れる数値の集合を返す（桁区切りのカンマは除去して比較する）。
 * 「資料に書かれている数値だけを指標にする」ことを機械的に確かめるために使う。
 */
export function numbersInMeasureText(measure: MayorPromiseMeasureSnapshot): Set<number> {
  const text = [
    measure.previousYearResult,
    measure.currentYearResult,
    measure.currentYearPlan,
    measure.futureTarget,
    measure.notes,
  ]
    .filter((t): t is string => typeof t === "string")
    .join(" ")
    .replace(/,/g, "");
  const found = new Set<number>();
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
    found.add(Number(m[0]));
  }
  if (typeof measure.quantitativeValue === "number") found.add(measure.quantitativeValue);
  return found;
}

/**
 * indicators の整合性を検証する。エラーが無ければ空配列を返す。
 * validate-data.mjs と回帰テストの両方がこの関数だけを使う（判定を二重に書かない）。
 */
export function validateMeasureIndicators(measures: MayorPromiseMeasureSnapshot[]): IndicatorIssue[] {
  const issues: IndicatorIssue[] = [];
  const seenIndicatorIds = new Set<string>();

  for (const measure of measures) {
    const measureTag = `mayorPromiseMeasures.json (${measure.measureId ?? "id不明"})`;
    const indicators: MayorPromiseIndicator[] = measure.indicators ?? [];
    if (indicators.length === 0) continue;

    const textNumbers = numbersInMeasureText(measure);
    const valuesInMeasure: number[] = [];

    for (const indicator of indicators) {
      const tag = `${measureTag} indicators=${indicator.id ?? "id不明"}`;
      if (isBlank(indicator.id)) issues.push({ tag, message: "指標のidが空です" });
      else if (seenIndicatorIds.has(indicator.id))
        issues.push({ tag, message: `指標のidが重複しています: ${indicator.id}` });
      else seenIndicatorIds.add(indicator.id);

      if (isBlank(indicator.label)) issues.push({ tag, message: "指標のlabel（指標名）が空です" });
      if (isBlank(indicator.unit)) issues.push({ tag, message: "指標のunit（単位）が空です" });
      else if (UNIT_FORBIDDEN_RE.test(indicator.unit))
        issues.push({
          tag,
          message: `unitには単位のみを書いてください（年度はfiscalYear、実績／予定はkindで表します）: ${indicator.unit}`,
        });

      if (!Array.isArray(indicator.values) || indicator.values.length === 0) {
        issues.push({ tag, message: "指標に年度別の値（values）がありません" });
        continue;
      }

      const seenYearKind = new Set<string>();
      for (const value of indicator.values) {
        const valueTag = `${tag} ${value.fiscalYear ?? "年度不明"}`;
        if (isBlank(value.fiscalYear) || !FISCAL_YEAR_RE.test(value.fiscalYear))
          issues.push({ tag: valueTag, message: `fiscalYearの形式が不正です（例：令和8年度）: ${value.fiscalYear}` });
        if (typeof value.value !== "number" || !Number.isFinite(value.value))
          issues.push({
            tag: valueTag,
            message: `valueは数値で登録してください（未確認の値を0等で埋めないこと）: ${value.value}`,
          });
        else {
          valuesInMeasure.push(value.value);
          if (!textNumbers.has(value.value))
            issues.push({
              tag: valueTag,
              message: `一次資料の転記文に現れない数値です（合算・推定は登録できません）: ${value.value}`,
            });
        }
        if (!VALID_KINDS.has(value.kind))
          issues.push({ tag: valueTag, message: `kindはresult（実績）かplan（予定）のいずれかです: ${value.kind}` });

        const key = `${value.fiscalYear}／${value.kind}`;
        if (seenYearKind.has(key))
          issues.push({ tag: valueTag, message: `同じ指標の中で年度と区分（実績／予定）が重複しています: ${key}` });
        else seenYearKind.add(key);
      }
    }

    // 後方互換：代表値を持つ施策に指標を追加した場合、どの指標とも一致しない代表値が残っていると、
    // 画面によって違う数字が出る（旧UIは代表値、新UIは指標を表示するため）。
    if (typeof measure.quantitativeValue === "number" && !valuesInMeasure.includes(measure.quantitativeValue)) {
      issues.push({
        tag: measureTag,
        message: `quantitativeValue（${measure.quantitativeValue}）と一致する指標の値がありません（旧表示と新指標の食い違い）`,
      });
    }
  }

  return issues;
}

/** 指標の整備状況。/data-status の表示と回帰テストが同じ値を使う。 */
export interface MeasureIndicatorSummary {
  /** 指標を登録した施策数。 */
  measuresWithIndicators: number;
  /** 施策の総数。 */
  measureTotal: number;
  /** 指標の総数。 */
  indicatorTotal: number;
  /** 年度別の値の総数。 */
  valueTotal: number;
  /** うち実績の件数。 */
  resultValueTotal: number;
  /** うち予定（計画値）の件数。 */
  planValueTotal: number;
  /** 値が登録されている年度（登録順、重複なし）。 */
  fiscalYears: string[];
  /** 2年度以上の値を持つ指標の数（年度をまたぐ推移を追えるもの）。 */
  multiYearIndicatorTotal: number;
}

export function summarizeMeasureIndicators(measures: MayorPromiseMeasureSnapshot[]): MeasureIndicatorSummary {
  const fiscalYears: string[] = [];
  let indicatorTotal = 0;
  let valueTotal = 0;
  let resultValueTotal = 0;
  let planValueTotal = 0;
  let multiYearIndicatorTotal = 0;
  let measuresWithIndicators = 0;

  for (const measure of measures) {
    const indicators = measure.indicators ?? [];
    if (indicators.length === 0) continue;
    measuresWithIndicators += 1;
    indicatorTotal += indicators.length;
    for (const indicator of indicators) {
      const years = new Set<string>();
      for (const value of indicator.values ?? []) {
        valueTotal += 1;
        if (value.kind === "plan") planValueTotal += 1;
        else resultValueTotal += 1;
        years.add(value.fiscalYear);
        if (!fiscalYears.includes(value.fiscalYear)) fiscalYears.push(value.fiscalYear);
      }
      if (years.size >= 2) multiYearIndicatorTotal += 1;
    }
  }

  return {
    measuresWithIndicators,
    measureTotal: measures.length,
    indicatorTotal,
    valueTotal,
    resultValueTotal,
    planValueTotal,
    fiscalYears,
    multiYearIndicatorTotal,
  };
}
