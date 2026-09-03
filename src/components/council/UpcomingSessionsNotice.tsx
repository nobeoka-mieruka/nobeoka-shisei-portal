import { Link } from "react-router-dom";
import {
  LATEST_CONFIRMED_SESSION_HEADING,
  UPCOMING_SESSION_HEADING,
  councilSessionPhaseLabels,
} from "../../lib/councilSessions";
import {
  formatScheduledQuestionPeriod,
  type ScheduledQuestionSession,
} from "../../lib/generalQuestionStats";

/**
 * Phase203：「次回・開催予定の会期」を、直近の確認済み会期と混同しない形で表示する共通部品。
 *
 * 表示するのは、質問通告書（generalQuestions.json）にある実データだけ：
 * 会期名・予定質問件数・質問予定議員数・質問予定日。データに無い情報は表示しない。
 * 会期名・件数・日付をこのファイルへ直接書かない（すべてpropsのsessions経由）。
 */
export function UpcomingSessionsNotice({
  sessions,
  showHeading = true,
  showQuestionsLink = true,
  className = "",
}: {
  sessions: ScheduledQuestionSession[];
  showHeading?: boolean;
  showQuestionsLink?: boolean;
  className?: string;
}) {
  if (sessions.length === 0) return null;

  return (
    <div className={`rounded-xl border border-outline-variant bg-surface-container-low p-4 ${className}`}>
      {showHeading && (
        <h3 className="text-sm font-semibold text-on-surface">{UPCOMING_SESSION_HEADING}</h3>
      )}
      <ul className="mt-2 space-y-3">
        {sessions.map((session) => {
          const period = formatScheduledQuestionPeriod(session);
          return (
            <li key={session.sessionName}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-on-surface">{session.sessionName}</span>
                <span className="rounded-full bg-tertiary-container px-2.5 py-0.5 text-xs font-semibold text-on-tertiary-container">
                  {councilSessionPhaseLabels[session.phase]}
                </span>
              </div>
              <dl className="mt-1 space-y-0.5 text-xs leading-relaxed text-on-surface-variant">
                {period && (
                  <div>
                    <dt className="inline">一般質問の予定日：</dt>
                    <dd className="inline">{period}</dd>
                  </div>
                )}
                <div>
                  <dt className="inline">質問通告書に基づく予定質問：</dt>
                  <dd className="inline">
                    {session.count}件（{session.memberCount}名）
                  </dd>
                </div>
                <div>
                  <dt className="inline">議決結果・会議録：</dt>
                  <dd className="inline">
                    未確認（公式資料が公開され次第、確認のうえ掲載します）
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-on-surface-variant">
        この会期は、公式資料を確認できている「{LATEST_CONFIRMED_SESSION_HEADING}」には含みません。予定日・質問項目は質問通告書の提出時点の内容であり、実際の発言内容とは異なる場合があります。
      </p>
      {showQuestionsLink && (
        <Link
          to="/questions"
          className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          予定されている質問項目を見る
        </Link>
      )}
    </div>
  );
}
