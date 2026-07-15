import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import searchIndexData from "../data/searchIndex.json";
import type { SearchEntryType, SearchIndexEntry } from "../types";
import { SearchBar } from "../components/SearchBar";
import { usePageTitle } from "../hooks/usePageTitle";
import { Breadcrumbs } from "../components/Breadcrumbs";

const searchIndex = searchIndexData as SearchIndexEntry[];

const typeLabels: Record<SearchEntryType, string> = {
  member: "議員",
  mayor: "市長",
  promise: "市長公約",
  bill: "議案",
  question: "一般質問",
  compensation: "報酬",
  finance: "財政",
  update: "更新履歴",
};

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim();
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const tokens = useMemo(() => normalize(query).split(/\s+/).filter(Boolean), [query]);

  const results = useMemo(() => {
    if (tokens.length === 0) return [];
    return searchIndex
      .map((entry) => {
        const haystack = [entry.title, entry.description, ...entry.keywords].map(normalize).join(" ");
        const allMatch = tokens.every((t) => haystack.includes(t));
        if (!allMatch) return null;
        const matchedKeywords = entry.keywords.filter((k) => tokens.some((t) => normalize(k).includes(t)));
        return { entry, matchedKeywords };
      })
      .filter((r): r is { entry: SearchIndexEntry; matchedKeywords: string[] } => r !== null);
  }, [tokens]);

  const hasQuery = tokens.length > 0;
  const isEmpty = hasQuery && results.length === 0;

  usePageTitle({
    title: "サイト内検索",
    description: "議員、議案、一般質問、市長公約、報酬、財政などをまとめて検索できます。",
    noindex: isEmpty,
  });

  return (
    <div className="px-4 py-4 sm:px-6">
      <Breadcrumbs items={[{ label: "ホーム", to: "/" }, { label: "サイト内検索" }]} />
      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">サイト内検索</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          議員、議案、一般質問、市長公約、報酬、財政、更新履歴などをまとめて検索できます。
        </p>
      </div>

      <SearchBar
        value={query}
        onChange={(v) => setSearchParams(v ? { q: v } : {}, { replace: true })}
        placeholder="議員名、議案名、テーマなどで検索"
      />

      {!hasQuery && (
        <p className="mt-6 text-sm text-on-surface-variant">
          キーワードを入力してください。議員名（漢字・ふりがな）、議案名、テーマなどで検索できます。
        </p>
      )}

      {isEmpty && (
        <p className="mt-6 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          「{query}」に一致する情報は見つかりませんでした。キーワードを変えてお試しください。
        </p>
      )}

      {hasQuery && results.length > 0 && (
        <>
          <p className="mb-3 mt-4 text-sm text-on-surface-variant">{results.length}件見つかりました</p>
          <ul className="space-y-3">
            {results.map(({ entry, matchedKeywords }, i) => (
              <li key={`${entry.url}-${i}`} className="rounded-xl bg-surface-container-low p-4 shadow-e1">
                <Link to={entry.url} className={`block rounded ${linkClass}`}>
                  <span className="inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">
                    {typeLabels[entry.type]}
                  </span>
                  <p className="mt-1.5 text-base font-semibold leading-snug text-on-surface">{entry.title}</p>
                  {entry.description && (
                    <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{entry.description}</p>
                  )}
                  {matchedKeywords.length > 0 && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      該当キーワード：{matchedKeywords.slice(0, 3).join("、")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
