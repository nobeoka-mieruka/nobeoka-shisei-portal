import type { SpeechSummaryStatus } from "../../types";
import { speechSummaryStatusLabel } from "../../lib/councilSpeeches";

const styles: Record<SpeechSummaryStatus, string> = {
  verified: "bg-primary-container text-on-primary-container",
  "partially-verified": "bg-tertiary-container text-on-tertiary-container",
  pending: "bg-secondary-container text-on-secondary-container",
  "source-unavailable": "border border-outline-variant text-on-surface-variant",
  "minutes-not-fetched": "border border-outline-variant text-on-surface-variant",
  "speaker-identification-pending": "bg-secondary-container text-on-secondary-container",
  "question-answer-link-pending": "bg-secondary-container text-on-secondary-container",
};

/**
 * 一般質問・質疑要約の確認状況バッジ。色だけに頼らず、必ず文字（ラベル）でも状態を示す。
 * "verified"（内容確認済み）以外は目立つ表示にし、暫定掲載であることが誤認されないようにする。
 */
export function SpeechSummaryStatusBadge({
  status,
  className = "",
}: {
  status: SpeechSummaryStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]} ${className}`}
    >
      {speechSummaryStatusLabel(status)}
    </span>
  );
}
