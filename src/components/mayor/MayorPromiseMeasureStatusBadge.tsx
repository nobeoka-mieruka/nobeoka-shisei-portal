import type { MayorPromiseMeasureStatus } from "../../types";
import {
  mayorPromiseMeasureStatusClass,
  mayorPromiseMeasureStatusIcon,
  mayorPromiseMeasureStatusLabel,
} from "../../lib/mayorPromiseMeasureStatus";

interface MayorPromiseMeasureStatusBadgeProps {
  status: MayorPromiseMeasureStatus;
  className?: string;
}

/** 個別の取組み（施策・事業単位）の進捗状況を、色だけに頼らずアイコン＋文字で表示するバッジ。 */
export function MayorPromiseMeasureStatusBadge({ status, className = "" }: MayorPromiseMeasureStatusBadgeProps) {
  const Icon = mayorPromiseMeasureStatusIcon[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${mayorPromiseMeasureStatusClass[status]} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {mayorPromiseMeasureStatusLabel[status]}
    </span>
  );
}
