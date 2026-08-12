import kohoOcrSearchIndexData from "../data/kohoOcrSearchIndex.json";
import type { KohoOcrSearchEntry } from "../types/kohoSearch";

export const kohoOcrSearchIndex = kohoOcrSearchIndexData as KohoOcrSearchEntry[];

export const KOHO_SEARCH_CATEGORY_LABEL: Record<KohoOcrSearchEntry["category"], string> = {
  mayorPolitics: "市長・政治",
  councilElection: "議会・選挙",
  finance: "財政",
  cityAdmin: "市政（合併・新庁舎等）",
};

/** キーワードの部分一致（大文字小文字を区別しない）で索引を検索する。 */
export function searchKohoOcrIndex(query: string): KohoOcrSearchEntry[] {
  const q = query.trim();
  if (!q) return [];
  return kohoOcrSearchIndex.filter((e) => e.keyword.includes(q) || e.context.includes(q));
}
