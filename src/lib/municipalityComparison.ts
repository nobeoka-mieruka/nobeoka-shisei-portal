import municipalityComparisonData from "../data/municipalityComparison.json";
import type { MunicipalityComparisonEntry } from "../types";

export const municipalityComparisons = municipalityComparisonData as MunicipalityComparisonEntry[];

/** 延岡市を先頭に、それ以外は五十音順で並べる。 */
export function sortedMunicipalityComparisons(): MunicipalityComparisonEntry[] {
  return [...municipalityComparisons].sort((a, b) => {
    if (a.isNobeoka) return -1;
    if (b.isNobeoka) return 1;
    return a.municipality.localeCompare(b.municipality, "ja");
  });
}

export function formatYenMetric(value: number | null, unit: "円" = "円"): string {
  return value !== null ? `${value.toLocaleString("ja-JP")}${unit}` : "確認中";
}
