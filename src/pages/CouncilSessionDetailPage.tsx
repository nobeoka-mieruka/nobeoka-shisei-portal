import { Link, useLocation, useParams } from "react-router-dom";
import councilSessionsData from "../data/councilSessions.json";
import billVotesData from "../data/billVotes.json";
import type { BillVoteItem, CouncilSession } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { CouncilDocumentCard } from "../components/council/CouncilDocumentCard";
import { SessionSummaryStatusBadge } from "../components/council/SessionSummaryStatusBadge";
import { councilDocumentCategoryLabels, councilDocumentCategoryOrder, publicDocuments } from "../lib/councilDocuments";
import { billsForSession, sessionBillStats, sessionSummaryStatusLabels } from "../lib/councilSessions";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";
import { GlobeIcon } from "../components/icons";

const councilSessions = councilSessionsData as CouncilSession[];
const billVotes = billVotesData as BillVoteItem[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function formatSessionPeriod(session: CouncilSession): string {
  if (session.startDate && session.endDate) {
    return `${formatJapaneseDate(session.startDate)}～${formatJapaneseDate(session.endDate)}`;
  }
  if (session.startDate) return `${formatJapaneseDate(session.startDate)}～（会期終了日は確認中）`;
  return "確認中";
}

export function CouncilSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const session = councilSessions.find((s) => s.id === sessionId);
  const seo = getSeoForPath(location.pathname);

  usePageTitle();

  if (!session) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to="/council-documents" label="定例会・議会資料一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された定例会の情報は見つかりませんでした。
        </p>
      </div>
    );
  }

  const visibleDocuments = publicDocuments(session.documents);
  const documentsByCategory = councilDocumentCategoryOrder
    .map((category) => ({ category, documents: visibleDocuments.filter((d) => d.category === category) }))
    .filter((group) => group.documents.length > 0);

  const sessionBills = billsForSession(billVotes, session);
  const stats = sessionBillStats(sessionBills);
  const summaryStatus = session.summaryStatus;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/council-documents" label="定例会・議会資料一覧に戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            session.sessionType === "定例会"
              ? "bg-surface-container-lowest text-on-surface"
              : "bg-tertiary-container text-on-tertiary-container"
          }`}
        >
          {session.sessionType}
        </span>
        <h1 className="mt-2 text-xl font-semibold leading-snug text-on-primary-container sm:text-2xl">
          {session.title}
        </h1>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm text-on-primary-container/80 sm:grid-cols-2">
          <div>
            <dt className="inline text-xs">会期：</dt>
            <dd className="inline">{formatSessionPeriod(session)}</dd>
          </div>
          <div>
            <dt className="inline text-xs">登録資料数：</dt>
            <dd className="inline">{visibleDocuments.length}件</dd>
          </div>
          <div>
            <dt className="inline text-xs">最終更新日：</dt>
            <dd className="inline">{session.lastVerified ? formatJapaneseDate(session.lastVerified) : "確認中"}</dd>
          </div>
        </dl>
        {session.officialSessionUrl && (
          <a
            href={session.officialSessionUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="延岡市議会公式サイトの定例会関連ページを新しいタブで開く"
            className={`mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
          >
            <GlobeIcon className="h-4 w-4" aria-hidden="true" />
            延岡市議会公式サイトで確認する
          </a>
        )}
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        掲載しているPDFは、延岡市議会および延岡市が公開している公式資料を、市民が確認しやすいよう定例会ごとに整理したものです。資料の内容は変更せず掲載しています。最新情報および正式な内容については、延岡市議会公式サイトもあわせてご確認ください。当サイトは、特定の議員、会派、政党、議案への支持・反対を目的とするものではありません。
      </p>

      <SectionCard title="この会期の概要">
        {summaryStatus && summaryStatus !== "unavailable" ? (
          <div className="space-y-3">
            {summaryStatus !== "verified" && <SessionSummaryStatusBadge status={summaryStatus} />}
            <p className="whitespace-pre-line text-sm leading-relaxed text-on-surface">{session.summary}</p>
            {summaryStatus !== "verified" && (
              <p className="rounded-lg bg-surface-container-high p-3 text-xs leading-relaxed text-on-surface-variant">
                この要約は公式資料を基に作成していますが、一部の内容（{sessionSummaryStatusLabels[summaryStatus]}）を確認中です。正式な内容は出典資料をご確認ください。
              </p>
            )}

            {stats && (
              <div className="rounded-lg bg-surface-container-high p-3 text-sm text-on-surface">
                <p className="font-medium">主な件数</p>
                <ul className="mt-1 space-y-0.5 text-xs text-on-surface-variant">
                  <li>登録議案：{stats.registered}件</li>
                  {stats.byResult.map(({ result, count }) => (
                    <li key={result}>
                      {result}：{count}件
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-outline-variant pt-3">
              <p className="text-xs leading-relaxed text-on-surface-variant">
                この要約は延岡市議会が公開している会議録、議案書、審議結果等を基に作成しています。
              </p>
              {session.summarySources && session.summarySources.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {session.summarySources.map((src, i) => {
                    const href = src.filePath ?? src.sourceUrl;
                    return (
                      <li key={`${src.documentId ?? src.title}-${i}`} className="text-xs text-on-surface-variant">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${src.title}を新しいタブで開く`}
                            className={`inline-flex min-h-11 items-center gap-1 text-primary underline ${linkClass}`}
                          >
                            {src.title}
                            {src.page && `（${src.page}ページ）`}
                          </a>
                        ) : (
                          <span>
                            {src.title}
                            {src.page && `（${src.page}ページ）`}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {session.summaryVerifiedAt && (
                <p className="mt-1.5 text-xs text-on-surface-variant">
                  確認日：{formatJapaneseDate(session.summaryVerifiedAt)}
                </p>
              )}
            </div>

            <CorrectionRequestButton
              pageName={`${session.title}の要約`}
              buttonLabel="要約内容の訂正・情報提供"
            />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-on-surface-variant">
            要約作成に必要な公式資料が不足しています。資料を確認でき次第、掲載します。
          </p>
        )}
      </SectionCard>

      {documentsByCategory.length === 0 ? (
        <SectionCard title="議会資料">
          <p className="text-sm leading-relaxed text-on-surface-variant">
            この定例会の資料は現在整理中です。公式資料を確認後、順次掲載します。
          </p>
        </SectionCard>
      ) : (
        documentsByCategory.map((group) => (
          <SectionCard key={group.category} title={councilDocumentCategoryLabels[group.category]}>
            <ul className="space-y-3">
              {group.documents.map((doc) => (
                <CouncilDocumentCard key={doc.id} document={doc} />
              ))}
            </ul>
          </SectionCard>
        ))
      )}

      <SectionCard title="この定例会の議案">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          この定例会で審議された個別の議案・採決結果は「議案ごとの賛否」ページで確認できます。
        </p>
        {sessionBills.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {sessionBills.map((bill) => (
              <li key={bill.id}>
                <Link
                  to={`/bills/votes/${bill.id}`}
                  className={`block rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface transition hover:bg-surface-container ${linkClass}`}
                >
                  <span className="font-medium">{bill.billNumber}</span>
                  <span className="ml-1.5">{bill.billTitle}</span>
                  {bill.result && bill.result !== "確認中" && (
                    <span className="ml-2 text-xs text-on-surface-variant">（{bill.result}）</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          to={`/bills/votes?session=${encodeURIComponent(session.title)}`}
          className={`mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${linkClass}`}
        >
          この定例会の議案一覧を見る
        </Link>
      </SectionCard>

      <div>
        <CorrectionRequestButton pageName={session.title} />
      </div>
    </div>
  );
}
