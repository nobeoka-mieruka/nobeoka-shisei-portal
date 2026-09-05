import type { UpdateHistoryCategory } from "../types";

/** 更新履歴のカテゴリ別バッジ色。UpdatesPage・HomePageの両方で同じ配色を使うための共通定義。 */
export const UPDATE_HISTORY_CATEGORY_CLASS: Record<UpdateHistoryCategory, string> = {
  新規追加: "bg-primary-container text-on-primary-container",
  データ更新: "bg-secondary-container text-on-secondary-container",
  表示改善: "bg-tertiary-container text-on-tertiary-container",
  出典追加: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  修正: "bg-surface-variant text-on-surface-variant",
  "議案・表決": "bg-[#e3ddff] text-[#2c2470] dark:bg-[#221a5c] dark:text-[#c9beff]",
  議会資料: "bg-[#dfe2f0] text-[#333a5c] dark:bg-[#242a45] dark:text-[#c2c8e6]",
  品質改善: "bg-[#ffe5c2] text-[#5c3d00] dark:bg-[#4a3200] dark:text-[#ffd699]",
  新機能: "bg-[#d3f4ff] text-[#00374a] dark:bg-[#003547] dark:text-[#a6e8ff]",
};

/** 日付降順（新しい順）に並べ替える。同日の場合は元の配列順を保つ（安定ソート）。 */
export function sortUpdateHistoryByDateDesc<T extends { date: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
