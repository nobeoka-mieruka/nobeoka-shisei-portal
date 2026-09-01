import type { BillVoteItem } from "../types";
import { classifyBillSourceRetrieval } from "./billSourceRetrieval";

/**
 * Phase145：議案の自動処理リスク分類（SAFE/REVIEW/HOLD）。
 * 既存のsourceRetrievalStatus（billSourceRetrieval.ts、A/B/C/D）・summaryQuality
 * （billSummaryQuality.ts、Level0〜3）とは別の、3つ目の軸として設計している
 * （「原資料への到達可能性」「説明の品質段階」「自動処理してよい安全度」は別の問い）。
 *
 * - SAFE：市長提出・構造化しやすいカテゴリ（予算/契約/財産取得/決算/専決処分）で、
 *   bill-speech-parser.mjsの実績（Phase142-145、150件超で検証）から安全に処理できると
 *   判断したもの。
 * - REVIEW：文脈判断が必要（条例の大半、人事全件、複数議案一括説明の可能性が高いもの、
 *   委員会・議員提出の議案等）。
 * - HOLD：通常の「市長提案理由説明」という枠組みが根本的に適用できない
 *   （請願・陳情・意見書・決議）、または撤回・廃案。
 *
 * この分類は構造的シグナル（カテゴリ・提出者区分・出典到達性）のみに基づく機械的な
 * トリアージであり、個々の議案の本文を実際に読んだ結果ではない（項目18の精神を維持し、
 * 「安全に処理できそうか」の一次判定にとどめる）。
 */

export type BillAutomationRisk = "SAFE" | "REVIEW" | "HOLD" | "VERIFIED";

const STRUCTURED_CATEGORIES = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);

function isLevel3(bill: Pick<BillVoteItem, "summarySource" | "reason" | "mainChanges" | "citizenImpact">): boolean {
  return bill.summarySource === "manual" && Boolean(bill.reason || (bill.mainChanges && bill.mainChanges.length > 0) || bill.citizenImpact);
}
function isLevel2(bill: Pick<BillVoteItem, "sourceTextVerifiedAt" | "summarySource" | "reason" | "mainChanges" | "citizenImpact">): boolean {
  return Boolean(bill.sourceTextVerifiedAt) && !isLevel3(bill);
}

type RiskInput = Pick<
  BillVoteItem,
  "transcriptUrl" | "fiscalYear" | "category" | "proposerType" | "result" | "sourceTextVerifiedAt" | "summarySource" | "reason" | "mainChanges" | "citizenImpact"
>;

/**
 * Phase146：REVIEW分類となった議案について、「なぜREVIEWなのか」を機械的・再現可能な
 * reasonCodeへ分解する。既存データ（category/proposerType/transcriptUrl/fiscalYear）のみを
 * 使い、本文を読んでの判断は行わない（項目1「推測分類は禁止」）。
 *
 * 1件につき必ず1つのprimaryReasonを返す（項目3：primaryReason合計＝REVIEW件数）。
 * - PERSONNEL：人事案件（氏名・経歴を扱うため最優先で分離）
 * - SOURCE_LINK_MISSING：構造化しやすいカテゴリ・市長提出だが、会議録リンク
 *   （transcriptUrl）が未登録の議案（令和5〜8年度でも、SAFE325件の対象には
 *   含まれなかった取りこぼし。技術的には最もSAFEに近い＝NEAR_SAFE候補）。
 * - ORDINANCE_COMPLEX：条例改正（新規制定/一部改正/全部改正/廃止の区別や、
 *   改正文脈の把握に個別確認を要する）。
 * - OTHER_NARRATIVE：その他カテゴリ（指定管理者の指定・財産の処分・訴えの提起等、
 *   多様な内容を含み一律の抽出ルールが定めにくい）。
 */
export type ReviewReasonCode = "PERSONNEL" | "SOURCE_LINK_MISSING" | "ORDINANCE_COMPLEX" | "OTHER_NARRATIVE";

export function classifyReviewReasonCode(bill: RiskInput): ReviewReasonCode {
  if (bill.category === "人事") return "PERSONNEL";
  if (STRUCTURED_CATEGORIES.has(bill.category ?? "") && bill.proposerType === "mayor") return "SOURCE_LINK_MISSING";
  if (bill.category === "条例") return "ORDINANCE_COMPLEX";
  return "OTHER_NARRATIVE";
}

/**
 * Phase146項目7：REVIEWを技術的な難しさで3段階（R1〜R3）に整理する。名称は内部管理用。
 * - R1：技術的な抽出問題だけで、解決すればSAFE相当になる候補（NEAR_SAFE）。
 *   市長提出・人事以外・「同一会期に同カテゴリ/同名の議案が複数まとまっていない」
 *   （＝複数議案一括説明の可能性が低い）議案。
 * - R2：一次資料へ到達しているが、複数議案一括説明の可能性が高く個別文脈確認が必要。
 * - R3：制度・個人情報・構造上、人による慎重な確認が必要（人事、委員会・議員提出議案）。
 *   委員会提出条例は、市長ではなく提案した議員・委員会の発言を探す必要があり、
 *   本抽出器（市長発言前提）をそのまま適用できないため、個人情報とは別の理由でR3とする。
 */
export type ReviewTier = "R1" | "R2" | "R3";

function titleStem(title: string): string {
  return title.replace(/[（(].*$/, "").trim();
}

/**
 * 同一会期・同カテゴリ、または同一会期・同じ件名の議案が何件あるかを事前に集計しておく
 * 必要がある（1件だけでは判定できないため、全体集合を渡す）。
 */
export function buildBatchLikelihoodIndex(bills: Pick<BillVoteItem, "session" | "category" | "billTitle">[]): {
  isLikelyBatch: (bill: Pick<BillVoteItem, "session" | "category" | "billTitle">) => boolean;
} {
  const sessionCategoryCount = new Map<string, number>();
  const sessionTitleStemCount = new Map<string, number>();
  for (const b of bills) {
    const k1 = `${b.session}|${b.category}`;
    sessionCategoryCount.set(k1, (sessionCategoryCount.get(k1) ?? 0) + 1);
    const k2 = `${b.session}|${titleStem(b.billTitle)}`;
    sessionTitleStemCount.set(k2, (sessionTitleStemCount.get(k2) ?? 0) + 1);
  }
  return {
    isLikelyBatch(bill) {
      const c1 = sessionCategoryCount.get(`${bill.session}|${bill.category}`) ?? 0;
      const c2 = sessionTitleStemCount.get(`${bill.session}|${titleStem(bill.billTitle)}`) ?? 0;
      return c1 >= 4 || c2 >= 3;
    },
  };
}

export function classifyReviewTier(
  bill: RiskInput & Pick<BillVoteItem, "session" | "billTitle">,
  isLikelyBatch: (bill: Pick<BillVoteItem, "session" | "category" | "billTitle">) => boolean,
): ReviewTier {
  if (bill.category === "人事") return "R3";
  if (bill.proposerType === "committee") return "R3";
  if (isLikelyBatch(bill)) return "R2";
  return "R1";
}

/**
 * Phase146項目24：HOLD（69件）の内容理由分類（データ抽出・要約・公開昇格は行わない、
 * 分類のみ）。
 */
export type HoldReasonCode = "PERSONAL_INFO_RISK" | "PETITION_STRUCTURE" | "STATEMENT_STRUCTURE" | "WITHDRAWN_OR_ABANDONED" | "OTHER";

export function classifyHoldReasonCode(bill: RiskInput): HoldReasonCode {
  if (bill.result === "撤回" || bill.result === "廃案") return "WITHDRAWN_OR_ABANDONED";
  if (bill.category === "請願" || bill.category === "陳情") return "PETITION_STRUCTURE";
  if (bill.category === "意見書" || bill.category === "決議") return "STATEMENT_STRUCTURE";
  return "OTHER";
}

export function classifyBillAutomationRisk(bill: RiskInput): BillAutomationRisk {
  if (isLevel3(bill) || isLevel2(bill)) return "VERIFIED";

  if (bill.category === "請願" || bill.category === "陳情") return "HOLD";
  if (bill.result === "撤回" || bill.result === "廃案") return "HOLD";
  if (bill.category === "意見書" || bill.category === "決議") return "HOLD";
  if (bill.category === "不明") return "HOLD";

  // 人事案件は項目9の方針により、SAFEへ無条件で含めない（氏名の誤登録は重大なため）。
  if (bill.category === "人事") return "REVIEW";

  const retrieval = classifyBillSourceRetrieval(bill);
  if (retrieval === "B" && !STRUCTURED_CATEGORIES.has(bill.category ?? "")) return "REVIEW";

  if (STRUCTURED_CATEGORIES.has(bill.category ?? "")) {
    return bill.proposerType === "mayor" ? "SAFE" : "REVIEW";
  }

  return "REVIEW";
}
