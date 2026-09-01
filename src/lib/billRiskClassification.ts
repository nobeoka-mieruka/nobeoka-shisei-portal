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
