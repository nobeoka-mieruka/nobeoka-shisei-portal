import { useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { sortedCivicTimelineEvents, civicTimelineCategories, civicTimelineDecades, getCivicTimelineEvent } from "../lib/civicTimeline";
import archiveMayorsData from "../data/archiveMayors.json";
import nobeokaCensusPopulationData from "../data/nobeokaCensusPopulation.json";
import type { ArchiveMayor } from "../types/historicalArchive";
import type { NobeokaCensusPopulationData } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { SourceLink } from "../components/SourceLink";
import { FilterSelect } from "../components/FilterSelect";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { CsvDownloadButton } from "../components/CsvDownloadButton";
import { LastUpdated } from "../components/LastUpdated";
import { FinanceLineChart } from "../components/finance/FinanceLineChart";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import type { CsvColumn } from "../lib/csv";
import type { CivicTimelineEvent } from "../types";

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const mayorById = new Map(archiveMayors.map((m) => [m.id, m]));
const nobeokaCensusPopulation = nobeokaCensusPopulationData as NobeokaCensusPopulationData;

/**
 * 「延岡の大きな転換点」。既存civicTimelineEvents.jsonの中から、市政史上の位置づけが
 * 一次・公的資料で説明できるものだけを厳選した（恣意的なランキングではない）。
 * 選定理由はTURNING_POINT_REASONSに記載し、UI側にも表示する。
 */
const TURNING_POINT_IDS = ["civic-002", "civic-008", "civic-150", "civic-108", "civic-034", "civic-036", "civic-048"] as const;
const TURNING_POINT_REASONS: Record<string, string> = {
  "civic-002": "延岡市の始まり（市制施行）。",
  "civic-008": "太平洋戦争末期の空襲。戦後復興の出発点。",
  "civic-150": "市長が住民の直接選挙で選ばれる制度への転換点。",
  "civic-108": "旭化成の工業都市としての発展を後押しした国の指定。",
  "civic-034": "平成の大合併の第一段階（北方町・北浦町編入）。",
  "civic-036": "平成の大合併の完了（北川町編入）、現在の市域が確定。",
  "civic-048": "県北の交通事情を大きく変えた高速道路網の整備。",
};

const DECADE_LABELS: { value: number; label: string }[] = [
  { value: 1930, label: "1930年代" },
  { value: 1940, label: "1940年代" },
  { value: 1950, label: "1950年代" },
  { value: 1960, label: "1960年代" },
  { value: 1970, label: "1970年代" },
  { value: 1980, label: "1980年代" },
  { value: 1990, label: "1990年代" },
  { value: 2000, label: "2000年代" },
  { value: 2010, label: "2010年代" },
  { value: 2020, label: "2020年代" },
];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const HISTORY_CSV_COLUMNS: CsvColumn<CivicTimelineEvent>[] = [
  { header: "年", value: (e) => e.year },
  { header: "日付", value: (e) => e.dateLabel },
  { header: "分類", value: (e) => e.category },
  { header: "タイトル", value: (e) => e.title },
  { header: "概要", value: (e) => e.summary },
  { header: "出典", value: (e) => e.sourceRefs.map((s) => s.url) },
  { header: "確認状況", value: (e) => (e.verificationStatus === "verified" ? "確認済み" : "一部確認済み") },
  { header: "最終確認日", value: (e) => e.lastVerifiedAt },
];

export function HistoryPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();

  const [decade, setDecade] = useState("all");
  const [category, setCategory] = useState("all");
  // 歴代市長ページ（/mayors/:slug）から「この市長の在任期間の出来事だけ見る」形で遷移してきた場合の
  // 絞り込み。relatedPersonIdsは根拠が確認できた場合のみ設定されるため、この絞り込みも
  // 一次資料で確認できた対応関係の範囲に限られる（「在任中に発生した」であり「市長の実績」ではない）。
  const personFilter = searchParams.get("person") ?? "";
  const filterMayor = personFilter ? archiveMayors.find((m) => m.id === personFilter) : undefined;

  const allEvents = sortedCivicTimelineEvents();
  const decades = civicTimelineDecades();
  const latestVerifiedAt = allEvents
    .map((e) => e.lastVerifiedAt)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  const decadeOptions = [
    { value: "all", label: "すべての年代" },
    ...decades.map((d) => ({ value: String(d), label: `${d}年代` })),
  ];
  const categoryOptions = [
    { value: "all", label: "すべての分類" },
    ...civicTimelineCategories.map((c) => ({ value: c, label: c })),
  ];

  const clearPersonFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("person");
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      const matchesDecade = decade === "all" || Math.floor(e.year / 10) * 10 === Number(decade);
      const matchesCategory = category === "all" || e.category === category;
      const matchesPerson = !personFilter || e.relatedPersonIds?.includes(personFilter);
      return matchesDecade && matchesCategory && matchesPerson;
    });
  }, [allEvents, decade, category, personFilter]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市政年表（延岡市政90年）</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          1933年に市となってから、延岡はどのように変わってきたのでしょうか。歴代市長、人口、選挙、産業、合併、道路、災害などの記録を、延岡市公式ホームページ等の公的資料からたどります。当サイトは公式サイトではありません。
        </p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        歴代市長の就任・退任は
        <Link to="/mayors" className={`mx-1 text-primary hover:underline ${linkClass}`}>
          歴代市長アーカイブ
        </Link>
        で、市長ごとの選挙結果・出来事の比較は
        <Link to="/compare/mayors" className={`mx-1 text-primary hover:underline ${linkClass}`}>
          歴代市長の比較
        </Link>
        で確認できます。延岡市公式資料等で確認できる範囲のみを掲載しており、日付が月までしか判明していない出来事は「〇〇年〇月」と表示しています。確認できていない事項は空欄にせず「確認中」「未収集」等で示しています。
      </p>

      <nav aria-label="年代へ移動">
        <p className="mb-2 text-xs font-medium text-on-surface-variant">年代から探す</p>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group">
          {DECADE_LABELS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDecade(decade === String(d.value) ? "all" : String(d.value))}
              aria-pressed={decade === String(d.value)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition ${linkClass} ${
                decade === String(d.value)
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </nav>

      <SectionCard title="延岡の大きな転換点">
        <p className="text-xs leading-relaxed text-on-surface-variant">
          {allEvents.length}件の記録すべてを読む前に、市政史の大きな流れをつかめるよう、一次・公的資料で重要性が説明できる出来事を{TURNING_POINT_IDS.length}件選びました（当サイト独自の順位付け・評価ではありません）。
        </p>
        <ol className="mt-3 space-y-2 border-l-2 border-primary-container pl-3">
          {TURNING_POINT_IDS.map((id) => {
            const ev = getCivicTimelineEvent(id);
            if (!ev) return null;
            return (
              <li key={id} className="relative">
                <p className="text-xs font-medium text-on-surface-variant">{ev.dateLabel}</p>
                <p className="text-sm font-semibold text-on-surface">{ev.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">{TURNING_POINT_REASONS[id]}</p>
              </li>
            );
          })}
        </ol>
      </SectionCard>

      <SectionCard title="延岡市の人口の変化（国勢調査、1920〜2020年）">
        <p className="text-xs leading-relaxed text-on-surface-variant">
          国勢調査とは、総務省が5年ごとに実施する全国一斉の人口調査です。延岡市統計書（延岡市公式資料）が公表する、
          <strong className="font-semibold text-on-surface">現在の市域（2007年3月時点）に組み替えた人口</strong>
          を表示しています。
        </p>
        <div className="mt-3">
          <FinanceLineChart
            points={nobeokaCensusPopulation.series.map((p) => ({
              label: p.eraLabel.replace("年", ""),
              value: p.reconstructedCurrentBoundaryPopulation,
            }))}
            formatValue={(v) => `${v.toLocaleString("ja-JP")}人`}
            ariaLabel="延岡市の国勢調査人口の推移グラフ（1920年〜2020年、現在の市域に組み替えた数値）。詳細は直後の一覧を参照してください。"
          />
        </div>
        <div className="mt-3 space-y-2 rounded-lg bg-surface-container p-3 text-xs leading-relaxed text-on-surface-variant">
          <p>
            <strong className="font-semibold text-on-surface">1980年（昭和55年）の人口について：</strong>
            上のグラフは154,881人（現在の市域に組み替えた人口）です。当時の実際の行政区域（合併前の旧市域）では136,598人でした。市域が異なるため、単純にどちらが「正しい」ということではありません。
          </p>
          <p>
            <strong className="font-semibold text-on-surface">市町村合併について：</strong>
            延岡市は2006年2月20日に北方町・北浦町を、2007年3月31日に北川町を編入しました。合併前後で市域・人口の集計範囲が変わるため、年ごとの単純な人口比較には注意が必要です。人口の増減を特定の市長個人の成果・責任として説明するものではありません。
          </p>
          <p>
            出典：
            <a
              href={nobeokaCensusPopulation.primarySource.url}
              target="_blank"
              rel="noreferrer"
              className={`ml-1 text-primary hover:underline ${linkClass}`}
            >
              {nobeokaCensusPopulation.primarySource.title}
            </a>
            （{nobeokaCensusPopulation.primarySource.organization}、{formatJapaneseDate(nobeokaCensusPopulation.primarySource.accessedAt)}確認）
          </p>
        </div>
      </SectionCard>

      {personFilter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-container p-3 text-sm text-on-primary-container">
          <p>
            {filterMayor ? `${filterMayor.name}市長の在任期間中に発生したことが確認できた出来事のみ表示中` : "指定した人物の在任期間中に発生したことが確認できた出来事のみ表示中"}
            （在任中の出来事であり、その市長が実施した政策・実績を示すものではありません）
          </p>
          <button
            type="button"
            onClick={clearPersonFilter}
            className={`shrink-0 rounded-full bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface hover:opacity-90 ${linkClass}`}
          >
            絞り込みを解除
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="年代" value={decade} onChange={setDecade} options={decadeOptions} />
        <FilterSelect label="分類" value={category} onChange={setCategory} options={categoryOptions} />
        <div className="ml-auto">
          <CsvDownloadButton filename="nobeoka-civic-timeline.csv" rows={filtered} columns={HISTORY_CSV_COLUMNS} />
        </div>
      </div>

      <p className="text-xs text-on-surface-variant" aria-live="polite" aria-atomic="true">
        {allEvents.length}件中{filtered.length}件を表示
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          条件に一致する出来事は見つかりませんでした。
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((event) => (
            <li key={event.id}>
              <SectionCard title={event.title} titleClassName="text-sm font-semibold text-on-surface">
                <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                  <span className="font-medium text-on-surface">{event.dateLabel}</span>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-semibold text-on-surface-variant">
                    {event.category}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-on-surface">{event.summary}</p>
                {event.notes && <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{event.notes}</p>}
                {((event.relatedPersonIds && event.relatedPersonIds.length > 0) ||
                  (event.relatedPages && event.relatedPages.length > 0)) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {event.relatedPersonIds?.map((id) => {
                      const mayor = mayorById.get(id);
                      if (!mayor) return null;
                      return (
                        <Link
                          key={id}
                          to={`/mayors/${mayor.slug}`}
                          className={`rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-medium text-primary hover:underline ${linkClass}`}
                        >
                          {mayor.name}市長の在任中
                        </Link>
                      );
                    })}
                    {event.relatedPages?.map((p) => (
                      <Link
                        key={p.to}
                        to={p.to}
                        className={`rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-medium text-primary hover:underline ${linkClass}`}
                      >
                        {p.label}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="mt-3 space-y-1">
                  {event.sourceRefs.map((ref) => (
                    <SourceLink key={ref.url} url={ref.url} label={ref.label} verifiedAt={event.lastVerifiedAt} />
                  ))}
                </div>
              </SectionCard>
            </li>
          ))}
        </ul>
      )}

      {latestVerifiedAt && (
        <LastUpdated dataAsOfLabel="年表データの最終確認日（最新値）" dataAsOf={formatJapaneseDate(latestVerifiedAt)} />
      )}

      <CorrectionRequestButton pageName="市政年表" />
    </div>
  );
}
