import type { BillMemberVoteStatus } from "../types";

export const billVoteLabels: Record<BillMemberVoteStatus, string> = {
  approve: "賛成",
  oppose: "反対",
  departed: "退席",
  absent: "欠席",
  recused: "除斥",
  notVoting: "採決なし",
  abstained: "棄権",
  unconfirmed: "確認不能",
};

/** 色だけに頼らず、記号でも賛否の種類を区別できるようにするための補助表示。 */
export const billVoteSymbols: Record<BillMemberVoteStatus, string> = {
  approve: "○",
  oppose: "×",
  departed: "△",
  absent: "－",
  recused: "－",
  notVoting: "－",
  abstained: "△",
  unconfirmed: "？",
};
