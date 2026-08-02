import type { BillVoteItem } from "../../types";
import { verificationStatusOf, verificationStatusLabels } from "../../lib/billVotes";

const styles: Record<string, string> = {
  verified: "bg-primary-container text-on-primary-container",
  "partially-verified": "bg-tertiary-container text-on-tertiary-container",
  pending: "bg-secondary-container text-on-secondary-container",
  "individual-votes-unavailable": "border border-outline-variant text-on-surface-variant",
};

/**
 * 議案の確認状況バッジ。色だけに頼らず、必ず文字（ラベル）でも状態を示す。
 * "verified"（確認済み）は控えめな表示にとどめ、目立たせすぎない。
 */
export function VerificationStatusBadge({ bill, className = "" }: { bill: BillVoteItem; className?: string }) {
  const status = verificationStatusOf(bill);
  if (status === "verified") return null; // 確認済みは既定状態のため、通常表示ではバッジを出さない
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]} ${className}`}>
      {verificationStatusLabels[status]}
    </span>
  );
}
