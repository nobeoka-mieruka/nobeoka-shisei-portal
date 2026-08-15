import { DataAvailabilityBadge } from "./DataAvailabilityBadge";
import type { DataAvailabilityStatus } from "../lib/dataAvailabilityStatus";

/**
 * TASK-074：statusを指定すると、共通の5区分バッジ（確認済み0件／未収録／未確認／
 * 非公開・不存在／調査中）をメッセージに併記する。既存の呼び出し元は変更なしで動作する
 * （statusは省略可能。文章表現だけで十分に区別できている箇所へ強制はしない）。
 */
export function EmptyState({
  message = "現在、掲載情報はありません",
  status,
}: {
  message?: string;
  status?: DataAvailabilityStatus;
}) {
  return (
    <p className="flex flex-wrap items-center gap-2 py-2 text-sm text-on-surface-variant">
      {status && <DataAvailabilityBadge status={status} />}
      <span>{message}</span>
    </p>
  );
}
