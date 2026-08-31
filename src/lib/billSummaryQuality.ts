import type { BillVoteItem } from "../types";

/**
 * Phase142：議案説明の「確認段階」を追跡するための単一情報源。
 *
 * 重要な前提：Phase141までに、billVotes.json 1,177件は
 * 「出典（sourceFilePath/sourceDocumentId）が紐付いていること」＝「出典確認済み」として扱っていた。
 * しかしPhase142の調査で、この出典は全件「議案等審議結果（採決結果）PDF」であり、
 * 議案本文（提案理由・内容）そのものではないことが判明した（billDocumentUrlは0件）。
 * つまり「出典が紐付いている」ことと「本文を読んで内容を確認した」ことは別であり、
 * 既存の1,177/1,177という数字だけでは「本文まで確認できた」ことを意味しない。
 *
 * このモジュールは、既存フィールド（reason/mainChanges/citizenImpact/summarySource/
 * sourceTextVerifiedAt/sourceFilePath等）から、議案説明が「どこまで確認済みか」を
 * 4段階で判定する。新しい巨大な状態管理フィールド群は追加しない（既存フィールドの組み合わせで
 * 判定する）。
 */

export type BillExplanationLevel = 0 | 1 | 2 | 3;

export const BILL_EXPLANATION_LEVEL_LABEL: Record<BillExplanationLevel, string> = {
  0: "出典未確認",
  1: "議案名・議決結果・出典を確認済み",
  2: "一次資料本文を確認済み",
  3: "一次資料本文に基づく説明あり",
};

export const BILL_EXPLANATION_LEVEL_DESCRIPTION: Record<BillExplanationLevel, string> = {
  0: "この議案の出典（審議結果PDF等）がまだ確認できていません。",
  1: "議案名・議決結果と、審議結果PDF等の出典は確認できています。ただし、この説明文は件名や分類から機械的に組み立てたものです。",
  2: "会議録等の一次資料本文を実際に確認しました。ただし、この議案固有の提案理由等がその資料に記載されていなかった、または市民向けの説明としてはまだ整理できていません。",
  3: "会議録等の一次資料本文を確認し、その内容に基づいて市民向けの説明を作成しています。",
};

/** 出典（審議結果PDF等）が紐付いているか。「本文を読んだか」とは別の軸。 */
export function isSourceLinked(bill: Pick<BillVoteItem, "sourceFilePath" | "sourceDocumentId">): boolean {
  return Boolean(bill.sourceFilePath || bill.sourceDocumentId);
}

/** 一次資料本文（会議録の提案理由説明等）を人が実際に確認したか。 */
export function isSourceTextVerified(bill: Pick<BillVoteItem, "sourceTextVerifiedAt">): boolean {
  return Boolean(bill.sourceTextVerifiedAt);
}

/** 一次資料本文の内容に基づく、市民向けの独自説明（Level3相当の中身）があるか。 */
export function hasCitizenSummary(bill: Pick<BillVoteItem, "reason" | "mainChanges" | "citizenImpact" | "summarySource">): boolean {
  if (bill.summarySource !== "manual") return false;
  return Boolean(bill.reason || (bill.mainChanges && bill.mainChanges.length > 0) || bill.citizenImpact);
}

/**
 * 議案説明の確認段階を判定する。
 * 0：出典すら未確認（現状データには存在しない想定）
 * 1：議案名＋議決結果＋出典確認（定型説明のみ）
 * 2：一次資料本文を確認済み（ただし市民向け独自説明はまだ、または資料に個別記載がなかった）
 * 3：一次資料本文に基づく市民向け要約あり
 */
export function getBillExplanationLevel(
  bill: Pick<BillVoteItem, "sourceFilePath" | "sourceDocumentId" | "sourceTextVerifiedAt" | "reason" | "mainChanges" | "citizenImpact" | "summarySource">,
): BillExplanationLevel {
  if (!isSourceLinked(bill)) return 0;
  if (hasCitizenSummary(bill)) return 3;
  if (isSourceTextVerified(bill)) return 2;
  return 1;
}
