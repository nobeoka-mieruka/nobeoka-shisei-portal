import type { SessionSummaryStatus } from "../../types";
import { sessionSummaryStatusLabels } from "../../lib/councilSessions";

const styles: Record<SessionSummaryStatus, string> = {
  verified: "bg-primary-container text-on-primary-container",
  "partially-verified": "bg-tertiary-container text-on-tertiary-container",
  pending: "bg-secondary-container text-on-secondary-container",
  unavailable: "border border-outline-variant text-on-surface-variant",
};

/**
 * 会期要約の確認状況バッジ。色だけに頼らず、必ず文字（ラベル）でも状態を示す。
 * "verified"（確認済み）は既定状態のため、通常表示ではバッジを出さない。
 */
export function SessionSummaryStatusBadge({
  status,
  className = "",
}: {
  status: SessionSummaryStatus;
  className?: string;
}) {
  if (status === "verified") return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]} ${className}`}
    >
      {sessionSummaryStatusLabels[status]}
    </span>
  );
}
