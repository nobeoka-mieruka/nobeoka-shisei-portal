import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import searchIndexData from "../data/searchIndex.json";
import type { SearchEntryType, SearchIndexEntry } from "../types";
import { SearchIcon } from "../components/icons";
import { HighlightText } from "../components/HighlightText";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { usePageTitle } from "../hooks/usePageTitle";
import { useSearchHistory } from "../hooks/useSearchHistory";
import { formatJapaneseDate } from "../config/site";
import { getSuggestions, searchEntries, sortResults, type SearchResult, type SearchSortKey } from "../lib/search";

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
  guide: "市役所案内",
  "press-conference": "市長記者会見",
  page: "固定ページ",
};

const sortOptions: { value: SearchSortKey; label: string }[] = [
  { value: "relevance", label: "関連度順" },
  { value: "newest", label: "新しい順" },
  { value: "oldest", label: "古い順" },
  { value: "kana", label: "五十音順" },
];

const EXAMPLE_KEYWORDS = ["市長公約", "一般質問", "議案", "子育て", "防災", "報酬", "財政", "市役所案内"];

const PAGE_SIZE = 20;
const URL_SYNC_DELAY_MS = 200;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [typeFilter, setTypeFilter] = useState<"all" | SearchEntryType>("all");
  const [sort, setSort] = useState<SearchSortKey>("relevance");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { history, addTerm, removeTerm, clearHistory } = useSearchHistory();

  // URLの?qが外部要因（戻る/進む、共有リンク）で変わったら、入力欄の表示も追従させる。
  useEffect(() => {
    const urlQuery = searchParams.get("q") ?? "";
    setQuery((current) => (current === urlQuery ? current : urlQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 入力を少し待ってからURLへ反映する（共有・戻るボタン対応。結果自体は待たずに即時更新）。
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (current !== query) {
        setSearchParams(query ? { q: query } : {}, { replace: true });
        if (query.trim()) addTerm(query.trim());
      }
    }, URL_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, typeFilter, sort]);

  const hasQuery = query.trim().length > 0;

  usePageTitle();

  const allResults: SearchResult[] = useMemo(() => searchEntries(searchIndex, query), [query]);

  const countsByType = useMemo(() => {
    const counts = new Map<SearchEntryType, number>();
    for (const r of allResults) counts.set(r.entry.type, (counts.get(r.entry.type) ?? 0) + 1);
    return counts;
  }, [allResults]);

  const availableTypes = useMemo(
    () => [...countsByType.keys()].sort((a, b) => (countsByType.get(b) ?? 0) - (countsByType.get(a) ?? 0)),
    [countsByType],
  );

  const filteredResults = useMemo(
    () => (typeFilter === "all" ? allResults : allResults.filter((r) => r.entry.type === typeFilter)),
    [allResults, typeFilter],
  );

  const sortedResults = useMemo(() => sortResults(filteredResults, sort), [filteredResults, sort]);
  const visibleResults = sortedResults.slice(0, visibleCount);

  const suggestions = useMemo(() => (hasQuery ? getSuggestions(searchIndex, query, 8) : []), [query, hasQuery]);

  const commitQuery = (value: string) => {
    setQuery(value);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    if (value.trim()) {
      setSearchParams({ q: value }, { replace: true });
      addTerm(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
      return;
    }
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") commitQuery(query);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitQuery(activeSuggestion >= 0 ? suggestions[activeSuggestion] : query);
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6">
      <Breadcrumbs items={[{ label: "ホーム", to: "/" }, { label: "サイト内検索" }]} />
      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">サイト内検索</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          議員、一般質問、議案、市長公約、財政などをまとめて検索できます。
        </p>
      </div>

      <div className="relative">
        <label htmlFor="site-search-input" className="sr-only">
          サイト内検索
        </label>
        <div className="flex items-center gap-3 rounded-full bg-surface-container-high px-4 py-3.5 shadow-e1 transition focus-within:shadow-e2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
          <SearchIcon className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
          <input
            ref={inputRef}
            id="site-search-input"
            type="search"
            role="combobox"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-controls="search-suggestions-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeSuggestion >= 0 ? `search-suggestion-${activeSuggestion}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
              setActiveSuggestion(-1);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
            onKeyDown={handleKeyDown}
            placeholder="議員名、議案名、テーマなどで検索"
            className="w-full min-w-0 bg-transparent text-base text-on-surface placeholder:text-on-surface-variant focus:outline-none"
          />
          <button
            type="button"
            onClick={() => commitQuery(query)}
            aria-label="検索する"
            className={`shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
          >
            検索
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul
            id="search-suggestions-listbox"
            role="listbox"
            aria-label="検索候補"
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-2xl bg-surface-container-high shadow-e2"
          >
            {suggestions.map((s, i) => (
              <li key={s}>
                <button
                  id={`search-suggestion-${i}`}
                  role="option"
                  aria-selected={activeSuggestion === i}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitQuery(s)}
                  className={`block w-full min-h-11 px-4 py-2.5 text-left text-sm ${
                    activeSuggestion === i ? "bg-secondary-container text-on-secondary-container" : "text-on-surface"
                  }`}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!hasQuery && (
        <div className="mt-5 space-y-5">
          {history.length > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-on-surface-variant">最近の検索</p>
                <button
                  type="button"
                  onClick={clearHistory}
                  className={`text-xs text-on-surface-variant underline hover:text-on-surface ${linkClass}`}
                >
                  すべて削除
                </button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {history.map((term) => (
                  <li key={term} className="flex items-center gap-1 rounded-full bg-surface-container-high pl-3 pr-1 py-1">
                    <button
                      type="button"
                      onClick={() => commitQuery(term)}
                      className={`text-sm text-on-surface ${linkClass}`}
                    >
                      {term}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTerm(term)}
                      aria-label={`「${term}」を検索履歴から削除`}
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest ${linkClass}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-on-surface-variant">よく使われるキーワード</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {EXAMPLE_KEYWORDS.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => commitQuery(k)}
                    className={`min-h-11 rounded-full bg-surface-container-high px-3.5 text-sm text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
                  >
                    {k}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-on-surface-variant">
            キーワードを入力してください。議員名（漢字・ふりがな）、議案名、テーマなどで検索できます。
          </p>
        </div>
      )}

      {hasQuery && (
        <>
          <div className="mt-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                typeFilter === "all"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              すべて {allResults.length}
            </button>
            {availableTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  typeFilter === t
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {typeLabels[t]} {countsByType.get(t) ?? 0}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm text-on-surface-variant" aria-live="polite">
              {sortedResults.length > 0 ? `${sortedResults.length}件見つかりました` : "0件"}
            </p>
            <label className="flex shrink-0 items-center gap-2 rounded-full bg-surface-container-high px-3.5 py-2 text-sm text-on-surface-variant">
              <span className="sr-only">並び替え</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SearchSortKey)}
                aria-label="並び替え"
                className="bg-transparent text-on-surface focus:outline-none"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {sortedResults.length === 0 ? (
            <div className="mt-6 space-y-4 rounded-xl bg-surface-container-low p-6 text-center sm:p-8">
              <p className="text-sm text-on-surface-variant">該当する情報が見つかりませんでした。</p>
              <ul className="mx-auto max-w-sm space-y-1 text-left text-xs text-on-surface-variant">
                <li>・検索語を短くする</li>
                <li>・別の表現で検索する</li>
                <li>・年度や種類の絞り込みを解除する</li>
                <li>
                  ・
                  <Link to="/contact" className={`text-primary hover:underline ${linkClass}`}>
                    情報提供・訂正依頼ページ
                  </Link>
                  から探している情報をお知らせいただくこともできます
                </li>
              </ul>
              <div>
                <p className="text-xs font-medium text-on-surface-variant">検索例</p>
                <ul className="mt-2 flex flex-wrap justify-center gap-2">
                  {EXAMPLE_KEYWORDS.map((k) => (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() => commitQuery(k)}
                        className={`min-h-11 rounded-full bg-surface-container-high px-3.5 text-sm text-on-surface hover:bg-surface-container-highest ${linkClass}`}
                      >
                        {k}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <>
              <ul className="mt-3 space-y-3">
                {visibleResults.map(({ entry, matchedKeywords }) => (
                  <li key={entry.id} className="rounded-xl bg-surface-container-low p-4 shadow-e1">
                    <Link to={entry.url} className={`block rounded ${linkClass}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">
                          {typeLabels[entry.type]}
                        </span>
                        {entry.date && (
                          <span className="text-xs text-on-surface-variant">{formatJapaneseDate(entry.date)}</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-base font-semibold leading-snug text-on-surface">
                        <HighlightText text={entry.title} query={query} />
                      </p>
                      {entry.description && (
                        <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                          <HighlightText text={entry.description} query={query} />
                        </p>
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

              {visibleCount < sortedResults.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className={`mt-4 w-full rounded-full border border-outline-variant py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
                >
                  さらに表示（残り{sortedResults.length - visibleCount}件）
                </button>
              )}
            </>
          )}
        </>
      )}

      <div className="mt-8">
        <CorrectionRequestButton pageName="サイト内検索" />
      </div>
    </div>
  );
}
