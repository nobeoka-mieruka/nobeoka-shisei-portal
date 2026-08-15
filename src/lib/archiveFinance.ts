import type {
  ArchiveFiscalYear,
  MunicipalBondIssuanceStatus,
  MunicipalBondIssuanceValueType,
} from "../types/historicalArchive";

/** 年度昇順に並べ替える。元データの登録順に依存しない。 */
export function sortedFiscalYears(years: ArchiveFiscalYear[]): ArchiveFiscalYear[] {
  return [...years].sort((a, b) => a.fiscalYear - b.fiscalYear);
}

/**
 * TASK-081：財政データの欠損年度を整理する共通ヘルパー。
 * 特定の項目（基金・当初予算等）でグラフ・表からフィルタして除外している年度を、
 * 「未収録」として明示するための文字列を組み立てる（0円と未収録の混同を防ぐ）。
 * 欠損理由が個別に分かっている場合は呼び出し側でnotesとして別途補足すること
 * （このヘルパーは「登録されていない」という事実のみを扱い、理由を推測しない）。
 */
export function missingFiscalYears(allYears: ArchiveFiscalYear[], hasData: (y: ArchiveFiscalYear) => boolean): number[] {
  return sortedFiscalYears(allYears)
    .filter((y) => !hasData(y))
    .map((y) => y.fiscalYear);
}

/** 欠損年度の一覧を、市民向けの短い文言にする。0件（欠損なし）ならnull。 */
export function formatMissingFiscalYearsNote(missingYears: number[], itemLabel: string): string | null {
  if (missingYears.length === 0) return null;
  return `${itemLabel}が未収録の年度：${missingYears.map((y) => fiscalYearLabel(y)).join("、")}（データが存在しないという意味ではなく、当サイトでまだ確認できていません）`;
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
