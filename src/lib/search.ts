import type { SearchIndexEntry } from "../types";

const HIRA_KATA_OFFSET = 0x60;

/** カタカナをひらがなへ変換する（濁点・半濁点等はNFKCで既に正規化済みの前提）。 */
function katakanaToHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - HIRA_KATA_OFFSET));
}

/** 全角/半角・大文字/小文字・カタカナ/ひらがなの違いを吸収した比較用文字列を返す。 */
export function normalize(text: string): string {
  return katakanaToHiragana(text.normalize("NFKC").toLowerCase()).trim();
}

export function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

export interface SearchResult {
  entry: SearchIndexEntry;
  score: number;
  matchedKeywords: string[];
}

const RECENCY_HALF_LIFE_DAYS = 365;

/** 新しい情報をわずかに優先するための加点（最大5点程度、日付が無い場合は0）。 */
function recencyBoost(dateIso?: string): number {
  if (!dateIso) return 0;
  const time = new Date(dateIso).getTime();
  if (Number.isNaN(time)) return 0;
  const days = (Date.now() - time) / 86_400_000;
  if (days < 0) return 0;
  return 5 * Math.exp(-days / RECENCY_HALF_LIFE_DAYS);
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
 * 全語（AND条件）を含むエントリだけを対象に、関連度スコアを算出して返す。
 * タイトル完全一致 > タイトル部分一致 > キーワード一致 > 概要一致 > 本文一致 の順で重み付けし、
 * 出現回数と更新の新しさをわずかに加点する。生成AIによる要約や推定順位は使用しない。
 */
export function searchEntries(entries: SearchIndexEntry[], query: string): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const normalizedQuery = normalize(query);

  const results: SearchResult[] = [];

  for (const entry of entries) {
    const title = normalize(entry.title);
    const description = normalize(entry.description);
    const keywordsNorm = entry.keywords.map(normalize);
    const content = normalize(entry.content ?? "");
    const haystack = [title, description, ...keywordsNorm, content].join(" ");

    if (!tokens.every((t) => haystack.includes(t))) continue;

    let score = 0;
    if (title === normalizedQuery) score += 100;
    else if (title.includes(normalizedQuery)) score += 60;

    const matchedKeywords: string[] = [];
    for (const token of tokens) {
      if (title.includes(token)) score += 20;

      const hitKeywords = entry.keywords.filter((_, i) => keywordsNorm[i].includes(token));
      if (hitKeywords.length > 0) {
        score += 12;
        matchedKeywords.push(...hitKeywords);
      }

      if (description.includes(token)) score += 5;
      if (content.includes(token)) score += 2;

      score += Math.min(countOccurrences(haystack, token), 5);
    }

    score += recencyBoost(entry.date);

    results.push({ entry, score, matchedKeywords: [...new Set(matchedKeywords)] });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export type SearchSortKey = "relevance" | "newest" | "oldest" | "kana";

export function sortResults(results: SearchResult[], sort: SearchSortKey): SearchResult[] {
  if (sort === "relevance") return results;
  const sorted = [...results];
  if (sort === "kana") {
    sorted.sort((a, b) => a.entry.title.localeCompare(b.entry.title, "ja"));
    return sorted;
  }
  sorted.sort((a, b) => {
    const ad = a.entry.date;
    const bd = b.entry.date;
    if (!ad && !bd) return 0;
    if (!ad) return 1;
    if (!bd) return -1;
    return sort === "newest" ? bd.localeCompare(ad) : ad.localeCompare(bd);
  });
  return sorted;
}

/** 入力中の候補（最大limit件）。タイトル→キーワードの順に、部分一致するものを重複なく返す。 */
export function getSuggestions(entries: SearchIndexEntry[], query: string, limit = 8): string[] {
  const q = normalize(query);
  if (!q) return [];

  const seen = new Set<string>();
  const suggestions: string[] = [];

  const tryAdd = (text?: string) => {
    if (!text || suggestions.length >= limit) return;
    if (seen.has(text)) return;
    if (!normalize(text).includes(q)) return;
    seen.add(text);
    suggestions.push(text);
  };

  for (const e of entries) {
    if (suggestions.length >= limit) break;
    tryAdd(e.title);
  }
  for (const e of entries) {
    if (suggestions.length >= limit) break;
    for (const k of e.keywords) tryAdd(k);
  }

  return suggestions;
}
