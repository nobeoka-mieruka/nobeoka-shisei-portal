import { useMemo } from "react";
import expensesData from "../data/mayorEntertainmentExpenses.json";
import type { MayorEntertainmentExpensesData } from "../types";
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

export function MayorEntertainmentExpensesPage() {
  usePageTitle("市長交際費");

  const total = useMemo(() => data.expenses.reduce((sum, e) => sum + e.amount, 0), []);
  const count = data.expenses.length;

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of data.expenses) {
      const ym = e.date.slice(0, 7);
      map.set(ym, (map.get(ym) ?? 0) + e.amount);
    }
    const confirmed = [...map.entries()].map(([month, amount]) => ({ month, amount, confirmed: true as const }));
    const unconfirmed = data.unconfirmedMonths.map((month) => ({ month, amount: null, confirmed: false as const }));
    return [...confirmed, ...unconfirmed].sort((a, b) => (a.month < b.month ? -1 : 1));
  }, []);

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
          {data.fiscalYearLabel}の市長交際費を、延岡市公式資料に基づいて掲載しています。公式資料がまだ公表されていない月は「データ確認中」と表示し、推定値は掲載していません。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={`${data.fiscalYearLabel}合計`} value={formatYen(total)} compact />
        <StatCard label="件数" value={count} unit="件" />
        <StatCard label="公表済み月数" value={byMonth.filter((m) => m.confirmed).length} unit="か月" />
        <StatCard label="データ確認中の月数" value={byMonth.filter((m) => !m.confirmed).length} unit="か月" />
      </div>

      <SectionCard title="月別合計">
        <ul className="space-y-2">
          {byMonth.map((m) => (
            <li
              key={m.month}
              className="flex items-center justify-between rounded-lg border border-outline-variant px-3 py-2 text-sm"
            >
              <span className="text-on-surface">{formatMonthLabel(m.month)}</span>
              <span className={m.confirmed ? "font-medium text-on-surface" : "text-on-surface-variant"}>
                {m.confirmed ? formatYen(m.amount as number) : "データ確認中"}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="区分別合計">
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
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
                <th className="py-2 pr-3 font-medium">支出月日</th>
                <th className="px-3 py-2 font-medium">区分</th>
                <th className="px-3 py-2 font-medium">支出先・内容等</th>
                <th className="px-3 py-2 text-right font-medium">支出金額</th>
              </tr>
            </thead>
            <tbody>
              {sortedExpenses.map((e, i) => (
                <tr key={i} className="border-b border-outline-variant align-top last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap text-on-surface-variant">{formatJapaneseDate(e.date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-on-surface-variant">{e.category}</td>
                  <td className="px-3 py-2 text-on-surface">{e.description}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-on-surface">{formatYen(e.amount)}</td>
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
