/**
 * src/lib/themeClassification.ts の matchPolicyCategoriesForText と同一ロジック。
 * .mjsからは直接importできないため、以前は scripts/generate-theme-candidates.mjs に
 * 複製されていたが、フェーズ10Cで scripts/run-archive-ai-processor.mjs からも同じロジックが
 * 必要になったため、共有モジュールとして切り出した（重複実装を避けるため）。
 * ロジックを変更する場合は src/lib/themeClassification.ts 側もあわせて更新すること。
 */

function countOccurrences(haystack, needle) {
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
 * @param {string} text
 * @param {{id: string, label: string, keywords?: string[]}[]} categories
 * @param {number} [maxResults]
 */
export function matchCategoriesForText(text, categories, maxResults = 5) {
  const normalized = text.normalize("NFKC");
  const matches = [];
  for (const category of categories) {
    const terms = [...(category.keywords ?? []), category.label];
    const matchedKeywords = [];
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
    matches.push({ categoryId: category.id, confidence, matchedKeywords });
  }
  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, maxResults);
}
