import { Link, useLocation } from "react-router-dom";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import type { ArchiveFiscalYear } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { FinanceMetricSection } from "../components/finance/FinanceMetricSection";
import { FinanceYearCards } from "../components/finance/FinanceYearCards";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { YenIcon } from "../components/icons";
import { SourceRefList } from "../components/SourceRefList";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  formatOkuYenOrConfirming,
  fiscalYearLabel,
  sortedFiscalYears,
  missingFiscalYears,
  formatMissingFiscalYearsNote,
  fiscalYearGapNote,
  hasBudgetData,
} from "../lib/archiveFinance";
import { financeMetricByKey } from "../lib/archiveFinanceMetrics";

const budgetInitialMetric = financeMetricByKey("budgetInitial")!;
const budgetFinalMetric = financeMetricByKey("budgetFinal")!;
const settlementMetric = financeMetricByKey("settlement")!;

const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]);
const yearGapNote = fiscalYearGapNote(archiveFiscalYears);
const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function FinanceBudgetPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const rows = archiveFiscalYears.filter(hasBudgetData);
  const missingYearsNote = formatMissingFiscalYearsNote(missingFiscalYears(archiveFiscalYears, hasBudgetData), "予算・決算");

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <YenIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">予算・決算規模の推移</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          一般会計の当初予算・補正後予算・決算額を、年度ごとに区別して整理しています。予算と決算は別の数値であり、混同しないようご注意ください。単年度の詳細な歳入・歳出構成は
          <Link to="/finance" className={`mx-1 underline ${linkClass}`}>
            延岡市の財政（単年度ダッシュボード）
          </Link>
          をご覧ください。
        </p>
      </div>

      <div className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        収録年度：{rows.length}／{archiveFiscalYears.length}年度（{fiscalYearLabel(archiveFiscalYears[0]?.fiscalYear)}〜
        {fiscalYearLabel(archiveFiscalYears[archiveFiscalYears.length - 1]?.fiscalYear)}）。{missingYearsNote}
        現在登録している年度は限られています。過去年度への遡及調査は今後、公式資料（予算書・決算書）を確認しながら段階的に進めます。「確認中」は資料が未確認であることを示し、0（ゼロ）とは異なります。人口・物価・国庫支出金・大型事業等の影響により予算規模は変動するため、金額の増減だけで単純に評価することは避けてください。
        {yearGapNote && <span className="mt-1 block">{yearGapNote}</span>}
      </div>

      <SectionCard title="当初予算の年度推移">
        <FinanceMetricSection metric={budgetInitialMetric} years={rows} showTable={false} />
      </SectionCard>

      <SectionCard title="補正後予算の年度推移">
        <FinanceMetricSection metric={budgetFinalMetric} years={rows} showTable={false} />
      </SectionCard>

      <SectionCard title="決算額の年度推移">
        <FinanceMetricSection metric={settlementMetric} years={rows} showTable={false} />
      </SectionCard>

      <SectionCard title="年度別 予算・決算（一覧）">
        {rows.length === 0 ? (
          <p className="text-sm text-on-surface-variant">登録済みの年度データはまだありません。</p>
        ) : (
          <FinanceYearCards
            caption="年度別の一般会計当初予算・補正後予算・決算額"
            years={rows}
            getYear={(y) => y.fiscalYear}
            rowKey={(y) => String(y.fiscalYear)}
            detailHref={(y) => `/timeline/${y.fiscalYear}`}
            fields={[
              { label: "当初予算", value: (y) => y.budget?.generalAccountInitialBudgetYen ?? null, format: (v) => formatOkuYenOrConfirming(v) },
              { label: "補正後予算", value: (y) => y.budget?.generalAccountFinalBudgetYen ?? null, format: (v) => formatOkuYenOrConfirming(v) },
              { label: "決算額", value: (y) => y.budget?.generalAccountSettlementYen ?? null, format: (v) => formatOkuYenOrConfirming(v) },
            ]}
          />
        )}
      </SectionCard>

      {rows.map((y) => (
        <SectionCard
          key={y.fiscalYear}
          title={`${fiscalYearLabel(y.fiscalYear)}の出典・確認状況`}
          action={
            <Link to={`/timeline/${y.fiscalYear}`} className={`shrink-0 text-xs text-primary underline ${linkClass}`}>
              この年度のタイムラインを見る
            </Link>
          }
        >
          {y.budget?.notes && <p className="mb-2 text-xs leading-relaxed text-on-surface-variant">{y.budget.notes}</p>}
          <SourceRefList refs={y.budget?.sourceRefs ?? []} />
        </SectionCard>
      ))}

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        年度を選んで並べて比較したい場合は
        <Link to="/compare/budget" className={`mx-1 underline ${linkClass}`}>
          予算・決算の比較
        </Link>
        をご利用ください。
      </p>

      <LastUpdated className="mt-4" />
      <div className="mt-4">
        <CorrectionRequestButton pageName="予算・決算規模の推移" />
      </div>
    </div>
  );
}
