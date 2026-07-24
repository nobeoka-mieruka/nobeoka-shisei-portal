import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import expensesData from "../data/mayorEntertainmentExpenses.json";
import type { MayorEntertainmentExpenseItem, MayorEntertainmentExpensesData } from "../types";
import { BackLink } from "../components/BackLink";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { SourceLink } from "../components/SourceLink";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const data = expensesData as MayorEntertainmentExpensesData;

type ExpenseSortKey = "dateDesc" | "dateAsc" | "amountDesc" | "amountAsc";

const sortOptions: { value: ExpenseSortKey; label: string }[] = [
  { value: "dateDesc", label: "支出日：新しい順" },
  { value: "dateAsc", label: "支出日：古い順" },
  { value: "amountDesc", label: "金額：高い順" },
  { value: "amountAsc", label: "金額：低い順" },
];

function formatYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y}年${m}月`;
}

type MonthRow =
  | { month: string; status: "confirmed"; amount: number; count: number; items: MayorEntertainmentExpenseItem[] }
  | { month: string; status: "confirmed-zero"; amount: 0; count: 0; items: [] }
  | { month: string; status: "unconfirmed"; amount: null; count: null; items: [] };

export function MayorEntertainmentExpensesPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const total = useMemo(() => data.expenses.reduce((sum, e) => sum + e.amount, 0), []);
  const count = data.expenses.length;

  const byMonth: MonthRow[] = useMemo(() => {
    const map = new Map<string, MayorEntertainmentExpenseItem[]>();
    for (const e of data.expenses) {
      const ym = e.date.slice(0, 7);
      const list = map.get(ym) ?? [];
      list.push(e);
      map.set(ym, list);
    }
    const confirmed: MonthRow[] = [...map.entries()].map(([month, items]) => ({
      month,
      status: "confirmed",
      amount: items.reduce((s, e) => s + e.amount, 0),
      count: items.length,
      items,
    }));
    const confirmedZero: MonthRow[] = data.confirmedZeroMonths.map((month) => ({
      month,
      status: "confirmed-zero",
      amount: 0,
      count: 0,
      items: [],
    }));
    const unconfirmed: MonthRow[] = data.unconfirmedMonths.map((month) => ({
      month,
      status: "unconfirmed",
      amount: null,
      count: null,
      items: [],
    }));
    return [...confirmed, ...confirmedZero, ...unconfirmed].sort((a, b) => (a.month < b.month ? -1 : 1));
  }, []);

  const confirmedMonthCount = byMonth.filter((m) => m.status !== "unconfirmed").length;
  const unconfirmedMonthCount = byMonth.filter((m) => m.status === "unconfirmed").length;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of data.expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [fiscalYearFilter, setFiscalYearFilter] = useState("all");
  const [sortKey, setSortKey] = useState<ExpenseSortKey>("dateDesc");

  const categoryOptions = useMemo(
    () => Array.from(new Set(data.expenses.map((e) => e.category))).map((c) => ({ value: c, label: c })),
    [],
  );
  const monthOptions = useMemo(
    () =>
      Array.from(new Set(data.expenses.map((e) => e.date.slice(0, 7))))
        .sort()
        .map((ym) => ({ value: ym, label: formatMonthLabel(ym) })),
    [],
  );
  const fiscalYearOptions = useMemo(() => [{ value: data.fiscalYear, label: data.fiscalYearLabel }], []);

  const hasActiveFilter =
    query !== "" || categoryFilter !== "all" || monthFilter !== "all" || fiscalYearFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setCategoryFilter("all");
    setMonthFilter("all");
    setFiscalYearFilter("all");
  };

  const sortedExpenses = useMemo(() => {
    const q = query.trim();
    let list = data.expenses.filter((e) => {
      const matchesQuery = q === "" || e.description.includes(q) || e.category.includes(q);
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter;
      const matchesMonth = monthFilter === "all" || e.date.slice(0, 7) === monthFilter;
      const matchesFiscalYear = fiscalYearFilter === "all" || fiscalYearFilter === data.fiscalYear;
      return matchesQuery && matchesCategory && matchesMonth && matchesFiscalYear;
    });
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "dateAsc":
          return a.date.localeCompare(b.date);
        case "amountDesc":
          return b.amount - a.amount;
        case "amountAsc":
          return a.amount - b.amount;
        case "dateDesc":
        default:
          return b.date.localeCompare(a.date);
      }
    });
    return list;
  }, [query, categoryFilter, monthFilter, fiscalYearFilter, sortKey]);

  const monthlySources = useMemo(() => {
    const seen = new Map<string, { sourceTitle: string; sourceUrl: string }>();
    for (const e of data.expenses) {
      if (!seen.has(e.sourceUrl)) seen.set(e.sourceUrl, { sourceTitle: e.sourceTitle, sourceUrl: e.sourceUrl });
    }
    return [...seen.values()];
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/mayor" label="市長情報に戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市長交際費</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          対象年度：{data.fiscalYearLabel}／最終確認日：{formatJapaneseDate(data.lastVerified)}
        </p>
        <p className="mt-2 text-sm text-on-primary-container/80">
          延岡市が公表している市長交際費の支出状況を、年度別・月別・区分別に整理しています。未公表の月は推定せず「データ確認中」と表示します。
        </p>
        <SourceLink url={data.sourcePageUrl} label={data.sourcePageTitle} className="mt-3" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={`${data.fiscalYearLabel}合計`} value={formatYen(total)} compact />
        <StatCard label="件数" value={count} unit="件" />
        <StatCard label="公表済み月数" value={confirmedMonthCount} unit="か月" />
        <StatCard label="データ確認中の月数" value={unconfirmedMonthCount} unit="か月" />
      </div>

      <SectionCard title="月別表示">
        <ul className="space-y-2">
          {byMonth.map((m) => (
            <li key={m.month} className="rounded-lg border border-outline-variant px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-on-surface">{formatMonthLabel(m.month)}</span>
                <span className="flex items-center gap-2">
                  {m.status !== "unconfirmed" && (
                    <span className="text-xs text-on-surface-variant">{m.count}件</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.status === "unconfirmed"
                        ? "bg-surface-variant text-on-surface-variant"
                        : "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]"
                    }`}
                  >
                    {m.status === "unconfirmed" ? "データ確認中" : "公表済み"}
                  </span>
                  <span className="font-medium text-on-surface">
                    {m.status === "unconfirmed" ? "—" : formatYen(m.amount)}
                  </span>
                </span>
              </div>
              {m.status === "confirmed" && m.items.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-primary">明細を見る</summary>
                  <ul className="mt-2 space-y-1.5 border-t border-outline-variant pt-2">
                    {m.items.map((e, i) => (
                      <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                        <span className="text-on-surface-variant">
                          {formatJapaneseDate(e.date)}　{e.category}　{e.description}
                        </span>
                        <span className="shrink-0 font-medium text-on-surface">{formatYen(e.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="区分別合計">
        <p className="mb-2 text-xs leading-relaxed text-on-surface-variant">
          区分は延岡市公式資料に記載された名称（慶弔費・渉外費・会費・協賛費）をそのまま使用しています。独自の統合や名称変更は行っていません。該当する支出がない区分は表示していません。
        </p>
        <ul className="space-y-2">
          {byCategory.map(([category, amount]) => (
            <li
              key={category}
              className="flex items-center justify-between rounded-lg border border-outline-variant px-3 py-2 text-sm"
            >
              <span className="text-on-surface">{category}</span>
              <span className="font-medium text-on-surface">{formatYen(amount)}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="支出明細を検索">
        <div className="space-y-3">
          <SearchBar value={query} onChange={setQuery} label="支出先・内容をキーワードで検索" placeholder="団体名、香典、会費など" />
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="年度" value={fiscalYearFilter} onChange={setFiscalYearFilter} options={fiscalYearOptions} />
            <FilterSelect label="月" value={monthFilter} onChange={setMonthFilter} options={monthOptions} />
            <FilterSelect label="区分" value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} />
            <label className="flex shrink-0 items-center gap-2 rounded-full bg-surface-container-high px-4 py-2.5 text-sm text-on-surface-variant shadow-e1 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
              <span className="sr-only">並び替え</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as ExpenseSortKey)}
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
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                条件をリセット
              </button>
            )}
          </div>
          <p className="text-sm text-on-surface-variant">
            {sortedExpenses.length > 0
              ? `${sortedExpenses.length}件表示中（全${data.expenses.length}件中）`
              : "条件に一致する支出はありませんでした。"}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="支出明細">
        <div
          className="hidden overflow-x-auto sm:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          role="region"
          aria-label="市長交際費 支出明細の表"
          tabIndex={0}
        >
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
                <th className="py-2 pr-3 font-medium">支出月日</th>
                <th className="px-3 py-2 font-medium">区分</th>
                <th className="px-3 py-2 font-medium">支出先・内容等</th>
                <th className="px-3 py-2 text-right font-medium">支出金額</th>
                <th className="px-3 py-2 font-medium">出典資料</th>
                <th className="px-3 py-2 font-medium">基準日</th>
                <th className="px-3 py-2 font-medium">最終確認日</th>
              </tr>
            </thead>
            <tbody>
              {sortedExpenses.map((e, i) => (
                <tr key={i} className="border-b border-outline-variant align-top last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap text-on-surface-variant">{formatJapaneseDate(e.date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-on-surface-variant">{e.category}</td>
                  <td className="px-3 py-2 text-on-surface">{e.description}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-on-surface">{formatYen(e.amount)}</td>
                  <td className="px-3 py-2">
                    <a
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${e.sourceTitle}を新しいタブで開く`}
                      className="text-xs text-primary hover:underline"
                    >
                      {e.sourceTitle}
                    </a>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-on-surface-variant">
                    {formatJapaneseDate(e.referenceDate)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-on-surface-variant">
                    {formatJapaneseDate(e.lastVerified)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="space-y-3 sm:hidden">
          {sortedExpenses.map((e, i) => (
            <li key={i} className="rounded-lg border border-outline-variant p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
                <span>{formatJapaneseDate(e.date)}</span>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5">{e.category}</span>
              </div>
              <p className="mt-1.5 text-sm text-on-surface">{e.description}</p>
              <p className="mt-1 text-right text-sm font-semibold text-on-surface">{formatYen(e.amount)}</p>
              <div className="mt-2 space-y-0.5 border-t border-outline-variant pt-2 text-xs text-on-surface-variant">
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${e.sourceTitle}を新しいタブで開く`}
                  className="block text-primary hover:underline"
                >
                  {e.sourceTitle}
                </a>
                <p>
                  基準日：{formatJapaneseDate(e.referenceDate)}／最終確認日：{formatJapaneseDate(e.lastVerified)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="出典">
        <SourceLink url={data.sourcePageUrl} label={data.sourcePageTitle} verifiedAt={data.lastVerified} className="mb-3" />
        <ul className="space-y-1.5">
          {monthlySources.map((s) => (
            <li key={s.sourceUrl}>
              <SourceLink url={s.sourceUrl} label={s.sourceTitle} />
            </li>
          ))}
        </ul>
      </SectionCard>

      <p className="px-1 text-xs text-on-surface-variant">最終確認：{formatJapaneseDate(data.lastVerified)}</p>

      <CorrectionRequestButton pageName="市長交際費" />
    </div>
  );
}
