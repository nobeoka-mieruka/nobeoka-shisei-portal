import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import councilSessionsData from "../data/councilSessions.json";
import generalQuestionsData from "../data/generalQuestions.json";
import type { CouncilSession, GeneralQuestionItem } from "../types";
import { publicDocuments } from "../lib/councilDocuments";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SessionSummaryStatusBadge } from "../components/council/SessionSummaryStatusBadge";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate, toEraFiscalYearLabel } from "../config/site";
import { getSeoForPath } from "../lib/seo";
import { GlossaryNote } from "../components/GlossaryNote";
import { COUNCIL_GLOSSARY, SOURCE_GLOSSARY } from "../lib/councilGlossary";
import { LATEST_CONFIRMED_SESSION_HEADING, latestConfirmedCouncilSession } from "../lib/councilSessions";
import { scheduledQuestionSessions } from "../lib/generalQuestionStats";
import { UpcomingSessionsNotice } from "../components/council/UpcomingSessionsNotice";

const councilSessions = councilSessionsData as CouncilSession[];
// Phase203：この一覧は「公式資料を確認できた会期」だけを載せている。質問通告書だけが公開されて
// いる会期（＝これから開催される会期）は一覧に現れないため、別枠で状態つきで案内する。
const upcomingScheduledSessions = scheduledQuestionSessions(generalQuestionsData as GeneralQuestionItem[]).filter(
  (s) => s.phase === "upcoming",
);
const latestConfirmedSession = latestConfirmedCouncilSession(councilSessions);

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function sessionNumberValue(session: CouncilSession): number {
  const match = session.sessionNumber?.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

/** 年度内の開催順（4月始まり）。sessionNumberが未確認のデータでも、idの月から並び順を機械的に決められる。 */
function fiscalMonthIndex(session: CouncilSession): number {
  const match = session.id.match(/^\d{4}-(\d{2})/);
  const month = match ? Number(match[1]) : 0;
  return month >= 4 ? month - 4 : month + 8;
}

function compareSessionsInFiscalYear(a: CouncilSession, b: CouncilSession): number {
  return fiscalMonthIndex(a) - fiscalMonthIndex(b) || sessionNumberValue(a) - sessionNumberValue(b) || a.id.localeCompare(b.id);
}

function formatSessionPeriod(session: CouncilSession): string {
  if (session.startDate && session.endDate) {
    return `${formatJapaneseDate(session.startDate)}～${formatJapaneseDate(session.endDate)}`;
  }
  if (session.startDate) return `${formatJapaneseDate(session.startDate)}～（会期は確認中）`;
  return "会期：確認中";
}

interface FiscalYearGroup {
  fiscalYear: number;
  label: string;
  sessions: CouncilSession[];
}

export function CouncilDocumentsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const groups = useMemo<FiscalYearGroup[]>(() => {
    const byYear = new Map<number, CouncilSession[]>();
    for (const s of councilSessions) {
      const list = byYear.get(s.fiscalYear) ?? [];
      list.push(s);
      byYear.set(s.fiscalYear, list);
    }
    return Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([fiscalYear, sessions]) => ({
        fiscalYear,
        label: toEraFiscalYearLabel(fiscalYear),
        sessions: [...sessions].sort(compareSessionsInFiscalYear),
      }));
  }, []);

  return (
    <div className="px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">定例会・議会資料</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市議会の定例会・臨時会ごとに、議案、審議結果、請願・陳情、会議録、市議会だよりなどの公式資料（PDF）を整理して掲載しています。
        </p>
      </div>

      <p className="mb-4 rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        本ページは、延岡市議会および延岡市が公開している会議録、審議結果、市議会だよりなどの
        <span className="font-medium text-on-surface">一次資料</span>
        を、市民が確認しやすいよう定例会ごとに整理したものです。資料の内容は変更せず掲載しています。最新情報および正式な内容については、延岡市議会公式サイトもあわせてご確認ください。当サイトは、特定の議員、会派、政党、議案への支持・反対を目的とするものではありません。
      </p>

      {/* Phase203：一覧に並ぶのは公式資料を確認できた会期だけ。直近の確認済み会期と、
          まだ資料が公開されていない開催予定の会期を、別の見出しで分けて示す。 */}
      {latestConfirmedSession && (
        <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <h2 className="text-sm font-semibold text-on-surface">{LATEST_CONFIRMED_SESSION_HEADING}</h2>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
            <Link to={`/council-documents/${latestConfirmedSession.id}`} className={`text-primary underline ${linkClass}`}>
              {latestConfirmedSession.title}
            </Link>
            （{latestConfirmedSession.sessionType}）— 議案等審議結果などの公式資料を確認できている、いちばん新しい会期です。
          </p>
        </div>
      )}
      <UpcomingSessionsNotice sessions={upcomingScheduledSessions} className="mb-4" />

      {/* Phase141項目7・13：初めて市議会を見る市民向けに、基礎用語をここでまとめて説明する。
          単一情報源はsrc/lib/councilGlossary.ts。 */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <GlossaryNote term="一次資料" definition={SOURCE_GLOSSARY["一次資料"]} />
        <GlossaryNote term="定例会" definition={COUNCIL_GLOSSARY["定例会"]} />
        <GlossaryNote term="臨時会" definition={COUNCIL_GLOSSARY["臨時会"]} />
        <GlossaryNote term="本会議" definition={COUNCIL_GLOSSARY["本会議"]} />
      </div>

      <a
        href="https://www.youtube.com/channel/UCGo355CFS2v2pAjbIkgzSAQ"
        target="_blank"
        rel="noopener noreferrer"
        className={`mb-4 flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface transition hover:bg-surface-container-high ${linkClass}`}
      >
        <span>
          本会議・委員会の様子は、延岡市議会公式YouTubeチャンネルで配信・録画公開されています。
          <span className="mt-0.5 block text-xs text-on-surface-variant">
            外部サイト（YouTube）へ移動します
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-primary">
          ↗
        </span>
      </a>

      {groups.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          定例会・議会資料データを準備中です。公開資料を確認しながら順次追加します。
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group, i) => (
            <details key={group.fiscalYear} open={i === 0} className="group rounded-xl bg-surface-container-low shadow-e1">
              <summary
                className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3.5 text-base font-semibold text-on-surface transition hover:bg-surface-container-high sm:px-5 ${linkClass}`}
              >
                <span>
                  {group.label}
                  <span className="ml-2 text-xs font-normal text-on-surface-variant">
                    （{group.sessions.length}件）
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-on-surface-variant transition group-open:rotate-180">
                  ▼
                </span>
              </summary>
              <ul className="space-y-2 px-3 pb-4 sm:px-4">
                {group.sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      to={`/council-documents/${session.id}`}
                      className={`block rounded-lg bg-surface p-3.5 shadow-e1 transition hover:bg-surface-container sm:p-4 ${linkClass}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-on-surface">{session.title}</p>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            session.sessionType === "定例会"
                              ? "bg-primary-container text-on-primary-container"
                              : "bg-tertiary-container text-on-tertiary-container"
                          }`}
                        >
                          {session.sessionType}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-on-surface-variant">{formatSessionPeriod(session)}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        登録資料数：{publicDocuments(session.documents).length}件／最終更新日：
                        {session.lastVerified ? formatJapaneseDate(session.lastVerified) : "確認中"}
                      </p>
                      {session.summaryStatus !== "verified" && session.summaryStatus && (
                        <SessionSummaryStatusBadge status={session.summaryStatus} className="mt-2" />
                      )}
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-on-surface-variant">
                        {session.shortSummary ?? "この会期の概要は現在整理中です。"}
                      </p>
                      <p className="mt-2 border-t border-outline-variant pt-2 text-sm text-primary">詳細を見る</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}

      <LastUpdated className="mt-6" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="定例会・議会資料" />
      </div>
    </div>
  );
}
