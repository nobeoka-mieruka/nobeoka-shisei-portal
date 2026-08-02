import type { BillPublicationStatus, BillVerificationStatus, BillMemberVoteStatus, BillVoteItem } from "../types";

/**
 * 一般公開ページに表示してよい議案かどうか。
 *
 * 「公開するかどうか」と「確認が済んでいるかどうか」は別の軸で扱う。
 * 確認待ち（pendingReview / updatedPendingReview）であっても、公式資料に基づく情報である限り
 * 「確認待ち」等の表示を伴って公開する（確認待ち＝非公開にはしない）。
 * 一般公開ページから除外するのは、誤抽出と判断され却下された（rejected）データと、
 * 抽出処理自体がエラーになった（error）データのみ。
 */
export function isPubliclyVisibleBill(bill: BillVoteItem): boolean {
  const hiddenStatuses: BillPublicationStatus[] = ["rejected", "error"];
  return !hiddenStatuses.includes(bill.publicationStatus as BillPublicationStatus);
}

/** 一般公開してよい議案だけを返す（rejected・errorを除く）。 */
export function publicBills(bills: BillVoteItem[]): BillVoteItem[] {
  return bills.filter(isPubliclyVisibleBill);
}

/** 未設定（省略）の場合は"verified"として扱う。 */
export function verificationStatusOf(bill: BillVoteItem): BillVerificationStatus {
  return bill.verificationStatus ?? "verified";
}

export function isFullyVerified(bill: BillVoteItem): boolean {
  return verificationStatusOf(bill) === "verified";
}

export const verificationStatusLabels: Record<BillVerificationStatus, string> = {
  verified: "確認済み",
  "partially-verified": "一部確認済み",
  pending: "確認待ち",
  "individual-votes-unavailable": "個人別表決未確認",
};

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
