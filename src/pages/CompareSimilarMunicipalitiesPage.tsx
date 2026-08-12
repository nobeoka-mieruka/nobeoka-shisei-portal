import { useLocation } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { CsvDownloadButton } from "../components/CsvDownloadButton";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { similarMunicipalityFinance, computeFieldStats } from "../lib/similarMunicipalityFinance";
import type { CsvColumn } from "../lib/csv";
import type { SimilarMunicipalityFinanceEntry } from "../types/similarMunicipalityFinance";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const fmt = (v: number | null, unit = "") => (v == null ? "確認中" : `${v.toLocaleString("ja-JP")}${unit}`);

const INDICATORS: { field: Parameters<typeof computeFieldStats>[0]; label: string; unit: string }[] = [
  { field: "financialStrengthIndex", label: "財政力指数", unit: "" },
  { field: "ordinaryBalanceRatioPercent", label: "経常収支比率", unit: "%" },
  { field: "realDebtServiceRatioPercent", label: "実質公債費比率", unit: "%" },
  { field: "futureBurdenRatioPercent", label: "将来負担比率", unit: "%" },
  { field: "population", label: "人口", unit: "人" },
];

const CSV_COLUMNS: CsvColumn<SimilarMunicipalityFinanceEntry>[] = [
  { header: "自治体名", value: (m) => m.municipalityName },
  { header: "都道府県", value: (m) => m.prefecture },
  { header: "人口", value: (m) => m.population },
  { header: "財政力指数", value: (m) => m.financialStrengthIndex },
  { header: "経常収支比率(%)", value: (m) => m.ordinaryBalanceRatioPercent },
  { header: "実質公債費比率(%)", value: (m) => m.realDebtServiceRatioPercent },
  { header: "将来負担比率(%)", value: (m) => m.futureBurdenRatioPercent },
];

export function CompareSimilarMunicipalitiesPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const nobeoka = similarMunicipalityFinance.municipalities.find((m) => m.isNobeoka);
  const others = similarMunicipalityFinance.municipalities
    .filter((m) => !m.isNobeoka)
    .sort((a, b) => a.municipalityName.localeCompare(b.municipalityName, "ja"));

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">類似団体（Ⅲ－３）財政比較</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市が属する総務省の類似団体区分「{similarMunicipalityFinance.classificationCode}」（人口・産業構造が近い全国{similarMunicipalityFinance.municipalities.length}自治体）について、{similarMunicipalityFinance.fiscalYear}年度の財政指標を同一資料・同一定義で比較しています。
        </p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        表示している順位・中央値・平均値は事実の集計であり、「良い・悪い」といった評価は当サイトでは行っていません。地方債現在高・基金残高・歳入・歳出は自治体ごとに個別資料の収集が必要なため、延岡市以外は今回未取得です。
      </p>

      <SectionCard title="指標ごとの延岡市の位置">
        <div className="space-y-4">
          {INDICATORS.map(({ field, label, unit }) => {
            const stats = computeFieldStats(field);
            return (
              <div key={field} className="rounded-lg bg-surface-container-low p-3">
                <p className="text-sm font-semibold text-on-surface">{label}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <StatCard label="延岡市" value={fmt(stats.nobeokaValue, unit)} compact />
                  <StatCard label="中央値" value={fmt(stats.median, unit)} compact />
                  <StatCard label="平均値" value={fmt(stats.average, unit)} compact />
                  <StatCard label="最高" value={fmt(stats.max, unit)} compact />
                  <StatCard label="最低" value={fmt(stats.min, unit)} compact />
                </div>
                {stats.nobeokaRankFromLowest != null && (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {stats.count}団体中、値が小さい方から{stats.nobeokaRankFromLowest}番目（同値の場合は同順位）。
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title={`構成自治体一覧（${similarMunicipalityFinance.municipalities.length}団体）`}
        action={
          <CsvDownloadButton
            filename="similar-municipality-finance.csv"
            rows={similarMunicipalityFinance.municipalities}
            columns={CSV_COLUMNS}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs text-on-surface-variant">
                <th className="py-2 pr-2">自治体名</th>
                <th className="py-2 pr-2 text-right">人口</th>
                <th className="py-2 pr-2 text-right">財政力指数</th>
                <th className="py-2 pr-2 text-right">経常収支比率</th>
                <th className="py-2 pr-2 text-right">実質公債費比率</th>
                <th className="py-2 pr-2 text-right">将来負担比率</th>
              </tr>
            </thead>
            <tbody>
              {nobeoka && (
                <tr className="border-b border-outline-variant bg-primary-container/30 font-semibold">
                  <td className="py-2 pr-2">{nobeoka.municipalityName}（当市）</td>
                  <td className="py-2 pr-2 text-right">{fmt(nobeoka.population, "人")}</td>
                  <td className="py-2 pr-2 text-right">{fmt(nobeoka.financialStrengthIndex)}</td>
                  <td className="py-2 pr-2 text-right">{fmt(nobeoka.ordinaryBalanceRatioPercent, "%")}</td>
                  <td className="py-2 pr-2 text-right">{fmt(nobeoka.realDebtServiceRatioPercent, "%")}</td>
                  <td className="py-2 pr-2 text-right">{fmt(nobeoka.futureBurdenRatioPercent, "%")}</td>
                </tr>
              )}
              {others.map((m) => (
                <tr key={m.municipalityCode} className="border-b border-outline-variant text-on-surface-variant">
                  <td className="py-2 pr-2">
                    {m.municipalityName}
                    <span className="ml-1 text-xs">（{m.prefecture}）</span>
                  </td>
                  <td className="py-2 pr-2 text-right">{fmt(m.population, "人")}</td>
                  <td className="py-2 pr-2 text-right">{fmt(m.financialStrengthIndex)}</td>
                  <td className="py-2 pr-2 text-right">{fmt(m.ordinaryBalanceRatioPercent, "%")}</td>
                  <td className="py-2 pr-2 text-right">{fmt(m.realDebtServiceRatioPercent, "%")}</td>
                  <td className="py-2 pr-2 text-right">{fmt(m.futureBurdenRatioPercent, "%")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="出典">
        <ul className="space-y-2 text-xs leading-relaxed text-on-surface-variant">
          {similarMunicipalityFinance.sourceRefs.map((ref, i) => (
            <li key={i}>
              <a href={ref.sourceUrl} target="_blank" rel="noopener noreferrer" className={`text-primary hover:underline ${linkClass}`}>
                {ref.sourceTitle}
              </a>
              （{ref.sourceOrganization}、確認日：{ref.accessedAt}）
              {ref.notes && <p className="mt-1">{ref.notes}</p>}
            </li>
          ))}
        </ul>
      </SectionCard>

      <LastUpdated className="mt-4" />
    </div>
  );
}
