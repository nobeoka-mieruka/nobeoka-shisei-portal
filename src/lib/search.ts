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
  /** ルールベース分類候補（AI候補）に一致した場合のみ設定。公式keywordsとは別に扱う。 */
  matchedAiCandidateKeywords: string[];
}

export interface SearchEntriesOptions {
  /**
   * true の場合のみ、aiCandidateKeywords（ルールベース分類候補、外部AI API不使用）も
   * 検索対象に含める。既定はfalse（公式データのみを検索対象にする、既存動作を維持）。
   */
  includeAi?: boolean;
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

// 日本語は分かち書きされないため、tokenize()は空白でしか区切らない。「人口減少について」
// 「西階公園はどうなった」のように助詞・語尾が続く1語の検索語は、そのままではentryの
// title/keywordsに一致しないことが多い。外部の形態素解析ライブラリを追加する代わりに、
// エントリのtitle・keywordsが検索語の中に部分文字列として埋め込まれている場合も一致とみなす
// 簡易フォールバックを用いる（誤マッチ防止のため、検索語・候補文字列とも一定の長さを要求する）。
const MIN_EMBED_TOKEN_LENGTH = 4;
// 「市長」「議員」等の2文字の一般名詞をそのまま許すと、無関係な長い検索語（例：「〇〇市長の
// 時代は」の「市長」部分）にまで大量のエントリが埋め込みマッチしてしまうため、3文字以上に限定する。
const MIN_EMBED_PHRASE_LENGTH = 3;

/** candidatesのうち、tokenの中に部分文字列として埋め込まれているものだけを返す。 */
function embeddedIn(token: string, candidates: string[]): string[] {
  if (token.length < MIN_EMBED_TOKEN_LENGTH) return [];
  return candidates.filter((c) => c.length >= MIN_EMBED_PHRASE_LENGTH && c.length < token.length && token.includes(c));
}

/**
 * 全語（AND条件）を含むエントリだけを対象に、関連度スコアを算出して返す。
 * タイトル完全一致 > タイトル部分一致 > キーワード一致 > 概要一致 > 本文一致 の順で重み付けし、
 * 出現回数と更新の新しさをわずかに加点する。生成AIによる要約や推定順位は使用しない。
 */
export function searchEntries(
  entries: SearchIndexEntry[],
  query: string,
  options: SearchEntriesOptions = {},
): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const normalizedQuery = normalize(query);
  const includeAi = options.includeAi ?? false;

  const results: SearchResult[] = [];

  for (const entry of entries) {
    const title = normalize(entry.title);
    const description = normalize(entry.description);
    const keywordsNorm = entry.keywords.map(normalize);
    const content = normalize(entry.content ?? "");
    const aiCandidateKeywords = includeAi ? (entry.aiCandidateKeywords ?? []) : [];
    const aiCandidateKeywordsNorm = aiCandidateKeywords.map(normalize);
    const haystack = [title, description, ...keywordsNorm, content, ...aiCandidateKeywordsNorm].join(" ");

    if (
      !tokens.every(
        (t) => haystack.includes(t) || embeddedIn(t, [title, ...keywordsNorm]).length > 0,
      )
    ) {
      continue;
    }

    let score = 0;
    if (title === normalizedQuery) score += 100;
    else if (title.includes(normalizedQuery)) score += 60;

    const matchedKeywords: string[] = [];
    const matchedAiCandidateKeywords: string[] = [];
    for (const token of tokens) {
      if (title.includes(token)) score += 20;

      const hitKeywords = entry.keywords.filter((_, i) => keywordsNorm[i].includes(token));
      if (hitKeywords.length > 0) {
        score += 12;
        matchedKeywords.push(...hitKeywords);
      }

      // 直接一致（title/keywords内にtokenがそのまま含まれる）が無かった場合のみ、
      // 「検索語の中にtitle/keywordsが埋め込まれている」逆方向の一致を弱めの加点で補う。
      if (!title.includes(token) && hitKeywords.length === 0) {
        if (embeddedIn(token, [title]).length > 0) score += 10;
        const embeddedKeywordsNorm = embeddedIn(token, keywordsNorm);
        if (embeddedKeywordsNorm.length > 0) {
          score += 6;
          matchedKeywords.push(...entry.keywords.filter((_, i) => embeddedKeywordsNorm.includes(keywordsNorm[i])));
        }
      }

      const hitAiKeywords = aiCandidateKeywords.filter((_, i) => aiCandidateKeywordsNorm[i].includes(token));
      if (hitAiKeywords.length > 0) {
        // AI候補一致は公式一致より低い加点にとどめ、公式データを優先表示する。
        score += 4;
        matchedAiCandidateKeywords.push(...hitAiKeywords);
      }

      if (description.includes(token)) score += 5;
      if (content.includes(token)) score += 2;

      score += Math.min(countOccurrences(haystack, token), 5);
    }

    score += recencyBoost(entry.date);

    results.push({
      entry,
      score,
      matchedKeywords: [...new Set(matchedKeywords)],
      matchedAiCandidateKeywords: [...new Set(matchedAiCandidateKeywords)],
    });
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
