import { Link, useLocation, useParams } from "react-router-dom";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import archiveMemberTermsData from "../data/archiveMemberTerms.json";
import archiveMemberAffiliationsData from "../data/archiveMemberAffiliations.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import councilSessionsData from "../data/councilSessions.json";
import formerMembersData from "../data/formerMembers.json";
import billVotesData from "../data/billVotes.json";
import { publicBills, billVoteLabels } from "../lib/billVotes";
import type { ArchiveMemberAffiliation, ArchiveMemberProfile, ArchiveMemberTerm } from "../types/historicalArchive";
import type { BillVoteItem, CouncilSession, CouncilSpeechSummaryData, FormerMember } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { BackLink } from "../components/BackLink";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SectionCard } from "../components/SectionCard";
import { EmptyState } from "../components/EmptyState";
import { SourceRefList } from "../components/SourceRefList";
import { ClockIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { evidenceAvailabilityLabel, evidenceAvailabilityDescription } from "../lib/evidenceAvailability";
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
import { PersonTimeline } from "../components/council/PersonTimeline";
import { getPersonTimeline } from "../lib/personTimeline";
import {
  getFormerMemberDataTier,
  FORMER_MEMBER_DATA_TIER_LABELS,
  FORMER_MEMBER_DATA_TIER_DESCRIPTIONS,
  FORMER_MEMBER_DATA_TIER_DISCLAIMER,
} from "../lib/formerMemberActivity";
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
const billVotes = publicBills(billVotesData as BillVoteItem[]);
const billsWithAnyMemberVoteDisclosed = billVotes.filter((b) => b.memberVotes.length > 0).length;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MemberFormerDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  // legacyMemberId（現職）が設定されたプロフィールは対象外とする。archiveMemberProfiles.jsonは
  // 現職・元議員の両方を収録するため、slugの一致だけで検索すると、Phase35で追加した現職議員の
  // プロフィールが「元議員」として誤表示されてしまう（実在の現職議員を誤って元議員扱いする
  // 重大な誤情報になるため、二重にガードする）。
  const profile = profiles.find((p) => p.slug === slug && !p.legacyMemberId);

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
  const partyHistory = affiliationsForMemberProfileByType(affiliations, profile.id, "party");
  const committeeHistory = affiliationsForMemberProfileByType(affiliations, profile.id, "committee");
  const roleHistory = affiliationsForMemberProfileByType(affiliations, profile.id, "councilRole");
  const speeches = speechesForProfile(profile, speechSummaryData);
  const legacyId = profile.legacyFormerMemberId ?? profile.legacyMemberId;
  const formerMemberRecord = profile.legacyFormerMemberId
    ? formerMembers.find((m) => m.id === profile.legacyFormerMemberId)
    : undefined;

  // Phase120で修正：以前はvoteMethod/disclosureStatusの整備前だったため常に(0, 0)で
  // 「議案賛否履歴：収録していません」固定表示だったが、Phase108以降、記名投票の再議2件から
  // 元議員10名全員に個人別賛否データが登録されている。実データを反映する。
  const disclosedVotes = legacyId ? billVotes.filter((b) => b.memberVotes.some((v) => v.memberId === legacyId)) : [];
  const timeline = legacyId ? getPersonTimeline(legacyId) : [];
  // Phase130：データ充足レベル（人物評価ではない。画面上に必ず注記を表示する）。
  const dataTier = getFormerMemberDataTier(new Set(timeline.map((e) => e.eventType)));

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
    calculateVotingDisclosureIndex(disclosedVotes.length, billsWithAnyMemberVoteDisclosed),
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
        { label: "議案賛否履歴", filled: disclosedVotes.length > 0 },
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
          <span
            className="rounded-full bg-tertiary-container px-2.5 py-0.5 text-xs font-semibold text-on-tertiary-container"
            title={FORMER_MEMBER_DATA_TIER_DESCRIPTIONS[dataTier]}
          >
            {FORMER_MEMBER_DATA_TIER_LABELS[dataTier]}
          </span>
        </div>
        {profile.nameKana && <p className="mt-1 text-sm text-on-surface-variant">{profile.nameKana}</p>}
        {profile.notes && <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{profile.notes}</p>}
        <p className="mt-3 rounded-lg bg-surface-container-lowest p-3 text-xs leading-relaxed text-on-surface-variant">
          <strong className="font-semibold text-on-surface">{FORMER_MEMBER_DATA_TIER_LABELS[dataTier]}</strong>
          ：{FORMER_MEMBER_DATA_TIER_DESCRIPTIONS[dataTier]}　{FORMER_MEMBER_DATA_TIER_DISCLAIMER}
        </p>

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

      <SectionCard title="活動タイムライン">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          選挙・任期・委員会所属・一般質問・議案への賛否を、公開資料から確認できた範囲で時系列にまとめたものです。イベントが無い期間を「活動なし」の意味では表示していません。下記の各項目別セクションにも、同じ内容をカテゴリごとに掲載しています。
        </p>
        {timeline.length > 0 ? (
          <PersonTimeline events={timeline} />
        ) : (
          <p className="text-sm text-on-surface-variant">この元議員について、タイムラインの元になる公開資料をまだ確認できていません。</p>
        )}
      </SectionCard>

      <SectionCard title="在籍期間・選挙・任期履歴">
        <div className="mb-3 flex flex-wrap gap-2">
          <span
            className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-medium text-on-primary-container"
            title={evidenceAvailabilityDescription("confirmed")}
          >
            選挙：{evidenceAvailabilityLabel("confirmed")}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              own.length > 0 ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-on-surface-variant"
            }`}
            title={evidenceAvailabilityDescription(own.length > 0 ? "confirmed" : "not_collected")}
          >
            正式な任期開始・終了日：{evidenceAvailabilityLabel(own.length > 0 ? "confirmed" : "not_collected")}
          </span>
        </div>
        {timeline.filter((e) => e.eventType === "election").length > 0 && (
          <p className="mb-2 text-sm text-on-surface">
            {timeline
              .filter((e) => e.eventType === "election")
              .map((e) => e.title)
              .join("／")}
          </p>
        )}
        {own.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            正式な任期開始日・終了日を示す公式資料は確認できていません（選挙当選日を任期開始日として代用することはしていません）。当選の事実そのものは上記「活動タイムライン」の選挙記録でご確認いただけます。「未収録」は、当サイトがこの情報をまだ収集・登録していないことを示し、資料が存在しないと断定するものではありません。
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
          <EmptyState message="会派履歴は資料未確認です。" status="under_review" />
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

      <SectionCard title="党派履歴（選挙時点）">
        <p className="mb-2 text-xs leading-relaxed text-on-surface-variant">
          議会内の会派（上記）とは別に、立候補時の届出党派を選挙結果資料から時系列で示したものです。実際の入党・離党時期とは異なる場合があります。
        </p>
        {partyHistory.length === 0 ? (
          <EmptyState message="党派履歴は資料未確認です。" status="under_review" />
        ) : (
          <ul className="space-y-1 text-sm text-on-surface-variant">
            {partyHistory.map((a) => (
              <li key={a.id}>
                {a.affiliationId}（{formatJapaneseDate(a.startDate)}〜{a.endDate ? formatJapaneseDate(a.endDate) : "現在も届出変更は未確認"}）
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="委員会履歴">
        {committeeHistory.length === 0 ? (
          <EmptyState message="委員会所属履歴は資料未確認です。" status="under_review" />
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
          <EmptyState message="役職履歴は資料未確認です。" status="under_review" />
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
          <EmptyState message="公開している一般質問記録はまだありません。" status="not_collected" />
        ) : (
          <ul className="space-y-2">
            {speeches.map((s) => {
              const session = councilSessions.find((cs) => cs.id === s.sessionId);
              return (
                <li key={s.id}>
                  <Link
                    to={`/members/${legacyId}/questions/${s.id}`}
                    className={`block rounded-lg bg-surface-container-high p-3 text-sm text-primary underline ${linkClass}`}
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
        {disclosedVotes.length === 0 ? (
          <EmptyState message="この元議員について、個人別の議案賛否が公開資料で確認できたものはありません（0件という意味ではなく、公開されている記名投票等の対象に含まれていないためです）。" />
        ) : (
          <ul className="space-y-2">
            {disclosedVotes.map((b) => {
              const vote = b.memberVotes.find((v) => v.memberId === legacyId)!;
              return (
                <li key={b.id} className="rounded-lg bg-surface-container-high p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/bills/votes/${b.id}`} className={`min-w-0 truncate text-on-surface hover:underline ${linkClass}`}>
                      {b.billNumber}　{b.billTitle}
                    </Link>
                    <span className="shrink-0 text-xs text-on-surface-variant">{billVoteLabels[vote.vote]}</span>
                  </div>
                  {(b.memberVoteRecordedDate ?? b.votingDate) && (
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {formatJapaneseDate(b.memberVoteRecordedDate ?? b.votingDate!)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="政策テーマ">
        <EmptyState message="政策データは今後のフェーズで追加予定です（資料未確認）。" status="not_collected" />
      </SectionCard>

      {profile.sourceRefs.length > 0 && (
        <SectionCard title="出典・確認状況">
          <SourceRefList refs={profile.sourceRefs} />
        </SectionCard>
      )}

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName={`${profile.name}（元議員）`} />
      </div>
    </div>
  );
}
