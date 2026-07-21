import type { MayorPromiseStatusLabel } from "../../types";
import { mayorPromiseStatusClass, mayorPromiseStatusIcon } from "../../lib/mayorPromiseStatus";

interface MayorPromiseStatusBadgeProps {
  status: MayorPromiseStatusLabel;
  className?: string;
}

/** 公約の進捗状況を、色だけに頼らずアイコン＋文字で表示するバッジ。 */
export function MayorPromiseStatusBadge({ status, className = "" }: MayorPromiseStatusBadgeProps) {
  const Icon = mayorPromiseStatusIcon[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${mayorPromiseStatusClass[status]} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {status}
    </span>
  );
}
