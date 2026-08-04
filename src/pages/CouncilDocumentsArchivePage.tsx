import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import archiveCouncilDocumentsData from "../data/archiveCouncilDocuments.json";
import billVotesData from "../data/billVotes.json";
import councilSessionsData from "../data/councilSessions.json";
import generalQuestionsData from "../data/generalQuestions.json";
import archivePoliciesData from "../data/archivePolicies.json";
import type { ArchiveCouncilDocument, ArchiveCouncilDocumentType } from "../types/historicalArchive";
import type { BillVoteItem } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { DocumentIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { archiveVerificationStatusLabel } from "../lib/archiveMayors";
import {
  documentResultLabel,
  documentStatusLabel,
  documentTypeLabel,
  documentsOfType,
  councilVoteLabels,
  ordinanceEffectStatusLabel,
  ordinanceRevisionTypeLabel,
  resolveCouncilVotes,
  resolveDocumentSourceUrl,
} from "../lib/archiveCouncilDocuments";

const archiveCouncilDocuments = archiveCouncilDocumentsData as ArchiveCouncilDocument[];
const billVotes = billVotesData as BillVoteItem[];
const councilSessions = councilSessionsData as { id: string; title: string }[];
const generalQuestions = generalQuestionsData as { id: string; title: string }[];
const archivePolicies = archivePoliciesData as { id: string; title: string; slug: string }[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function sessionTitle(sessionId?: string): string | undefined {
  if (!sessionId) return undefined;
  return councilSessions.find((s) => s.id === sessionId)?.title ?? sessionId;
}

const PROPOSER_TYPE_LABELS: Record<string, string> = {
  mayor: "市長提出",
  member: "議員提出",
  committee: "委員会提出",
  other: "その他",
};

function proposerTypeLabel(type?: string): string {
  if (!type) return "確認中";
  return PROPOSER_TYPE_LABELS[type] ?? type;
}

interface ListPageConfig {
  documentType: ArchiveCouncilDocumentType;
  basePath: string;
  heroTitle: string;
  heroDescription: string;
}

function DocumentsListPage({ documentType, basePath, heroTitle, heroDescription }: ListPageConfig) {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();

  const docs = documentsOfType(archiveCouncilDocuments, documentType);
  const fiscalYearFilter = searchParams.get("fiscalYear") ?? "";
  const sessionFilter = searchParams.get("session") ?? "";
  const resultFilter = searchParams.get("result") ?? "";

  const fiscalYears = [...new Set(docs.map((d) => d.fiscalYear))].sort((a, b) => b - a);
  const sessionIds = [...new Set(docs.map((d) => d.sessionId).filter((s): s is string => Boolean(s)))];
  const results = [...new Set(docs.map((d) => d.result).filter((r): r is NonNullable<typeof r> => Boolean(r)))];

  const filtered = docs.filter((d) => {
    if (fiscalYearFilter && String(d.fiscalYear) !== fiscalYearFilter) return false;
    if (sessionFilter && d.sessionId !== sessionFilter) return false;
    if (resultFilter && d.result !== resultFilter) return false;
    return true;
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <DocumentIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">{heroTitle}</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">{heroDescription}</p>
      </div>

      <div className="mb-1 rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        現在登録している{documentTypeLabel(documentType)}は{docs.length}件です。既存の議案賛否データ（
        <Link to="/bills/votes" className={`text-primary hover:underline ${linkClass}`}>
          /bills/votes
        </Link>
        ）で公式資料を確認できたものから少数ずつ登録しています。未登録は「情報が無い」ことを意味しません。
      </div>

      <SectionCard title="絞り込み">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-on-surface-variant">年度</span>
            <select
              className="min-h-[44px] rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              value={fiscalYearFilter}
              onChange={(e) => updateParam("fiscalYear", e.target.value)}
            >
              <option value="">すべて</option>
              {fiscalYears.map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-on-surface-variant">会期</span>
            <select
              className="min-h-[44px] rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              value={sessionFilter}
              onChange={(e) => updateParam("session", e.target.value)}
            >
              <option value="">すべて</option>
              {sessionIds.map((s) => (
                <option key={s} value={s}>
                  {sessionTitle(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-on-surface-variant">結果</span>
            <select
              className="min-h-[44px] rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              value={resultFilter}
              onChange={(e) => updateParam("result", e.target.value)}
            >
              <option value="">すべて</option>
              {results.map((r) => (
                <option key={r} value={r}>
                  {documentResultLabel(r as ArchiveCouncilDocument["result"])}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
          条件に一致する{documentTypeLabel(documentType)}はまだ登録されていません。
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((doc) => (
            <li key={doc.id}>
              <Link
                to={`${basePath}/${doc.slug}`}
                className={`block rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-on-surface">{doc.title}</p>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                    {doc.result ? documentResultLabel(doc.result) : documentStatusLabel(doc.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {doc.number ? `${doc.number}／` : ""}
                  {doc.fiscalYear}年度
                  {doc.sessionId ? `／${sessionTitle(doc.sessionId)}` : ""}
                  {doc.decisionDate ? `／${doc.decisionDate}` : ""}
                </p>
                <p className="mt-2 text-xs text-on-surface-variant">
                  出典：{doc.sourceRefs.length}件（{archiveVerificationStatusLabel(doc.verificationStatus)}）
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName={heroTitle} />
      </div>
    </div>
  );
}

interface DetailPageConfig {
  documentType: ArchiveCouncilDocumentType;
  basePath: string;
  listLabel: string;
}

function DocumentDetailPage({ documentType, basePath, listLabel }: DetailPageConfig) {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const doc = archiveCouncilDocuments.find((d) => d.documentType === documentType && d.slug === slug);

  if (!doc) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to={basePath} label={`${listLabel}に戻る`} />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された{documentTypeLabel(documentType)}情報は見つかりませんでした。
        </p>
      </div>
    );
  }

  const votes = resolveCouncilVotes(billVotes, doc);
  const sourceUrl = resolveDocumentSourceUrl(billVotes, doc);
  const relatedQuestions = (doc.relatedQuestionIds ?? [])
    .map((id) => generalQuestions.find((q) => q.id === id))
    .filter((q): q is { id: string; title: string } => Boolean(q));
  const relatedPolicies = (doc.relatedPolicyIds ?? [])
    .map((id) => archivePolicies.find((p) => p.id === id))
    .filter((p): p is { id: string; title: string; slug: string } => Boolean(p));
  const relatedOrdinanceIds = doc.ordinanceDetail?.relatedOrdinanceDocumentIds ?? [];
  const relatedOrdinances = relatedOrdinanceIds
    .map((id) => archiveCouncilDocuments.find((d) => d.id === id))
    .filter((d): d is ArchiveCouncilDocument => Boolean(d));

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to={basePath} label={`${listLabel}に戻る`} />

      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-on-surface sm:text-2xl">{doc.title}</h1>
          <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
            {doc.result ? documentResultLabel(doc.result) : documentStatusLabel(doc.status)}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-2">
          <div>
            <dt className="inline">資料番号：</dt>
            <dd className="inline">{doc.number ?? "確認中"}</dd>
          </div>
          <div>
            <dt className="inline">資料種別：</dt>
            <dd className="inline">{documentTypeLabel(doc.documentType)}</dd>
          </div>
          <div>
            <dt className="inline">年度：</dt>
            <dd className="inline">{doc.fiscalYear}年度</dd>
          </div>
          <div>
            <dt className="inline">会期：</dt>
            <dd className="inline">
              {doc.sessionId ? (
                <Link to={`/council-documents/${doc.sessionId}`} className={`text-primary hover:underline ${linkClass}`}>
                  {sessionTitle(doc.sessionId)}
                </Link>
              ) : (
                "確認中"
              )}
            </dd>
          </div>
          <div>
            <dt className="inline">提出日：</dt>
            <dd className="inline">{doc.submittedDate ?? "確認中"}</dd>
          </div>
          <div>
            <dt className="inline">議決日・審査日：</dt>
            <dd className="inline">{doc.decisionDate ?? "確認中"}</dd>
          </div>
          <div>
            <dt className="inline">提出者：</dt>
            <dd className="inline">{proposerTypeLabel(doc.proposerType)}</dd>
          </div>
          <div>
            <dt className="inline">付託委員会：</dt>
            <dd className="inline">{doc.committeeId ?? "確認中"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">概要</h2>
        <p className="mt-2 text-sm leading-loose text-on-surface">{doc.summary}</p>
        {doc.notes && <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{doc.notes}</p>}
      </section>

      {doc.ordinanceDetail && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">条例の区分</h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-2">
            <div>
              <dt className="inline">改廃区分：</dt>
              <dd className="inline">{ordinanceRevisionTypeLabel(doc.ordinanceDetail.revisionType)}</dd>
            </div>
            <div>
              <dt className="inline">効力状況：</dt>
              <dd className="inline">{ordinanceEffectStatusLabel(doc.ordinanceDetail.effectStatus)}</dd>
            </div>
            <div>
              <dt className="inline">公布日：</dt>
              <dd className="inline">{doc.ordinanceDetail.promulgationDate ?? "確認中"}</dd>
            </div>
            <div>
              <dt className="inline">施行日：</dt>
              <dd className="inline">{doc.ordinanceDetail.enforcementDate ?? "確認中"}</dd>
            </div>
          </dl>
          {relatedOrdinances.length > 0 && (
            <div className="mt-2 text-xs text-on-surface-variant">
              関連条例：
              {relatedOrdinances.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && "、"}
                  <Link to={`/ordinances/${o.slug}`} className={`text-primary hover:underline ${linkClass}`}>
                    {o.title}
                  </Link>
                </span>
              ))}
            </div>
          )}
          {(doc.ordinanceDetail.revisionHistory?.length ?? 0) === 0 && (
            <p className="mt-2 text-xs text-on-surface-variant">改正履歴：資料未確認</p>
          )}
        </section>
      )}

      {votes.length > 0 && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">議員別賛否</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            {votes.length}名分の記録があります。詳細は既存の議案賛否ページでご確認ください。
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {votes.slice(0, 6).map((v) => (
              <span key={v.memberId} className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                {v.memberName ?? v.memberId}：{councilVoteLabels[v.vote]}
              </span>
            ))}
            {votes.length > 6 && <span className="text-xs text-on-surface-variant">他{votes.length - 6}名</span>}
          </div>
          {doc.existingBillVoteId && (
            <Link
              to={`/bills/votes/${doc.existingBillVoteId}`}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
            >
              議員別賛否の全件を見る
            </Link>
          )}
        </section>
      )}
      {votes.length === 0 && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">議員別賛否</h2>
          <p className="mt-1 text-xs text-on-surface-variant">資料未確認</p>
        </section>
      )}

      {(relatedQuestions.length > 0 || relatedPolicies.length > 0 || (doc.relatedFiscalYears?.length ?? 0) > 0) && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">関連情報</h2>
          {relatedQuestions.length > 0 && (
            <div className="mt-2 text-sm">
              <p className="text-xs font-medium text-on-surface-variant">関連する一般質問</p>
              <ul className="mt-1 space-y-1">
                {relatedQuestions.map((q) => (
                  <li key={q.id}>
                    <Link to={`/questions/${q.id}`} className={`text-primary hover:underline ${linkClass}`}>
                      {q.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {relatedPolicies.length > 0 && (
            <div className="mt-2 text-sm">
              <p className="text-xs font-medium text-on-surface-variant">関連政策</p>
              <ul className="mt-1 space-y-1">
                {relatedPolicies.map((p) => (
                  <li key={p.id}>
                    <Link to={`/policies/${p.slug}`} className={`text-primary hover:underline ${linkClass}`}>
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(doc.relatedFiscalYears?.length ?? 0) > 0 && (
            <div className="mt-2 text-sm">
              <p className="text-xs font-medium text-on-surface-variant">関連する財政年度</p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {doc.relatedFiscalYears?.map((y) => (
                  <li key={y}>
                    <Link
                      to="/finance/budget"
                      className={`rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-primary hover:underline ${linkClass}`}
                    >
                      {y}年度
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">出典・確認状況</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          全体の確認状況：{archiveVerificationStatusLabel(doc.verificationStatus)}
        </p>
        <ul className="mt-2 space-y-2">
          {doc.sourceRefs.map((ref, i) => (
            <li key={`${ref.sourceUrl ?? "source"}-${i}`} className="text-sm">
              {ref.sourceUrl ? (
                <a
                  href={ref.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-primary hover:underline ${linkClass}`}
                >
                  {ref.sourceTitle ?? ref.sourceUrl}
                </a>
              ) : (
                <span className="text-on-surface-variant">出典URL未確認</span>
              )}
              <span className="ml-2 rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                {archiveVerificationStatusLabel(ref.verificationStatus)}
              </span>
            </li>
          ))}
          {sourceUrl && doc.sourceRefs.every((r) => r.sourceUrl !== sourceUrl) && (
            <li className="text-sm">
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={`text-primary hover:underline ${linkClass}`}>
                審議結果資料（既存議案賛否データより）
              </a>
            </li>
          )}
        </ul>
      </section>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName={`${doc.title}（${documentTypeLabel(doc.documentType)}）`} />
      </div>
    </div>
  );
}

export function BillsArchivePage() {
  return (
    <DocumentsListPage
      documentType="bill"
      basePath="/bills"
      heroTitle="議案アーカイブ"
      heroDescription="議案を公式資料の原文と出典に基づいて整理しています。議員別の賛否は既存の議案賛否ページでご確認いただけます。達成・未達成の独自判定や優劣評価は行っていません。"
    />
  );
}

export function BillArchiveDetailPage() {
  return <DocumentDetailPage documentType="bill" basePath="/bills" listLabel="議案アーカイブ" />;
}

export function OrdinancesPage() {
  return (
    <DocumentsListPage
      documentType="ordinance"
      basePath="/ordinances"
      heroTitle="条例アーカイブ"
      heroDescription="条例の制定・改正・廃止を公式資料の原文と出典に基づいて整理しています。施行日・公布日・現行/失効の状況は確認できたものだけ掲載しています。"
    />
  );
}

export function OrdinanceDetailPage() {
  return <DocumentDetailPage documentType="ordinance" basePath="/ordinances" listLabel="条例アーカイブ" />;
}

export function PetitionsPage() {
  return (
    <DocumentsListPage
      documentType="petition"
      basePath="/petitions"
      heroTitle="請願アーカイブ"
      heroDescription="議員紹介を伴う請願の審査状況を公式資料の原文と出典に基づいて整理しています。請願者が私人の場合、公式サイトで公開されている範囲を超えて氏名等は掲載していません。"
    />
  );
}

export function PetitionDetailPage() {
  return <DocumentDetailPage documentType="petition" basePath="/petitions" listLabel="請願アーカイブ" />;
}

export function RequestsPage() {
  return (
    <DocumentsListPage
      documentType="request"
      basePath="/requests"
      heroTitle="陳情アーカイブ"
      heroDescription="陳情の審査状況を公式資料の原文と出典に基づいて整理しています。陳情者が私人の場合、公式サイトで公開されている範囲を超えて氏名等は掲載していません。"
    />
  );
}

export function RequestDetailPage() {
  return <DocumentDetailPage documentType="request" basePath="/requests" listLabel="陳情アーカイブ" />;
}
