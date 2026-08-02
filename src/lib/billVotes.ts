import type { BillMemberVoteStatus, BillVoteItem } from "../types";

/**
 * 一般公開ページに表示してよい議案かどうか。
 * publicationStatus未設定（既存データ・手入力データとの後方互換）は"published"として扱う。
 * pendingReview系（PDFから自動抽出したが確認が済んでいないデータ）は一覧・詳細ページに表示しない。
 */
export function isPubliclyVisibleBill(bill: BillVoteItem): boolean {
  return bill.publicationStatus === undefined || bill.publicationStatus === "published";
}

/** 一般公開してよい議案だけを返す。 */
export function publicBills(bills: BillVoteItem[]): BillVoteItem[] {
  return bills.filter(isPubliclyVisibleBill);
}

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
