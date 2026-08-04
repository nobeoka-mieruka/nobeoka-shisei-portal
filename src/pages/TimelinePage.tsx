import { Link, useLocation } from "react-router-dom";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import type { ArchiveMayor, ArchiveMayorTerm, ArchiveFiscalYear } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { CompareSourceNotice } from "../components/compare/CompareSourceNotice";
import { ClockIcon, LandmarkIcon, YenIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { buildMayorTermEvents, buildFiscalYearEvents, groupEventsByFiscalYear } from "../lib/archiveTimeline";
import { sortedFiscalYears } from "../lib/archiveFinance";

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]);

const timelineEvents = [
  ...buildMayorTermEvents(archiveMayors, archiveMayorTerms),
  ...buildFiscalYearEvents(archiveFiscalYears),
];
const yearGroups = groupEventsByFiscalYear(timelineEvents);

export function TimelinePage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">延岡市政の年表</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          市長任期・年度別財政データを、公式資料で確認できた範囲で年度別に一覧表示します。点数化や評価は行っていません。データが少ない年度は「確認できたデータはまだありません」と表示し、0とは区別しています。
        </p>
      </div>

      {yearGroups.length === 0 && (
        <SectionCard title="年表">
          <p className="text-sm text-on-surface-variant">現在表示できる年表データがありません。</p>
        </SectionCard>
      )}

      {yearGroups.map((group) => (
        <SectionCard key={group.fiscalYear} title={`${group.fiscalYear}年度`}>
          <ul className="space-y-4">
            {group.events.map((event) => (
              <li key={event.id} className="rounded-lg border border-outline-variant p-3">
                <div className="flex items-start gap-2">
                  {event.category === "mayorTerm" ? (
                    <LandmarkIcon className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
                  ) : (
                    <YenIcon className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
                  )}
                  <div className="flex-1">
                    <p className="text-xs text-on-surface-variant">{event.dateLabel}</p>
                    {event.relatedPath ? (
                      <Link to={event.relatedPath} className="text-sm font-semibold text-primary hover:underline">
                        {event.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold text-on-surface">{event.title}</p>
                    )}
                    {event.description && (
                      <p className="mt-1 text-sm text-on-surface-variant">{event.description}</p>
                    )}
                  </div>
                </div>
                <CompareSourceNotice items={[{ label: event.title, sourceRefs: event.sourceRefs }]} className="mt-2" />
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        現在登録されている年表データは限られています（市長任期・年度別財政のみ）。議案・条例・請願・陳情、政策、一般質問等の年表への追加は今後、公式資料で確認できたものから順次行います。
      </p>

      <LastUpdated className="mt-4" />
    </div>
  );
}
