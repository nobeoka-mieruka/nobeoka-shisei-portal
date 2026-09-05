import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useHydratedSearchParams } from "../hooks/useHydratedSearchParams";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import type { ArchiveFiscalYear } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CompareTable } from "../components/compare/CompareTable";
import { FinanceStackedBarChart } from "../components/finance/FinanceStackedBarChart";
import { FinanceMetricSection } from "../components/finance/FinanceMetricSection";
import { CompareItemPicker } from "../components/compare/CompareItemPicker";
import { LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatOkuYenOrConfirming, fiscalYearLabel, sortedFiscalYears } from "../lib/archiveFinance";
import { parseCompareSelection, buildCompareSearchParams, MIN_COMPARE_ITEMS } from "../lib/archiveCompare";
import { financeMetricsByGroup, financeMetricByKey } from "../lib/archiveFinanceMetrics";
import { formatPerCapitaYen } from "../lib/archivePerCapita";

const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]).filter((y) => y.fund);
const yearIds = archiveFiscalYears.map((y) => String(y.fiscalYear));
const fundMetrics = financeMetricsByGroup("fund");

export function CompareFundsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useHydratedSearchParams();
  const [metricKey, setMetricKey] = useState<string>("fiscalAdjustmentFund");

  const selected = parseCompareSelection(searchParams, yearIds, "years");
  const selectedRows = archiveFiscalYears
    .filter((y) => selected.includes(String(y.fiscalYear)))
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  const handleChange = (ids: string[]) => setSearchParams(buildCompareSearchParams(ids, "years"), { replace: true });
  const activeMetric = financeMetricByKey(metricKey) ?? fundMetrics[0];

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/compare" label="比較トップに戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <LandmarkIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">基金の比較</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          年度末の基金残高を、最大4年度まで選んで比較できます。決算未確定の年度は「見込額」と明記し、決算額と区別しています。基金総額と財源調整用基金は定義が異なるため単純比較できません。
        </p>
      </div>

      <SectionCard title="比較する年度を選ぶ">
        <CompareItemPicker
          legend="年度"
          options={archiveFiscalYears.map((y) => ({
            id: String(y.fiscalYear),
            label: fiscalYearLabel(y.fiscalYear),
            sublabel: y.fund?.isEstimate ? "見込額" : undefined,
          }))}
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
          <SectionCard title="比較結果（基金の内訳）">
            <FinanceStackedBarChart
              points={selectedRows.map((y) => ({
                label: `${fiscalYearLabel(y.fiscalYear)}${y.fund?.isEstimate ? "（見込）" : ""}`,
                segments: [
                  {
                    key: "fiscalAdjustment",
                    label: "財源調整用基金",
                    value: y.fund?.balance.fiscalAdjustmentFundYen ?? null,
                    color: "var(--color-primary)",
                  },
                  {
                    key: "other",
                    label: "その他特定目的基金",
                    value: y.fund?.balance.otherSpecificPurposeFundsYen ?? null,
                    color: "var(--color-tertiary)",
                  },
                ],
              }))}
              formatValue={(v) => formatOkuYenOrConfirming(v)}
              ariaLabel="選択した年度の基金内訳の積み上げ比較棒グラフ。詳細は直後の表を参照してください。"
            />
            <CompareTable
              caption="選択した年度の基金残高（財源調整用基金・その他特定目的基金・全体）"
              rows={selectedRows}
              rowKey={(y) => String(y.fiscalYear)}
              columns={[
                { header: "年度", render: (y) => fiscalYearLabel(y.fiscalYear) },
                { header: "財源調整用基金", align: "right", render: (y) => formatOkuYenOrConfirming(y.fund?.balance.fiscalAdjustmentFundYen) },
                { header: "その他特定目的基金", align: "right", render: (y) => formatOkuYenOrConfirming(y.fund?.balance.otherSpecificPurposeFundsYen) },
                { header: "基金全体", align: "right", render: (y) => formatOkuYenOrConfirming(y.fund?.balance.totalYen) },
                {
                  header: "一人当たり（元資料掲載値）",
                  align: "right",
                  render: (y) => (y.fund?.balance.perCapitaYen != null ? formatPerCapitaYen(y.fund.balance.perCapitaYen) : "確認中"),
                },
                { header: "区分", render: (y) => (y.fund?.isEstimate ? "見込額" : "決算額") },
              ]}
            />
          </SectionCard>

          <SectionCard title="区分を選んで比較（財源調整用基金・基金総額）">
            <div className="flex flex-wrap gap-2" role="group" aria-label="基金区分の切り替え">
              {fundMetrics.map((m) => (
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
        </>
      )}
    </div>
  );
}
