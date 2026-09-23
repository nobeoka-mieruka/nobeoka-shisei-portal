/**
 * 財政年度比較（/compare/finance等）・年度推移グラフ（/finance/budget等）・年度別タイムライン
 * （/timeline/:year）で共通利用する、年度別財政指標のレジストリ。
 * archiveFiscalYears.jsonの各サブフィールドへのアクセス・単位・グラフ種別・定義注記を一箇所にまとめ、
 * ページごとに同じnullチェック・フォーマットを重複実装しないようにする。
 */
import type { ArchiveFiscalYear, ArchiveSourceRef } from "../types/historicalArchive";
import {
  formatOkuYenOrConfirming,
  formatPercentOrConfirming,
  municipalBondIssuanceStatusLabel,
  municipalBondIssuanceValueTypeLabel,
} from "./archiveFinance";
import { soundnessValueStatus, type SoundnessValueField } from "./financeSoundness";

export type FinanceMetricGroup = "population" | "budget" | "debt" | "fund" | "ratio";

export interface FinanceMetricPoint {
  value: number | null;
  sourceRefs: ArchiveSourceRef[];
  /** その年度固有の定義注記（元資料の記載が年度により異なる場合）。無ければmetric.definitionNoteを使う。 */
  definitionNoteOverride?: string;
  /**
   * 「確認状況」列の表示を上書きする（例：決算確認済み／予算値のみ／一次資料公開待ち等の5区分）。
   * 未指定時は従来通りsourceRefs[0].verificationStatusから導出する。
   */
  statusLabelOverride?: string;
  /** 値の性質（決算／当初予算／補正後予算等）。指定した指標のみ「値の種類」列を表示する。 */
  valueTypeLabel?: string;
  /**
   * 資料で「該当なし」（比率が算定されない）と明記された年度。値はnullのまま、
   * 「確認中」「資料未確認」とは区別して表示する。
   */
  notApplicable?: boolean;
}

/**
 * 健全化判断比率の年度の点。「該当なし」（赤字が無い・将来負担額を財源が上回る等で
 * 比率が算定されない）を、確認中と同じ見え方にしない。判定は財政健全化の各画面と同じ関数を使う。
 */
function ratioPoint(y: ArchiveFiscalYear, field: SoundnessValueField): FinanceMetricPoint {
  const notApplicable = soundnessValueStatus(y.finance, field) === "notApplicable";
  return {
    value: y.finance?.[field] ?? null,
    sourceRefs: y.finance?.sourceRefs ?? [],
    notApplicable,
    statusLabelOverride: notApplicable ? "該当なし（比率が算定されない）" : undefined,
  };
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

/**
 * Phase248：人口・世帯数の系列定義と、市域（集計範囲）の変更をまとめた注記。
 *
 * 掲載している人口・世帯数は、いずれも延岡市「現住人口及び世帯数の推移」の**同じ表の同じ行**
 * （同一基準日）から取得した「現住人口」系列である。同じ統計ページで別に公表されている
 * 「住民基本台帳による町丁目別人口・世帯数」「国勢調査」とは別系列のため、混ぜて比較できない。
 *
 * また、この表は当時の行政区域ベースで、遡及的な市域の組み替えをしていない
 * （平成18年2月20日の北方町・北浦町編入、平成19年3月31日の北川町編入の前後で
 * 人口・世帯数ともに実際の段差があることを月次データで確認済み）。
 * このため、編入前後の年度を直接比較すると「増えた」ように見える点を必ず添える。
 */
const POPULATION_BOUNDARY_NOTE =
  "この数値は当時の市域（行政区域）で集計されており、現在の市域に組み替えた数値ではありません。" +
  "平成18年2月20日に北方町・北浦町、平成19年3月31日に北川町が編入されたため、その前後の年度を直接比べると市域の広がりの分だけ増えて見えます。";

const POPULATION_SERIES_NOTE =
  "延岡市「現住人口及び世帯数の推移」の各年1月1日現在の現住人口です（この資料は月ごとの一覧のため、" +
  "年度どうしを並べられるよう基準日をそろえています。最新の月の人口は延岡市の財政ページに基準日つきで掲載しています）。" +
  "住民基本台帳人口・国勢調査人口とは別の系列のため、混ぜて比較できません。" +
  POPULATION_BOUNDARY_NOTE;

const HOUSEHOLDS_SERIES_NOTE =
  "同じ表・同じ基準日の行から取得した、現住人口に対応する世帯数です。" +
  "住民基本台帳の世帯数・国勢調査の世帯数とは別の系列のため、混ぜて比較できません。" +
  POPULATION_BOUNDARY_NOTE;

export const FINANCE_METRICS: FinanceMetricDefinition[] = [
  {
    key: "population",
    label: "人口",
    unit: "人",
    group: "population",
    chartKind: "line",
    definitionNote: POPULATION_SERIES_NOTE,
    formatValue: formatPersonOrConfirming,
    getPoint: (y) => ({ value: y.population?.population ?? null, sourceRefs: y.population?.sourceRefs ?? [] }),
  },
  {
    key: "households",
    label: "世帯数",
    unit: "世帯",
    group: "population",
    chartKind: "line",
    definitionNote: HOUSEHOLDS_SERIES_NOTE,
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
    definitionNote:
      "歳入の決算総額。年度により、一般会計（広報等）の値と、普通会計（決算カード・財政状況資料集。2001〜2008年度と2019年度以降）の値が含まれます。会計の範囲が異なる年度があるため、各年度の定義欄をご確認ください。",
    formatValue: formatOkuYenOrConfirming,
    getPoint: (y) => ({ value: y.budget?.totalRevenueYen ?? null, sourceRefs: y.budget?.sourceRefs ?? [] }),
  },
  {
    key: "totalExpenditure",
    label: "歳出総額",
    unit: "円（億円表示）",
    group: "budget",
    chartKind: "bar",
    definitionNote:
      "歳出の決算総額。年度により、一般会計（広報等）の値と、普通会計（決算カード・財政状況資料集。2001〜2008年度と2019年度以降）の値が含まれます。会計の範囲が異なる年度があるため、各年度の定義欄をご確認ください。",
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
      sourceRefs: y.debt?.municipalBondIssuanceSourceRefs ?? [],
      definitionNoteOverride: y.debt?.notes,
      statusLabelOverride: municipalBondIssuanceStatusLabel(y.debt?.municipalBondIssuanceStatus),
      valueTypeLabel: municipalBondIssuanceValueTypeLabel(y.debt?.municipalBondIssuanceValueType),
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
    definitionNote: "基金の年度末残高の合計。年度により元資料と会計の範囲が異なります（企業会計を含む広報の値、一般・特別会計の審査意見書の値など）。年度をまたいで比べる前に、各年度の定義欄をご確認ください。",
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
    definitionNote: "市が公表した財政力指数（地方交付税法に基づく基準財政収入額を基準財政需要額で割った値の過去3年平均）。独自の評価・順位づけは行っていません。",
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
    getPoint: (y) => ratioPoint(y, "realDebtServiceRatioPercent"),
  },
  {
    key: "futureBurdenRatio",
    label: "将来負担比率",
    unit: "%",
    group: "ratio",
    chartKind: "line",
    definitionNote: "市が公表した将来負担比率。独自の評価・順位づけは行っていません。",
    formatValue: formatPercentOrConfirming,
    getPoint: (y) => ratioPoint(y, "futureBurdenRatioPercent"),
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
