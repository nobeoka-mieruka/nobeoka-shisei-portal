import type { BillVote } from "../types";
import { SectionCard } from "./SectionCard";
import { VoteResultBadge } from "./VoteResultBadge";

export function VotingRecordsSection({ votes }: { votes: BillVote[] }) {
  return (
    <SectionCard title={`議案賛否一覧（${votes.length}件）`}>
      {votes.length > 0 ? (
        <ul className="space-y-2">
          {votes.map((v) => (
            <li
              key={v.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                  <span>{v.date}</span>
                  <span aria-hidden>・</span>
                  <span>{v.session}</span>
                  {v.billNumber && (
                    <>
                      <span aria-hidden>・</span>
                      <span>{v.billNumber}</span>
                    </>
                  )}
                </div>
                <p className="mt-1 text-sm text-on-surface">{v.billName}</p>
                {v.note && <p className="mt-1 text-xs text-on-surface-variant">{v.note}</p>}
              </div>
              <VoteResultBadge result={v.result} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-sm text-on-surface-variant">個人別の賛否は公開資料で確認できません</p>
      )}
    </SectionCard>
  );
}
