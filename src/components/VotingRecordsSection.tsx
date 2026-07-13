import type { BillVote } from "../types";
import { SectionCard } from "./SectionCard";
import { VoteResultBadge } from "./VoteResultBadge";

const EMPTY_MESSAGE =
  "現在、公開資料を確認しながら議案ごとの賛否情報を整理しています。延岡市議会の公開資料で個人別の賛否を確認できない場合があります。";

export function VotingRecordsSection({ votes }: { votes: BillVote[] }) {
  if (votes.length === 0) {
    return (
      <p className="rounded-lg bg-surface-container-low/70 px-3 py-2.5 text-xs leading-relaxed text-on-surface-variant">
        {EMPTY_MESSAGE}
      </p>
    );
  }

  return (
    <SectionCard title={`議案賛否一覧（${votes.length}件）`}>
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
    </SectionCard>
  );
}
