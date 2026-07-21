import type { ComponentType, SVGProps } from "react";
import type { MayorPromiseItem, MayorPromiseStatusLabel } from "../types";
import { CheckCircleIcon, ClockIcon, ChartBarIcon, MinusCircleIcon, ArrowPathIcon, QuestionMarkCircleIcon } from "../components/icons";

/** 状況バッジの配色。色だけでなく必ず文字ラベル・アイコンと併用すること。 */
export const mayorPromiseStatusClass: Record<MayorPromiseStatusLabel, string> = {
  達成: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  実施済み: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  進行中: "bg-primary-container text-on-primary-container",
  一部実施: "bg-[#fdf0d8] text-[#8a5a00] dark:bg-[#3a2a05] dark:text-[#f0c674]",
  方針変更: "bg-[#efe3fb] text-[#5b3a91] dark:bg-[#2a1f3d] dark:text-[#c9a8f0]",
  未着手: "bg-surface-variant text-on-surface-variant",
  検討中: "bg-surface-variant text-on-surface-variant",
  確認中: "bg-surface-variant text-on-surface-variant",
};

/** 状況バッジ用アイコン。色・文字に加えてアイコンでも識別できるようにする。 */
export const mayorPromiseStatusIcon: Record<MayorPromiseStatusLabel, ComponentType<SVGProps<SVGSVGElement>>> = {
  達成: CheckCircleIcon,
  実施済み: CheckCircleIcon,
  進行中: ClockIcon,
  一部実施: ChartBarIcon,
  方針変更: ArrowPathIcon,
  未着手: MinusCircleIcon,
  検討中: QuestionMarkCircleIcon,
  確認中: QuestionMarkCircleIcon,
};

const ACHIEVED_STATUSES: MayorPromiseStatusLabel[] = ["達成", "実施済み"];
/** 「進捗が動いている」とみなす区分の優先順位（優先度が高いものから判定）。 */
const ACTIVE_STATUS_PRIORITY: MayorPromiseStatusLabel[] = ["進行中", "一部実施", "方針変更", "検討中"];

/**
 * 政策カテゴリに属する個別公約の状況から、政策全体の状況を1つに集計する。
 * 優先順位：すべて達成／実施済み＞進行中・一部実施・方針変更・検討中のいずれかが1件以上
 * ＞すべて未着手＞それ以外は確認中。
 * 該当する個別公約が1件もない場合は null を返す（表示側で「確認中」等にフォールバックする）。
 */
export function aggregateCategoryStatus(
  promises: MayorPromiseItem[],
  categoryId: string,
): MayorPromiseStatusLabel | null {
  const items = promises.filter((p) => p.categoryId === categoryId);
  if (items.length === 0) return null;

  if (items.every((p) => ACHIEVED_STATUSES.includes(p.statusLabel))) {
    return items[0].statusLabel;
  }
  for (const label of ACTIVE_STATUS_PRIORITY) {
    if (items.some((p) => p.statusLabel === label)) return label;
  }
  if (items.every((p) => p.statusLabel === "未着手")) return "未着手";
  return "確認中";
}
