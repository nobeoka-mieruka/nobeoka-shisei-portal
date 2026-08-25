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
  CONTINUING: "継続実施中",
  PREPARING: "準備中",
  NOT_ASSESSABLE: "評価不能",
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
