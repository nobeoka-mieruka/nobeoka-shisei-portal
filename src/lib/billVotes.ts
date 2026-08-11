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

/**
 * 個人別賛否（memberVotes）が0件のときに表示する理由文。
 * individualVoteDisclosureStatusで「まだ確認していない（unconfirmed）」と
 * 「会議録で確認した結果、個人別には記録されていない（notDisclosed）」を区別する。
 * disclosedなのにmemberVotesが空というデータはvalidate-data.mjsで防止済みのため、
 * ここでは扱わない。
 */
export function memberVotesUnavailableReason(bill: BillVoteItem): string {
  if (bill.individualVoteDisclosureStatus === "notDisclosed") {
    return `会議録で確認した結果、この議案は起立採決等（記名投票以外の方法）で議決されており、公式資料に議員個人の賛成・反対は記録されていません。${bill.lastVerified ? `（${bill.lastVerified}確認）` : ""}全会一致と記録されている場合でも、在席者・欠席者・議長・除斥者が確認できないため、推測で議員個人の賛否を割り当てることはしていません。`;
  }
  return "個人別の表決：現時点で確認できる公式資料には、各議員の賛成・反対・棄権等が明確に掲載されていません。全会一致と記録されている場合でも、在席者・欠席者・議長・除斥者が確認できないため、推測で議員個人の賛否を割り当てることはしていません。";
}

/**
 * 委員会への付託を省略し、本会議で直接議決されたことを一次資料（会議録）で確認済みの場合に
 * billVotes.jsonのcommitteeフィールドへ設定する値。新しいフィールドは追加せず、既存の
 * committee?:stringフィールドを流用する（Phase19で導入）。
 */
export const NO_COMMITTEE_REFERRAL = "付託なし（本会議で即日議決）";

export type CommitteeFlowStatus = "confirmed" | "no-referral" | "pending" | "source-unavailable";

/**
 * 議案のcommitteeフィールドが表す状態を分類する。
 * - "confirmed"：実際の委員会名が確認できている
 * - "no-referral"：委員会付託を省略し、本会議で直接議決されたことを確認済み（NO_COMMITTEE_REFERRAL）
 * - "source-unavailable"：committee未設定で、かつ同じ会期（sessionId）の議案が1件も
 *   committeeを持たない＝会議録自体が未公開と判断できる場合
 * - "pending"：committee未設定だが、同じ会期の他の議案にはcommitteeが確認済みのものがある
 *   （会議録は公開されているが、この議案だけ未確認の個別ケース）
 *
 * Phase19（2026-08）終了時点では、committee未確認の全24件が令和8年5月臨時会・6月定例会
 * （会議録未公開）に集中しており、"pending"に該当する議案は存在しない。ただし将来、
 * 自動抽出パイプラインが委員会情報を持たない新規議案を追加した場合に備え、
 * 会期単位で自動的に判定する（特定の会期IDをハードコードしない）。
 */
export function committeeFlowStatus(bill: BillVoteItem, allBills: BillVoteItem[]): CommitteeFlowStatus {
  if (bill.committee === NO_COMMITTEE_REFERRAL) return "no-referral";
  if (bill.committee) return "confirmed";
  if (!bill.sessionId) return "pending";
  const sessionBills = allBills.filter((b) => b.sessionId === bill.sessionId);
  const anySessionBillConfirmed = sessionBills.some((b) => !!b.committee);
  return anySessionBillConfirmed ? "pending" : "source-unavailable";
}

/** 一覧・詳細ページで使う、審査状況の短い一言ラベル（政治的評価を含まない事実表示）。 */
export function reviewFlowSummaryLabel(bill: BillVoteItem, allBills: BillVoteItem[]): string {
  const status = committeeFlowStatus(bill, allBills);
  if (status === "no-referral") return "委員会審査なし（付託省略）";
  if (status === "confirmed") return `${bill.committee}で審査`;
  if (status === "source-unavailable") return "会議録公開待ち";
  return "確認中";
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
