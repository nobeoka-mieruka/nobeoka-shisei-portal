import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInitialSearchParams } from "../hooks/useHydratedSearchParams";
import type { SearchEntryType, SearchIndexEntry } from "../types";
import { useSearchIndex } from "../hooks/useSearchIndex";
import { SearchIcon } from "../components/icons";
import { HighlightText } from "../components/HighlightText";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { usePageTitle } from "../hooks/usePageTitle";
import { useSearchHistory } from "../hooks/useSearchHistory";
import { formatJapaneseDate } from "../config/site";
import {
  getAlternativeQueries,
  getSuggestions,
  groupResultsByUrl,
  normalize,
  SEARCH_MATCH_TIER_LABELS,
  SEARCH_TYPE_LABELS,
  searchEntries,
  sortResults,
  type AlternativeQuery,
  type SearchResult,
  type SearchSortKey,
} from "../lib/search";
import { trackEvent } from "../lib/analytics";

const typeLabels = SEARCH_TYPE_LABELS;

/**
 * 本文・概要のうち、検索語が出てくる前後だけを抜き出す（該当箇所の表示用）。
 * 見つからない場合は空文字（該当箇所の欄を出さない）。
 */
function excerptFor(entry: SearchIndexEntry, query: string): string {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const texts = [entry.content ?? "", entry.description ?? ""];
  for (const text of texts) {
    if (!text) continue;
    const norm = normalize(text);
    for (const t of tokens) {
      const idx = norm.indexOf(t);
      if (idx < 0) continue;
      // normalize は文字数をほぼ保つ（NFKC・かな変換）ため、同じ位置を元の文から切り出す。
      const from = Math.max(0, idx - 40);
      const to = Math.min(text.length, idx + t.length + 40);
      return `${from > 0 ? "…" : ""}${text.slice(from, to)}${to < text.length ? "…" : ""}`;
    }
  }
  return "";
}

/** URLの?type=値が既知のtypeLabelsキーに一致する場合のみ受け付ける（不正な値の混入防止）。 */
function isKnownSearchEntryType(value: string): value is SearchEntryType {
  return value in typeLabels;
}

const sortOptions: { value: SearchSortKey; label: string }[] = [
  { value: "relevance", label: "一致順（完全一致→タイトル→本文→キーワード）" },
  { value: "newest", label: "新しい順" },
  { value: "oldest", label: "古い順" },
  { value: "kana", label: "五十音順" },
];
const SORT_KEYS = new Set(sortOptions.map((o) => o.value));
function isKnownSortKey(value: string): value is SearchSortKey {
  return SORT_KEYS.has(value as SearchSortKey);
}

const EXAMPLE_KEYWORDS = ["市長公約", "一般質問", "議案", "条例", "政策", "子育て", "防災", "報酬", "財政", "市役所案内"];

/** 0件のときに案内する「別の言い方」の、候補を出した理由の表示名。 */
const ALTERNATIVE_REASON_LABELS: Record<AlternativeQuery["reason"], string> = {
  hint: "このサイトでの言い方",
  narrower: "検索語に含まれる言葉",
  token: "1語ずつ検索",
};

const PAGE_SIZE = 20;
const URL_SYNC_DELAY_MS = 200;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Phase240：検索語・絞り込みの初期値は既定値に固定する。プリレンダリング済みHTMLは常に
  // クエリなしの内容（静的ホスティングはクエリを無視して同じファイルを返す）のため、
  // 初回レンダリングでURLの条件を反映するとハイドレーション不一致になる。
  // アクセス時のURLに入っていた条件は、ハイドレーション完了後に一度だけ反映する。
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | SearchEntryType>("all");
  const [fiscalYearFilter, setFiscalYearFilter] = useState("");
  const [verificationStatusFilter, setVerificationStatusFilter] = useState("");
  const [includeAi, setIncludeAi] = useState(false);
  const [sort, setSort] = useState<SearchSortKey>("relevance");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { history, addTerm, removeTerm, clearHistory } = useSearchHistory();

  const initialParamsApplied = useInitialSearchParams((params) => {
    setQuery(params.get("q") ?? "");
    const t = params.get("type") ?? "";
    setTypeFilter(t && isKnownSearchEntryType(t) ? t : "all");
    setFiscalYearFilter(params.get("fiscalYear") ?? "");
    setVerificationStatusFilter(params.get("verificationStatus") ?? "");
    setIncludeAi(params.get("includeAi") === "true");
    const s = params.get("sort") ?? "";
    setSort(s && isKnownSortKey(s) ? s : "relevance");
  });

  // URLの?qが外部要因（戻る/進む、共有リンク）で変わったら、入力欄の表示も追従させる。
  useEffect(() => {
    if (!initialParamsApplied) return;
    const urlQuery = searchParams.get("q") ?? "";
    setQuery((current) => (current === urlQuery ? current : urlQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, initialParamsApplied]);

  // 入力を少し待ってからURLへ反映する（共有・戻るボタン対応。結果自体は待たずに即時更新）。
  // 既存のfiscalYear・type等のクエリを消さないよう、常にsearchParamsを丸ごと置き換えるのではなく
  // 現在の値をベースに?qだけを更新する（過去、絞り込み中に検索語を変えると年度・種類等の
  // 絞り込みがURLから消えてしまう不具合があったため修正）。
  useEffect(() => {
    if (!initialParamsApplied) return;
    const timer = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (current !== query) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            if (query) next.set("q", query);
            else next.delete("q");
            return next;
          },
          { replace: true },
        );
        if (query.trim()) addTerm(query.trim());
      }
    }, URL_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, initialParamsApplied]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, typeFilter, fiscalYearFilter, verificationStatusFilter, includeAi, sort]);

  // 種類・年度・確認状況・並び替え・AI候補を含めるかの絞り込みは、選択のたびに即座にURLへ反映する
  // （検索結果URLを共有・ブックマークでき、戻る操作でも絞り込み条件が失われないようにするため）。
  useEffect(() => {
    // アクセス時のURLの条件を反映する前に書き戻すと、共有されたURLの絞り込みを消してしまう。
    if (!initialParamsApplied) return;
    const next = new URLSearchParams(searchParams);
    if (typeFilter !== "all") next.set("type", typeFilter);
    else next.delete("type");
    if (fiscalYearFilter) next.set("fiscalYear", fiscalYearFilter);
    else next.delete("fiscalYear");
    if (verificationStatusFilter) next.set("verificationStatus", verificationStatusFilter);
    else next.delete("verificationStatus");
    if (includeAi) next.set("includeAi", "true");
    else next.delete("includeAi");
    if (sort !== "relevance") next.set("sort", sort);
    else next.delete("sort");
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialParamsApplied, typeFilter, fiscalYearFilter, verificationStatusFilter, includeAi, sort]);

  const hasQuery = query.trim().length > 0;

  usePageTitle();

  // 索引は /search を開いたときだけ読み込む（トップページ等のJSには含めない）。
  const { entries: searchIndex, status: indexStatus, bodiesLoaded } = useSearchIndex();

  const allResults: SearchResult[] = useMemo(
    () => searchEntries(searchIndex, query, { includeAi }),
    [searchIndex, query, includeAi],
  );

  const countsByType = useMemo(() => {
    const counts = new Map<SearchEntryType, number>();
    for (const r of allResults) counts.set(r.entry.type, (counts.get(r.entry.type) ?? 0) + 1);
    return counts;
  }, [allResults]);

  const availableTypes = useMemo(
    () => [...countsByType.keys()].sort((a, b) => (countsByType.get(b) ?? 0) - (countsByType.get(a) ?? 0)),
    [countsByType],
  );

  const fiscalYearOptions = useMemo(
    () => [...new Set(searchIndex.map((e) => e.fiscalYear).filter((y): y is number => typeof y === "number"))].sort((a, b) => b - a),
    [searchIndex],
  );

  const filteredResults = useMemo(
    () =>
      allResults.filter((r) => {
        if (typeFilter !== "all" && r.entry.type !== typeFilter) return false;
        if (fiscalYearFilter && String(r.entry.fiscalYear ?? "") !== fiscalYearFilter) return false;
        if (verificationStatusFilter && (r.entry.verificationStatus ?? "") !== verificationStatusFilter) return false;
        return true;
      }),
    [allResults, typeFilter, fiscalYearFilter, verificationStatusFilter],
  );

  const sortedResults = useMemo(() => sortResults(filteredResults, sort), [filteredResults, sort]);

  // Phase199：同じページ（同じURL）を指す結果は1行にまとめて表示する。
  // 市政年表・更新履歴・自治体比較は、1ページの中の個別項目を索引に登録しているため、
  // まとめないと同じ遷移先の行が10件以上続き、他の情報が下へ押し出されてしまう。
  // まとめた一致の見出しは行の中に残すので、どの項目が一致したかは分かる。
  const groupedResults = useMemo(() => groupResultsByUrl(sortedResults), [sortedResults]);
  const visibleGroups = groupedResults.slice(0, visibleCount);
  const mergedCount = sortedResults.length - groupedResults.length;

  // 検索語の入力が落ち着いてから（連続キー入力のたびに送信しないよう）、0件率・
  // 検索回数を把握するための最小限のイベントを送信する。検索語そのものは送らない。
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      trackEvent("site_search", { result_count: sortedResults.length, has_results: sortedResults.length > 0 });
    }, URL_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const suggestions = useMemo(
    () => (hasQuery ? getSuggestions(searchIndex, query, 8) : []),
    [searchIndex, query, hasQuery],
  );

  const hasActiveFilter = typeFilter !== "all" || fiscalYearFilter !== "" || verificationStatusFilter !== "";

  // 検索語自体で1件も見つからなかったときだけ、実際に結果が出る「別の言い方」を探す
  // （辞書の言い換え候補・検索語に含まれる語・1語ずつの検索。件数を確認済みの候補だけを案内する）。
  const alternativeQueries: AlternativeQuery[] = useMemo(
    () =>
      hasQuery && bodiesLoaded && allResults.length === 0 ? getAlternativeQueries(searchIndex, query, { includeAi }, 4) : [],
    [searchIndex, bodiesLoaded, query, hasQuery, allResults.length, includeAi],
  );

  const clearFilters = () => {
    setTypeFilter("all");
    setFiscalYearFilter("");
    setVerificationStatusFilter("");
  };

  const commitQuery = (value: string) => {
    setQuery(value);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    if (value.trim()) {
      // 既存の絞り込み（type・fiscalYear等）を保ったまま?qだけを更新する。
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("q", value);
          return next;
        },
        { replace: true },
      );
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
          議員、一般質問、会議録、議案・議決結果、会期、委員会、市長公約、財政、選挙などをまとめて検索できます。結果は「完全一致 → タイトル一致 → 本文一致 → キーワード一致」の順に並び、重要度などによる並べ替えはしていません。
        </p>
      </div>

      <div className="relative">
        <label htmlFor="site-search-input" className="sr-only">
          サイト内検索
        </label>
        <div className="flex min-h-11 items-stretch gap-3 rounded-full bg-surface-container-high px-4 py-3.5 shadow-e1 transition focus-within:shadow-e2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
          <SearchIcon className="h-5 w-5 shrink-0 self-center text-on-surface-variant" aria-hidden />
          <input
            ref={inputRef}
            id="site-search-input"
            type="search"
            role="combobox"
            aria-expanded={showSuggestions && suggestions.length > 0}
            // Phase194（WCAG）：候補リストが閉じているときはid参照先が存在しないため、
            // 開いているときだけaria-controlsを指定する（存在しないIDの参照を避ける）。
            aria-controls={showSuggestions && suggestions.length > 0 ? "search-suggestions-listbox" : undefined}
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
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
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
              // Phase194（WCAG）：role="listbox"が直接持てる子はrole="option"のみのため、
              // 中間の<li>はrole="presentation"にしてボタン側をoptionとして扱わせる。
              <li key={s} role="presentation">
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex min-h-11 max-w-full shrink-0 items-center gap-2 rounded-full bg-surface-container-high px-3.5 py-2 text-sm text-on-surface-variant focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              <span className="sr-only">年度</span>
              <select
                value={fiscalYearFilter}
                onChange={(e) => setFiscalYearFilter(e.target.value)}
                aria-label="年度で絞り込み"
                className="min-w-0 max-w-full truncate bg-transparent py-2 text-on-surface focus:outline-none"
              >
                <option value="">年度：すべて</option>
                {fiscalYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}年度
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 max-w-full shrink-0 items-center gap-2 rounded-full bg-surface-container-high px-3.5 py-2 text-sm text-on-surface-variant focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              <span className="sr-only">確認状況</span>
              <select
                value={verificationStatusFilter}
                onChange={(e) => setVerificationStatusFilter(e.target.value)}
                aria-label="確認状況で絞り込み"
                className="min-w-0 max-w-full truncate bg-transparent py-2 text-on-surface focus:outline-none"
              >
                <option value="">確認状況：すべて</option>
                <option value="verified">確認済み</option>
                <option value="partiallyVerified">一部確認済み</option>
                <option value="needsReview">確認中</option>
                <option value="sourceUnavailable">資料未公開</option>
              </select>
            </label>
            <label className="flex min-h-11 max-w-full shrink-0 items-center gap-2 rounded-full bg-surface-container-high px-3.5 py-2 text-sm text-on-surface-variant focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              <input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} className="h-4 w-4" />
              分類候補（キーワード一致）を含める
            </label>
          </div>
          {includeAi && (
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
              キーワードの一致だけで機械的に付けたテーマ分類の候補も検索対象に含めます（AIや人による確認はしていません）。該当する結果には「分類候補」と表示し、公式データとは区別します。
            </p>
          )}
          {indexStatus === "loading" && (
            <p className="mt-3 text-sm text-on-surface-variant" role="status">
              検索データを読み込んでいます…
            </p>
          )}
          {indexStatus === "ready-light" && (
            <p className="mt-3 text-xs text-on-surface-variant" role="status">
              タイトル・概要・キーワードで検索しています。会議録などの本文を読み込み中です（読み込み後に本文の一致を追加します）。
            </p>
          )}
          {indexStatus === "error" && (
            <p className="mt-3 rounded-lg bg-surface-container p-3 text-sm text-on-surface" role="alert">
              検索データを読み込めませんでした。通信状況を確認して、ページを再読み込みしてください。
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm text-on-surface-variant" aria-live="polite">
              {indexStatus === "loading" || indexStatus === "idle"
                ? "読み込み中"
                : sortedResults.length > 0
                ? mergedCount > 0
                  ? `${sortedResults.length}件見つかりました（同じページを指す結果をまとめて${groupedResults.length}件で表示）`
                  : `${sortedResults.length}件見つかりました`
                : "0件"}
            </p>
            <label className="flex min-h-11 max-w-full shrink-0 items-center gap-2 rounded-full bg-surface-container-high px-3.5 py-2 text-sm text-on-surface-variant focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              <span className="sr-only">並び替え</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SearchSortKey)}
                aria-label="並び替え"
                className="min-w-0 max-w-full truncate bg-transparent py-2 text-on-surface focus:outline-none"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {indexStatus === "loading" || indexStatus === "idle" || indexStatus === "error" ? null : sortedResults.length === 0 ? (
            <div className="mt-6 space-y-4 rounded-xl bg-surface-container-low p-6 sm:p-8">
              {allResults.length > 0 ? (
                <>
                  <p className="text-center text-sm text-on-surface-variant">
                    「{query.trim()}」では{allResults.length}件見つかりましたが、現在の絞り込み条件に一致する結果はありません。
                  </p>
                  {hasActiveFilter && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={clearFilters}
                        className={`inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
                      >
                        絞り込みを解除して{allResults.length}件を表示する
                      </button>
                    </div>
                  )}
                  {availableTypes.length > 0 && (
                    <div>
                      <p className="text-center text-xs font-medium text-on-surface-variant">別の種類から探す</p>
                      <ul className="mt-2 flex flex-wrap justify-center gap-2">
                        {availableTypes.map((t) => (
                          <li key={t}>
                            <button
                              type="button"
                              onClick={() => {
                                setTypeFilter(t);
                                setFiscalYearFilter("");
                                setVerificationStatusFilter("");
                              }}
                              className={`min-h-11 rounded-full bg-surface-container-high px-3.5 text-sm text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
                            >
                              {typeLabels[t]}（{countsByType.get(t) ?? 0}件）
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-center text-sm text-on-surface-variant">
                    「{query.trim()}」に該当する情報は見つかりませんでした。
                  </p>
                  {alternativeQueries.length > 0 && (
                    <div>
                      <p className="text-center text-xs font-medium text-on-surface-variant">別の言い方で探す</p>
                      <ul className="mx-auto mt-2 max-w-sm space-y-2">
                        {alternativeQueries.map((a) => (
                          <li key={a.term}>
                            <button
                              type="button"
                              onClick={() => commitQuery(a.term)}
                              className={`flex w-full min-h-11 flex-col items-start gap-0.5 rounded-xl bg-surface-container-high px-4 py-2 text-left transition hover:bg-surface-container-highest ${linkClass}`}
                            >
                              <span className="text-sm font-medium text-on-surface">
                                「{a.term}」で検索（{a.count}件）
                              </span>
                              <span className="text-xs text-on-surface-variant">
                                {a.note ?? ALTERNATIVE_REASON_LABELS[a.reason]}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <ul className="mx-auto max-w-sm space-y-1 text-left text-xs text-on-surface-variant">
                <li>・検索語を短くする（「延岡駅前の再開発」→「延岡駅」など）</li>
                <li>・別の表現で検索する（「議事録」→「会議録」など）</li>
                <li>・年度や種類の絞り込みを解除する</li>
                <li>
                  ・
                  <Link to="/contact" className={`text-primary underline ${linkClass}`}>
                    情報提供・訂正依頼ページ
                  </Link>
                  から探している情報をお知らせいただくこともできます
                </li>
              </ul>
              <div>
                <p className="text-center text-xs font-medium text-on-surface-variant">検索例</p>
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
                {visibleGroups.map(({ result: { entry, matchedAiCandidateKeywords, tier, reasons }, others }, index) => {
                  const excerpt = tier >= 3 ? excerptFor(entry, query) : "";
                  return (
                  <li key={entry.id} className="rounded-xl bg-surface-container-low p-4 shadow-e1">
                    <Link
                      to={entry.url}
                      onClick={() => trackEvent("search_result_click", { result_type: entry.type, result_position: index + 1 })}
                      className={`block rounded ${linkClass}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 text-xs font-medium text-on-secondary-container">
                          {typeLabels[entry.type]}
                        </span>
                        {entry.date ? (
                          <span className="text-xs text-on-surface-variant">{formatJapaneseDate(entry.date)}</span>
                        ) : typeof entry.fiscalYear === "number" ? (
                          <span className="text-xs text-on-surface-variant">{entry.fiscalYear}年度</span>
                        ) : null}
                        <span className="text-xs text-on-surface-variant">／{SEARCH_MATCH_TIER_LABELS[tier]}</span>
                        {matchedAiCandidateKeywords.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                            分類候補
                          </span>
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
                      {excerpt && (
                        <p className="mt-1.5 rounded bg-surface-container px-2 py-1 text-xs leading-relaxed text-on-surface-variant">
                          <span className="font-medium">該当箇所：</span>
                          <HighlightText text={excerpt} query={query} />
                        </p>
                      )}
                      <p className="mt-1 text-xs text-on-surface-variant">
                        <span className="font-medium">一致理由：</span>
                        {reasons.join("／")}
                      </p>
                      {matchedAiCandidateKeywords.length > 0 && (
                        <p className="mt-1 text-xs text-on-surface-variant">
                          分類候補（キーワード一致、確認前）で一致：{matchedAiCandidateKeywords.slice(0, 3).join("、")}
                        </p>
                      )}
                      <span className="mt-1.5 inline-block text-xs font-medium text-primary underline">詳細ページを見る</span>
                    </Link>
                    {entry.sourceRefs && entry.sourceRefs.length > 0 && (
                      <ul className="mt-1 flex flex-wrap gap-x-3" aria-label={`「${entry.title}」の一次資料`}>
                        {entry.sourceRefs.map((ref) => (
                          <li key={ref.url}>
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`一次資料：${ref.label}（外部サイトが新しいタブで開きます）`}
                              className={`inline-flex min-h-11 items-center text-xs text-primary underline ${linkClass}`}
                            >
                              一次資料：{ref.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {others.length > 0 && (
                      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                        このページ内の他の一致（{others.length}件）：
                        {others
                          .slice(0, 3)
                          .map((o) => o.entry.title)
                          .join("、")}
                        {others.length > 3 && ` ほか${others.length - 3}件`}
                      </p>
                    )}
                  </li>
                  );
                })}
              </ul>

              {visibleCount < groupedResults.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className={`mt-4 w-full rounded-full border border-outline-variant py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
                >
                  さらに表示（残り{groupedResults.length - visibleCount}件）
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
