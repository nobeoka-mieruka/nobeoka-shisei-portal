import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { sortedCivicTimelineEvents, civicTimelineCategories, civicTimelineDecades } from "../lib/civicTimeline";
import archiveMayorsData from "../data/archiveMayors.json";
import type { ArchiveMayor } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { SourceLink } from "../components/SourceLink";
import { FilterSelect } from "../components/FilterSelect";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { CsvDownloadButton } from "../components/CsvDownloadButton";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import type { CsvColumn } from "../lib/csv";
import type { CivicTimelineEvent } from "../types";

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const mayorById = new Map(archiveMayors.map((m) => [m.id, m]));

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

  const [decade, setDecade] = useState("all");
  const [category, setCategory] = useState("all");

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

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      const matchesDecade = decade === "all" || Math.floor(e.year / 10) * 10 === Number(decade);
      const matchesCategory = category === "all" || e.category === category;
      return matchesDecade && matchesCategory;
    });
  }, [allEvents, decade, category]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市政年表</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市公式ホームページが公表する年表・資料をもとに、市制施行、合併、市庁舎、行政組織、災害、公共事業、教育・福祉・産業に関する主な出来事を年代順に整理しています。当サイトは公式サイトではありません。
        </p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        歴代市長の就任・退任は
        <Link to="/mayors" className={`mx-1 text-primary hover:underline ${linkClass}`}>
          歴代市長アーカイブ
        </Link>
        で別途確認できます。延岡市公式資料で確認できる範囲のみを掲載しており、日付が月までしか判明していない出来事は「〇〇年〇月」と表示しています。
      </p>

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
