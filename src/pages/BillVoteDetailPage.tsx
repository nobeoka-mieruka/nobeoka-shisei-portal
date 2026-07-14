import { useParams } from "react-router-dom";
import billVotesData from "../data/billVotes.json";
import type { BillVoteItem } from "../types";
import { SectionCard } from "../components/SectionCard";
import { BackLink } from "../components/BackLink";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { BillVoteBadge } from "../components/bills/BillVoteBadge";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";

const billVotes = billVotesData as BillVoteItem[];

function safeFormatDate(iso?: string): string {
  return iso ? formatJapaneseDate(iso) : "確認中";
}

export function BillVoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bill = billVotes.find((b) => b.id === id);

  usePageTitle(bill ? bill.billTitle : "議案情報");

  if (!bill) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <BackLink to="/bills/votes" label="議案ごとの賛否に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          議案情報が見つかりませんでした。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <BackLink to="/bills/votes" label="議案ごとの賛否に戻る" />

      <div className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <p className="text-xs text-on-surface-variant">
          {bill.billNumber}／{bill.session}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-on-surface sm:text-2xl">{bill.billTitle}</h1>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-on-surface-variant">担当委員会</dt>
            <dd className="text-on-surface">{bill.committee ?? "確認中"}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">提出者</dt>
            <dd className="text-on-surface">{bill.proposer ?? "確認中"}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">提出日</dt>
            <dd className="text-on-surface">{safeFormatDate(bill.submittedDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">議決日</dt>
            <dd className="text-on-surface">{safeFormatDate(bill.votingDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">議決結果</dt>
            <dd className="font-medium text-on-surface">{bill.result}</dd>
          </div>
        </dl>
      </div>

      <SectionCard title="概要">
        <p className="text-sm leading-relaxed text-on-surface">{bill.summary}</p>
      </SectionCard>

      <SectionCard title={`議員別賛否（${bill.memberVotes.length}名）`}>
        {bill.memberVotes.length > 0 ? (
          <ul className="space-y-2">
            {bill.memberVotes.map((v) => (
              <li
                key={v.memberId}
                className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface">{v.memberName}</p>
                  <p className="text-xs text-on-surface-variant">{v.faction}</p>
                </div>
                <BillVoteBadge vote={v.vote} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-surface-container-high/70 px-3 py-2.5 text-xs leading-relaxed text-on-surface-variant">
            議員個人の賛否は公開資料で確認できません。
          </p>
        )}
      </SectionCard>

      <CorrectionRequestButton pageName={bill.billTitle} />
    </div>
  );
}
