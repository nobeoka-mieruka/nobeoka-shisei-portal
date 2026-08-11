import type {
  ArchiveFiscalYear,
  MunicipalBondIssuanceStatus,
  MunicipalBondIssuanceValueType,
} from "../types/historicalArchive";

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

/** 市債発行額の確認状況（決算確認済み／予算値のみ／一次資料公開待ち等）を表示用の日本語ラベルに変換する。 */
export function municipalBondIssuanceStatusLabel(status: MunicipalBondIssuanceStatus | undefined): string {
  switch (status) {
    case "settlementConfirmed":
      return "決算確認済み";
    case "budgetOnly":
      return "予算値のみ";
    case "sourcePendingPublication":
      return "一次資料公開待ち";
    case "sourceFoundValueUnextracted":
      return "一次資料あり／値未抽出";
    case "unconfirmed":
    case undefined:
      return "未確認";
  }
}

/** 市債発行額の値の性質（決算／当初予算／補正後予算等）を表示用の日本語ラベルに変換する。 */
export function municipalBondIssuanceValueTypeLabel(valueType: MunicipalBondIssuanceValueType | undefined): string | undefined {
  switch (valueType) {
    case "settlement":
      return "決算";
    case "initialBudget":
      return "当初予算";
    case "revisedBudget":
      return "補正後予算";
    case "budget":
      return "予算（区分未特定）";
    case undefined:
      return undefined;
  }
}
