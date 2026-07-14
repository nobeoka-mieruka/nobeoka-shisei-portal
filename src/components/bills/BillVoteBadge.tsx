import type { BillMemberVoteStatus } from "../../types";

export const billVoteLabels: Record<BillMemberVoteStatus, string> = {
  approve: "賛成",
  oppose: "反対",
  abstain: "退席",
  absent: "欠席",
  recused: "除斥",
  notVoting: "採決なし",
};

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
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${billVoteStyles[vote]}`}>
      {billVoteLabels[vote]}
    </span>
  );
}
