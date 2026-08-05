import { Link, useLocation, useParams } from "react-router-dom";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import archiveMemberTermsData from "../data/archiveMemberTerms.json";
import archiveMemberAffiliationsData from "../data/archiveMemberAffiliations.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import councilSessionsData from "../data/councilSessions.json";
import formerMembersData from "../data/formerMembers.json";
import type { ArchiveMemberAffiliation, ArchiveMemberProfile, ArchiveMemberTerm } from "../types/historicalArchive";
import type { CouncilSession, CouncilSpeechSummaryData, FormerMember } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { BackLink } from "../components/BackLink";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SectionCard } from "../components/SectionCard";
import { EmptyState } from "../components/EmptyState";
import { GlobeIcon, ClockIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { archiveVerificationStatusLabel } from "../lib/archiveMayors";
import {
  affiliationTypeLabel,
  affiliationsForMemberProfileByType,
  archiveMemberStatusLabel,
  speechesForProfile,
  termsForMemberProfile,
} from "../lib/archiveMembers";
import { buildCompareSearchParams } from "../lib/archiveCompare";
import { fiscalYearOfIsoDate } from "../lib/archiveTimeline";
import { personSlug } from "../lib/people";
import { ActivityRadarSection } from "../components/council/ActivityRadarSection";
import {
  calculateAttendanceIndex,
  calculateInformationDisclosureIndex,
  calculateProposalActivityIndex,
  calculateQuestionActivityIndex,
  calculateSpeechActivityIndex,
  calculateVotingDisclosureIndex,
  eligibleSessionIdsFor,
} from "../lib/activityRadar";

const profiles = archiveMemberProfilesData as ArchiveMemberProfile[];
const terms = archiveMemberTermsData as ArchiveMemberTerm[];
const affiliations = archiveMemberAffiliationsData as ArchiveMemberAffiliation[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const councilSessions = councilSessionsData as CouncilSession[];
const formerMembers = formerMembersData as FormerMember[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MemberFormerDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const profile = profiles.find((p) => p.slug === slug);

  if (!profile) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to="/members/former" label="元議員一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された元議員情報は見つかりませんでした。
        </p>
      </div>
    );
  }

  const own = termsForMemberProfile(terms, profile.id);
  const factionHistory = affiliationsForMemberProfileByType(affiliations, profile.id, "faction");
  const committeeHistory = affiliationsForMemberProfileByType(affiliations, profile.id, "committee");
  const roleHistory = affiliationsForMemberProfileByType(affiliations, profile.id, "councilRole");
  const speeches = speechesForProfile(profile, speechSummaryData);
  const legacyId = profile.legacyFormerMemberId ?? profile.legacyMemberId;
  const formerMemberRecord = profile.legacyFormerMemberId
    ? formerMembers.find((m) => m.id === profile.legacyFormerMemberId)
    : undefined;

  // 議会活動データ（レーダーチャート）。在職確認済み会期（formerMembers.jsonのservedSessions）
  // のみを対象期間とする（在職期間全体を保証する記録ではない旨は算定方法ページで説明する）。
  const radarEligibleSessions = eligibleSessionIdsFor({
    isFormerMember: true,
    servedSessions: formerMemberRecord?.servedSessions,
  });
  const radarMetrics = [
    calculateQuestionActivityIndex(speeches, radarEligibleSessions, profile.lastVerifiedAt),
    calculateSpeechActivityIndex(speeches, radarEligibleSessions, profile.lastVerifiedAt),
    calculateAttendanceIndex(),
    calculateVotingDisclosureIndex(0, 0),
    calculateProposalActivityIndex(),
    calculateInformationDisclosureIndex(
      [
        { label: "経歴・概要", filled: !!profile.notes },
        { label: "読み方", filled: !!profile.nameKana },
        { label: "在籍期間・任期履歴", filled: own.length > 0 },
        { label: "会派履歴", filled: factionHistory.length > 0 },
        { label: "委員会履歴", filled: committeeHistory.length > 0 },
        { label: "一般質問履歴", filled: speeches.length > 0 },
        { label: "出典", filled: profile.sourceRefs.length > 0 },
        { label: "議案賛否履歴", filled: false },
      ],
      profile.lastVerifiedAt,
    ),
  ];

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/members/former" label="元議員一覧に戻る" />

      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-on-surface">{profile.name}</h1>
          <span className="rounded-full bg-surface-container-lowest px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
            {archiveMemberStatusLabel(profile.status)}（現職ではありません）
          </span>
        </div>
        {profile.nameKana && <p className="mt-1 text-sm text-on-surface-variant">{profile.nameKana}</p>}
        {profile.notes && <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{profile.notes}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {profile.legacyFormerMemberId && (
            <Link
              to={`/compare/members?${buildCompareSearchParams([personSlug("former-member", profile.legacyFormerMemberId)]).toString()}`}
              className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
            >
              この議員を比較
            </Link>
          )}
          <Link
            to={
              own[0]
                ? `/timeline/${fiscalYearOfIsoDate(own[0].termStart)}`
                : speeches[0]?.date
                  ? `/timeline/${fiscalYearOfIsoDate(speeches[0].date)}`
                  : "/timeline"
            }
            className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
          >
            年表で見る
          </Link>
        </div>
      </section>

      <ActivityRadarSection
        metrics={radarMetrics}
        targetPeriodLabel="在職を確認できた会期（公式会議録で在職・発言を確認できた範囲）"
        updatedAt={profile.lastVerifiedAt}
      />

      <SectionCard title="在籍期間・選挙・任期履歴">
        {own.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            在籍期間・選挙情報は確認中です（公式資料で在職が確認できている会期については下記「一般質問履歴」を参照してください）。
          </p>
        ) : (
          <ul className="space-y-2">
            {own.map((t) => (
              <li key={t.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-on-surface">
                  <ClockIcon className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
                  {t.termNumber ? `第${t.termNumber}期　` : ""}
                  {formatJapaneseDate(t.termStart)}〜{t.termEnd ? formatJapaneseDate(t.termEnd) : "現在"}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  選挙区分：{t.constituency ?? "確認中"}／状態：{t.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="会派履歴">
        {factionHistory.length === 0 ? (
          <EmptyState message="会派履歴は資料未確認です。" />
        ) : (
          <ul className="space-y-1 text-sm text-on-surface-variant">
            {factionHistory.map((a) => (
              <li key={a.id}>
                {a.affiliationId}（{formatJapaneseDate(a.startDate)}〜{a.endDate ? formatJapaneseDate(a.endDate) : "現在"}）
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="委員会履歴">
        {committeeHistory.length === 0 ? (
          <EmptyState message="委員会所属履歴は資料未確認です。" />
        ) : (
          <ul className="space-y-1 text-sm text-on-surface-variant">
            {committeeHistory.map((a) => (
              <li key={a.id}>
                {a.affiliationId}
                {a.role ? `（${a.role}）` : ""}（{formatJapaneseDate(a.startDate)}〜
                {a.endDate ? formatJapaneseDate(a.endDate) : "現在"}）
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="議長・副議長等の役職履歴">
        {roleHistory.length === 0 ? (
          <EmptyState message="役職履歴は資料未確認です。" />
        ) : (
          <ul className="space-y-1 text-sm text-on-surface-variant">
            {roleHistory.map((a) => (
              <li key={a.id}>
                {a.role ?? affiliationTypeLabel(a.affiliationType)}（{formatJapaneseDate(a.startDate)}〜
                {a.endDate ? formatJapaneseDate(a.endDate) : "現在"}）
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="一般質問履歴">
        {speeches.length === 0 ? (
          <EmptyState message="公開している一般質問記録はまだありません。" />
        ) : (
          <ul className="space-y-2">
            {speeches.map((s) => {
              const session = councilSessions.find((cs) => cs.id === s.sessionId);
              return (
                <li key={s.id}>
                  <Link
                    to={`/members/${legacyId}/questions/${s.id}`}
                    className={`block rounded-lg bg-surface-container-high p-3 text-sm text-primary hover:underline ${linkClass}`}
                  >
                    {session?.title ?? s.sessionId}
                    {s.date && `（${formatJapaneseDate(s.date)}）`}の{s.speechType}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="議案賛否履歴">
        <EmptyState message="元議員の議案賛否は現行データでは収録していません（資料未確認）。" />
      </SectionCard>

      <SectionCard title="政策テーマ">
        <EmptyState message="政策データは今後のフェーズで追加予定です（資料未確認）。" />
      </SectionCard>

      {profile.sourceRefs.length > 0 && (
        <SectionCard title="出典・確認状況">
          <ul className="space-y-2">
            {profile.sourceRefs.map((ref, i) => (
              <li key={`${ref.sourceUrl ?? "source"}-${i}`} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {ref.sourceUrl ? (
                    <a
                      href={ref.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${ref.sourceTitle ?? "出典"}を新しいタブで開く`}
                      className={`inline-flex items-center gap-1.5 text-primary hover:underline ${linkClass}`}
                    >
                      <GlobeIcon className="h-4 w-4 shrink-0" aria-hidden />
                      {ref.sourceTitle ?? ref.sourceUrl}
                    </a>
                  ) : (
                    <span className="text-on-surface-variant">{ref.sourceTitle ?? "出典URL未確認"}</span>
                  )}
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                    {archiveVerificationStatusLabel(ref.verificationStatus)}
                  </span>
                </div>
                {ref.notes && <p className="mt-1 text-xs text-on-surface-variant">{ref.notes}</p>}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName={`${profile.name}（元議員）`} />
      </div>
    </div>
  );
}
