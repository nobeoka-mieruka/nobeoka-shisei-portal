import type { ArchiveFiscalYear } from "../types/historicalArchive";

/** 年度昇順に並べ替える。元データの登録順に依存しない。 */
export function sortedFiscalYears(years: ArchiveFiscalYear[]): ArchiveFiscalYear[] {
  return [...years].sort((a, b) => a.fiscalYear - b.fiscalYear);
}

/** 円単位の内部値を「約◯億円」表示に変換する。nullは「確認中」。 */
export function formatOkuYenOrConfirming(value: number | null | undefined): string {
  if (value === null || value === undefined) return "確認中";
  return `約${(value / 100_000_000).toFixed(1)}億円`;
}

/** 円単位の内部値をそのまま円表示にする（1人当たり金額など）。nullは「確認中」。 */
export function formatYenOrConfirming(value: number | null | undefined): string {
  if (value === null || value === undefined) return "確認中";
  return `${value.toLocaleString("ja-JP")}円`;
}

/** パーセント値の表示。nullは「確認中」。 */
export function formatPercentOrConfirming(value: number | null | undefined): string {
  if (value === null || value === undefined) return "確認中";
  return `${value}％`;
}

export function fiscalYearLabel(fiscalYear: number): string {
  return `${fiscalYear}年度`;
}
