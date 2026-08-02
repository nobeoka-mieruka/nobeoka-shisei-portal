import themesData from "../data/themes.json";
import type { Theme } from "../types";
import { normalizeTopicLabel } from "./topicNormalization";

export const themes = themesData as Theme[];

const UNCLASSIFIED_SLUG = "unclassified";

export function findThemeBySlug(slug: string): Theme | undefined {
  return themes.find((t) => t.slug === slug);
}

/**
 * 正規化済みのテーマ語句（topicNormalization適用後）を、固定テーマ辞書のslugへ分類する。
 * src/data/themes.jsonのkeywordsに部分一致すれば、そのテーマへ分類する。
 * 会議録データへの保存はせず、常にtopicsから計算する（二重管理を避けるため）。
 * 一致しない場合は"unclassified"（未分類）を返す。独自の推測分類はしない。
 */
export function classifyTopicToThemeSlug(rawTopic: string): string {
  const topic = normalizeTopicLabel(rawTopic);
  for (const theme of themes) {
    if (theme.keywords.some((keyword) => topic.includes(keyword))) {
      return theme.slug;
    }
  }
  return UNCLASSIFIED_SLUG;
}
