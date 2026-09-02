import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import billVotesData from "../data/billVotes.json";
import generalQuestionsData from "../data/generalQuestions.json";
import mayorPromisesData from "../data/mayorPromises.json";
import councilSessionsData from "../data/councilSessions.json";
import type { BillMemberVoteStatus, BillVoteItem, CouncilSession, GeneralQuestionItem, MayorPromisesData } from "../types";
import { SectionCard } from "../components/SectionCard";
import { BackLink } from "../components/BackLink";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LastUpdated } from "../components/LastUpdated";
import { BillVoteBadge } from "../components/bills/BillVoteBadge";
import {
  billVoteLabels,
  committeeFlowStatus,
  memberVotesUnavailableReason,
  publicBills,
  verificationStatusOf,
} from "../lib/billVotes";
import { getCommitteeByName } from "../lib/committees";
import { VerificationStatusBadge } from "../components/bills/VerificationStatusBadge";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { GlobeIcon } from "../components/icons";
import { getSeoForPath } from "../lib/seo";
import { ReviewFlowTimeline } from "../components/bills/ReviewFlowTimeline";
import { GlossaryNote } from "../components/GlossaryNote";
import { COUNCIL_GLOSSARY } from "../lib/councilGlossary";
import { BillCategoryNotice, BillResultOutcomeNotice } from "../components/bills/BillCategoryNotice";
import { BILL_EXPLANATION_LEVEL_DESCRIPTION, BILL_EXPLANATION_LEVEL_LABEL, getBillExplanationLevel } from "../lib/billSummaryQuality";

const billVotes = publicBills(billVotesData as BillVoteItem[]);
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const councilSessions = councilSessionsData as CouncilSession[];
const mayorPromises = (mayorPromisesData as MayorPromisesData).promises;

const voteOrder: BillMemberVoteStatus[] = [
  "approve",
  "oppose",
  "abstained",
  "departed",
  "absent",
  "recused",
  "notVoting",
  "unconfirmed",
];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

interface DocumentLink {
  label: string;
  url: string;
  sourceType: string;
}

function collectDocuments(bill: BillVoteItem): DocumentLink[] {
  const docs: DocumentLink[] = [];
  if (bill.billDocumentUrl) docs.push({ label: "議案書", url: bill.billDocumentUrl, sourceType: "議案書" });
  if (bill.resultDocumentUrl) docs.push({ label: "議決結果", url: bill.resultDocumentUrl, sourceType: "議決結果" });
  if (bill.transcriptUrl) docs.push({ label: "会議録", url: bill.transcriptUrl, sourceType: "会議録" });
  if (bill.committeeDocumentUrl)
    docs.push({ label: "委員会資料", url: bill.committeeDocumentUrl, sourceType: "委員会資料" });
  if (bill.budgetDocumentUrl) docs.push({ label: "予算資料", url: bill.budgetDocumentUrl, sourceType: "予算資料" });
  if (bill.videoUrl) docs.push({ label: "議会中継・録画", url: bill.videoUrl, sourceType: "議会中継" });
  for (const d of bill.relatedDocumentUrls ?? []) {
    docs.push({ label: d.title, url: d.url, sourceType: d.sourceType ?? "関連資料" });
  }
  return docs;
}

interface CouncilDocumentLink {
  /** PDFを開くURL。sourcePageが分かる場合は #page=N を付与する（対応ブラウザでは該当ページへ直接移動する）。 */
  url: string;
  /** 延岡市議会公式サイト上のURL（storageTypeがlocalの場合のみ、urlとは別に案内する）。 */
  officialUrl?: string;
  title: string;
  sessionId: string;
  sessionTitle: string;
  sourcePage?: number;
}

/** 議案データのsessionId/sourceDocumentIdから、対応する定例会資料PDFへのリンクを解決する（確認できた場合のみ）。 */
function resolveCouncilDocumentLink(bill: BillVoteItem): CouncilDocumentLink | undefined {
  if (!bill.sessionId) return undefined;
  const session = councilSessions.find((s) => s.id === bill.sessionId);
  if (!session) return undefined;
  const doc = bill.sourceDocumentId
    ? session.documents.find((d) => d.id === bill.sourceDocumentId)
    : session.documents.find((d) => d.category === "results");
  const isLocal = doc?.storageType === "local";
  const baseUrl = (isLocal ? doc.filePath : doc?.sourceUrl) ?? bill.sourceFilePath;
  if (!baseUrl) return undefined;
  const sourcePage = bill.sourcePage;
  // ブラウザによってはPDFの#page=フラグメントに対応していないため、画面上にも該当ページ数を文字で併記する。
  const url = sourcePage != null ? `${baseUrl}#page=${sourcePage}` : baseUrl;
  return {
    url,
    officialUrl: isLocal ? doc?.sourceUrl : undefined,
    title: doc?.title ?? "議案等審議結果",
    sessionId: session.id,
    sessionTitle: session.title,
    sourcePage,
  };
}

export function BillVoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const bill = billVotes.find((b) => b.id === id);
  const seo = getSeoForPath(location.pathname);
  const [copied, setCopied] = useState(false);

  usePageTitle();

  if (!bill) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <BackLink to="/bills/votes" label="議案・賛否一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された議案データは見つかりませんでした。
        </p>
      </div>
    );
  }

  const documents = collectDocuments(bill);
  const councilDocumentLink = resolveCouncilDocumentLink(bill);
  const committeeForBill = bill.committee ? getCommitteeByName(bill.committee) : undefined;
  const flowStatus = committeeFlowStatus(bill, billVotes);
  const isPetitionLike = bill.category === "請願" || bill.category === "陳情";
  const relatedQuestions = (bill.relatedQuestionIds ?? [])
    .map((qId) => generalQuestions.find((q) => q.id === qId))
    .filter((q): q is GeneralQuestionItem => !!q);
  const relatedPromises = (bill.relatedMayorPromiseIds ?? [])
    .map((pId) => mayorPromises.find((p) => p.id === pId))
    .filter((p): p is (typeof mayorPromises)[number] => !!p);
  const hasOverview =
    bill.reason ||
    (bill.mainChanges && bill.mainChanges.length > 0) ||
    bill.citizenImpact ||
    bill.relatedBudgetSummary ||
    (bill.relatedOrdinances && bill.relatedOrdinances.length > 0) ||
    (bill.topics && bill.topics.length > 0);
  const hasRelated =
    (bill.relatedQuestionIds && bill.relatedQuestionIds.length > 0) ||
    (bill.relatedCommitteeActivityIds && bill.relatedCommitteeActivityIds.length > 0) ||
    (bill.relatedMayorPromiseIds && bill.relatedMayorPromiseIds.length > 0) ||
    (bill.relatedFinanceItems && bill.relatedFinanceItems.length > 0);
  const relatedBills = (bill.relatedBillIds ?? [])
    .map((id) => billVotes.find((b) => b.id === id))
    .filter((b): b is BillVoteItem => !!b);

  const verification = verificationStatusOf(bill);
  const isVerified = verification === "verified";
  // Phase142：「出典が紐付いていること」と「本文を読んで確認したこと」は別軸。
  // どこまで確認済みかを4段階（Level0〜3）で示す。単一情報源はsrc/lib/billSummaryQuality.ts。
  const explanationLevel = getBillExplanationLevel(bill);
  const isManualSummary = bill.summarySource === "manual";

  const sessionBills = billVotes.filter((b) => b.session === bill.session);
  const idx = sessionBills.findIndex((b) => b.id === bill.id);
  const prevBill = idx > 0 ? sessionBills[idx - 1] : undefined;
  const nextBill = idx >= 0 && idx < sessionBills.length - 1 ? sessionBills[idx + 1] : undefined;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードAPIが使えない環境では何もしない
    }
  };

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6 print:space-y-3 print:px-0 print:py-0">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink to="/bills/votes" label="議案・賛否一覧に戻る" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`rounded-full border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
          >
            {copied ? "コピーしました" : "このページのURLをコピー"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className={`rounded-full border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
          >
            印刷
          </button>
        </div>
      </div>

      {/* 確認状況の注意表示（確認済み以外の場合のみ） */}
      {!isVerified && (
        <div className="rounded-2xl border-2 border-tertiary bg-tertiary-container p-4 text-on-tertiary-container shadow-e1 sm:p-5">
          <div className="flex items-center gap-2">
            <VerificationStatusBadge bill={bill} className="!bg-surface-container-lowest !text-on-surface" />
            <p className="text-sm font-semibold">この案件は現在確認作業中です</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed">
            {bill.verificationNote ??
              "この案件は公式資料の記載が複雑なため、現在確認作業中です。議会全体の結果や個人別表決の一部に、未確定の項目があります。正式な内容は延岡市議会の公式資料をご確認ください。"}
          </p>
        </div>
      )}

      {/* 議案基本情報 */}
      <div className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6 print:rounded-none print:border print:border-outline-variant print:shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-on-surface-variant">{bill.billNumber}</p>
          <VerificationStatusBadge bill={bill} />
        </div>
        <h1 className="mt-1 text-xl font-semibold text-on-surface sm:text-2xl">{bill.billTitle}</h1>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-on-surface-variant">年度</dt>
            <dd className="text-on-surface">{bill.fiscalYear}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">定例会・臨時会</dt>
            <dd className="text-on-surface">{bill.session}</dd>
          </div>
          {bill.submittedDate && (
            <div>
              <dt className="text-xs text-on-surface-variant">提出日</dt>
              <dd className="text-on-surface">{formatJapaneseDate(bill.submittedDate)}</dd>
            </div>
          )}
          {bill.votingDate && (
            <div>
              <dt className="text-xs text-on-surface-variant">議決日</dt>
              <dd className="text-on-surface">{formatJapaneseDate(bill.votingDate)}</dd>
            </div>
          )}
          {bill.proposer && (
            <div>
              <dt className="text-xs text-on-surface-variant">提出者</dt>
              <dd className="text-on-surface">{bill.proposer}</dd>
            </div>
          )}
          {bill.committee && (
            <div>
              <dt className="text-xs text-on-surface-variant">担当委員会</dt>
              <dd className="text-on-surface">
                {committeeForBill ? (
                  <Link to={`/committees/${committeeForBill.id}`} className={`text-primary underline ${linkClass}`}>
                    {bill.committee}
                  </Link>
                ) : (
                  bill.committee
                )}
              </dd>
            </div>
          )}
          {bill.voteMethod && (
            <div>
              <dt className="text-xs text-on-surface-variant">採決方法</dt>
              <dd className="text-on-surface">{bill.voteMethod}</dd>
            </div>
          )}
          {bill.effectiveDate && (
            <div>
              <dt className="text-xs text-on-surface-variant">施行日</dt>
              <dd className="text-on-surface">{bill.effectiveDate}</dd>
            </div>
          )}
          {bill.submittingDepartment && (
            <div>
              <dt className="text-xs text-on-surface-variant">担当課</dt>
              <dd className="text-on-surface">{bill.submittingDepartment}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-on-surface-variant">議決結果</dt>
            <dd className="font-medium text-on-surface">{bill.result}</dd>
          </div>
          {bill.lastVerified && (
            <div>
              <dt className="text-xs text-on-surface-variant">最終確認日</dt>
              <dd className="text-on-surface">{formatJapaneseDate(bill.lastVerified)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Phase161：意見書・決議・請願・陳情は市長提出の条例・予算議案とは性質が異なるため、
          カテゴリ専用の案内文を表示する（該当しない案件では何も表示しない）。 */}
      <BillCategoryNotice bill={bill} />

      {/* 審査の流れ */}
      <SectionCard title="審査の流れ">
        <ReviewFlowTimeline bill={bill} allBills={billVotes} />
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <GlossaryNote
            term="委員会付託"
            definition="議案を本会議で全議員が審議する前に、専門的に扱う委員会（総務政策・産業建設・厚生教育など）へ審査を委ねることです。"
          />
          <GlossaryNote
            term="付託省略"
            definition="人事案件や専決処分の承認など、内容が明確な議案について、委員会での審査を経ずに本会議で直接採決することです。議長の提案に議員から異議がない場合に決定します。"
          />
          {flowStatus === "confirmed" && (
            <GlossaryNote
              term="委員長報告"
              definition="委員会での審査が終わった後、本会議で委員長が審査の経過と結果を全議員に報告することです。この報告の後に、本会議での採決が行われます。"
            />
          )}
          {bill.result === "継続審査" && (
            <GlossaryNote
              term="継続審査"
              definition="今の会期中に結論を出さず、次の会期以降も審査を続けることです。否決ではなく、審査が完了していない状態を示します。"
            />
          )}
          {isPetitionLike && (
            <GlossaryNote
              term="採択・不採択"
              definition="請願・陳情に対する議会の判断です。「採択」は内容に賛成し実現を求めること、「不採択」は実現を求めないことを意味します。「一部採択」「趣旨採択」は、内容の一部または趣旨のみに賛成する判断です。"
            />
          )}
          {/* Phase161：意見書・決議・請願・陳情は、市長提出議案とは制度上の位置づけが異なるため、
              単一情報源であるCOUNCIL_GLOSSARY（src/lib/councilGlossary.ts）から該当する用語のみを表示する。 */}
          {bill.category && COUNCIL_GLOSSARY[bill.category] && (
            <GlossaryNote term={bill.category} definition={COUNCIL_GLOSSARY[bill.category]} />
          )}
          {/* Phase141項目6：議決結果の用語を、実際にこの議案が該当するものだけ表示する
              （存在しない語の説明を大量追加しない）。単一情報源はsrc/lib/councilGlossary.ts。
              「不認定」は文字列として「認定」を含むため、「不認定」に一致した場合は
              「認定」（逆の意味）を重複表示しないよう除外する。 */}
          {!isPetitionLike &&
            bill.result !== "継続審査" &&
            Object.entries(COUNCIL_GLOSSARY)
              .filter(([term]) => bill.result.includes(term))
              .filter(([term]) => !(term === "認定" && bill.result.includes("不認定")))
              .map(([term, definition]) => <GlossaryNote key={term} term={term} definition={definition} />)}
        </div>
      </SectionCard>

      {/* 議案の概要 */}
      <SectionCard title="議案の概要">
        <div className="space-y-3">
          {/* Phase142：この議案の説明が「どこまで確認済みか」を4段階で明示する。
              出典が紐付いているだけの状態（Level1）と、一次資料本文まで確認した状態（Level2・3）を
              区別する。単一情報源はsrc/lib/billSummaryQuality.ts。 */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                explanationLevel >= 3
                  ? "bg-primary-container text-on-primary-container"
                  : explanationLevel >= 2
                    ? "bg-tertiary-container text-on-tertiary-container"
                    : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              確認状況：{BILL_EXPLANATION_LEVEL_LABEL[explanationLevel]}
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant">{BILL_EXPLANATION_LEVEL_DESCRIPTION[explanationLevel]}</p>

          {/* Phase141項目17・18／Phase142：定型説明（Level0・1）は「機械的に組み立てた説明」である旨を、
              独自要約（Level3、summarySource: "manual"）は「一次資料をもとにしたこのサイトによる要約」で
              あり公式の要約ではない旨を、それぞれ正しく区別して明示する。公式資料そのものと
              誤認されないようにするため。 */}
          {isManualSummary ? (
            <p className="text-[11px] text-on-surface-variant">
              ※この説明は、会議録等の一次資料本文をもとに、当サイトが市民向けに整理したものです（延岡市議会が公式に作成した要約ではありません）。詳しい内容は下記の根拠資料（会議録・PDF等）でご確認ください。
            </p>
          ) : (
            <p className="text-[11px] text-on-surface-variant">
              ※この概要は、議案名・提出者・議決結果などから当サイトが機械的に組み立てた説明です。延岡市議会が公式に作成した要約ではありません。詳しい内容は下記の出典PDF（原資料）でご確認ください。
            </p>
          )}
          <p className="text-sm leading-relaxed text-on-surface">{bill.summary}</p>
          {bill.reason && (
            <div>
              <p className="text-xs font-medium text-on-surface-variant">提出理由</p>
              <p className="mt-1 text-sm leading-relaxed text-on-surface">{bill.reason}</p>
            </div>
          )}
          {bill.mainChanges && bill.mainChanges.length > 0 && (
            <div>
              <p className="text-xs font-medium text-on-surface-variant">主な変更内容</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-on-surface">
                {bill.mainChanges.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {bill.citizenImpact && (
            <div>
              <p className="text-xs font-medium text-on-surface-variant">市民生活への影響</p>
              <p className="mt-1 text-sm leading-relaxed text-on-surface">{bill.citizenImpact}</p>
            </div>
          )}
          {bill.relatedBudgetSummary && (
            <div>
              <p className="text-xs font-medium text-on-surface-variant">関連する予算</p>
              <p className="mt-1 text-sm leading-relaxed text-on-surface">{bill.relatedBudgetSummary}</p>
            </div>
          )}
          {bill.relatedOrdinances && bill.relatedOrdinances.length > 0 && (
            <div>
              <p className="text-xs font-medium text-on-surface-variant">関連条例</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-on-surface">
                {bill.relatedOrdinances.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          {bill.topics && bill.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {bill.topics.map((t) => (
                <span key={t} className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        {!hasOverview && explanationLevel >= 2 && (
          <p className="mt-1 text-xs text-on-surface-variant">
            一次資料本文（会議録等）は確認しましたが、この議案固有の提案理由等の記載は見当たりませんでした。推測で補うことはしていません。
          </p>
        )}
        {!hasOverview && explanationLevel < 2 && (
          <p className="mt-1 text-xs text-on-surface-variant">概要以外の項目は公開資料で確認でき次第、追加します。</p>
        )}
      </SectionCard>

      {/* 議決結果 */}
      <SectionCard title="議決結果">
        <p className="text-xs text-on-surface-variant">議会全体の結果</p>
        <p className="text-2xl font-bold text-on-surface">{bill.result}</p>
        {/* Phase161：「撤回」「廃案」を、議会が内容に反対した「否決」や請願・陳情の「不採択」と
            明確に区別して案内する（既存のresultフィールドの値のみを用いる）。 */}
        <BillResultOutcomeNotice bill={bill} />
        {!isVerified && (
          <p className="mt-1 text-xs text-on-surface-variant">
            {bill.unresolvedFields?.includes("result")
              ? "資料の表現が複合的なため、結果区分を確認中です。上記は現時点で読み取れた表記です。"
              : "確認中の項目があります。"}
          </p>
        )}
        {bill.memberVotes.length > 0 && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {voteOrder.map((v) => {
              const count = bill.memberVotes.filter((mv) => mv.vote === v).length;
              return (
                <div key={v} className="rounded-lg bg-surface-container-high p-2 text-center">
                  <p className="text-xs text-on-surface-variant">{billVoteLabels[v]}</p>
                  <p className="mt-0.5 text-lg font-semibold text-on-surface">{count}</p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* 議員別賛否 */}
      <SectionCard title="議員別の賛否">
        {bill.memberVoteRecordedDate && bill.memberVoteRecordedDate !== bill.votingDate && (
          <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
            ※上記の議決日（{bill.votingDate && formatJapaneseDate(bill.votingDate)}）は議案の主たる議決日です。以下の議員別の賛否は、
            {formatJapaneseDate(bill.memberVoteRecordedDate)}に実施された採決（再議等）の記録です。
          </p>
        )}
        {bill.memberVotes.length > 0 ? (
          <ul className="space-y-2">
            {bill.memberVotes.map((v) => (
              <li
                key={v.memberId}
                className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3"
              >
                <div className="min-w-0">
                  <Link
                    to={`/members/${v.memberId}`}
                    className={`text-sm font-medium text-primary underline ${linkClass}`}
                  >
                    {v.memberName}
                  </Link>
                  <p className="text-xs text-on-surface-variant">{v.faction}</p>
                </div>
                <BillVoteBadge vote={v.vote} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-surface-container-high/70 px-3 py-2.5 text-xs leading-relaxed text-on-surface-variant">
            {memberVotesUnavailableReason(bill)}
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          議長は通常、可否同数の場合などを除き採決に加わらない場合があります。欠席、退席、除斥、採決時の在席状況などにより、議員数と賛否数の合計が一致しない場合があります。
        </p>
      </SectionCard>

      {/* 根拠資料 */}
      {documents.length > 0 && (
        <SectionCard title="根拠資料">
          <ul className="space-y-3">
            {documents.map((d, i) => (
              <li key={`${d.url}-${i}`} className="border-b border-outline-variant pb-3 last:border-0 last:pb-0">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${d.label}を新しいタブで開く`}
                  className={`inline-flex items-center gap-1.5 text-sm text-primary underline ${linkClass}`}
                >
                  <GlobeIcon className="h-4 w-4" />
                  {d.label}
                </a>
                <p className="mt-1 text-xs text-on-surface-variant">
                  資料種別：{d.sourceType}／公表機関：延岡市議会
                  {bill.lastVerified && `／確認日：${formatJapaneseDate(bill.lastVerified)}`}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* 定例会資料PDFとの連携 */}
      {councilDocumentLink && (
        <SectionCard title="掲載されている定例会資料">
          <p className="text-sm leading-relaxed text-on-surface">
            この議案は「{councilDocumentLink.sessionTitle}」の資料「{councilDocumentLink.title}」に掲載されています。
            {councilDocumentLink.sourcePage != null && `（該当ページ：${councilDocumentLink.sourcePage}ページ目）`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={councilDocumentLink.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="この議案が掲載されているPDFを新しいタブで開く"
              className={`inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${linkClass}`}
            >
              この議案が掲載されているPDFを開く
            </a>
            {councilDocumentLink.officialUrl && (
              <a
                href={councilDocumentLink.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="延岡市議会公式サイトでこの資料を確認する（新しいタブで開く）"
                className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
              >
                公式サイトで確認する
              </a>
            )}
            <Link
              to={`/council-documents/${councilDocumentLink.sessionId}`}
              className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
            >
              同じ定例会の資料を見る
            </Link>
          </div>
        </SectionCard>
      )}

      {/* 関連する議案（改正の履歴等） */}
      {relatedBills.length > 0 && (
        <SectionCard title="関連する議案">
          <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
            {bill.relationStatus === "confirmed"
              ? "人が確認し、関連を確定した議案です。"
              : "議案名が同じ条例名を含むことなどから機械的に抽出した候補です。同一の条例改正であると断定するものではありません。"}
          </p>
          <ul className="space-y-2">
            {relatedBills.map((rb) => (
              <li key={rb.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant p-3">
                <div className="min-w-0">
                  <p className="text-xs text-on-surface-variant">{rb.billNumber}／{rb.session}</p>
                  <Link to={`/bills/votes/${rb.id}`} className={`text-sm font-medium text-primary underline ${linkClass}`}>
                    {rb.billTitle}
                  </Link>
                </div>
                <Link
                  to={`/bills/compare?left=${encodeURIComponent(bill.id)}&right=${encodeURIComponent(rb.id)}`}
                  className={`shrink-0 rounded-full border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
                >
                  比較する
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* 関連情報 */}
      <SectionCard title="関連情報">
        {hasRelated ? (
          <ul className="space-y-2 text-sm">
            {relatedQuestions.map((q) => (
              <li key={q.id}>
                <Link to={`/questions/${q.id}`} className={`text-primary underline ${linkClass}`}>
                  関連する一般質問：{q.title}（{q.memberName}議員）
                </Link>
              </li>
            ))}
            {bill.relatedCommitteeActivityIds && bill.relatedCommitteeActivityIds.length > 0 && (
              <li className="text-on-surface-variant">
                関連する委員会活動（{bill.relatedCommitteeActivityIds.length}件）※委員会活動データベースは準備中です
              </li>
            )}
            {relatedPromises.map((p) => (
              <li key={p.id}>
                <Link to={`/mayor/policy-progress/${p.id}`} className={`text-primary underline ${linkClass}`}>
                  関連する市長公約：{p.promiseText}
                </Link>
              </li>
            ))}
            {bill.relatedFinanceItems && bill.relatedFinanceItems.length > 0 && (
              <li>
                <Link to="/finance" className={`text-primary underline ${linkClass}`}>
                  関連する予算・財政情報：{bill.relatedFinanceItems.join("、")}
                </Link>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">関連情報は登録されていません</p>
        )}
      </SectionCard>

      {/* 前後の議案 */}
      {(prevBill || nextBill) && (
        <div className="flex flex-wrap items-stretch justify-between gap-2 print:hidden">
          {prevBill ? (
            <Link
              to={`/bills/votes/${prevBill.id}`}
              className={`min-w-0 flex-1 rounded-xl bg-surface-container-low p-3 text-sm shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
            >
              <span className="block text-xs text-on-surface-variant">前の議案</span>
              <span className="block truncate font-medium text-on-surface">{prevBill.billTitle}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {nextBill ? (
            <Link
              to={`/bills/votes/${nextBill.id}`}
              className={`min-w-0 flex-1 rounded-xl bg-surface-container-low p-3 text-right text-sm shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
            >
              <span className="block text-xs text-on-surface-variant">次の議案</span>
              <span className="block truncate font-medium text-on-surface">{nextBill.billTitle}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </div>
      )}

      {bill.lastVerified && (
        <LastUpdated dataAsOfLabel="この議案データの最終確認日" dataAsOf={formatJapaneseDate(bill.lastVerified)} />
      )}

      <div className="print:hidden">
        <CorrectionRequestButton
          pageName={bill.billTitle}
          buttonLabel={!isVerified ? "資料の読み取りに関する情報提供・訂正依頼" : undefined}
        />
        {!isVerified && (
          <p className="mt-2 px-1 text-xs leading-relaxed text-on-surface-variant">
            フォーム内に、議案ID「{bill.id}」「{bill.billNumber}」「{bill.session}」および、根拠となる公式資料の該当ページなどをご記入ください。第三者からの情報提供のみで内容を確定することはなく、公式資料と照合したうえで反映します。
          </p>
        )}
      </div>
    </div>
  );
}
