import type { BillMemberVoteStatus } from "../../types";
import { billVoteLabels, billVoteSymbols } from "../../lib/billVotes";

const billVoteStyles: Record<BillMemberVoteStatus, string> = {
  approve: "bg-primary-container text-on-primary-container",
  oppose: "bg-error-container text-on-error-container",
  abstain: "bg-secondary-container text-on-secondary-container",
  absent: "bg-surface-container-high text-on-surface-variant",
  recused: "bg-tertiary-container text-on-tertiary-container",
  notVoting: "border border-outline-variant text-on-surface-variant",
};

export function BillVoteBadge({ vote }: { vote: BillMemberVoteStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${billVoteStyles[vote]}`}>
      <span aria-hidden>{billVoteSymbols[vote]}</span>
      {billVoteLabels[vote]}
    </span>
  );
}
