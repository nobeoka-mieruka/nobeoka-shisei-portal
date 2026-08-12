/**
 * BLOCKEDタスクの細分化ステータス（src/data/blockedTaskClassification.json）。
 * TASKS.mdの5状態（READY/IN_PROGRESS/BLOCKED/REVIEW/DONE）は運用ルールとして
 * そのまま維持し、このファイルはBLOCKED（および解決済み＝COMPLETED）タスクの
 * 「なぜBLOCKEDなのか」を機械可読に補足するための追加レイヤーとして扱う。
 * TASKS.md側の「状態：」表記を置き換えるものではない。
 */
export type BlockedTaskStatus =
  | "WAITING_EXTERNAL"
  | "BLOCKED_TECHNICAL"
  | "MANUAL_REVIEW"
  | "NOT_APPLICABLE"
  | "COMPLETED";

export type BlockedReasonCode =
  | "SOURCE_NOT_PUBLISHED"
  | "SOURCE_NOT_FOUND"
  | "SOURCE_UNAVAILABLE"
  | "IMAGE_PDF"
  | "OCR_REQUIRED"
  | "IDENTITY_UNCERTAIN"
  | "OUTSIDE_SCOPE"
  | "WAITING_OFFICIAL_RELEASE"
  | "DATA_MODEL_LIMITATION"
  | "MANUAL_REVIEW_REQUIRED";

export interface BlockedTaskClassificationEntry {
  taskId: string;
  title: string;
  status: BlockedTaskStatus;
  blockedReasonCode: BlockedReasonCode | null;
  reasonSummary: string;
  /** ISO形式。この分類をいつ最後に見直したか。 */
  lastCheckedAt: string;
  /** ISO形式。次回見直しの目安（未定の場合はnull）。 */
  nextCheckAt: string | null;
  attemptCount: number;
  /** 既存の自動巡回基盤（blockedTaskWatch.json等）で再確認できる対象かどうか。 */
  autoRecheck: boolean;
  autoRecheckMechanism: string | null;
  notes: string;
}
