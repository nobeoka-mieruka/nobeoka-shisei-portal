/**
 * 汎用の順位付け関数。欠損値（null/undefined/非数値）は順位計算から除外し、
 * rank: null として返す（＝「確認中」等の表示に使う）。
 * 有効な数値は降順に並べ、同額は同順位（競技順位方式：1, 2, 2, 4）とする。
 */
export interface Ranked<T> {
  item: T;
  value: number | null;
  rank: number | null;
}

export function rankGeneric<T>(items: T[], getValue: (item: T) => number | null | undefined): Ranked<T>[] {
  const withValue = items.map((item) => {
    const raw = getValue(item);
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    return { item, value };
  });

  const rankable = withValue
    .filter((entry): entry is { item: T; value: number } => entry.value !== null)
    .sort((a, b) => b.value - a.value);

  const rankByItem = new Map<T, number>();
  let rank = 1;
  rankable.forEach((entry, index) => {
    if (index > 0 && entry.value !== rankable[index - 1].value) {
      rank = index + 1;
    }
    rankByItem.set(entry.item, rank);
  });

  return withValue.map(({ item, value }) => ({
    item,
    value,
    rank: rankByItem.get(item) ?? null,
  }));
}
