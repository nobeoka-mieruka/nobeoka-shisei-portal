import { Link, useLocation, useParams } from "react-router-dom";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import councilSessionsData from "../data/councilSessions.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import type { CouncilMember, CouncilSession, CouncilSpeechSummaryData, FormerMember } from "../types";
import type { ArchiveMemberProfile } from "../types/historicalArchive";
import { BackLink } from "../components/BackLink";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SpeechSummaryStatusBadge } from "../components/council/SpeechSummaryStatusBadge";
import { findMemberOrFormerLink, findPublishedSpeech } from "../lib/councilSpeeches";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];
const councilSessions = councilSessionsData as CouncilSession[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const EXCHANGE_TYPE_LABELS: Record<string, string> = {
  question: "議員の質問",
  answer: "答弁",
  "follow-up-question": "再質問",
  "follow-up-answer": "再答弁",
};

function exchangeSpeakerLabel(
  exchange: { type: string; speakerId?: string; speakerName?: string },
  memberName: string,
): string {
  if (exchange.type === "question" || exchange.type === "follow-up-question") return memberName;
  return exchange.speakerName ?? "答弁者確認中";
}

/**
 * 一般質問・質疑の詳細ページ。公式会議録本文を基にした確認済み質問・答弁要約
 * （councilSpeechSummaries.json、isPublished:true）を表示する。
 */
export function MemberSpeechDetailPage() {
  const { memberId, speechId } = useParams<{ memberId: string; speechId: string }>();
  const location = useLocation();
  const member = findMemberOrFormerLink(memberId, members, formerMembers, archiveMemberProfiles);
  const speech = member && speechId ? findPublishedSpeech(speechSummaryData, member.id, speechId) : undefined;
  const seo = getSeoForPath(location.pathname);

  usePageTitle();

  if (!member || !speech) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to={member ? member.href : "/"} label={member ? `${member.name}議員のページに戻る` : "トップに戻る"} />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された質問・質疑の要約は見つかりませんでした。
        </p>
      </div>
    );
  }

  const session = councilSessions.find((s) => s.id === speech.sessionId);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to={member.href} label={`${member.name}議員のページに戻る`} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-surface-container-lowest px-2.5 py-0.5 text-xs font-semibold text-on-surface">
            {speech.speechType}
          </span>
          <SpeechSummaryStatusBadge status={speech.summaryStatus} />
          {member.isFormer && (
            <span className="rounded-full bg-surface-container-lowest px-2.5 py-0.5 text-xs font-semibold text-on-surface">
              元議員（当時の在職記録）
            </span>
          )}
        </div>
        <h1 className="mt-2 text-xl font-semibold leading-snug text-on-primary-container sm:text-2xl">
          {member.name}議員の{speech.speechType}
        </h1>
        <p className="mt-2 text-sm text-on-primary-container/80">
          {session?.title ?? speech.sessionId}
          {speech.date && `／${formatJapaneseDate(speech.date)}`}
          {speech.meetingNumber && `／${speech.meetingNumber}`}
        </p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        掲載している質問・答弁の要約は、延岡市議会が公開する公式会議録を基にAIで作成し、確認状況を表示しています。原文のすべての文脈や表現を再現するものではありません。正式な発言内容は公式会議録をご確認ください。収録対象は、令和5年5月15日（令和5年第1回臨時会、現在の議員任期における最初の本会議）以降に開催された本会議です。
      </p>

      <SectionCard title="質問項目">
        <ul className="space-y-5">
          {speech.questionItems.map((q, i) => {
            const isConfirmed = q.questionAnswerLinkStatus === "confirmed" || q.questionAnswerLinkStatus === "partially-confirmed";
            const sortedExchanges = [...q.exchanges].sort((a, b) => a.order - b.order);
            return (
              <li key={q.id} className="rounded-lg border border-outline-variant p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-semibold text-on-surface">
                    質問{i + 1}　{q.title}
                  </p>
                  {!isConfirmed && (
                    <span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs font-medium text-on-secondary-container">
                      対応関係確認中
                    </span>
                  )}
                </div>

                {sortedExchanges.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {sortedExchanges.map((ex, idx) => (
                      <li key={ex.order}>
                        {idx > 0 && (
                          <p className="py-1 text-center text-xs text-on-surface-variant" aria-hidden="true">
                            ↓
                          </p>
                        )}
                        <div className="rounded-lg bg-surface-container-high p-2.5">
                          <p className="text-xs font-medium text-on-surface">
                            【{EXCHANGE_TYPE_LABELS[ex.type] ?? ex.type}】{exchangeSpeakerLabel(ex, member.name)}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-on-surface">{ex.summary}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <>
                    <p className="mt-2 text-xs font-medium text-on-surface-variant">質問の要点</p>
                    <p className="text-sm leading-relaxed text-on-surface">{q.questionSummary}</p>
                    {isConfirmed ? (
                      <>
                        <p className="mt-2 text-xs font-medium text-on-surface-variant">
                          市の答弁の要点{q.answerers && q.answerers.length > 0 && `（答弁者：${q.answerers.join("、")}）`}
                        </p>
                        <p className="text-sm leading-relaxed text-on-surface">{q.answerSummary}</p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">質問と答弁の対応関係を現在確認中です。</p>
                    )}
                  </>
                )}

                {q.questionApproach && (
                  <p className="mt-2 text-xs text-on-surface-variant">質問の取り上げ方：{q.questionApproach}</p>
                )}
                {q.answerStatus && <p className="text-xs text-on-surface-variant">答弁の状態：{q.answerStatus}</p>}
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard title="出典・確認状況">
        <ul className="space-y-1.5 text-xs text-on-surface-variant">
          {speech.summarySources.map((src, i) => (
            <li key={i}>
              {src.sourceUrl ? (
                <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer" className={`text-primary hover:underline ${linkClass}`}>
                  {src.title}
                </a>
              ) : (
                src.title
              )}
              {src.pageFrom && `（${src.pageFrom}${src.pageTo && src.pageTo !== src.pageFrom ? `〜${src.pageTo}` : ""}ページ）`}
            </li>
          ))}
        </ul>
        {speech.verifiedAt && <p className="mt-2 text-xs text-on-surface-variant">確認日：{formatJapaneseDate(speech.verifiedAt)}</p>}
      </SectionCard>

      <div>
        <CorrectionRequestButton pageName={`${member.name}議員の${speech.speechType}要約`} buttonLabel="要約内容の訂正・情報提供" />
      </div>

      <Link to={member.href} className={`text-sm font-medium text-primary hover:underline ${linkClass}`}>
        {member.name}議員のページに戻る
      </Link>
    </div>
  );
}
