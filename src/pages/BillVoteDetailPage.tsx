import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import billVotesData from "../data/billVotes.json";
import type { BillMemberVoteStatus, BillVoteItem } from "../types";
import { SectionCard } from "../components/SectionCard";
import { BackLink } from "../components/BackLink";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { BillVoteBadge } from "../components/bills/BillVoteBadge";
import { billVoteLabels } from "../lib/billVotes";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { billOgImage } from "../lib/ogImage";
import { GlobeIcon } from "../components/icons";

const billVotes = billVotesData as BillVoteItem[];

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

export function BillVoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bill = billVotes.find((b) => b.id === id);
  const [copied, setCopied] = useState(false);

  usePageTitle(
    bill
      ? {
          title: `${bill.billNumber}「${bill.billTitle}」｜採決結果・議員別賛否`,
          description: `${bill.billNumber}「${bill.billTitle}」の概要、議決結果（${bill.result}）、議員別の賛否を掲載しています。`,
          image: billOgImage(bill.id),
        }
      : { title: "議案情報", noindex: true },
  );

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
      <Breadcrumbs
        items={[
          { label: "ホーム", to: "/" },
          { label: "議案一覧", to: "/bills/votes" },
          { label: bill.billNumber },
        ]}
      />
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

      {/* 議案基本情報 */}
      <div className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6 print:rounded-none print:border print:border-outline-variant print:shadow-none">
        <p className="text-sm text-on-surface-variant">{bill.billNumber}</p>
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
              <dd className="text-on-surface">{bill.committee}</dd>
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

      {/* 議案の概要 */}
      <SectionCard title="議案の概要">
        <div className="space-y-3">
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
        {!hasOverview && (
          <p className="mt-1 text-xs text-on-surface-variant">概要以外の項目は公開資料で確認でき次第、追加します。</p>
        )}
      </SectionCard>

      {/* 議決結果 */}
      <SectionCard title="議決結果">
        <p className="text-2xl font-bold text-on-surface">{bill.result}</p>
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
                    className={`text-sm font-medium text-primary hover:underline ${linkClass}`}
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
            議員個人の賛否は、公開資料で確認できていません。
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
                  className={`inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
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

      {/* 関連情報 */}
      {hasRelated && (
        <SectionCard title="関連情報">
          <ul className="space-y-2 text-sm">
            {bill.relatedQuestionIds && bill.relatedQuestionIds.length > 0 && (
              <li>
                <Link to="/questions" className={`text-primary hover:underline ${linkClass}`}>
                  関連する一般質問（{bill.relatedQuestionIds.length}件）
                </Link>
              </li>
            )}
            {bill.relatedCommitteeActivityIds && bill.relatedCommitteeActivityIds.length > 0 && (
              <li className="text-on-surface-variant">
                関連する委員会活動（{bill.relatedCommitteeActivityIds.length}件）※委員会活動データベースは準備中です
              </li>
            )}
            {bill.relatedMayorPromiseIds && bill.relatedMayorPromiseIds.length > 0 && (
              <li>
                <Link to="/mayor/policy-progress" className={`text-primary hover:underline ${linkClass}`}>
                  関連する市長公約（{bill.relatedMayorPromiseIds.length}件）
                </Link>
              </li>
            )}
            {bill.relatedFinanceItems && bill.relatedFinanceItems.length > 0 && (
              <li>
                <Link to="/finance" className={`text-primary hover:underline ${linkClass}`}>
                  関連する予算・財政情報（{bill.relatedFinanceItems.length}件）
                </Link>
              </li>
            )}
          </ul>
        </SectionCard>
      )}

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

      <div className="print:hidden">
        <CorrectionRequestButton pageName={bill.billTitle} />
      </div>
    </div>
  );
}
