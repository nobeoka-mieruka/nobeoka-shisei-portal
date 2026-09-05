import { useLocation } from "react-router-dom";
import { useHydratedSearchParams } from "../hooks/useHydratedSearchParams";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import type { ArchiveFiscalYear } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { FinanceTable } from "../components/finance/FinanceTable";
import { FinanceLineChart } from "../components/finance/FinanceLineChart";
import { CompareItemPicker } from "../components/compare/CompareItemPicker";
import { LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { fiscalYearLabel, sortedFiscalYears } from "../lib/archiveFinance";
import { parseCompareSelection, buildCompareSearchParams, MIN_COMPARE_ITEMS } from "../lib/archiveCompare";

const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]).filter((y) => y.population);
const yearIds = archiveFiscalYears.map((y) => String(y.fiscalYear));

export function ComparePopulationPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useHydratedSearchParams();

  const selected = parseCompareSelection(searchParams, yearIds, "years");
  const selectedRows = archiveFiscalYears
    .filter((y) => selected.includes(String(y.fiscalYear)))
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  const handleChange = (ids: string[]) => setSearchParams(buildCompareSearchParams(ids, "years"), { replace: true });

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
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">人口の比較</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市の人口を、最大4年度まで選んで比較できます。基準日は資料により1月1日・7月1日等が混在するため、各年度の基準日を必ずご確認ください。
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
        <SectionCard title="比較結果">
          <FinanceLineChart
            points={selectedRows.map((y) => ({
              // Phase216：yearを渡すことで、連続していない年度を選んだ場合に線でつながなくなる
              //（間の年度の値を確認していないため、直線で結ぶと推移を推定したように見えてしまう）。
              year: y.fiscalYear,
              label: fiscalYearLabel(y.fiscalYear),
              value: y.population?.population ?? null,
            }))}
            formatValue={(v) => `${v.toLocaleString("ja-JP")}人`}
            ariaLabel="選択した年度の人口の推移グラフ。グラフ直後の年度別一覧に各年度の値を掲載しています。"
          />
          <FinanceTable
            caption="選択した年度の人口・世帯数・基準日"
            rows={selectedRows}
            rowKey={(y) => String(y.fiscalYear)}
            columns={[
              { header: "年度", render: (y) => fiscalYearLabel(y.fiscalYear) },
              {
                header: "人口",
                align: "right",
                render: (y) => (y.population?.population != null ? `${y.population.population.toLocaleString("ja-JP")}人` : "確認中"),
              },
              {
                header: "世帯数",
                align: "right",
                render: (y) => (y.population?.households != null ? `${y.population.households.toLocaleString("ja-JP")}世帯` : "確認中"),
              },
              { header: "基準日", render: (y) => y.population?.referenceDate ?? "確認中" },
            ]}
          />
        </SectionCard>
      )}
    </div>
  );
}
