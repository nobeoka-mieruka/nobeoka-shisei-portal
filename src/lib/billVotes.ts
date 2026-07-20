import type { BillMemberVoteStatus } from "../types";

export const billVoteLabels: Record<BillMemberVoteStatus, string> = {
  approve: "賛成",
  oppose: "反対",
  abstain: "退席",
  absent: "欠席",
  recused: "除斥",
  notVoting: "採決なし",
};

/** 色だけに頼らず、記号でも賛否の種類を区別できるようにするための補助表示。 */
export const billVoteSymbols: Record<BillMemberVoteStatus, string> = {
  approve: "○",
  oppose: "×",
  abstain: "△",
  absent: "－",
  recused: "－",
  notVoting: "－",
};
