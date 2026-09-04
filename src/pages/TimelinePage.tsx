import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import archiveMemberTermsData from "../data/archiveMemberTerms.json";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import generalQuestionsData from "../data/generalQuestions.json";
import archiveCouncilDocumentsData from "../data/archiveCouncilDocuments.json";
import archivePoliciesData from "../data/archivePolicies.json";
import type {
  ArchiveMayor,
  ArchiveMayorTerm,
  ArchiveMemberProfile,
  ArchiveMemberTerm,
  ArchiveFiscalYear,
  ArchiveCouncilDocument,
  ArchivePolicy,
} from "../types/historicalArchive";
import type { GeneralQuestionItem } from "../types";
import type { ArchiveTimelineEventCategory } from "../types/timeline";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { CompareSourceNotice } from "../components/compare/CompareSourceNotice";
import {
  ClockIcon,
  LandmarkIcon,
  YenIcon,
  BriefcaseIcon,
  QuestionMarkCircleIcon,
  DocumentIcon,
  CheckCircleIcon,
} from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  buildMayorTermEvents,
  buildMemberTermEvents,
  buildFinanceMetricEvents,
  buildGeneralQuestionEvents,
  buildCouncilDocumentEvents,
  buildPolicyEvents,
  groupEventsByFiscalYear,
} from "../lib/archiveTimeline";
import { sortedFiscalYears } from "../lib/archiveFinance";
import { humanizeDataNote } from "../lib/citizenTermLabels";

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];
const archiveMemberTerms = archiveMemberTermsData as ArchiveMemberTerm[];
const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]);
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const archiveCouncilDocuments = archiveCouncilDocumentsData as ArchiveCouncilDocument[];
const archivePolicies = archivePoliciesData as ArchivePolicy[];

const timelineEvents = [
  ...buildMayorTermEvents(archiveMayors, archiveMayorTerms),
  ...buildMemberTermEvents(archiveMemberProfiles, archiveMemberTerms),
  ...buildFinanceMetricEvents(archiveFiscalYears),
  ...buildGeneralQuestionEvents(generalQuestions),
  ...buildCouncilDocumentEvents(archiveCouncilDocuments),
  ...buildPolicyEvents(archivePolicies),
];

const CATEGORY_META: Record<ArchiveTimelineEventCategory, { label: string; icon: typeof LandmarkIcon }> = {
  mayorTerm: { label: "市長任期", icon: LandmarkIcon },
  memberTerm: { label: "議員任期", icon: BriefcaseIcon },
  finance: { label: "財政・人口", icon: YenIcon },
  generalQuestion: { label: "一般質問", icon: QuestionMarkCircleIcon },
  councilDocument: { label: "議案・条例・請願・陳情", icon: DocumentIcon },
  policy: { label: "政策", icon: CheckCircleIcon },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as ArchiveTimelineEventCategory[];

export function TimelinePage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [activeCategories, setActiveCategories] = useState<Set<ArchiveTimelineEventCategory>>(new Set(ALL_CATEGORIES));

  const toggleCategory = (category: ArchiveTimelineEventCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const yearGroups = useMemo(
    () => groupEventsByFiscalYear(timelineEvents.filter((e) => activeCategories.has(e.category))),
    [activeCategories],
  );

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
          市長任期・議員任期・一般質問・議案条例請願陳情・政策・財政（人口・予算・決算・市債・基金等）を、公式資料で確認できた範囲で年度別に一覧表示します。点数化や評価は行っていません。データが少ない年度は「確認できたデータはまだありません」と表示し、0とは区別しています。
        </p>
      </div>

      <SectionCard title="カテゴリで絞り込む">
        <div className="flex flex-wrap gap-2" role="group" aria-label="表示するカテゴリの切り替え">
          {ALL_CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            const active = activeCategories.has(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                aria-pressed={active}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  active
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {meta.label}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {yearGroups.length === 0 && (
        <SectionCard title="年表">
          <p className="text-sm text-on-surface-variant">
            {activeCategories.size === 0 ? "カテゴリを1つ以上選んでください。" : "現在表示できる年表データがありません。"}
          </p>
        </SectionCard>
      )}

      {yearGroups.map((group) => (
        <SectionCard
          key={group.fiscalYear}
          title={`${group.fiscalYear}年度`}
          action={
            <Link
              to={`/timeline/${group.fiscalYear}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-surface-container-high px-3 py-1.5 text-xs text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              この年度のタイムラインを見る
            </Link>
          }
        >
          <ul className="space-y-4">
            {group.events.map((event) => {
              const Icon = CATEGORY_META[event.category].icon;
              return (
                <li key={event.id} className="rounded-lg border border-outline-variant p-3">
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
                    {/* Phase192：min-w-0がないと、説明文に英数字の長い連続文字列（資料中の
                        フィールド名等）が含まれる場合にflexアイテムが縮まず、320px幅で右方向へ
                        大きくはみ出す（実測238px）。break-wordsと併せて折り返しを保証する。 */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs break-words text-on-surface-variant">
                        {CATEGORY_META[event.category].label}／{humanizeDataNote(event.dateLabel)}
                      </p>
                      {event.relatedPath ? (
                        <Link
                          to={event.relatedPath}
                          className="inline-flex min-h-11 items-center text-sm font-semibold break-words text-primary underline"
                        >
                          {event.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-on-surface">{event.title}</p>
                      )}
                      {event.description && (
                        <p className="mt-1 text-sm break-words text-on-surface-variant">{humanizeDataNote(event.description)}</p>
                      )}
                    </div>
                  </div>
                  <CompareSourceNotice items={[{ label: event.title, sourceRefs: event.sourceRefs }]} className="mt-2" />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ))}

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        各年度の「この年度のタイムラインを見る」からは、この一覧に無い詳細（財政指標の出典・定義等）も含めて確認できます。
      </p>

      <LastUpdated className="mt-4" />
    </div>
  );
}
