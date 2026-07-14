import financeData from "../data/financeOverview.json";
import type { FinanceOverviewData } from "../types";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { FinanceBarList } from "../components/finance/FinanceBarList";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { GlobeIcon } from "../components/icons";

const data = financeData as FinanceOverviewData;

function formatThousandYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}千円`;
}

function formatOku(value: number): string {
  return `約${(value / 100000).toFixed(1)}億円`;
}

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function FinancePage() {
  usePageTitle("延岡市の財政");

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">延岡市の財政</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          {data.fiscalYearLabel}6月補正後の一般会計（基準日：{formatJapaneseDate(data.referenceDate)}）を、公開資料に基づいて整理しています。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="一般会計総額（6月補正後）"
          value={formatThousandYen(data.generalAccountTotalThousandYen)}
          hint={formatOku(data.generalAccountTotalThousandYen)}
          compact
        />
        <StatCard
          label="6月補正額"
          value={formatThousandYen(data.supplementaryAmountThousandYen)}
          hint={formatOku(data.supplementaryAmountThousandYen)}
          compact
        />
      </div>

      <SectionCard title="歳入構成（主要項目）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          一般会計歳入のうち、施政方針・予算説明で示された主要項目です。ここに挙げた項目の合計は歳入全体には一致しません。
        </p>
        <FinanceBarList items={data.revenueItems} />
      </SectionCard>

      <SectionCard title="歳出構成（目的別・主要項目）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          一般会計歳出のうち、金額の大きい目的別区分です。ここに挙げた項目の合計は歳出全体には一致しません（議会費・労働費・災害復旧費・予備費などは含んでいません）。
        </p>
        <FinanceBarList items={data.expenditureItems} />
      </SectionCard>

      <SectionCard title="6月補正予算の主な内容">
        <ul className="space-y-3">
          {data.supplementaryHighlights.map((h) => (
            <li key={h.title} className="rounded-lg border border-outline-variant p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-medium text-on-surface">{h.title}</p>
                {h.amountThousandYen !== undefined && (
                  <p className="text-sm font-semibold text-on-surface">{formatThousandYen(h.amountThousandYen)}</p>
                )}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{h.description}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="出典">
        <ul className="space-y-1.5">
          {data.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.title}を新しいタブで開く`}
                className={`inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
              >
                <GlobeIcon className="h-4 w-4" />
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </SectionCard>

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">{data.notes}</p>

      <p className="px-1 text-xs text-on-surface-variant">最終確認：{formatJapaneseDate(data.lastVerified)}</p>

      <CorrectionRequestButton pageName="延岡市の財政" />
    </div>
  );
}
