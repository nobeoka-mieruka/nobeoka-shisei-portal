/**
 * 財政年度比較（/compare/finance等）・年度推移グラフ（/finance/budget等）・年度別タイムライン
 * （/timeline/:year）で共通利用する、年度別財政指標のレジストリ。
 * archiveFiscalYears.jsonの各サブフィールドへのアクセス・単位・グラフ種別・定義注記を一箇所にまとめ、
 * ページごとに同じnullチェック・フォーマットを重複実装しないようにする。
 */
import type { ArchiveFiscalYear, ArchiveSourceRef } from "../types/historicalArchive";
import { formatOkuYenOrConfirming, formatPercentOrConfirming } from "./archiveFinance";

export type FinanceMetricGroup = "population" | "budget" | "debt" | "fund" | "ratio";

export interface FinanceMetricPoint {
  value: number | null;
  sourceRefs: ArchiveSourceRef[];
  /** その年度固有の定義注記（元資料の記載が年度により異なる場合）。無ければmetric.definitionNoteを使う。 */
  definitionNoteOverride?: string;
}

export interface FinanceMetricDefinition {
  key: string;
  label: string;
  unit: string;
  group: FinanceMetricGroup;
  /** line＝残高等ストック値の推移、bar＝発行額・予算額等フロー値（年度ごとの単発値）。 */
  chartKind: "line" | "bar";
  definitionNote: string;
  formatValue: (value: number | null) => string;
  getPoint: (year: ArchiveFiscalYear) => FinanceMetricPoint;
}

function formatPersonOrConfirming(value: number | null | undefined): string {
  if (value === null || value === undefined) return "確認中";
  return `${value.toLocaleString("ja-JP")}人`;
}

function formatHouseholdsOrConfirming(value: number | null | undefined): string {
  if (value === null || value === undefined) return "確認中";
  return `${value.toLocaleString("ja-JP")}世帯`;
}

function formatIndexOrConfirming(value: number | null | undefined): string {
  if (value === null || value === undefined) return "確認中";
  return value.toFixed(2);
}

export const FINANCE_METRICS: FinanceMetricDefinition[] = [
  {
    key: "population",
    label: "人口",
    unit: "人",
    group: "population",
    chartKind: "line",
    definitionNote: "各年度の基準日時点の人口（基準日は年度により異なる場合があります）。",
    formatValue: formatPersonOrConfirming,
    getPoint: (y) => ({ value: y.population?.population ?? null, sourceRefs: y.population?.sourceRefs ?? [] }),
  },
  {
    key: "households",
    label: "世帯数",
    unit: "世帯",
    group: "population",
    chartKind: "line",
    definitionNote: "各年度の基準日時点の世帯数。",
    formatValue: formatHouseholdsOrConfirming,
    getPoint: (y) => ({ value: y.population?.households ?? null, sourceRefs: y.population?.sourceRefs ?? [] }),
  },
  {
    key: "budgetInitial",
    label: "一般会計当初予算",
    unit: "円（億円表示）",
    group: "budget",
    chartKind: "bar",
    definitionNote: "4月時点で議決された当初予算額（その後の補正は含まない）。補正後予算・決算額とは別の数値です。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({ value: y.budget?.generalAccountInitialBudgetYen ?? null, sourceRefs: y.budget?.sourceRefs ?? [] }),
  },
  {
    key: "budgetFinal",
    label: "補正後予算",
    unit: "円（億円表示）",
    group: "budget",
    chartKind: "bar",
    definitionNote: "補正後（最終）の予算額。決算額（実際の執行額）とは別の数値です。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({ value: y.budget?.generalAccountFinalBudgetYen ?? null, sourceRefs: y.budget?.sourceRefs ?? [] }),
  },
  {
    key: "settlement",
    label: "一般会計決算",
    unit: "円（億円表示）",
    group: "budget",
    chartKind: "bar",
    definitionNote: "決算額（実際に執行された額）。予算額（当初・補正後）とは別の数値です。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({ value: y.budget?.generalAccountSettlementYen ?? null, sourceRefs: y.budget?.sourceRefs ?? [] }),
  },
  {
    key: "totalRevenue",
    label: "歳入総額",
    unit: "円（億円表示）",
    group: "budget",
    chartKind: "bar",
    definitionNote: "一般会計の歳入総額。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({ value: y.budget?.totalRevenueYen ?? null, sourceRefs: y.budget?.sourceRefs ?? [] }),
  },
  {
    key: "totalExpenditure",
    label: "歳出総額",
    unit: "円（億円表示）",
    group: "budget",
    chartKind: "bar",
    definitionNote: "一般会計の歳出総額。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({ value: y.budget?.totalExpenditureYen ?? null, sourceRefs: y.budget?.sourceRefs ?? [] }),
  },
  {
    key: "localTax",
    label: "市税",
    unit: "円（億円表示）",
    group: "budget",
    chartKind: "bar",
    definitionNote: "地方税（市税）収入額。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({ value: y.budget?.localTaxRevenueYen ?? null, sourceRefs: y.budget?.sourceRefs ?? [] }),
  },
  {
    key: "localAllocationTax",
    label: "地方交付税",
    unit: "円（億円表示）",
    group: "budget",
    chartKind: "bar",
    definitionNote: "地方交付税額。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({ value: y.budget?.localAllocationTaxYen ?? null, sourceRefs: y.budget?.sourceRefs ?? [] }),
  },
  {
    key: "nationalSubsidies",
    label: "国庫支出金",
    unit: "円（億円表示）",
    group: "budget",
    chartKind: "bar",
    definitionNote: "国庫支出金額。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({ value: y.budget?.nationalSubsidiesYen ?? null, sourceRefs: y.budget?.sourceRefs ?? [] }),
  },
  {
    key: "debtIssuance",
    label: "市債発行額",
    unit: "円（億円表示）",
    group: "debt",
    chartKind: "bar",
    definitionNote: "その年度に新たに借り入れた額（フロー）。年度末市債残高（ストック）とは別の数値です。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({
      value: y.debt?.municipalBondIssuanceYen ?? null,
      sourceRefs: y.debt?.balance.sourceRefs ?? [],
      definitionNoteOverride: y.debt?.notes,
    }),
  },
  {
    key: "debtBalanceGeneral",
    label: "年度末市債残高（一般会計）",
    unit: "円（億円表示）",
    group: "debt",
    chartKind: "line",
    definitionNote:
      "一般会計のみの市債残高。普通会計地方債・特別会計含む・企業会計含む残高とは定義が異なるため単純比較できません。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({
      value: y.debt?.balance.generalAccountBondBalanceYen ?? null,
      sourceRefs: y.debt?.balance.sourceRefs ?? [],
      definitionNoteOverride: y.debt?.balance.definitionNote,
    }),
  },
  {
    key: "debtBalanceOrdinary",
    label: "年度末市債残高（普通会計地方債）",
    unit: "円（億円表示）",
    group: "debt",
    chartKind: "line",
    definitionNote:
      "普通会計の地方債残高。一般会計のみの残高・特別会計含む・企業会計含む残高とは定義が異なるため単純比較できません。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({
      value: y.debt?.balance.ordinaryAccountLocalBondBalanceYen ?? null,
      sourceRefs: y.debt?.balance.sourceRefs ?? [],
      definitionNoteOverride: y.debt?.balance.definitionNote,
    }),
  },
  {
    key: "fundTotal",
    label: "基金総額",
    unit: "円（億円表示）",
    group: "fund",
    chartKind: "line",
    definitionNote: "財源調整用基金とその他特定目的基金の合計（元資料の分類による）。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({
      value: y.fund?.balance.totalYen ?? null,
      sourceRefs: y.fund?.balance.sourceRefs ?? [],
      definitionNoteOverride: y.fund?.balance.definitionNote,
    }),
  },
  {
    key: "fiscalAdjustmentFund",
    label: "財源調整用基金",
    unit: "円（億円表示）",
    group: "fund",
    chartKind: "line",
    definitionNote:
      "財政調整積立基金・地域づくり推進事業基金・退職手当基金・減債基金の合計（元資料の定義。単独の「財政調整基金」のみの金額ではありません）。基金総額とは定義が異なるため単純比較できません。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({
      value: y.fund?.balance.fiscalAdjustmentFundYen ?? null,
      sourceRefs: y.fund?.balance.sourceRefs ?? [],
      definitionNoteOverride: y.fund?.balance.definitionNote,
    }),
  },
  {
    key: "fiscalReserveFund",
    label: "財政調整基金",
    unit: "円（億円表示）",
    group: "fund",
    chartKind: "line",
    definitionNote:
      "財政調整基金単独の残高（総務省統一様式「財政状況資料集」の区分）。上記の財源調整用基金（財政調整積立基金・地域づくり推進事業基金・退職手当基金・減債基金の合計）とは定義が異なるため単純比較できません。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({
      value: y.fund?.balance.fiscalReserveFundYen ?? null,
      sourceRefs: y.fund?.balance.sourceRefs ?? [],
      definitionNoteOverride: y.fund?.balance.definitionNote,
    }),
  },
  {
    key: "financialStrengthIndex",
    label: "財政力指数",
    unit: "（指数）",
    group: "ratio",
    chartKind: "line",
    definitionNote: "総務省の地方公共団体財政健全化法に基づき市が公表した財政力指数。独自の評価・順位づけは行っていません。",
    formatValue: formatIndexOrConfirming,
    getPoint: (y) => ({ value: y.finance?.financialStrengthIndex ?? null, sourceRefs: y.finance?.sourceRefs ?? [] }),
  },
  {
    key: "currentAccountRatio",
    label: "経常収支比率",
    unit: "%",
    group: "ratio",
    chartKind: "line",
    definitionNote: "市が公表した経常収支比率。独自の評価・順位づけは行っていません。",
    formatValue: formatPercentOrConfirming,
    getPoint: (y) => ({ value: y.finance?.currentAccountRatioPercent ?? null, sourceRefs: y.finance?.sourceRefs ?? [] }),
  },
  {
    key: "realDebtServiceRatio",
    label: "実質公債費比率",
    unit: "%",
    group: "ratio",
    chartKind: "line",
    definitionNote: "市が公表した実質公債費比率。独自の評価・順位づけは行っていません。",
    formatValue: formatPercentOrConfirming,
    getPoint: (y) => ({ value: y.finance?.realDebtServiceRatioPercent ?? null, sourceRefs: y.finance?.sourceRefs ?? [] }),
  },
  {
    key: "futureBurdenRatio",
    label: "将来負担比率",
    unit: "%",
    group: "ratio",
    chartKind: "line",
    definitionNote: "市が公表した将来負担比率。独自の評価・順位づけは行っていません。",
    formatValue: formatPercentOrConfirming,
    getPoint: (y) => ({ value: y.finance?.futureBurdenRatioPercent ?? null, sourceRefs: y.finance?.sourceRefs ?? [] }),
  },
];

export const FINANCE_METRIC_GROUP_LABELS: Record<FinanceMetricGroup, string> = {
  population: "人口",
  budget: "予算・決算",
  debt: "市債",
  fund: "基金",
  ratio: "財政指標",
};

export function financeMetricsByGroup(group: FinanceMetricGroup): FinanceMetricDefinition[] {
  return FINANCE_METRICS.filter((m) => m.group === group);
}

export function financeMetricByKey(key: string): FinanceMetricDefinition | undefined {
  return FINANCE_METRICS.find((m) => m.key === key);
}
