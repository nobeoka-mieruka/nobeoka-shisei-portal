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

/**
 * TASK-097（Phase10 Lane E）：archiveFiscalYears.jsonには1965年度のように、他の収録年度
 * （1988〜2026年度）から大きく離れた単独の年度が混在している。「収録年度：X／Y年度（最古〜最新）」
 * という表示だけでは、最古年度〜最新年度の間が連続して収録されているかのように誤解されるおそれが
 * あるため、実際に記録が存在しない年度区間（歯抜け区間）を明示する注記を組み立てる。
 * 区間が1つもなければnull（＝表示中の年度がすべて連続している）。
 */
export function fiscalYearGapNote(allYears: ArchiveFiscalYear[]): string | null {
  const sorted = sortedFiscalYears(allYears);
  const gapDescriptions: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevFy = sorted[i - 1].fiscalYear;
    const currFy = sorted[i].fiscalYear;
    if (currFy - prevFy > 1) {
      gapDescriptions.push(`${fiscalYearLabel(prevFy)}〜${fiscalYearLabel(currFy)}の間（${currFy - prevFy - 1}年度分）`);
    }
  }
  if (gapDescriptions.length === 0) return null;
  return `上記の年度範囲は最古年度〜最新年度を示しているだけで、その間の全年度を収録しているという意味ではありません。${gapDescriptions.join("、")}は当サイトに記録がなく、推移として連続的に比較できません。`;
}

/**
 * TASK-085：年度ごとのデータ有無判定。FinanceFundsPage・FinanceBudgetPage・
 * FinanceDebtPage・DataStatusPage・dataCompletenessSummaryで同じ`!!y.fund`等の
 * 判定式を個別に書いていたため、一本化した（将来、判定基準を変える際の修正漏れを防ぐ）。
 */
export function hasFundData(y: ArchiveFiscalYear): boolean {
  return !!y.fund;
}
export function hasBudgetData(y: ArchiveFiscalYear): boolean {
  return !!y.budget;
}
export function hasDebtData(y: ArchiveFiscalYear): boolean {
  return !!y.debt;
}
export function hasFinanceRatioData(y: ArchiveFiscalYear): boolean {
  return !!y.finance;
}
export function hasPopulationData(y: ArchiveFiscalYear): boolean {
  return !!y.population;
}

/**
 * Phase137：上記hasBudgetData等は「そのサブオブジェクト自体が存在するか」（＝この軸で調査に
 * 着手済みか）だけを見ており、フィールド単位の欠損（例：budgetは存在するが
 * generalAccountInitialBudgetYenだけがnull）までは区別できない。「年度は収録済みだが
 * 一部項目が未確認」という状態をUI・data-statusで正しく表せるよう、代表的なフィールド単位の
 * 判定関数をここに追加する。項目名は既存スキーマ（src/types/historicalArchive.ts）の
 * フィールド名をそのまま使い、独自の名称は作らない。
 */
export function hasInitialBudgetAmount(y: ArchiveFiscalYear): boolean {
  return y.budget?.generalAccountInitialBudgetYen != null;
}
/**
 * 市債残高（普通会計ベース）。ArchiveMunicipalBondBalanceは定義の異なる5区分
 * （一般会計／普通会計／特別会計含む／企業会計含む／市民1人当たり）を持ち、実際に登録されている
 * 年度が最も多いのはordinaryAccountLocalBondBalanceYen（普通会計、Phase137時点で36年度）のため、
 * これを代表指標とする。generalAccountBondBalanceYen（一般会計）は別区分のため単純合算はしない
 * （区分を明示した別集計として扱う。hasGeneralAccountBondBalance参照）。
 */
export function hasOrdinaryAccountBondBalance(y: ArchiveFiscalYear): boolean {
  return y.debt?.balance?.ordinaryAccountLocalBondBalanceYen != null;
}
/**
 * 市債残高（一般会計ベース）。Phase165でFY2019〜2024分（延岡市監査委員の決算審査意見書）を
 * 新規確認し、Phase137時点のFY2025のみ（1年度）から7年度に増えた。上記の普通会計ベースとは
 * 定義が異なる別集計のため、混同しないこと。
 */
export function hasGeneralAccountBondBalance(y: ArchiveFiscalYear): boolean {
  return y.debt?.balance?.generalAccountBondBalanceYen != null;
}
/** 基金残高。totalYen（合計）は元資料に合計行が無い年度が多いため、区分ごとの内訳値（財源調整用・財政調整基金単体・減債基金・その他特定目的基金）のいずれか1つでも確認できていれば「確認済み」とする。 */
export function hasAnyFundBalance(y: ArchiveFiscalYear): boolean {
  const b = y.fund?.balance;
  if (!b) return false;
  return b.totalYen != null || b.fiscalAdjustmentFundYen != null || b.fiscalReserveFundYen != null || b.bondRedemptionFundYen != null || b.otherSpecificPurposeFundsYen != null;
}
/**
 * 一般会計決算額（歳出決算ベース、generalAccountSettlementYen）。Phase165でFY2019〜2024分
 * （延岡市監査委員の決算審査意見書）を新規確認した。予算額（当初・補正後）とは別の指標であり、
 * 既存のhasInitialBudgetAmount（当初予算）・fiscalYearsWithTotalRevenue（歳入総額）とも
 * 定義が異なるため、別集計として扱う。
 */
export function hasGeneralAccountSettlement(y: ArchiveFiscalYear): boolean {
  return y.budget?.generalAccountSettlementYen != null;
}
/** 財政健全化判断比率。4指標（実質公債費比率・将来負担比率・経常収支比率・財政力指数）のいずれか1つでも確認できていれば「確認済み」とする（4指標すべてを要求すると、一部だけ確認できた年度が「未確認」として過小評価されるため）。 */
export function hasAnyFinanceRatio(y: ArchiveFiscalYear): boolean {
  const f = y.finance;
  if (!f) return false;
  return f.realDebtServiceRatioPercent != null || f.futureBurdenRatioPercent != null || f.currentAccountRatioPercent != null || f.financialStrengthIndex != null;
}

/**
 * Phase177：Phase165で新規確認したフィールドのうち、hasGeneralAccountBondBalance・
 * hasGeneralAccountSettlement（Phase168で追加済み）以外の項目にも、データ収録状況ページの
 * 完全性ダッシュボードへ未反映のものが残っていたため追加する。個別ページ
 * （FinanceBudgetPage・FinanceDebtPage等）には既に表示済みの値で、ここでは
 * 「完全性ダッシュボードで年度カバレッジを集計できるか」の観点のみを追加する
 * （データ実値・既存の型定義は変更しない）。
 */
/** 一般会計補正後（最終）予算額。当初予算・決算額とは別の集計（generalAccountFinalBudgetYen）。 */
export function hasFinalBudgetAmount(y: ArchiveFiscalYear): boolean {
  return y.budget?.generalAccountFinalBudgetYen != null;
}
/** 特別会計予算額（specialAccountBudgetYen）。Phase165でFY2020〜2025分を新規確認するまで、当サイトのどの画面にも表示されていなかった項目。 */
export function hasSpecialAccountBudget(y: ArchiveFiscalYear): boolean {
  return y.budget?.specialAccountBudgetYen != null;
}
/** 市債残高（企業会計を含む全会計、includingEnterpriseAccountsYen）。一般会計・普通会計ベースとは別区分。 */
export function hasBondBalanceIncludingEnterprise(y: ArchiveFiscalYear): boolean {
  return y.debt?.balance?.includingEnterpriseAccountsYen != null;
}
/** 市債残高（市民1人当たり、perCapitaYen）。FinanceDebtPageの年度別一覧には既に表示されている。 */
export function hasBondBalancePerCapita(y: ArchiveFiscalYear): boolean {
  return y.debt?.balance?.perCapitaYen != null;
}
/** 歳入内訳（地方税・地方交付税・国庫支出金・都道府県支出金）のいずれか1つでも確認できていれば「確認済み」とする（4項目すべてを要求すると過小評価されるため、hasAnyFundBalance等と同じ方針）。 */
export function hasAnyRevenueBreakdown(y: ArchiveFiscalYear): boolean {
  const b = y.budget;
  if (!b) return false;
  return b.localTaxRevenueYen != null || b.localAllocationTaxYen != null || b.nationalSubsidiesYen != null || b.prefecturalSubsidiesYen != null;
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
