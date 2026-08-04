import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import type { ArchiveFiscalYear } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { FinanceTable } from "../components/finance/FinanceTable";
import { FinanceBarChart } from "../components/finance/FinanceBarChart";
import { CompareItemPicker } from "../components/compare/CompareItemPicker";
import { ChartBarIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  formatOkuYenOrConfirming,
  formatPercentOrConfirming,
  fiscalYearLabel,
  sortedFiscalYears,
} from "../lib/archiveFinance";
import { parseCompareSelection, buildCompareSearchParams, MIN_COMPARE_ITEMS } from "../lib/archiveCompare";

const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]);
const yearIds = archiveFiscalYears.map((y) => String(y.fiscalYear));

type MetricKey = "financialStrengthIndex" | "realDebtServiceRatioPercent" | "futureBurdenRatioPercent" | "currentAccountRatioPercent";

const metricOptions: { key: MetricKey; label: string; format: (v: number | null) => string }[] = [
  { key: "financialStrengthIndex", label: "財政力指数", format: (v) => (v != null ? v.toFixed(2) : "確認中") },
  { key: "realDebtServiceRatioPercent", label: "実質公債費比率", format: formatPercentOrConfirming },
  { key: "futureBurdenRatioPercent", label: "将来負担比率", format: formatPercentOrConfirming },
  { key: "currentAccountRatioPercent", label: "経常収支比率", format: formatPercentOrConfirming },
];

export function CompareFinancePage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();
  const [metric, setMetric] = useState<MetricKey>("financialStrengthIndex");

  const selected = parseCompareSelection(searchParams, yearIds);
  const selectedRows = archiveFiscalYears
    .filter((y) => selected.includes(String(y.fiscalYear)))
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  const handleChange = (ids: string[]) => setSearchParams(buildCompareSearchParams(ids), { replace: true });
  const activeMetric = metricOptions.find((m) => m.key === metric)!;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/compare" label="比較トップに戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">年度別財政の比較</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          人口・予算・市債・基金・財政健全化判断比率を、最大4年度まで選んで一覧で比較できます。市の公式評価がない指標について独自の順位づけ・優劣判定は行っていません。
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

      {selected.length > 0 && selected.length < MIN_COMPARE_ITEMS && (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
          比較には{MIN_COMPARE_ITEMS}件以上の選択が必要です。もう{MIN_COMPARE_ITEMS - selected.length}件選んでください。
        </p>
      )}

      {selectedRows.length >= MIN_COMPARE_ITEMS && (
        <>
          <SectionCard title="財政健全化判断比率等の比較">
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="比較する指標の切り替え">
              {metricOptions.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetric(m.key)}
                  aria-pressed={metric === m.key}
                  className={`min-h-[36px] rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    metric === m.key
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <FinanceBarChart
              points={selectedRows.map((y) => ({
                label: fiscalYearLabel(y.fiscalYear),
                value: y.finance?.[activeMetric.key] ?? null,
              }))}
              formatValue={(v) => activeMetric.format(v)}
              ariaLabel={`選択した年度の${activeMetric.label}の比較棒グラフ。詳細は直後の表を参照してください。`}
            />
          </SectionCard>

          <SectionCard title="年度別 比較表（人口・予算・市債・基金・財政指標）">
            <FinanceTable
              caption="選択した年度の主要財政指標の比較"
              rows={selectedRows}
              rowKey={(y) => String(y.fiscalYear)}
              columns={[
                { header: "年度", render: (y) => fiscalYearLabel(y.fiscalYear) },
                {
                  header: "人口",
                  align: "right",
                  render: (y) => (y.population?.population != null ? `${y.population.population.toLocaleString("ja-JP")}人` : "確認中"),
                },
                { header: "一般会計補正後予算", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.generalAccountFinalBudgetYen) },
                { header: "一般会計決算", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.generalAccountSettlementYen) },
                { header: "市債発行額", align: "right", render: (y) => formatOkuYenOrConfirming(y.debt?.municipalBondIssuanceYen) },
                { header: "基金全体", align: "right", render: (y) => formatOkuYenOrConfirming(y.fund?.balance.totalYen) },
                { header: "財政力指数", align: "right", render: (y) => (y.finance?.financialStrengthIndex != null ? y.finance.financialStrengthIndex.toFixed(2) : "確認中") },
                { header: "実質公債費比率", align: "right", render: (y) => formatPercentOrConfirming(y.finance?.realDebtServiceRatioPercent) },
                { header: "将来負担比率", align: "right", render: (y) => formatPercentOrConfirming(y.finance?.futureBurdenRatioPercent) },
              ]}
            />
            <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
              市債残高は資料により定義が異なるため、この表では発行額（フロー）のみ表示しています。残高（ストック）の区分別比較は
              <Link to="/compare/debt" className="mx-1 text-primary hover:underline">
                市債の比較
              </Link>
              をご覧ください。
            </p>
          </SectionCard>
        </>
      )}
    </div>
  );
}
