/**
 * 類似団体区分「Ⅲ－３」財政比較データ（src/data/similarMunicipalityFinanceComparison.json）。
 *
 * TASK-012で確定した構成59自治体（延岡市を含む）について、総務省公式資料から
 * 同一年度・同一定義で取得できた財政指標のみを収録する。自治体ごとに別資料・
 * 別年度を混在させない（財政力指数等5指標は「地方公共団体の主要財政指標一覧」
 * という単一の全国統一資料から取得、人口は「住民基本台帳に基づく人口」という
 * 別の単一の全国統一資料から取得。両資料の基準時点は完全には一致しない）。
 *
 * 基金残高（Phase88で追加）は総務省「基金の積立状況等の一覧化」から全団体同一定義で
 * 取得できた。地方債現在高は、財政指標・人口のような単一の全国統一Excelを今回の調査
 * 時間内では発見できなかったため、全団体debtBalance.dataStatus="NOT_FOUND"のまま
 * （延岡市を含め未収集。個別自治体ごとに探すのは次回以降の課題）。
 * 総額／一般会計／全会計の区別が資料上明確でない値は登録していない（fundBalanceの
 * accountTypeに明記）。順位・中央値・平均値の算出はsrc/lib側で行い、「良い/悪い」等の
 * 価値判断は一切表示しない（事実としての数値・順位のみ）。
 */

/** 個別データ項目の取得状況。未取得の理由を区別する（推測で埋めない）。 */
export type SimilarMunicipalityDataStatus =
  /** 一次資料で確認済み。 */
  | "CONFIRMED"
  /** 該当資料がまだ公表されていない。 */
  | "NOT_PUBLISHED"
  /** この団体・年度には該当しない（算定なし等）。 */
  | "NOT_APPLICABLE"
  /** 全国統一の資料を今回の調査では発見できなかった。 */
  | "NOT_FOUND"
  /** 調査継続中。 */
  | "UNDER_RESEARCH";

/** 基金残高（円）。総務省「基金の積立状況等の一覧化」による全団体同一定義。 */
export interface SimilarMunicipalityFundBalance {
  fiscalYear: number;
  /** 集計範囲（例："全会計（基金）"）。一般会計・普通会計・全会計を混同しないため必ず明記する。 */
  accountType: string;
  totalFundBalanceYen: number | null;
  fiscalReserveFundYen: number | null;
  bondRedemptionFundYen: number | null;
  otherSpecificPurposeFundsYen: number | null;
  perCapitaTotalFundBalanceYen: number | null;
  definition: string;
  dataStatus: SimilarMunicipalityDataStatus;
}

/** 地方債現在高（円）。今回は全国統一の単一資料を発見できなかったため、全団体NOT_FOUND。 */
export interface SimilarMunicipalityDebtBalance {
  fiscalYear: number;
  accountType: string;
  totalDebtBalanceYen: number | null;
  perCapitaDebtBalanceYen: number | null;
  definition: string;
  sourceRef: string | null;
  sourceUrl: string | null;
  checkedAt: string;
  dataStatus: SimilarMunicipalityDataStatus;
}

export interface SimilarMunicipalityFinanceEntry {
  /** 全国地方公共団体コード（6桁）。 */
  municipalityCode: string;
  municipalityName: string;
  prefecture: string;
  /** trueの場合、延岡市自身の行。 */
  isNobeoka: boolean;
  /** 財政指標の対象年度（西暦、4月始まり）。 */
  fiscalYear: number;
  classificationCode: string;
  /** 住民基本台帳人口（令和6年1月1日時点等、財政指標とは基準時点が異なる場合がある）。未取得の場合はnull。 */
  population: number | null;
  financialStrengthIndex: number | null;
  /** 経常収支比率(%)。 */
  ordinaryBalanceRatioPercent: number | null;
  realDebtServiceRatioPercent: number | null;
  /** 将来負担比率(%)。算定なしの場合はnull。 */
  futureBurdenRatioPercent: number | null;
  /** ラスパイレス指数（職員給与水準の指標、参考値）。 */
  laspeyresIndex: number | null;
  /** 基金残高の内訳（Phase88追加、全団体同一定義）。 */
  fundBalance?: SimilarMunicipalityFundBalance;
  /** 地方債現在高（Phase88時点では全団体NOT_FOUND、将来のための型のみ用意）。 */
  debtBalance?: SimilarMunicipalityDebtBalance;
  totalRevenueYen: number | null;
  totalExpenditureYen: number | null;
}

export interface SimilarMunicipalityFinanceData {
  generatedAt: string;
  classificationCode: string;
  fiscalYear: number;
  note: string;
  sourceRefs: {
    sourceUrl: string;
    sourceTitle: string;
    sourceOrganization: string;
    sourcePublishedDate: string | null;
    accessedAt: string;
    extractionMethod: "manual" | "pdf-extraction" | "official-api" | "other";
    verificationStatus: "verified" | "needsReview" | "partiallyVerified";
    notes?: string;
  }[];
  municipalities: SimilarMunicipalityFinanceEntry[];
}
