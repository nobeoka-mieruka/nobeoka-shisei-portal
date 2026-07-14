import type { MayorPromiseItem, MayorPromiseStatusLabel } from "../types";

/** 状況バッジの配色。色だけでなく必ず文字ラベルと併用すること。 */
export const mayorPromiseStatusClass: Record<MayorPromiseStatusLabel, string> = {
  進行中: "bg-primary-container text-on-primary-container",
  検討中: "bg-surface-variant text-on-surface-variant",
  実施済み: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  確認中: "bg-surface-variant text-on-surface-variant",
};

/**
 * 政策カテゴリに属する個別公約の状況から、政策全体の状況を1つに集計する。
 * 優先順位：すべて実施済み＞進行中が1件以上＞（進行中なしで）検討中が1件以上＞それ以外は確認中。
 * 該当する個別公約が1件もない場合は null を返す（表示側で「確認中」等にフォールバックする）。
 */
export function aggregateCategoryStatus(
  promises: MayorPromiseItem[],
  categoryId: string,
): MayorPromiseStatusLabel | null {
  const items = promises.filter((p) => p.categoryId === categoryId);
  if (items.length === 0) return null;

  if (items.every((p) => p.statusLabel === "実施済み")) return "実施済み";
  if (items.some((p) => p.statusLabel === "進行中")) return "進行中";
  if (items.some((p) => p.statusLabel === "検討中")) return "検討中";
  return "確認中";
}
