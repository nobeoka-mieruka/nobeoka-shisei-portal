import searchSynonymsData from "../data/searchSynonyms.json" with { type: "json" };
import type { SearchEntryType, SearchIndexEntry, SearchSynonymDictionary } from "../types";

const HIRA_KATA_OFFSET = 0x60;

export const searchSynonyms = searchSynonymsData as SearchSynonymDictionary;

/** カタカナをひらがなへ変換する（濁点・半濁点等はNFKCで既に正規化済みの前提）。 */
function katakanaToHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - HIRA_KATA_OFFSET));
}

/**
 * 全角/半角・大文字/小文字・カタカナ/ひらがな・連続空白の違いを吸収した比較用文字列を返す。
 * NFKCで全角英数字・全角スペース・半角カナを正規化し、小文字化したうえでカタカナをひらがなへ寄せる。
 * 漢字の異体字や送り仮名の違いは、意味が変わる可能性があるためここでは吸収せず、
 * src/data/searchSynonyms.jsonの表記ゆれ辞書（明示的に登録した語だけ）で扱う。
 */
export function normalize(text: string): string {
  return katakanaToHiragana(text.normalize("NFKC").toLowerCase()).replace(/\s+/g, " ").trim();
}

/**
 * 空白・中黒を取り除いた比較用文字列。
 * 「小野 正二」（データ側は姓名の間に空白）と「小野正二」（利用者の入力）のように、
 * 区切り文字の有無だけが違う場合を一致させるために使う。
 * 誤マッチを避けるため、title・keywordsのような短い項目にだけ適用し、本文（content）には使わない。
 */
export function compact(text: string): string {
  return normalize(text).replace(/[\s・]/g, "");
}

export function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

// --- 表記ゆれ辞書（src/data/searchSynonyms.json） ---

/** 正規化済みの表記ゆれグループ。長い語から順に置換するため、長さの降順で保持する。 */
const VARIANT_GROUPS: string[][] = searchSynonyms.orthographicVariants.map((g) =>
  [...new Set(g.terms.map(normalize))].filter(Boolean).sort((a, b) => b.length - a.length),
);

/** 1語あたりの展開上限（辞書語が複数含まれる長い検索語で組み合わせが増えすぎないようにする）。 */
const MAX_VARIANT_FORMS = 8;

/**
 * form内に出現するgroupの語をすべてtoへ置き換える。1件も置き換えなければnullを返す。
 * groupは長さの降順で渡すこと（「取組み」を「取組」＋「み」と誤って分解しないため）。
 */
function replaceGroupTerms(form: string, group: string[], to: string): string | null {
  let out = "";
  let i = 0;
  let replaced = false;
  while (i < form.length) {
    const hit = group.find((t) => form.startsWith(t, i));
    if (hit) {
      out += to;
      i += hit.length;
      if (hit !== to) replaced = true;
    } else {
      out += form[i];
      i += 1;
    }
  }
  return replaced ? out : null;
}

/**
 * 正規化済みの語について、表記ゆれ辞書で同一語と登録された書き方をすべて返す（元の語を先頭に含む）。
 * 辞書に無い語はそのまま1件だけ返す。
 */
export function expandVariants(normalizedToken: string): string[] {
  let forms = [normalizedToken];
  for (const group of VARIANT_GROUPS) {
    const next = new Set(forms);
    for (const form of forms) {
      for (const to of group) {
        const replaced = replaceGroupTerms(form, group, to);
        if (replaced) next.add(replaced);
      }
    }
    forms = [...next];
    if (forms.length >= MAX_VARIANT_FORMS) break;
  }
  return forms.slice(0, MAX_VARIANT_FORMS);
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

// --- スコアの重み付け ---
// 完全一致 ＞ タイトル一致 ＞ 人物名一致 ＞ テーマ（キーワード）一致 ＞ 概要一致 ＞ 本文一致 の順。
const SCORE_EXACT_TITLE = 100;
const SCORE_TITLE_CONTAINS_QUERY = 60;
/** タイトル部分一致の最低保証割合（検索語がタイトルのごく一部でも、一致自体は評価する）。 */
const TITLE_COVERAGE_FLOOR = 0.35;
const SCORE_TITLE_TOKEN = 20;
/** 議員・元議員・市長など「その人自身のページ」のタイトル（＝氏名）に一致した場合の加点。 */
const SCORE_PERSON_NAME = 15;
const SCORE_KEYWORD_TOKEN = 12;
/** 登録キーワードが検索語とそのまま一致した場合の追加加点（そのエントリはその語そのものを扱っている）。 */
const SCORE_KEYWORD_EXACT = 8;
const SCORE_EMBEDDED_TITLE = 10;
const SCORE_EMBEDDED_KEYWORD = 6;
const SCORE_DESCRIPTION_TOKEN = 5;
/** AI候補（ルールベース分類候補）一致は公式データより必ず低い加点にとどめる。 */
const SCORE_AI_KEYWORD_TOKEN = 4;
const SCORE_CONTENT_TOKEN = 2;
/** タイトル・キーワード・概要での出現回数加点の上限。 */
const MAX_STRONG_OCCURRENCE_BONUS = 5;
/**
 * 本文（会議録の質問・答弁要約など）での出現回数加点の上限。
 * 本文はタイトルやキーワードより桁違いに長く、同じ語が何度も出るだけで
 * 会議録エントリが上位を独占していたため、加点を小さく抑える。
 */
const MAX_CONTENT_OCCURRENCE_BONUS = 2;

/** 氏名そのものがタイトルになっているエントリ区分（人物名一致の判定に使う）。 */
const PERSON_ENTRY_TYPES = new Set<SearchEntryType>(["member", "former-member", "mayor"]);

/**
 * 人物ページのタイトルから、氏名の部分だけを取り出す。
 * generate-search-index.mjsは「氏名（元議員）」「氏名（現市長）」「延岡市長 氏名」の形式でタイトルを作るため、
 * 括弧書きの肩書きと「延岡市長」の接頭辞を取り除く。
 * 「議員」「市長」のような一般的な役職名だけの検索語で、人物名一致の加点が入らないようにするための処理。
 */
function personNameOf(normalizedTitle: string): string {
  return normalizedTitle
    .replace(/\([^()]*\)/g, "")
    .replace(/^延岡市長\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * エントリ区分ごとの最終倍率。
 * ・update（更新履歴）はサイトの作業記録であり、市民が探している市政情報そのものではないため下げる。
 * ・speech（会議録の発言）は「〇〇議員の一般質問」という一般的なタイトルで件数も多く、
 *   本文の偶然一致で上位を占めやすいためわずかに下げる。
 * それ以外の区分は等倍（1.0）で、区分による有利不利を作らない。
 */
const TYPE_SCORE_WEIGHT: Partial<Record<SearchEntryType, number>> = {
  update: 0.7,
  speech: 0.9,
};

interface NormalizedEntry {
  title: string;
  compactTitle: string;
  /** 人物ページのみ、肩書きを除いた氏名部分（空白・中黒を除いた形）。 */
  compactPersonName: string;
  description: string;
  keywordsNorm: string[];
  compactKeywords: string[];
  content: string;
  aiCandidateKeywordsNorm: string[];
  /** タイトル・キーワード・概要をつないだ、出現回数の数えやすい文字列。 */
  strong: string;
}

/**
 * 正規化済みのエントリ内容を使い回すためのキャッシュ。
 * 検索は入力のたびに全件（2000件超）走査するため、毎回の正規化を避ける。
 * searchIndex.jsonはビルド時生成の読み取り専用データなので、内容が変わることはない。
 */
const normalizedEntryCache = new WeakMap<SearchIndexEntry, NormalizedEntry>();

function getNormalizedEntry(entry: SearchIndexEntry): NormalizedEntry {
  const cached = normalizedEntryCache.get(entry);
  if (cached) return cached;

  const title = normalize(entry.title);
  const description = normalize(entry.description);
  const keywordsNorm = entry.keywords.map(normalize);
  const value: NormalizedEntry = {
    title,
    compactTitle: compact(entry.title),
    compactPersonName: PERSON_ENTRY_TYPES.has(entry.type) ? compact(personNameOf(title)) : "",
    description,
    keywordsNorm,
    compactKeywords: entry.keywords.map(compact),
    content: normalize(entry.content ?? ""),
    aiCandidateKeywordsNorm: (entry.aiCandidateKeywords ?? []).map(normalize),
    strong: [title, description, ...keywordsNorm].join(" "),
  };
  normalizedEntryCache.set(entry, value);
  return value;
}

interface TokenScore {
  matched: boolean;
  score: number;
  matchedKeywordIndexes: number[];
  matchedAiKeywordIndexes: number[];
}

/** 検索語1形分の、正規化済み表記と空白・中黒を除いた表記の組。 */
interface QueryForm {
  form: string;
  compactForm: string;
}

function toQueryForm(form: string): QueryForm {
  return { form, compactForm: compact(form) };
}

/** 1つの表記（正規化済み・辞書展開後の1形）についての一致判定と加点。 */
function scoreVariantForm(f: NormalizedEntry, { form, compactForm }: QueryForm, includeAi: boolean): TokenScore {
  const titleHit = f.title.includes(form) || (compactForm.length > 0 && f.compactTitle.includes(compactForm));

  const matchedKeywordIndexes: number[] = [];
  for (let i = 0; i < f.keywordsNorm.length; i += 1) {
    if (f.keywordsNorm[i].includes(form) || (compactForm.length > 0 && f.compactKeywords[i].includes(compactForm))) {
      matchedKeywordIndexes.push(i);
    }
  }

  const matchedAiKeywordIndexes: number[] = [];
  if (includeAi) {
    for (let i = 0; i < f.aiCandidateKeywordsNorm.length; i += 1) {
      if (f.aiCandidateKeywordsNorm[i].includes(form)) matchedAiKeywordIndexes.push(i);
    }
  }

  const descriptionHit = f.description.includes(form);
  const contentHit = f.content.includes(form);

  // 直接一致（title/keywords内にformがそのまま含まれる）が無かった場合のみ、
  // 「検索語の中にtitle/keywordsが埋め込まれている」逆方向の一致を弱めの加点で補う。
  const embeddedTitle = !titleHit && matchedKeywordIndexes.length === 0 && embeddedIn(form, [f.title]).length > 0;
  const embeddedKeywordIndexes: number[] = [];
  if (!titleHit && matchedKeywordIndexes.length === 0) {
    const embedded = new Set(embeddedIn(form, f.keywordsNorm));
    for (let i = 0; i < f.keywordsNorm.length; i += 1) {
      if (embedded.has(f.keywordsNorm[i])) embeddedKeywordIndexes.push(i);
    }
  }

  const matched =
    titleHit ||
    matchedKeywordIndexes.length > 0 ||
    matchedAiKeywordIndexes.length > 0 ||
    descriptionHit ||
    contentHit ||
    embeddedTitle ||
    embeddedKeywordIndexes.length > 0;

  if (!matched) {
    return { matched: false, score: 0, matchedKeywordIndexes: [], matchedAiKeywordIndexes: [] };
  }

  let score = 0;
  if (titleHit) {
    score += SCORE_TITLE_TOKEN;
    // 人物名一致は、肩書きを除いた氏名部分に一致した場合だけ加点する
    // （「議員」「市長」のような役職名だけの検索語で人物ページが上位を占めないようにする）。
    if (f.compactPersonName.length > 0 && compactForm.length > 0 && f.compactPersonName.includes(compactForm)) {
      score += SCORE_PERSON_NAME;
    }
  }
  if (matchedKeywordIndexes.length > 0) {
    score += SCORE_KEYWORD_TOKEN;
    if (matchedKeywordIndexes.some((i) => f.keywordsNorm[i] === form || f.compactKeywords[i] === compactForm)) {
      score += SCORE_KEYWORD_EXACT;
    }
  }
  if (embeddedTitle) score += SCORE_EMBEDDED_TITLE;
  if (embeddedKeywordIndexes.length > 0) score += SCORE_EMBEDDED_KEYWORD;
  if (matchedAiKeywordIndexes.length > 0) score += SCORE_AI_KEYWORD_TOKEN;
  if (descriptionHit) score += SCORE_DESCRIPTION_TOKEN;
  if (contentHit) score += SCORE_CONTENT_TOKEN;

  score += Math.min(countOccurrences(f.strong, form), MAX_STRONG_OCCURRENCE_BONUS);
  score += Math.min(countOccurrences(f.content, form), MAX_CONTENT_OCCURRENCE_BONUS);

  return {
    matched: true,
    score,
    matchedKeywordIndexes: [...matchedKeywordIndexes, ...embeddedKeywordIndexes],
    matchedAiKeywordIndexes,
  };
}

/**
 * 全語（AND条件）を含むエントリだけを対象に、関連度スコアを算出して返す。
 * 完全一致 ＞ タイトル一致 ＞ 人物名一致 ＞ テーマ（キーワード）一致 ＞ 概要一致 ＞ 本文一致 の順で
 * 重み付けし、出現回数と更新の新しさをわずかに加点する。生成AIによる要約や推定順位は使用しない。
 * 表記ゆれ（障害／障がい、子ども／子供 等）はsrc/data/searchSynonyms.jsonに登録した語だけを展開する。
 */
export function searchEntries(
  entries: SearchIndexEntry[],
  query: string,
  options: SearchEntriesOptions = {},
): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const includeAi = options.includeAi ?? false;

  const tokenForms = tokens.map((t) => expandVariants(t).map(toQueryForm));
  const queryForms = expandVariants(normalize(query));
  const compactQueryForms = queryForms.map(compact).filter(Boolean);

  const results: SearchResult[] = [];

  for (const entry of entries) {
    const f = getNormalizedEntry(entry);

    let score = 0;
    const matchedKeywordIndexes = new Set<number>();
    const matchedAiKeywordIndexes = new Set<number>();
    let allMatched = true;

    for (const forms of tokenForms) {
      let best: TokenScore | null = null;
      for (const form of forms) {
        const s = scoreVariantForm(f, form, includeAi);
        if (s.matched && (best === null || s.score > best.score)) best = s;
      }
      if (!best) {
        allMatched = false;
        break;
      }
      score += best.score;
      for (const i of best.matchedKeywordIndexes) matchedKeywordIndexes.add(i);
      for (const i of best.matchedAiKeywordIndexes) matchedAiKeywordIndexes.add(i);
    }

    if (!allMatched) continue;

    // 検索語全体とタイトルの一致は、空白・中黒を除いた形で判定する
    // （「小野 正二」と「小野正二」、「福祉・介護」と「福祉介護」を同じ扱いにするため）。
    if (compactQueryForms.some((q) => f.compactTitle === q)) {
      score += SCORE_EXACT_TITLE;
    } else {
      const matchedForm = compactQueryForms.find((q) => f.compactTitle.includes(q));
      if (matchedForm) {
        // タイトル全体に占める検索語の割合で加点する。
        // 「議員」のような短い語が長いタイトルの一部に含まれるだけの場合と、
        // タイトルのほとんどが検索語である場合を同じ扱いにしないための重み付け。
        // ただし一致していること自体の価値は残すため、下限（TITLE_COVERAGE_FLOOR）を設ける。
        const coverage = Math.min(1, matchedForm.length / f.compactTitle.length);
        score += SCORE_TITLE_CONTAINS_QUERY * (TITLE_COVERAGE_FLOOR + (1 - TITLE_COVERAGE_FLOOR) * coverage);
      }
    }

    score += recencyBoost(entry.date);
    score *= TYPE_SCORE_WEIGHT[entry.type] ?? 1;

    results.push({
      entry,
      score,
      matchedKeywords: [...matchedKeywordIndexes].map((i) => entry.keywords[i]).filter(Boolean),
      matchedAiCandidateKeywords: [...matchedAiKeywordIndexes]
        .map((i) => (entry.aiCandidateKeywords ?? [])[i])
        .filter(Boolean),
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
  const forms = expandVariants(q);
  const compactForms = forms.map(compact).filter(Boolean);

  const seen = new Set<string>();
  const suggestions: string[] = [];

  const tryAdd = (text?: string) => {
    if (!text || suggestions.length >= limit) return;
    if (seen.has(text)) return;
    const n = normalize(text);
    const c = compact(text);
    if (!forms.some((f) => n.includes(f)) && !compactForms.some((f) => c.includes(f))) return;
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

/** 0件のときに案内する「別の言い方」の候補。 */
export interface AlternativeQuery {
  /** 実際に検索できる語。 */
  term: string;
  /** その語で見つかる件数（1件以上のものだけを返す）。 */
  count: number;
  /**
   * 提案の理由。
   * hint：市民がよく使う言い換え語の辞書（src/data/searchSynonyms.json）
   * narrower：検索語の一部として、このサイトに実際にある語が含まれていた
   * token：複数語で検索されたため、1語ずつに分けた
   */
  reason: "hint" | "narrower" | "token";
  /** hintの場合の補足説明。 */
  note?: string;
}

const MIN_NARROWER_TERM_LENGTH = 2;

/**
 * 検索結果が0件のときに、実際に結果が出る「別の言い方」を返す。
 * 候補は必ずこのサイトの索引で件数を確認してから返すため、押しても0件になる案内は出さない。
 * 検索結果そのものを勝手に置き換えることはしない（利用者が選んだときだけ検索し直す）。
 */
export function getAlternativeQueries(
  entries: SearchIndexEntry[],
  query: string,
  options: SearchEntriesOptions = {},
  limit = 4,
): AlternativeQuery[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const candidates: { term: string; reason: AlternativeQuery["reason"]; note?: string }[] = [];
  const seen = new Set<string>([normalizedQuery]);

  const addCandidate = (term: string, reason: AlternativeQuery["reason"], note?: string) => {
    const n = normalize(term);
    if (!n || seen.has(n)) return;
    seen.add(n);
    candidates.push({ term, reason, note });
  };

  // 1. 市民がよく使う言い換え語の辞書
  for (const hint of searchSynonyms.queryHints) {
    const hintQuery = normalize(hint.query);
    if (!hintQuery || !normalizedQuery.includes(hintQuery)) continue;
    for (const s of hint.suggestions) addCandidate(s, "hint", hint.note);
  }

  // 2. 検索語の中に含まれている、このサイトに実在する語（例：「延岡駅前の再開発」→「延岡駅」）
  const narrower = new Map<string, number>();
  for (const entry of entries) {
    const f = getNormalizedEntry(entry);
    for (let i = 0; i < entry.keywords.length; i += 1) {
      const k = f.keywordsNorm[i];
      if (k.length < MIN_NARROWER_TERM_LENGTH || k.length >= normalizedQuery.length) continue;
      if (!normalizedQuery.includes(k)) continue;
      narrower.set(entry.keywords[i], (narrower.get(entry.keywords[i]) ?? 0) + 1);
    }
  }
  for (const [term] of [...narrower.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    addCandidate(term, "narrower");
  }

  // 3. 複数語での検索は、1語ずつに分けた候補も案内する
  const tokens = tokenize(query);
  if (tokens.length > 1) {
    for (const t of tokens) addCandidate(t, "token");
  }

  const alternatives: AlternativeQuery[] = [];
  for (const c of candidates) {
    if (alternatives.length >= limit) break;
    const count = searchEntries(entries, c.term, options).length;
    if (count === 0) continue;
    alternatives.push({ term: c.term, count, reason: c.reason, note: c.note });
  }
  return alternatives;
}
