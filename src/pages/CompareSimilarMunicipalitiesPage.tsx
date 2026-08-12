import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { CsvDownloadButton } from "../components/CsvDownloadButton";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { similarMunicipalityFinance, computeStatsByAccessor } from "../lib/similarMunicipalityFinance";
import type { CsvColumn } from "../lib/csv";
import type { SimilarMunicipalityFinanceEntry } from "../types/similarMunicipalityFinance";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const fmt = (v: number | null | undefined, unit = "") => (v == null ? "確認中" : `${v.toLocaleString("ja-JP")}${unit}`);

interface IndicatorDef {
  key: string;
  label: string;
  unit: string;
  /** 市民向けの一言説明。価値判断（高い＝良い/悪い等）は含めない。 */
  description: string;
  accessor: (m: SimilarMunicipalityFinanceEntry) => number | null | undefined;
}

const INDICATORS: IndicatorDef[] = [
  {
    key: "financialStrengthIndex",
    label: "財政力指数",
    unit: "",
    description: "自治体が、標準的な行政サービスにかかる費用を自前の税収などでどれくらい賄えるかを示す指数です。1に近いほど自前の財源の割合が高いことを意味します。",
    accessor: (m) => m.financialStrengthIndex,
  },
  {
    key: "ordinaryBalanceRatioPercent",
    label: "経常収支比率",
    unit: "%",
    description: "人件費・扶助費・借金の返済（公債費）など、毎年決まって出ていく経費に、毎年入ってくる使いみちが決まっていない収入（一般財源）をどれくらい充てているかを示す割合です。",
    accessor: (m) => m.ordinaryBalanceRatioPercent,
  },
  {
    key: "realDebtServiceRatioPercent",
    label: "実質公債費比率",
    unit: "%",
    description: "収入に対して、借金（地方債）の返済にどれくらいの負担がかかっているかを示す割合です。地方債の発行に許可が必要になる基準（25%）などが国から示されています。",
    accessor: (m) => m.realDebtServiceRatioPercent,
  },
  {
    key: "futureBurdenRatioPercent",
    label: "将来負担比率",
    unit: "%",
    description: "借金の残高や将来支払う可能性のある負担が、収入に対してどれくらいの規模かを示す割合です。算定方法上、将来の負担より備えの方が大きい場合は「算定なし」またはマイナスの値になることがあります。",
    accessor: (m) => m.futureBurdenRatioPercent,
  },
  {
    key: "population",
    label: "人口",
    unit: "人",
    description: "住民基本台帳に基づく人口です（財政指標とは基準となる日が異なります）。",
    accessor: (m) => m.population,
  },
  {
    key: "fundTotal",
    label: "基金残高（貯金の合計）",
    unit: "円",
    description: "災害や大型事業への備え、将来の借金返済のために積み立てている「貯金」の合計残高です。財政調整基金・減債基金・その他の目的別基金の合計です。",
    accessor: (m) => m.fundBalance?.totalFundBalanceYen,
  },
  {
    key: "fundPerCapita",
    label: "基金残高（住民1人当たり）",
    unit: "円",
    description: "上記の基金残高を人口で割った、住民1人当たりの金額です。自治体の規模の違いを除いて比較する際の参考値です。",
    accessor: (m) => m.fundBalance?.perCapitaTotalFundBalanceYen,
  },
];

const CSV_COLUMNS: CsvColumn<SimilarMunicipalityFinanceEntry>[] = [
  { header: "自治体名", value: (m) => m.municipalityName },
  { header: "都道府県", value: (m) => m.prefecture },
  { header: "人口", value: (m) => m.population },
  { header: "財政力指数", value: (m) => m.financialStrengthIndex },
  { header: "経常収支比率(%)", value: (m) => m.ordinaryBalanceRatioPercent },
  { header: "実質公債費比率(%)", value: (m) => m.realDebtServiceRatioPercent },
  { header: "将来負担比率(%)", value: (m) => m.futureBurdenRatioPercent },
  { header: "基金残高(円)", value: (m) => m.fundBalance?.totalFundBalanceYen ?? null },
  { header: "基金残高・住民1人当たり(円)", value: (m) => m.fundBalance?.perCapitaTotalFundBalanceYen ?? null },
];

export function CompareSimilarMunicipalitiesPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [query, setQuery] = useState("");
  const [miyazakiOnly, setMiyazakiOnly] = useState(false);

  const nobeoka = similarMunicipalityFinance.municipalities.find((m) => m.isNobeoka);

  const others = useMemo(() => {
    return similarMunicipalityFinance.municipalities
      .filter((m) => !m.isNobeoka)
      .filter((m) => !miyazakiOnly || m.prefecture === "宮崎県")
      .filter((m) => !query.trim() || m.municipalityName.includes(query.trim()) || m.prefecture.includes(query.trim()))
      .sort((a, b) => a.municipalityName.localeCompare(b.municipalityName, "ja"));
  }, [query, miyazakiOnly]);

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
        表示している順位・中央値・平均値は事実の集計であり、「良い・悪い」といった評価は当サイトでは行っていません。指標にはそれぞれ異なる意味があり、値が高い・低いことが一律に望ましい／望ましくないとは限りません。地方債現在高・歳入・歳出は、全団体同一定義の資料を今回の調査では見つけられなかったため未掲載です。
      </p>

      <SectionCard title="指標ごとの延岡市の位置">
        <div className="space-y-4">
          {INDICATORS.map(({ key, label, unit, description, accessor }) => {
            const stats = computeStatsByAccessor(accessor);
            return (
              <div key={key} className="rounded-lg bg-surface-container-low p-3">
                <p className="text-sm font-semibold text-on-surface">{label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">{description}</p>
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="自治体名・都道府県名で絞り込み"
            aria-label="自治体名で絞り込み"
            className={`min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant ${linkClass}`}
          />
          <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <input
              type="checkbox"
              checked={miyazakiOnly}
              onChange={(e) => setMiyazakiOnly(e.target.checked)}
              className={`h-4 w-4 ${linkClass}`}
            />
            宮崎県内のみ
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs text-on-surface-variant">
                <th className="py-2 pr-2">自治体名</th>
                <th className="py-2 pr-2 text-right">人口</th>
                <th className="py-2 pr-2 text-right">財政力指数</th>
                <th className="py-2 pr-2 text-right">経常収支比率</th>
                <th className="py-2 pr-2 text-right">実質公債費比率</th>
                <th className="py-2 pr-2 text-right">将来負担比率</th>
                <th className="py-2 pr-2 text-right">基金残高</th>
              </tr>
            </thead>
            <tbody>
              {nobeoka && (!miyazakiOnly || nobeoka.prefecture === "宮崎県") && (
                <tr className="border-b border-outline-variant bg-primary-container/30 font-semibold">
                  <td className="py-2 pr-2">{nobeoka.municipalityName}（当市）</td>
                  <td className="py-2 pr-2 text-right">{fmt(nobeoka.population, "人")}</td>
                  <td className="py-2 pr-2 text-right">{fmt(nobeoka.financialStrengthIndex)}</td>
                  <td className="py-2 pr-2 text-right">{fmt(nobeoka.ordinaryBalanceRatioPercent, "%")}</td>
                  <td className="py-2 pr-2 text-right">{fmt(nobeoka.realDebtServiceRatioPercent, "%")}</td>
                  <td className="py-2 pr-2 text-right">{fmt(nobeoka.futureBurdenRatioPercent, "%")}</td>
                  <td className="py-2 pr-2 text-right">
                    {nobeoka.fundBalance?.totalFundBalanceYen != null
                      ? `${Math.round(nobeoka.fundBalance.totalFundBalanceYen / 1e8).toLocaleString("ja-JP")}億円`
                      : "確認中"}
                  </td>
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
                  <td className="py-2 pr-2 text-right">
                    {m.fundBalance?.totalFundBalanceYen != null
                      ? `${Math.round(m.fundBalance.totalFundBalanceYen / 1e8).toLocaleString("ja-JP")}億円`
                      : "確認中"}
                  </td>
                </tr>
              ))}
              {others.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-xs text-on-surface-variant">
                    条件に一致する自治体がありません。
                  </td>
                </tr>
              )}
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
