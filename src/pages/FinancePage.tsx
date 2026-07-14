import financeData from "../data/financeDashboard.json";
import type { FinanceDashboardData, FinanceSourceMeta } from "../types";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { FinanceBarList } from "../components/finance/FinanceBarList";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { GlobeIcon } from "../components/icons";

const data = financeData as FinanceDashboardData;

function formatThousandYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}千円`;
}

function formatOku(value: number): string {
  return `約${(value / 100000).toFixed(1)}億円`;
}

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function sourceHref(source: FinanceSourceMeta): string {
  return source.page ? `${source.url}#page=${source.page}` : source.url;
}

function SectionSource({ section }: { section: string }) {
  const source = data.sources.find((s) => s.section === section);
  if (!source) return null;
  return (
    <div className="mt-3 border-t border-outline-variant pt-2 text-xs text-on-surface-variant">
      <a
        href={sourceHref(source)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${source.title}を新しいタブで開く`}
        className={`inline-flex items-center gap-1 text-primary hover:underline ${linkClass}`}
      >
        <GlobeIcon className="h-3.5 w-3.5" />
        {source.title}
        {source.page && `（p.${source.page}）`}
      </a>
      <p className="mt-1">
        公表機関：{source.organization}／基準日：{formatJapaneseDate(source.referenceDate)}／確認日：
        {formatJapaneseDate(source.confirmedDate)}
      </p>
    </div>
  );
}

export function FinancePage() {
  usePageTitle("延岡市の財政");

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">延岡市の財政</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          {data.fiscalYearLabel}6月補正後の一般会計（基準日：{formatJapaneseDate(data.referenceDate)}
          ）を、公開資料に基づいて整理しています。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="一般会計総額（6月補正後）"
          value={formatThousandYen(data.generalAccount.totalThousandYen)}
          hint={formatOku(data.generalAccount.totalThousandYen)}
          compact
        />
        <StatCard
          label="6月補正額"
          value={formatThousandYen(data.generalAccount.supplementaryThousandYen)}
          hint={formatOku(data.generalAccount.supplementaryThousandYen)}
          compact
        />
        <StatCard
          label="補正前総額"
          value={formatThousandYen(data.generalAccount.totalBeforeThousandYen)}
          hint={formatOku(data.generalAccount.totalBeforeThousandYen)}
          compact
        />
      </div>

      <SectionCard title="歳入構成（主要項目）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          一般会計歳入のうち、資料で構成比が示された主要項目です。ここに挙げた項目の合計は歳入全体には一致しません。市債についての注記は本ページ下部をご覧ください。
        </p>
        <FinanceBarList items={data.revenue} />
        <SectionSource section="revenue" />
      </SectionCard>

      <SectionCard title="歳出構成（目的別）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          一般会計歳出を、目的別区分（民生費・総務費など）で示したものです。
        </p>
        <FinanceBarList items={data.expenditureByPurpose} />
        <SectionSource section="expenditureByPurpose" />
      </SectionCard>

      <SectionCard title="歳出構成（性質別）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          一般会計歳出を、性質別区分（人件費・扶助費など）で示したものです。目的別区分とは異なる分類です。
        </p>
        <FinanceBarList items={data.expenditureByNature} />
        <SectionSource section="expenditureByNature" />
      </SectionCard>

      <SectionCard title="6月補正予算の主な内容">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          6月補正予算に計上された主な事業です。市長の公約・政策との関連付けは行っていません。
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.supplementaryBudgetProjects.map((p) => (
            <li
              key={p.title}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-outline-variant p-3"
            >
              <span className="text-sm text-on-surface">{p.title}</span>
              <span className="text-sm font-semibold text-on-surface">{formatThousandYen(p.amountThousandYen)}</span>
            </li>
          ))}
        </ul>
        <SectionSource section="supplementaryBudgetProjects" />
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SectionCard title="基金残高">
          <p className="text-sm text-on-surface-variant">{data.fundBalance.unavailableLabel}</p>
          <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
            今回使用した2資料だけでは正確な基金残高を確認できないため、推定値は掲載していません。
          </p>
        </SectionCard>
        <SectionCard title="人口推移">
          <p className="text-sm text-on-surface-variant">{data.populationTrend.unavailableLabel}</p>
          <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
            今回使用した2資料だけでは正確な人口推移を確認できないため、推定値は掲載していません。
          </p>
        </SectionCard>
      </div>

      <SectionCard title="市債について">
        <p className="text-sm font-semibold text-on-surface">
          {formatThousandYen(data.revenue.find((r) => r.label === "市債")?.amountThousandYen ?? 0)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{data.debtNote}</p>
      </SectionCard>

      <SectionCard title="出典一覧">
        <ul className="space-y-3">
          {data.sources.map((s) => (
            <li key={`${s.section}-${s.url}-${s.page}`} className="border-b border-outline-variant pb-3 last:border-0 last:pb-0">
              <a
                href={sourceHref(s)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.title}を新しいタブで開く`}
                className={`inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
              >
                <GlobeIcon className="h-4 w-4" />
                {s.title}
                {s.page && `（p.${s.page}）`}
              </a>
              <p className="mt-1 text-xs text-on-surface-variant">
                公表機関：{s.organization}／基準日：{formatJapaneseDate(s.referenceDate)}／確認日：
                {formatJapaneseDate(s.confirmedDate)}
              </p>
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
