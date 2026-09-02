import type { BillPublicationStatus, BillVerificationStatus, BillMemberVoteStatus, BillVoteItem, BillVoteMethod } from "../types";

/**
 * 一般公開ページに表示してよい議案かどうか。
 *
 * 「公開するかどうか」と「確認が済んでいるかどうか」は別の軸で扱う。
 * 確認待ち（pendingReview / updatedPendingReview）であっても、公式資料に基づく情報である限り
 * 「確認待ち」等の表示を伴って公開する（確認待ち＝非公開にはしない）。
 * 一般公開ページから除外するのは、誤抽出と判断され却下された（rejected）データと、
 * 抽出処理自体がエラーになった（error）データのみ。
 */
export function isPubliclyVisibleBill(bill: Pick<BillVoteItem, "publicationStatus">): boolean {
  const hiddenStatuses: BillPublicationStatus[] = ["rejected", "error"];
  return !hiddenStatuses.includes(bill.publicationStatus as BillPublicationStatus);
}

/**
 * 一般公開してよい議案だけを返す（rejected・errorを除く）。
 * Phase193：軽量インデックス（BillVoteIndexItem）にも同じ判定を使えるよう、
 * publicationStatusだけを見るジェネリックにしている（判定内容は従来と同一）。
 */
export function publicBills<T extends Pick<BillVoteItem, "publicationStatus">>(bills: T[]): T[] {
  return bills.filter(isPubliclyVisibleBill);
}

/** TASK-085：提出者区分が確認済みの議案数。DataStatusPage・dataCompletenessSummaryで
 * 個別に同じ式を実装していたため一本化した。 */
export function countBillsWithKnownProposerType(bills: Pick<BillVoteItem, "proposerType">[]): number {
  return bills.filter((b) => b.proposerType).length;
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
  // verificationNoteは通常「確認作業中（isVerified===false）」の案件向けの注記だが、
  // 個人別賛否が0件のnotDisclosed案件では、verificationStatus="verified"であっても
  // 会議録の討論記録から一部議員の賛否が判明している場合があり、その内容はここでのみ
  // 市民へ伝わる（Phase100-101、2026-08-24）。誤解を招かないよう、あくまで補足情報として
  // 末尾に付記するに留め、個人別賛否の一覧（memberVotes）には追加しない。
  const supplement = bill.verificationNote ? ` ${bill.verificationNote}` : "";
  if (bill.individualVoteDisclosureStatus === "notDisclosed") {
    return `会議録で確認した結果、この議案は起立採決等（記名投票以外の方法）で議決されており、公式資料に議員個人の賛成・反対は記録されていません。${bill.lastVerified ? `（${bill.lastVerified}確認）` : ""}全会一致と記録されている場合でも、在席者・欠席者・議長・除斥者が確認できないため、推測で議員個人の賛否を割り当てることはしていません。${supplement}`;
  }
  return `個人別の表決：現時点で確認できる公式資料には、各議員の賛成・反対・棄権等が明確に掲載されていません。全会一致と記録されている場合でも、在席者・欠席者・議長・除斥者が確認できないため、推測で議員個人の賛否を割り当てることはしていません。${supplement}`;
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

/**
 * Phase112：採決方式（voteMethod）と個人別結果の公開状態（disclosureStatus）を、
 * 混同しない別軸として整理するための分類。
 *
 * 【背景】Phase108までの報告で使っていた「aggregate_only」（1,151件）と
 * 「not_disclosed」（521件、既存individualVoteDisclosureStatusの値をそのまま集計したもの）は、
 * 実際には概念が重なっていた（aggregate_onlyの内訳は「not_disclosed（521件、個人別非公開と
 * 確認済み）」＋「未調査だが採決方式は判明している630件」の合算だった）。本モジュールは
 * 既存フィールド（voteMethod・individualVoteDisclosureStatus・memberVotes）から、
 * 重複のない4区分（individual/aggregate/not_disclosed/unknown）を導出する。
 * 既存データへの書き込みは行わない（表示・集計専用の派生ロジック）。
 */
export type VoteMethodCategory = "unanimous" | "standing_vote" | "voice_vote" | "recorded_vote" | "no_vote" | "unknown";

/** 個人別結果の公開状態。「aggregate」は採決方式は判明しているが個人別の内訳は確認できていない
 * （＝unconfirmed）状態、「not_disclosed」は個人別に非公開であることを一次資料で確認済みの状態。
 * この2つを混同しないために別の値として区別する。 */
export type VoteDisclosureCategory = "individual" | "aggregate" | "not_disclosed" | "unknown";

const VOTE_METHOD_CATEGORY_MAP: Partial<Record<BillVoteMethod, VoteMethodCategory>> = {
  全会一致: "unanimous",
  起立多数: "standing_vote",
  起立少数: "standing_vote",
  簡易採決: "voice_vote",
  記名投票: "recorded_vote",
  // 無記名投票（秘密投票）は「記名投票」とは正反対の性質（氏名が残らない）のため、
  // recorded_voteへ分類すると事実と逆になる。専用区分は設けず、現時点でデータが0件のため
  // unknownとして扱う（将来該当議案が現れた場合は要見直し）。
  無記名投票: "unknown",
  採決なし: "no_vote",
  確認できず: "unknown",
};

export const VOTE_METHOD_CATEGORY_LABELS_JA: Record<VoteMethodCategory, string> = {
  unanimous: "全会一致",
  standing_vote: "起立採決",
  voice_vote: "簡易採決（異議なし採決）",
  recorded_vote: "記名投票",
  no_vote: "採決なし",
  unknown: "不明",
};

export const VOTE_DISCLOSURE_CATEGORY_LABELS_JA: Record<VoteDisclosureCategory, string> = {
  individual: "個人別に公開",
  aggregate: "採決方式は判明（個人別は未確認）",
  not_disclosed: "個人別は非公開と確認済み",
  unknown: "採決方式・公開状況とも不明",
};

export function classifyVoteMethod(bill: BillVoteItem): VoteMethodCategory {
  if (!bill.voteMethod) return "unknown";
  return VOTE_METHOD_CATEGORY_MAP[bill.voteMethod] ?? "unknown";
}

/**
 * 個人別結果の公開状態を判定する。
 * 優先順位：①memberVotesが実在すれば"individual"（最も確実な事実）
 * ②individualVoteDisclosureStatus==="notDisclosed"なら"not_disclosed"（非公開と確認済み）
 * ③voteMethodが判明していれば"aggregate"（採決方式は分かるが個人別は未調査）
 * ④それ以外は"unknown"
 */
export function classifyVoteDisclosure(bill: BillVoteItem): VoteDisclosureCategory {
  if (bill.memberVotes.length > 0) return "individual";
  if (bill.individualVoteDisclosureStatus === "notDisclosed") return "not_disclosed";
  if (bill.voteMethod) return "aggregate";
  return "unknown";
}

export interface VoteClassificationSummary {
  totalBillCount: number;
  byMethod: Record<VoteMethodCategory, number>;
  byDisclosure: Record<VoteDisclosureCategory, number>;
}

export function summarizeVoteClassification(bills: BillVoteItem[]): VoteClassificationSummary {
  const byMethod = { unanimous: 0, standing_vote: 0, voice_vote: 0, recorded_vote: 0, no_vote: 0, unknown: 0 } as Record<
    VoteMethodCategory,
    number
  >;
  const byDisclosure = { individual: 0, aggregate: 0, not_disclosed: 0, unknown: 0 } as Record<VoteDisclosureCategory, number>;
  for (const b of bills) {
    byMethod[classifyVoteMethod(b)]++;
    byDisclosure[classifyVoteDisclosure(b)]++;
  }
  return { totalBillCount: bills.length, byMethod, byDisclosure };
}
