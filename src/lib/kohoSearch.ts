import kohoOcrSearchIndexData from "../data/kohoOcrSearchIndex.json";
import type { KohoOcrSearchEntry } from "../types/kohoSearch";

export const kohoOcrSearchIndex = kohoOcrSearchIndexData as KohoOcrSearchEntry[];

export const KOHO_SEARCH_CATEGORY_LABEL: Record<KohoOcrSearchEntry["category"], string> = {
  mayorPolitics: "市長・政治",
  councilElection: "議会・選挙",
  finance: "財政",
  cityAdmin: "市政（合併・新庁舎等）",
};

/**
 * 異体字の表記ゆれを吸収するための正規化マップ。旧字体・異体字を新字体（常用漢字）側へ
 * 寄せる。検索時に両方の表記でヒットするよう、クエリ・索引側の双方をこの関数で
 * 正規化してから比較する（異体字が一致するだけで別人と自動確定はしない。検索の
 * ヒット精度向上のみに使う）。
 */
const ITAIJI_MAP: Record<string, string> = {
  髙: "高",
  﨑: "崎",
  濵: "浜",
  澤: "沢",
  邉: "辺",
  邊: "辺",
  "\u{20BB7}": "吉", // 𠮷（つちよし）
};

function normalizeItaiji(text: string): string {
  let result = text;
  for (const [from, to] of Object.entries(ITAIJI_MAP)) {
    result = result.split(from).join(to);
  }
  return result;
}

/** 全角数字を半角数字へ、全角英字を半角へ正規化する（検索の表記ゆれ吸収用）。 */
function normalizeWidth(text: string): string {
  return text.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

function normalizeForSearch(text: string): string {
  return normalizeWidth(normalizeItaiji(text));
}

/** 元号年→西暦年（開始年）。changeYear=改元年（この年の1月1日は西暦=changeYear、そこから起算）。 */
const ERA_START_YEAR: Record<string, number> = {
  令和: 2018, // 令和1年=2019年 → 令和N年=2018+N
  平成: 1988, // 平成1年=1989年 → 平成N年=1988+N
  昭和: 1925, // 昭和1年=1926年 → 昭和N年=1925+N
};

/**
 * クエリ文字列に「令和6年」のような元号表記が含まれる場合、対応する西暦年
 * （例："2024年"）も含む検索語のリストを返す。西暦表記が含まれる場合は
 * 対応する元号表記も返す。一致する変換が無ければ元のクエリのみを返す。
 */
export function expandEraYearQuery(query: string): string[] {
  const results = new Set<string>([query]);
  const eraMatch = query.match(/(令和|平成|昭和)(\d{1,2})年/);
  if (eraMatch) {
    const [, era, numStr] = eraMatch;
    const western = ERA_START_YEAR[era] + Number(numStr);
    results.add(query.replace(eraMatch[0], `${western}年`));
  }
  const westernMatch = query.match(/(19|20)(\d{2})年/);
  if (westernMatch) {
    const westernYear = Number(westernMatch[0].replace("年", ""));
    for (const [era, startYear] of Object.entries(ERA_START_YEAR)) {
      const eraNum = westernYear - startYear;
      if (eraNum >= 1 && eraNum <= 64) {
        results.add(query.replace(westernMatch[0], `${era}${eraNum}年`));
      }
    }
  }
  return [...results];
}

export interface KohoSearchFilters {
  category?: KohoOcrSearchEntry["category"];
  verifiedOnly?: boolean;
  yearFrom?: number;
  yearTo?: number;
}

/** キーワードの部分一致（異体字・全角半角を正規化）で索引を検索し、フィルターを適用する。 */
export function searchKohoOcrIndex(query: string, filters: KohoSearchFilters = {}): KohoOcrSearchEntry[] {
  const q = query.trim();
  if (!q) return [];
  const queryVariants = expandEraYearQuery(q).map(normalizeForSearch);

  return kohoOcrSearchIndex.filter((e) => {
    const normKeyword = normalizeForSearch(e.keyword);
    const normContext = normalizeForSearch(e.context);
    const matches = queryVariants.some((v) => normKeyword.includes(v) || normContext.includes(v));
    if (!matches) return false;
    if (filters.category && e.category !== filters.category) return false;
    if (filters.verifiedOnly && e.verificationStatus !== "verified") return false;
    if (e.issueDate) {
      const year = Number(e.issueDate.slice(0, 4));
      if (filters.yearFrom != null && year < filters.yearFrom) return false;
      if (filters.yearTo != null && year > filters.yearTo) return false;
    }
    return true;
  });
}

/** 索引に含まれる発行年の一覧（新しい順）。年代フィルターの選択肢生成に使う。 */
export function kohoSearchAvailableYears(): number[] {
  const years = new Set<number>();
  for (const e of kohoOcrSearchIndex) {
    if (e.issueDate) years.add(Number(e.issueDate.slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}
