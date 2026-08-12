/**
 * 類似団体区分「Ⅲ－３」財政比較データ（src/data/similarMunicipalityFinanceComparison.json）。
 *
 * TASK-012で確定した構成59自治体（延岡市を含む）について、総務省公式資料から
 * 同一年度・同一定義で取得できた財政指標のみを収録する。自治体ごとに別資料・
 * 別年度を混在させない（財政力指数等5指標は「地方公共団体の主要財政指標一覧」
 * という単一の全国統一資料から取得、人口は「住民基本台帳に基づく人口」という
 * 別の単一の全国統一資料から取得。両資料の基準時点は完全には一致しない）。
 *
 * 地方債現在高・基金残高・歳入・歳出は自治体ごとに個別の決算資料が必要なため、
 * 今回は延岡市以外はnull（未取得）。順位・中央値・平均値の算出はsrc/lib側で
 * 行い、「良い/悪い」等の価値判断は一切表示しない（事実としての数値・順位のみ）。
 */
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
  /** 地方債現在高（円）。個別資料未収集のためnull（延岡市を除く）。 */
  debtBalanceYen: number | null;
  /** 基金残高（円）。個別資料未収集のためnull（延岡市を除く）。 */
  fundBalanceYen: number | null;
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
