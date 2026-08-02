import type { MemberSpeechAnalysisStatus } from "../../types";
import { memberSpeechAnalysisStatusLabels } from "../../lib/councilSpeeches";

const styles: Record<MemberSpeechAnalysisStatus, string> = {
  verified: "bg-primary-container text-on-primary-container",
  "partially-verified": "bg-tertiary-container text-on-tertiary-container",
  pending: "bg-secondary-container text-on-secondary-container",
  "insufficient-data": "border border-outline-variant text-on-surface-variant",
  "not-analyzed": "border border-outline-variant text-on-surface-variant",
};

/** AIによる質問内容の分析の確認状況バッジ。色だけに頼らず、必ず文字（ラベル）でも状態を示す。 */
export function MemberSpeechAnalysisStatusBadge({
  status,
  className = "",
}: {
  status: MemberSpeechAnalysisStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]} ${className}`}
    >
      {memberSpeechAnalysisStatusLabels[status]}
    </span>
  );
}
