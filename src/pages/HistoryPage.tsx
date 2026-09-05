import { useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  sortedCivicTimelineEvents,
  civicTimelineCategories,
  civicTimelineDecades,
  getCivicTimelineEvent,
  civicTimelineEventFiscalYear,
} from "../lib/civicTimeline";
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
import { ImplementationAttributionNote } from "../components/ImplementationAttributionNote";
import { FinanceLineChart } from "../components/finance/FinanceLineChart";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import type { CsvColumn } from "../lib/csv";
import type { CivicTimelineEvent } from "../types";
import { humanizeDataNote } from "../lib/citizenTermLabels";
import { sourceMediumLabel } from "../lib/sourceMedium";
import {
  IMPLEMENTATION_FILTER_LABEL,
  IMPLEMENTATION_FILTER_ORDER,
  IMPLEMENTING_BODY_LABEL,
  NOBEOKA_RELATION_LABEL,
  UNCONFIRMED_IMPLEMENTATION_FILTER,
  implementationFilterValue,
} from "../lib/implementationAttribution";

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
  { header: "日付", value: (e) => humanizeDataNote(e.dateLabel) ?? e.dateLabel },
  { header: "分類", value: (e) => e.category },
  { header: "タイトル", value: (e) => e.title },
  { header: "概要", value: (e) => e.summary },
  // Phase230-231：一次資料で確認できた場合のみ実施主体を書き出す。
  // 未確認を「延岡市」で埋めず「確認中」と明示する。
  {
    header: "実施主体",
    value: (e) => (e.implementation ? IMPLEMENTING_BODY_LABEL[e.implementation.implementingBody] : "確認中"),
  },
  {
    header: "延岡市との関係",
    value: (e) => (e.implementation ? NOBEOKA_RELATION_LABEL[e.implementation.nobeokaRelation] : "確認中"),
  },
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
  // Phase232：実施主体（延岡市／宮崎県／共同／確認中）での絞り込み。既存の年代・分類と
  // 同じFilterSelectに1つ追加するだけで、新しい検索画面は作らない。
  const [implementingBody, setImplementingBody] = useState("all");
  // 歴代市長ページ（/mayors/:slug）から「この市長の在任期間の出来事だけ見る」形で遷移してきた場合の
  // 絞り込み。relatedPersonIdsは根拠が確認できた場合のみ設定されるため、この絞り込みも
  // 一次資料で確認できた対応関係の範囲に限られる（「在任中に発生した」であり「市長の実績」ではない）。
  const personFilter = searchParams.get("person") ?? "";
  const filterMayor = personFilter ? archiveMayors.find((m) => m.id === personFilter) : undefined;

  const allEvents = sortedCivicTimelineEvents();
  const decades = civicTimelineDecades();
  // 実施主体を一次資料で確認できた件数（未確認との違いを件数でも示す）。
  const implementationCount = allEvents.filter((e) => e.implementation).length;
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
  // Phase232：実施主体の選択肢は、実際にデータへ存在する区分だけを件数付きで並べる
  // （該当0件の空の選択肢を作らない）。値は内部コードではなく画面に出さない短い識別子。
  const implementingBodyCounts = new Map<string, number>();
  for (const e of allEvents) {
    const key = implementationFilterValue(e.implementation);
    implementingBodyCounts.set(key, (implementingBodyCounts.get(key) ?? 0) + 1);
  }
  const implementingBodyOptions = IMPLEMENTATION_FILTER_ORDER.filter((v) => implementingBodyCounts.has(v)).map((v) => ({
    value: v,
    label: `${IMPLEMENTATION_FILTER_LABEL[v]}（${implementingBodyCounts.get(v)}件）`,
  }));

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
      const matchesBody = implementingBody === "all" || implementationFilterValue(e.implementation) === implementingBody;
      return matchesDecade && matchesCategory && matchesPerson && matchesBody;
    });
  }, [allEvents, decade, category, personFilter, implementingBody]);

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
        <Link to="/mayors" className={`mx-1 text-primary underline ${linkClass}`}>
          歴代市長アーカイブ
        </Link>
        で、市長ごとの選挙結果・出来事の比較は
        <Link to="/compare/mayors" className={`mx-1 text-primary underline ${linkClass}`}>
          歴代市長の比較
        </Link>
        で確認できます。延岡市公式資料等で確認できる範囲のみを掲載しており、日付が月までしか判明していない出来事は「〇〇年〇月」と表示しています。確認できていない事項は空欄にせず「確認中」「未収集」等で示しています。
      </p>

      {/* Phase230-231：市政年表には延岡市の事業以外（県立施設の設置、県主催の催し等）も含まれる。
          実施主体の表示が無い出来事を「延岡市の事業」と読ませないための説明。 */}
      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        この年表には、延岡市の事業ではない出来事（宮崎県が設置した学校・病院、宮崎県が主催し延岡市が参加した催しなど）も含まれます。一次資料で実施主体を確認できた出来事には「実施主体」「延岡市との関係」を表示しています（{implementationCount}件）。表示が無い出来事は実施主体を確認中であり、延岡市の事業であることを意味しません。延岡市内で行われたことと、延岡市が実施したことは別です。
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
                <p className="text-xs font-medium text-on-surface-variant">{humanizeDataNote(ev.dateLabel)}</p>
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
              className={`ml-1 text-primary underline ${linkClass}`}
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
        {/* Phase232：「延岡市の事業」と「宮崎県の事業」を読み分けられるようにする絞り込み。
            選択肢の文字はすべて市民向けの日本語で、内部コードは表示しない。 */}
        <FilterSelect
          label="実施主体"
          value={implementingBody}
          onChange={setImplementingBody}
          options={implementingBodyOptions}
        />
        <div className="ml-auto">
          <CsvDownloadButton filename="nobeoka-civic-timeline.csv" rows={filtered} columns={HISTORY_CSV_COLUMNS} />
        </div>
      </div>

      <p className="text-xs text-on-surface-variant" aria-live="polite" aria-atomic="true">
        {allEvents.length}件中{filtered.length}件を表示
        {implementingBody !== "all" && `（絞り込み：${IMPLEMENTATION_FILTER_LABEL[implementingBody]}）`}
      </p>

      {/* Phase232：「確認中」で絞り込んだときに、それが「延岡市の事業」の一覧だと
          誤解されないよう、絞り込みの意味をその場で文字で説明する。 */}
      {implementingBody === UNCONFIRMED_IMPLEMENTATION_FILTER && (
        <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
          ここに表示しているのは、実施主体をまだ一次資料で確認できていない出来事です。延岡市の事業であるという意味でも、延岡市の事業ではないという意味でもありません。
        </p>
      )}

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
                  <span className="font-medium text-on-surface">{humanizeDataNote(event.dateLabel)}</span>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-semibold text-on-surface-variant">
                    {event.category}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-on-surface">{humanizeDataNote(event.summary)}</p>
                {/* Phase230-231：延岡市の事業ではない出来事（県立施設・県主催の催し等）を
                    市の事業と誤読させないため、一次資料で実施主体を確認できたものだけ明示する。 */}
                <ImplementationAttributionNote attribution={event.implementation} className="mt-2" />
                {event.notes && <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{humanizeDataNote(event.notes)}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {event.relatedPersonIds?.map((id) => {
                    const mayor = mayorById.get(id);
                    if (!mayor) return null;
                    return (
                      <Link
                        key={id}
                        to={`/mayors/${mayor.slug}`}
                        className={`rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-medium text-primary underline ${linkClass}`}
                      >
                        {mayor.name}市長の在任中
                      </Link>
                    );
                  })}
                  {event.relatedPages?.map((p) => (
                    <Link
                      key={p.to}
                      to={p.to}
                      className={`rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-medium text-primary underline ${linkClass}`}
                    >
                      {p.label}
                    </Link>
                  ))}
                  {/* Phase188：出来事の日付（年、判読できれば月まで）から会計年度を近似し、
                      同じ年度の市長任期・財政・人口・議案・一般質問等をまとめて確認できる
                      年度別ページへ横断的に誘導する（手入力ではなく自動算出）。 */}
                  <Link
                    to={`/timeline/${civicTimelineEventFiscalYear(event)}`}
                    className={`rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-medium text-primary underline ${linkClass}`}
                  >
                    同じ年度の市長・財政・人口等を見る
                  </Link>
                </div>
                {/* Phase228：市政年表の出典には新聞記事も含まれる。報道は一次資料ではないため、
                    公式資料と同じ見た目で「根拠資料」として並べず、文字のラベルで区別する。 */}
                <div className="mt-3 space-y-1">
                  {event.sourceRefs.map((ref) => {
                    const mediumLabel = sourceMediumLabel(ref);
                    return (
                      <div key={ref.url} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <SourceLink url={ref.url} label={ref.label} verifiedAt={event.lastVerifiedAt} />
                        {mediumLabel && (
                          <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface-variant">
                            {mediumLabel}
                          </span>
                        )}
                      </div>
                    );
                  })}
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
