import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import type { ArchiveFiscalYear } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CompareTable } from "../components/compare/CompareTable";
import { FinanceBarChart } from "../components/finance/FinanceBarChart";
import { FinanceMetricSection } from "../components/finance/FinanceMetricSection";
import { CompareItemPicker } from "../components/compare/CompareItemPicker";
import { YenIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatOkuYenOrConfirming, fiscalYearLabel, sortedFiscalYears } from "../lib/archiveFinance";
import { parseCompareSelection, buildCompareSearchParams, MIN_COMPARE_ITEMS } from "../lib/archiveCompare";
import { financeMetricsByGroup, financeMetricByKey } from "../lib/archiveFinanceMetrics";
import { computePerCapitaYen, describePerCapita } from "../lib/archivePerCapita";

const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]).filter((y) => y.budget);
const yearIds = archiveFiscalYears.map((y) => String(y.fiscalYear));
const budgetMetrics = financeMetricsByGroup("budget");

export function CompareBudgetPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();
  const [metricKey, setMetricKey] = useState<string>("budgetFinal");

  const selected = parseCompareSelection(searchParams, yearIds, "years");
  const selectedRows = archiveFiscalYears
    .filter((y) => selected.includes(String(y.fiscalYear)))
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  const handleChange = (ids: string[]) => setSearchParams(buildCompareSearchParams(ids, "years"), { replace: true });
  const activeMetric = financeMetricByKey(metricKey) ?? budgetMetrics[0];

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/compare" label="比較トップに戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <YenIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">予算・決算の比較</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          一般会計の当初予算・補正後予算・決算額を、最大4年度まで選んで比較できます。予算と決算は別の数値です。人口・物価・国庫支出金・大型事業等の影響があるため、金額の増減だけで単純に評価しないでください。
        </p>
      </div>

      <SectionCard title="比較する年度を選ぶ">
        <CompareItemPicker
          legend="年度"
          options={archiveFiscalYears.map((y) => ({ id: String(y.fiscalYear), label: fiscalYearLabel(y.fiscalYear) }))}
          selected={selected}
          onChange={handleChange}
        />
      </SectionCard>

      {selected.length < MIN_COMPARE_ITEMS && (
        <p className="rounded-xl border border-primary/30 bg-primary-container/40 p-4 text-sm font-medium text-on-surface">
          {selected.length === 0
            ? `比較したい年度を${MIN_COMPARE_ITEMS}件以上選んでください（上の一覧をタップ）。`
            : `比較には${MIN_COMPARE_ITEMS}件以上の選択が必要です。もう${MIN_COMPARE_ITEMS - selected.length}件選んでください。`}
        </p>
      )}

      {selectedRows.length >= MIN_COMPARE_ITEMS && (
        <>
          <SectionCard title="比較結果（補正後予算）">
            <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
              一般会計補正後予算（最終予算）で比較しています。当初予算・決算額は下の表でご確認ください。
            </p>
            <FinanceBarChart
              points={selectedRows.map((y) => ({
                label: fiscalYearLabel(y.fiscalYear),
                value: y.budget?.generalAccountFinalBudgetYen ?? null,
              }))}
              formatValue={(v) => formatOkuYenOrConfirming(v)}
              ariaLabel="選択した年度の一般会計補正後予算の比較棒グラフ。詳細は直後の表を参照してください。"
            />
            <CompareTable
              caption="選択した年度の当初予算・補正後予算・決算額"
              rows={selectedRows}
              rowKey={(y) => String(y.fiscalYear)}
              columns={[
                { header: "年度", render: (y) => fiscalYearLabel(y.fiscalYear) },
                { header: "当初予算", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.generalAccountInitialBudgetYen) },
                { header: "補正後予算", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.generalAccountFinalBudgetYen) },
                { header: "決算額", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.generalAccountSettlementYen) },
              ]}
            />
          </SectionCard>

          <SectionCard title="項目を選んで比較（歳入内訳を含む）">
            <div className="flex flex-wrap gap-2" role="group" aria-label="予算項目の切り替え">
              {budgetMetrics.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetricKey(m.key)}
                  aria-pressed={metricKey === m.key}
                  className={`inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    metricKey === m.key
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <FinanceMetricSection metric={activeMetric} years={selectedRows} />
            </div>
          </SectionCard>

          <SectionCard title="市民1人当たりの予算・決算額（当サイトによる算出値）">
            <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
              同じ年度の確認済み人口で当サイトが単純に割り算した参考値です。延岡市が公式に発表した「1人当たり」指標ではありません。
            </p>
            <ul className="space-y-1.5 text-xs leading-relaxed text-on-surface-variant">
              {selectedRows.flatMap((y) => {
                const items: string[] = [];
                const initial = computePerCapitaYen(y.budget?.generalAccountInitialBudgetYen, "一般会計当初予算", y.budget?.sourceRefs ?? [], y);
                const finalBudget = computePerCapitaYen(y.budget?.generalAccountFinalBudgetYen, "一般会計補正後予算", y.budget?.sourceRefs ?? [], y);
                const settlement = computePerCapitaYen(y.budget?.generalAccountSettlementYen, "一般会計決算", y.budget?.sourceRefs ?? [], y);
                if (initial) items.push(`${fiscalYearLabel(y.fiscalYear)}の${describePerCapita(initial, "一人当たり当初予算")}`);
                if (finalBudget) items.push(`${fiscalYearLabel(y.fiscalYear)}の${describePerCapita(finalBudget, "一人当たり補正後予算")}`);
                if (settlement) items.push(`${fiscalYearLabel(y.fiscalYear)}の${describePerCapita(settlement, "一人当たり決算額")}`);
                if (items.length === 0) items.push(`${fiscalYearLabel(y.fiscalYear)}：金額または人口が未確認のため算出していません`);
                return items;
              }).map((text, i) => <li key={i}>{text}</li>)}
            </ul>
          </SectionCard>
        </>
      )}
    </div>
  );
}
