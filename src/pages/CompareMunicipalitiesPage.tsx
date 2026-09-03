import { useLocation } from "react-router-dom";
import { sortedMunicipalityComparisons } from "../lib/municipalityComparison";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CompareTable } from "../components/compare/CompareTable";
import { SourceLink } from "../components/SourceLink";
import { LastUpdatedInfo } from "../components/LastUpdatedInfo";
import { CsvDownloadButton } from "../components/CsvDownloadButton";
import { LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import type { CsvColumn } from "../lib/csv";
import type { MunicipalityComparisonEntry, DatedMetric } from "../types";
import { humanizeDataNote } from "../lib/citizenTermLabels";

function metricCell(metric: DatedMetric, formatValue: (v: number) => string): string {
  if (metric.value === null) return metric.notApplicableReason ? "算定不可" : "確認中";
  return formatValue(metric.value);
}

/** Phase23で追加した任意項目（型ではoptional）向け。フィールド自体が無い場合も「確認中」として扱う。 */
function optionalMetricCell(metric: DatedMetric | undefined, formatValue: (v: number) => string): string {
  if (!metric) return "確認中";
  return metricCell(metric, formatValue);
}

function metricCsvValue(metric: DatedMetric): string | number | null {
  return metric.value;
}

const yen = (v: number) => `${v.toLocaleString("ja-JP")}円`;
const million = (v: number) => `${v.toLocaleString("ja-JP")}百万円`;
const thousand = (v: number) => `${v.toLocaleString("ja-JP")}千円`;
const percent = (v: number) => `${v}%`;

const MUNICIPALITY_CSV_COLUMNS: CsvColumn<MunicipalityComparisonEntry>[] = [
  { header: "自治体名", value: (m) => m.municipality },
  { header: "人口", value: (m) => metricCsvValue(m.population) },
  { header: "人口基準日", value: (m) => m.population.referenceDate },
  { header: "面積(km2)", value: (m) => metricCsvValue(m.areaKm2) },
  { header: "議員定数", value: (m) => metricCsvValue(m.councilSeats) },
  { header: "議員報酬月額(円)", value: (m) => metricCsvValue(m.councilMemberMonthlyYen) },
  { header: "市長給料月額(円)", value: (m) => metricCsvValue(m.mayorMonthlyYen) },
  { header: "副市長給料月額(円)", value: (m) => metricCsvValue(m.deputyMayorMonthlyYen) },
  { header: "教育長給料月額(円)", value: (m) => metricCsvValue(m.superintendentMonthlyYen) },
  { header: "財政力指数", value: (m) => metricCsvValue(m.fiscalStrengthIndex) },
  { header: "財政指標基準年度", value: (m) => m.fiscalStrengthIndex.referenceDate },
  { header: "経常収支比率(%)", value: (m) => (m.currentAccountRatioPercent ? metricCsvValue(m.currentAccountRatioPercent) : null) },
  { header: "実質公債費比率(%)", value: (m) => metricCsvValue(m.realDebtServiceRatioPercent) },
  { header: "将来負担比率(%)", value: (m) => metricCsvValue(m.futureBurdenRatioPercent) },
  { header: "自主財源比率(%)", value: (m) => (m.independentFinancialResourceRatioPercent ? metricCsvValue(m.independentFinancialResourceRatioPercent) : null) },
  { header: "基金残高(百万円)", value: (m) => metricCsvValue(m.fundBalanceMillionYen) },
  { header: "基金残高基準日", value: (m) => m.fundBalanceMillionYen.referenceDate },
  { header: "地方債現在高(千円)", value: (m) => metricCsvValue(m.municipalBondBalanceThousandYen) },
  { header: "地方債現在高基準日", value: (m) => m.municipalBondBalanceThousandYen.referenceDate },
  { header: "歳入総額(千円)", value: (m) => (m.totalRevenueThousandYen ? metricCsvValue(m.totalRevenueThousandYen) : null) },
  { header: "市町村税(千円)", value: (m) => (m.localTaxRevenueThousandYen ? metricCsvValue(m.localTaxRevenueThousandYen) : null) },
  { header: "1人当たり歳入(千円)", value: (m) => (m.perCapitaRevenueThousandYen ? metricCsvValue(m.perCapitaRevenueThousandYen) : null) },
  { header: "1人当たり市税(円)", value: (m) => (m.perCapitaLocalTaxYen ? metricCsvValue(m.perCapitaLocalTaxYen) : null) },
  { header: "1人当たり地方債現在高(千円)", value: (m) => (m.perCapitaBondBalanceThousandYen ? metricCsvValue(m.perCapitaBondBalanceThousandYen) : null) },
  { header: "出典URL", value: (m) => m.sourceRefs.map((s) => s.url) },
  { header: "最終確認日", value: (m) => m.lastVerifiedAt },
];

export function CompareMunicipalitiesPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const municipalities = sortedMunicipalityComparisons();

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
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">
            延岡市と宮崎県内5市の比較
          </h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市と、宮崎市・都城市・日向市・日南市・小林市・西都市を、各市公式資料・宮崎県資料・総務省資料で確認できた範囲で比較します。項目ごとに基準日・対象年度が異なる場合があり、無理に年度をそろえていません。独自の評価・順位付けは行っていません。
        </p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        議員報酬・特別職給料は期末手当を含まない月額です。「確認中」は公式資料に到達できず未確認、「算定不可」は制度上その自治体では比率が算定されない（将来負担額が財源見込額を下回る）ことを示し、意味が異なります。
      </p>

      <div className="flex justify-end">
        <CsvDownloadButton filename="nobeoka-municipality-comparison.csv" rows={municipalities} columns={MUNICIPALITY_CSV_COLUMNS} />
      </div>

      <SectionCard title="人口・面積・議員定数">
        <CompareTable
          caption="延岡市と比較対象5市の人口・面積・議員定数"
          rows={municipalities}
          rowKey={(m) => m.id}
          columns={[
            { header: "自治体", render: (m) => (m.isNobeoka ? `${m.municipality}（当サイト対象）` : m.municipality) },
            { header: "人口", align: "right", render: (m) => metricCell(m.population, (v) => `${v.toLocaleString("ja-JP")}人`) },
            { header: "人口基準日", render: (m) => m.population.referenceDate ?? "確認中" },
            { header: "面積", align: "right", render: (m) => metricCell(m.areaKm2, (v) => `${v}km²`) },
            { header: "議員定数", align: "right", render: (m) => metricCell(m.councilSeats, (v) => `${v}人`) },
          ]}
        />
      </SectionCard>

      <SectionCard title="議員報酬・特別職給料（月額、期末手当は含まない）">
        <CompareTable
          caption="延岡市と比較対象5市の議員報酬・特別職給料月額"
          rows={municipalities}
          rowKey={(m) => m.id}
          columns={[
            { header: "自治体", render: (m) => m.municipality },
            { header: "議員報酬", align: "right", render: (m) => metricCell(m.councilMemberMonthlyYen, yen) },
            { header: "市長給料", align: "right", render: (m) => metricCell(m.mayorMonthlyYen, yen) },
            { header: "副市長給料", align: "right", render: (m) => metricCell(m.deputyMayorMonthlyYen, yen) },
            { header: "教育長給料", align: "right", render: (m) => metricCell(m.superintendentMonthlyYen, yen) },
            { header: "基準日", render: (m) => m.councilMemberMonthlyYen.referenceDate ?? "確認中" },
          ]}
        />
      </SectionCard>

      <SectionCard title="財政指標（令和5年度決算ベース）">
        <CompareTable
          caption="延岡市と比較対象5市の財政力指数・経常収支比率・実質公債費比率・将来負担比率・自主財源比率"
          rows={municipalities}
          rowKey={(m) => m.id}
          columns={[
            { header: "自治体", render: (m) => m.municipality },
            { header: "財政力指数", align: "right", render: (m) => metricCell(m.fiscalStrengthIndex, (v) => v.toFixed(3)) },
            { header: "経常収支比率", align: "right", render: (m) => optionalMetricCell(m.currentAccountRatioPercent, percent) },
            { header: "実質公債費比率", align: "right", render: (m) => metricCell(m.realDebtServiceRatioPercent, percent) },
            { header: "将来負担比率", align: "right", render: (m) => metricCell(m.futureBurdenRatioPercent, percent) },
            { header: "自主財源比率", align: "right", render: (m) => optionalMetricCell(m.independentFinancialResourceRatioPercent, percent) },
          ]}
        />
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          出典：宮崎県「指標でみる宮崎県」市町村編財政。6市とも令和5年度決算・同一資料で年度がそろっています。
        </p>
      </SectionCard>

      <SectionCard title="歳入総額・市町村税（令和5年度決算ベース）">
        <CompareTable
          caption="延岡市と比較対象5市の歳入総額・市町村税収入済額と、それぞれの住民1人当たり額"
          rows={municipalities}
          rowKey={(m) => m.id}
          columns={[
            { header: "自治体", render: (m) => m.municipality },
            { header: "歳入総額", align: "right", render: (m) => optionalMetricCell(m.totalRevenueThousandYen, thousand) },
            { header: "1人当たり歳入", align: "right", render: (m) => optionalMetricCell(m.perCapitaRevenueThousandYen, thousand) },
            { header: "市町村税", align: "right", render: (m) => optionalMetricCell(m.localTaxRevenueThousandYen, thousand) },
            { header: "1人当たり市税", align: "right", render: (m) => optionalMetricCell(m.perCapitaLocalTaxYen, yen) },
          ]}
        />
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          1人当たり額は当サイトの算出値ではなく、出典資料が直接公表している値です（令和5年1月1日現在の住民基本台帳人口を用いて算定されており、上表の「人口」欄の基準日とは異なります）。歳出・財政調整基金単体・標準財政規模は、この出典資料には掲載が無く、当サイトでは未確認です。
        </p>
      </SectionCard>

      <SectionCard title="基金残高・地方債現在高">
        <CompareTable
          caption="延岡市と比較対象5市の基金残高・地方債現在高"
          rows={municipalities}
          rowKey={(m) => m.id}
          columns={[
            { header: "自治体", render: (m) => m.municipality },
            { header: "基金残高", align: "right", render: (m) => metricCell(m.fundBalanceMillionYen, million) },
            { header: "基金残高基準日", render: (m) => m.fundBalanceMillionYen.referenceDate ?? "確認中" },
            { header: "地方債現在高", align: "right", render: (m) => metricCell(m.municipalBondBalanceThousandYen, thousand) },
            { header: "地方債基準日", render: (m) => m.municipalBondBalanceThousandYen.referenceDate ?? "確認中" },
            { header: "1人当たり地方債現在高", align: "right", render: (m) => optionalMetricCell(m.perCapitaBondBalanceThousandYen, thousand) },
          ]}
        />
      </SectionCard>

      <SectionCard title="出典">
        <ul className="space-y-4">
          {municipalities.map((m) => (
            <li key={m.id}>
              <p className="text-sm font-semibold text-on-surface">{m.municipality}</p>
              <ul className="mt-1 space-y-1">
                {m.sourceRefs.map((ref) => (
                  <li key={ref.url}>
                    <SourceLink url={ref.url} label={ref.label} />
                  </li>
                ))}
              </ul>
              {m.notes && <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">{humanizeDataNote(m.notes)}</p>}
              <LastUpdatedInfo verifiedAt={m.lastVerifiedAt} className="mt-1.5" />
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
