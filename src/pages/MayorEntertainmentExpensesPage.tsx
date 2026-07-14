import { useMemo } from "react";
import expensesData from "../data/mayorEntertainmentExpenses.json";
import type { MayorEntertainmentExpenseItem, MayorEntertainmentExpensesData } from "../types";
import { BackLink } from "../components/BackLink";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { SourceLink } from "../components/SourceLink";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";

const data = expensesData as MayorEntertainmentExpensesData;

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
  usePageTitle("市長交際費");

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

  const sortedExpenses = useMemo(() => [...data.expenses].sort((a, b) => (a.date < b.date ? 1 : -1)), []);

  const monthlySources = useMemo(() => {
    const seen = new Map<string, { sourceTitle: string; sourceUrl: string }>();
    for (const e of data.expenses) {
      if (!seen.has(e.sourceUrl)) seen.set(e.sourceUrl, { sourceTitle: e.sourceTitle, sourceUrl: e.sourceUrl });
    }
    return [...seen.values()];
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
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

      <SectionCard title="支出明細">
        <div className="hidden overflow-x-auto sm:block">
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
