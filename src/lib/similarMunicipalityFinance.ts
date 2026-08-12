import similarMunicipalityFinanceData from "../data/similarMunicipalityFinanceComparison.json";
import type { SimilarMunicipalityFinanceData, SimilarMunicipalityFinanceEntry } from "../types/similarMunicipalityFinance";

export const similarMunicipalityFinance = similarMunicipalityFinanceData as SimilarMunicipalityFinanceData;

type NumericField = Extract<
  keyof SimilarMunicipalityFinanceEntry,
  "population" | "financialStrengthIndex" | "ordinaryBalanceRatioPercent" | "realDebtServiceRatioPercent" | "futureBurdenRatioPercent" | "laspeyresIndex"
>;

export interface FieldStats {
  /** 値を確認できた自治体数（nullを除く）。 */
  count: number;
  min: number | null;
  max: number | null;
  median: number | null;
  average: number | null;
  /** 延岡市の値。 */
  nobeokaValue: number | null;
  /** 値を確認できた自治体の中での延岡市の順位（1=最小値）。値が同じ場合は同順位。未確認の場合はnull。 */
  nobeokaRankFromLowest: number | null;
}

/**
 * 指定した指標の統計値（最小・最大・中央値・平均・延岡市の値と順位）を算出する。
 * 「順位が高い/低いことが良い/悪い」という価値判断は一切行わない（事実の算出のみ）。
 */
export function computeFieldStats(field: NumericField): FieldStats {
  const values = similarMunicipalityFinance.municipalities
    .map((m) => m[field])
    .filter((v): v is number => typeof v === "number");
  const sorted = [...values].sort((a, b) => a - b);
  const nobeoka = similarMunicipalityFinance.municipalities.find((m) => m.isNobeoka);
  const nobeokaValue = nobeoka ? (nobeoka[field] as number | null) : null;

  const median =
    sorted.length === 0
      ? null
      : sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

  const average = sorted.length === 0 ? null : sorted.reduce((a, b) => a + b, 0) / sorted.length;

  let nobeokaRankFromLowest: number | null = null;
  if (nobeokaValue != null) {
    nobeokaRankFromLowest = sorted.filter((v) => v < nobeokaValue).length + 1;
  }

  return {
    count: sorted.length,
    min: sorted.length ? sorted[0] : null,
    max: sorted.length ? sorted[sorted.length - 1] : null,
    median,
    average,
    nobeokaValue,
    nobeokaRankFromLowest,
  };
}
