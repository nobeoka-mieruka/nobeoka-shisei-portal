import type { ComponentType, SVGProps } from "react";
import type { MayorPromiseMeasureStatus } from "../types";
import { CheckCircleIcon, ClockIcon, ArrowPathIcon, MinusCircleIcon, QuestionMarkCircleIcon } from "../components/icons";

/**
 * 個別の取組み（mayorPromiseMeasures.json、Phase148）の進捗区分を、
 * 市民が理解しやすい日本語ラベルへ変換する。市独自の評価とポータル独自評価を混同しないため、
 * ここでのラベルはPDF本文に記載された事実の言い換えに留め、達成率等のスコアリングは行わない。
 */
export const mayorPromiseMeasureStatusLabel: Record<MayorPromiseMeasureStatus, string> = {
  COMPLETED: "完了",
  IN_PROGRESS: "実施中",
  PLANNED: "予定",
  CONTINUING: "継続",
  PREPARING: "準備中",
  NOT_ASSESSABLE: "判定できず",
};

/** 状況バッジの配色。色だけでなく必ず文字ラベル・アイコンと併用すること。 */
export const mayorPromiseMeasureStatusClass: Record<MayorPromiseMeasureStatus, string> = {
  COMPLETED: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  IN_PROGRESS: "bg-primary-container text-on-primary-container",
  CONTINUING: "bg-primary-container text-on-primary-container",
  PLANNED: "bg-surface-variant text-on-surface-variant",
  PREPARING: "bg-[#fdf0d8] text-[#8a5a00] dark:bg-[#3a2a05] dark:text-[#f0c674]",
  NOT_ASSESSABLE: "bg-surface-variant text-on-surface-variant",
};

export const mayorPromiseMeasureStatusIcon: Record<MayorPromiseMeasureStatus, ComponentType<SVGProps<SVGSVGElement>>> = {
  COMPLETED: CheckCircleIcon,
  IN_PROGRESS: ClockIcon,
  CONTINUING: ArrowPathIcon,
  PLANNED: MinusCircleIcon,
  PREPARING: QuestionMarkCircleIcon,
  NOT_ASSESSABLE: QuestionMarkCircleIcon,
};

/**
 * 施策データのfiscalYear（例："令和8年度"）から、offsetYears分だけ前後の年度ラベルを算出する
 * （Phase154）。表示ラベルの言い換えのみを行い、実績・予定の中身は一切補完・推測しない。
 * パターンに一致しない場合はnullを返し、呼び出し側は汎用ラベル（前年度／今年度等）へ
 * フォールバックすること。
 */
export function shiftFiscalYearLabel(fiscalYear: string, offsetYears: number): string | null {
  const m = /^令和(\d+)年度$/.exec(fiscalYear);
  if (!m) return null;
  const year = Number(m[1]) + offsetYears;
  if (!Number.isFinite(year) || year <= 0) return null;
  return `令和${year}年度`;
}

/**
 * Phase274：指標の年度別の値が、実績なのか予定・予算・目標なのかの表示ラベル。
 *
 * 予定や予算額を実績として読ませないため、値の横に必ずこの文字ラベルを併記する。
 * 色や記号だけで区別しない（色覚の違いや白黒印刷でも区別できるようにするため）。
 */
export const MEASURE_INDICATOR_KIND_LABEL: Record<
  "actual" | "budget" | "planned" | "target" | "derived" | "provisional",
  string
> = {
  actual: "実績",
  budget: "予算額",
  planned: "予定（計画値）",
  target: "目標値",
  derived: "当サイトの算出値",
  provisional: "速報値",
};

/** 区分ごとの説明文（「なぜこの数字か」の説明で使う）。 */
export const MEASURE_INDICATOR_KIND_DESCRIPTION: Record<
  "actual" | "budget" | "planned" | "target" | "derived" | "provisional",
  string
> = {
  actual: "公表資料で、既に行われたこととして記載されている数値です。",
  budget: "予算に計上された額です。実際に使われた額（決算）とは異なります。",
  planned: "公表資料に、これから行う予定として記載されている数値です。実績ではありません。",
  target: "公表資料に、目指す水準として記載されている数値です。現在の値ではありません。",
  derived: "公表資料の数値から当サイトが計算した値です。算出式を併記しています。",
  provisional: "公表資料に速報値・暫定値として記載されている数値です。後から変わることがあります。",
};

/** 区分バッジの配色。色だけで意味を伝えないため、必ず上の文字ラベルと併用する。 */
export const measureIndicatorKindClass: Record<
  "actual" | "budget" | "planned" | "target" | "derived" | "provisional",
  string
> = {
  actual: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  budget: "bg-secondary-container text-on-secondary-container",
  planned: "bg-surface-variant text-on-surface-variant",
  target: "bg-[#efe3fb] text-[#5b3a91] dark:bg-[#2a1f3d] dark:text-[#c9a8f0]",
  derived: "border border-outline-variant text-on-surface-variant",
  provisional: "bg-[#fdf0d8] text-[#8a5a00] dark:bg-[#3a2a05] dark:text-[#f0c674]",
};
