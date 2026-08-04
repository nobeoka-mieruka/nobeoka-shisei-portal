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
import { ChartBarIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatOkuYenOrConfirming, fiscalYearLabel, sortedFiscalYears } from "../lib/archiveFinance";
import { parseCompareSelection, buildCompareSearchParams, MIN_COMPARE_ITEMS } from "../lib/archiveCompare";
import { financeMetricsByGroup, financeMetricByKey } from "../lib/archiveFinanceMetrics";
import { formatPerCapitaYen } from "../lib/archivePerCapita";

const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]).filter((y) => y.debt);
const yearIds = archiveFiscalYears.map((y) => String(y.fiscalYear));
const debtMetrics = financeMetricsByGroup("debt");

export function CompareDebtPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();
  const [metricKey, setMetricKey] = useState<string>("debtIssuance");

  const selected = parseCompareSelection(searchParams, yearIds, "years");
  const selectedRows = archiveFiscalYears
    .filter((y) => selected.includes(String(y.fiscalYear)))
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  const handleChange = (ids: string[]) => setSearchParams(buildCompareSearchParams(ids, "years"), { replace: true });
  const activeMetric = financeMetricByKey(metricKey) ?? debtMetrics[0];

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
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市債の比較</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          市債の発行額（フロー）と年度末残高（ストック）は別の数値です。残高は資料により一般会計・普通会計・特別会計含む・企業会計含む・一人当たりの5区分があり、定義が異なる数値を同一グラフで直接比較していません。市債の増減は市長個人だけの成果・責任ではありません。
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
          <SectionCard title="比較結果（市債発行額）">
            <FinanceBarChart
              points={selectedRows.map((y) => ({
                label: fiscalYearLabel(y.fiscalYear),
                value: y.debt?.municipalBondIssuanceYen ?? null,
              }))}
              formatValue={(v) => formatOkuYenOrConfirming(v)}
              ariaLabel="選択した年度の市債発行額の比較棒グラフ。詳細は直後の表を参照してください。"
            />
            <CompareTable
              caption="選択した年度の市債発行額・年度末残高（区分別）"
              rows={selectedRows}
              rowKey={(y) => String(y.fiscalYear)}
              columns={[
                { header: "年度", render: (y) => fiscalYearLabel(y.fiscalYear) },
                { header: "発行額", align: "right", render: (y) => formatOkuYenOrConfirming(y.debt?.municipalBondIssuanceYen) },
                { header: "一般会計残高", align: "right", render: (y) => formatOkuYenOrConfirming(y.debt?.balance.generalAccountBondBalanceYen) },
                { header: "普通会計残高", align: "right", render: (y) => formatOkuYenOrConfirming(y.debt?.balance.ordinaryAccountLocalBondBalanceYen) },
                {
                  header: "一人当たり（元資料掲載値）",
                  align: "right",
                  render: (y) => (y.debt?.balance.perCapitaYen != null ? formatPerCapitaYen(y.debt.balance.perCapitaYen) : "確認中"),
                },
              ]}
            />
          </SectionCard>

          <SectionCard title="区分を選んで比較（発行額・残高）">
            <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
              「定義が異なるため単純比較できません」：発行額（フロー）と残高（ストック）、また残高の会計区分同士は、下のグラフでも常に別系列として扱っています。
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="市債区分の切り替え">
              {debtMetrics.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetricKey(m.key)}
                  aria-pressed={metricKey === m.key}
                  className={`min-h-[36px] rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
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
