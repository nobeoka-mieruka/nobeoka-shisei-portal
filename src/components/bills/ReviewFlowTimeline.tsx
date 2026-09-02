import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { BillVoteItem } from "../../types";
import { committeeFlowStatus, NO_COMMITTEE_REFERRAL } from "../../lib/billVotes";
import { getCommitteeByName } from "../../lib/committees";
import { formatJapaneseDate } from "../../config/site";
import { CheckCircleIcon, ClockIcon } from "../icons";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

interface FlowStep {
  key: string;
  title: string;
  date?: string;
  body: ReactNode;
  /** "done"＝一次資料で確認済みの事実／"pending"＝未確認・資料未公開など、確定していない状態。 */
  state: "done" | "pending";
}

/**
 * 議案が提出されてから本会議で議決されるまでの流れを、時系列の縦型タイムラインで表示する。
 *
 * 委員会の個別開催日・審査結果（可決すべきもの等の文言）は公式資料（延岡市議会公式サイト・
 * 会議録検索システム）に開催回数・日付単位では公表されていないため、ここでは
 * 「どの委員会に付託されたか」までを示し、日付を推測で補うことはしない。
 */
export function ReviewFlowTimeline({ bill, allBills }: { bill: BillVoteItem; allBills: BillVoteItem[] }) {
  const flowStatus = committeeFlowStatus(bill, allBills);
  const committee = bill.committee && bill.committee !== NO_COMMITTEE_REFERRAL ? getCommitteeByName(bill.committee) : undefined;

  const steps: FlowStep[] = [];

  if (bill.submittedDate || bill.proposer) {
    steps.push({
      key: "submit",
      title: "議案提出",
      date: bill.submittedDate,
      state: "done",
      body: (
        <p className="text-sm text-on-surface">
          {bill.proposer ? `${bill.proposer}が提出` : "議会へ提出"}
          {bill.submittingDepartment && `（担当課：${bill.submittingDepartment}）`}
        </p>
      ),
    });
  }

  if (flowStatus === "confirmed") {
    steps.push({
      key: "committee",
      title: "委員会付託・審査",
      state: "done",
      body: (
        <div className="text-sm text-on-surface">
          <p>
            {committee ? (
              <Link to={`/committees/${committee.id}`} className={`font-medium text-primary underline ${linkClass}`}>
                {bill.committee}
              </Link>
            ) : (
              <span className="font-medium">{bill.committee}</span>
            )}
            {" "}に付託され、審査されました。
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            委員会の個別の開催日・審査結果（可決すべきもの等の文言）は公式資料で公表されていないため、付託先の委員会のみを表示しています。
          </p>
        </div>
      ),
    });
  } else if (flowStatus === "no-referral") {
    steps.push({
      key: "committee",
      title: "委員会審査なし",
      state: "done",
      body: (
        <p className="text-sm text-on-surface">
          会議録で確認したところ、委員会への付託を省略し、本会議で直接議決されています（人事案件・専決処分の承認・即日議決の条例改正等）。
        </p>
      ),
    });
  } else if (flowStatus === "source-unavailable") {
    steps.push({
      key: "committee",
      title: "委員会付託の確認",
      state: "pending",
      body: (
        <p className="text-sm text-on-surface-variant">
          会議録公開待ち：延岡市議会「会議録検索システム」でこの会期の会議録がまだ公開されていないため、付託委員会を確認できません。公開され次第、確認して反映します。
        </p>
      ),
    });
  } else {
    steps.push({
      key: "committee",
      title: "委員会付託の確認",
      state: "pending",
      body: <p className="text-sm text-on-surface-variant">この議案の付託委員会は、確認作業中です。</p>,
    });
  }

  steps.push({
    key: "vote",
    title: "本会議採決",
    date: bill.votingDate,
    state: "done",
    body: (
      <div className="text-sm text-on-surface">
        <p className="font-semibold">{bill.result}</p>
        {bill.voteMethod && <p className="mt-0.5 text-xs text-on-surface-variant">採決方法：{bill.voteMethod}</p>}
      </div>
    ),
  });

  return (
    <ol className="space-y-0">
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
          {i < steps.length - 1 && (
            <span aria-hidden className="absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px bg-outline-variant" />
          )}
          <span className="mt-0.5 shrink-0" aria-hidden>
            {step.state === "done" ? (
              <CheckCircleIcon className="h-6 w-6 text-primary" />
            ) : (
              <ClockIcon className="h-6 w-6 text-on-surface-variant" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-semibold text-on-surface">{step.title}</p>
              {step.date && (
                <p className="text-xs text-on-surface-variant">{formatJapaneseDate(step.date)}</p>
              )}
            </div>
            <div className="mt-1">{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
