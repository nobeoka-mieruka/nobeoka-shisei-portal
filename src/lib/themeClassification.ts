import themesData from "../data/themes.json";
import type { Theme } from "../types";
import type { ArchivePolicyCategory } from "../types/historicalArchive";
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

/**
 * 質問テーマ（themes.json、一般質問の分類用）と政策テーママスタ（archivePolicyCategories.json、
 * アーカイブ横断の共通テーマ辞書）は別々のタクソノミーとして運用しているため、
 * 人が一度だけ定義した直接対応表（推測・機械分類ではない）で橋渡しする。
 * 新しいテーマ・カテゴリを追加した場合は、このマップも合わせて見直すこと。
 */
export const THEME_TO_POLICY_CATEGORY_IDS: Record<string, string[]> = {
  "theme-education": ["childcare", "education"],
  "theme-welfare": ["welfare", "senior", "disability"],
  "theme-health": ["healthcare"],
  "theme-disaster": ["disaster-prevention", "fire-service"],
  "theme-population": ["population-decline", "migration"],
  "theme-industry": ["commerce", "employment"],
  "theme-tourism": ["tourism"],
  "theme-primary-industry": ["agriculture-fishery"],
  "theme-transportation": ["public-transport", "infrastructure"],
  "theme-urban-development": ["downtown-revitalization"],
  "theme-environment": ["environment", "decarbonization"],
  "theme-finance-reform": ["finance", "administrative-reform"],
  "theme-digital": ["digitalization"],
  "theme-city-office": ["city-hall-reform"],
  "theme-community": ["community"],
  "theme-other": ["other"],
  "theme-unclassified": [],
};

// ===== フェーズ8：横断検索・テーマ分類の基盤（ルールベース、外部AI APIは使用しない） =====

export interface ThemeMatch {
  categoryId: string;
  /** 0〜1。一致した語の種類数・出現回数から機械的に算出する（AI推定ではない）。 */
  confidence: number;
  matchedKeywords: string[];
  /** 一致箇所の前後の抜粋。人による確認の手がかり用。 */
  evidenceText: string;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const found = haystack.indexOf(needle, from);
    if (found === -1) break;
    count += 1;
    from = found + needle.length;
  }
  return count;
}

/**
 * 政策テーママスタ（archivePolicyCategories.jsonのkeywords・label）に対して、政策・議案・
 * 一般質問等の本文（自由記述の長文）を機械的に照合し、分類候補を返す純粋関数。
 * `classifyTopicToThemeSlug`（短い質問テーマ語句を最初に一致した1件へ分類）とは異なり、
 * 長文中の複数キーワード出現を集計して候補を確信度順に複数返す。
 *
 * 外部AI APIは一切使用しない（ルールベースのキーワード一致のみ）。戻り値はあくまで候補であり、
 * 呼び出し側で確定分類として扱わないこと（ArchiveAiCategoryCandidate.status="candidate"の
 * まま保存し、人が確認するまで確定分類・公開表示に使わない）。
 */
export function matchPolicyCategoriesForText(
  text: string,
  categories: ArchivePolicyCategory[],
  maxResults = 5,
): ThemeMatch[] {
  const normalized = text.normalize("NFKC");
  const matches: ThemeMatch[] = [];

  for (const category of categories) {
    const terms = [...(category.keywords ?? []), category.label];
    const matchedKeywords: string[] = [];
    let occurrences = 0;
    for (const term of terms) {
      if (!term) continue;
      const count = countOccurrences(normalized, term);
      if (count > 0) {
        matchedKeywords.push(term);
        occurrences += count;
      }
    }
    if (matchedKeywords.length === 0) continue;

    const confidence = Math.min(1, matchedKeywords.length * 0.25 + Math.min(occurrences, 5) * 0.05);
    const evidenceIndex = normalized.indexOf(matchedKeywords[0]);
    const evidenceText =
      evidenceIndex >= 0
        ? normalized.slice(Math.max(0, evidenceIndex - 10), evidenceIndex + matchedKeywords[0].length + 10)
        : matchedKeywords.join("、");

    matches.push({ categoryId: category.id, confidence, matchedKeywords, evidenceText });
  }

  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, maxResults);
}
