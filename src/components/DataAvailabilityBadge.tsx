import { DATA_AVAILABILITY_STATUS_LABELS, type DataAvailabilityStatus } from "../lib/dataAvailabilityStatus";

const STYLE_BY_STATUS: Record<DataAvailabilityStatus, string> = {
  confirmed: "bg-tertiary-container text-on-tertiary-container",
  not_collected: "bg-surface-container-high text-on-surface-variant",
  under_review: "bg-secondary-container text-on-secondary-container",
  unavailable: "bg-surface-container-high text-on-surface-variant",
  unknown: "bg-secondary-container text-on-secondary-container",
};

/**
 * TASK-074：「0件」「未確認」「未収録」等の表記をサイト全体で統一するための共通バッジ。
 * 色だけに頼らず、必ず文字ラベルも表示する（色覚特性への配慮）。
 */
export function DataAvailabilityBadge({ status, className = "" }: { status: DataAvailabilityStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLE_BY_STATUS[status]} ${className}`}
    >
      {DATA_AVAILABILITY_STATUS_LABELS[status]}
    </span>
  );
}
