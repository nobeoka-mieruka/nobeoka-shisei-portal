/**
 * 「同じ年度の確認済み人口」を使った1人当たり金額の算出。
 * 元資料に既に1人当たり値が掲載されている場合（例：市債残高・基金残高のperCapitaYen）は
 * ここでは算出せず、元資料の値をそのまま「算出値ではない」ものとして別途表示すること。
 */
import type { ArchiveFiscalYear, ArchiveSourceRef } from "../types/historicalArchive";

export interface PerCapitaResult {
  value: number;
  formula: string;
  numeratorLabel: string;
  numeratorYen: number;
  denominatorLabel: string;
  denominatorPopulation: number;
  populationFiscalYear: number;
  rounding: string;
  /** 当サイトが算出した値であり、元資料に掲載された値そのものではないことを示すフラグ。常にtrue。 */
  isCalculated: true;
  sourceRefs: ArchiveSourceRef[];
}

/**
 * 金額（円）を、指定した年度の確認済み人口で割った1人当たり金額を算出する。
 * 金額・人口のいずれかが未確認（null/undefined）、または人口が0以下の場合は算出しない（nullを返す）。
 * 人口はpopulationYear引数で明示的に渡された年度のものだけを使い、他年度の値で代替しない。
 */
export function computePerCapitaYen(
  amountYen: number | null | undefined,
  amountLabel: string,
  amountSourceRefs: ArchiveSourceRef[],
  populationYear: ArchiveFiscalYear | undefined,
): PerCapitaResult | null {
  const population = populationYear?.population?.population;
  if (amountYen == null || population == null || population <= 0 || !populationYear) return null;

  return {
    value: Math.round(amountYen / population),
    formula: `${amountLabel}（円）÷ 人口（人）`,
    numeratorLabel: amountLabel,
    numeratorYen: amountYen,
    denominatorLabel: "人口",
    denominatorPopulation: population,
    populationFiscalYear: populationYear.fiscalYear,
    rounding: "円未満四捨五入",
    isCalculated: true,
    sourceRefs: [...amountSourceRefs, ...(populationYear.population?.sourceRefs ?? [])],
  };
}

export function formatPerCapitaYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

/** 算式・分子・分母・使用した人口年度・丸め方・算出値である旨をまとめた1行の説明文を作る。 */
export function describePerCapita(result: PerCapitaResult, label: string): string {
  return `${label}：${formatPerCapitaYen(result.value)}（${result.formula}＝${result.numeratorYen.toLocaleString("ja-JP")}円÷${result.denominatorPopulation.toLocaleString("ja-JP")}人〔${result.populationFiscalYear}年度人口〕、${result.rounding}、当サイトによる算出値）`;
}
