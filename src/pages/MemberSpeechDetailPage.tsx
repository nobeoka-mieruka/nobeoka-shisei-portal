import { Link, useLocation, useParams } from "react-router-dom";
import membersData from "../data/members.json";
import councilSessionsData from "../data/councilSessions.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import type { CouncilMember, CouncilSession, CouncilSpeechSummaryData } from "../types";
import { BackLink } from "../components/BackLink";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SpeechSummaryStatusBadge } from "../components/council/SpeechSummaryStatusBadge";
import { findPublishedSpeech } from "../lib/councilSpeeches";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const members = membersData as CouncilMember[];
const councilSessions = councilSessionsData as CouncilSession[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 一般質問・質疑の詳細ページ。
 *
 * 現時点ではcouncilSpeechSummaries.jsonにisPublished:trueのレコードが1件も存在しないため、
 * このページは常に「見つかりませんでした」を表示する（将来、公式会議録本文の解析結果が
 * 承認・公開された時点で、実際の内容が表示されるようになる）。
 */
export function MemberSpeechDetailPage() {
  const { memberId, speechId } = useParams<{ memberId: string; speechId: string }>();
  const location = useLocation();
  const member = members.find((m) => m.id === memberId);
  const speech = member && speechId ? findPublishedSpeech(speechSummaryData, member.id, speechId) : undefined;
  const seo = getSeoForPath(location.pathname);

  usePageTitle();

  if (!member || !speech) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to={member ? `/members/${member.id}` : "/"} label={member ? `${member.name}議員のページに戻る` : "トップに戻る"} />
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
      <BackLink to={`/members/${member.id}`} label={`${member.name}議員のページに戻る`} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-surface-container-lowest px-2.5 py-0.5 text-xs font-semibold text-on-surface">
            {speech.speechType}
          </span>
          <SpeechSummaryStatusBadge status={speech.summaryStatus} />
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
        掲載している質問・答弁の要約は、延岡市議会が公開する公式会議録を基にAIで作成し、確認状況を表示しています。原文のすべての文脈や表現を再現するものではありません。正式な発言内容は公式会議録をご確認ください。
      </p>

      <SectionCard title="質問項目">
        <ul className="space-y-4">
          {speech.questionItems.map((q, i) => (
            <li key={q.id} className="rounded-lg border border-outline-variant p-3">
              <p className="text-sm font-semibold text-on-surface">
                質問{i + 1}　{q.title}
              </p>
              <p className="mt-2 text-xs font-medium text-on-surface-variant">質問の要点</p>
              <p className="text-sm leading-relaxed text-on-surface">{q.questionSummary}</p>
              <p className="mt-2 text-xs font-medium text-on-surface-variant">
                市の答弁の要点{q.answerers && q.answerers.length > 0 && `（答弁者：${q.answerers.join("、")}）`}
              </p>
              <p className="text-sm leading-relaxed text-on-surface">{q.answerSummary}</p>
            </li>
          ))}
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

      <Link to={`/members/${member.id}`} className={`text-sm font-medium text-primary hover:underline ${linkClass}`}>
        {member.name}議員のページに戻る
      </Link>
    </div>
  );
}
