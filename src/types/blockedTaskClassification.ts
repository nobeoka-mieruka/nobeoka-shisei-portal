/**
 * BLOCKEDタスクの細分化ステータス（src/data/blockedTaskClassification.json）。
 * TASKS.mdの5状態（READY/IN_PROGRESS/BLOCKED/REVIEW/DONE）は運用ルールとして
 * そのまま維持し、このファイルはBLOCKED（および解決済み＝COMPLETED）タスクの
 * 「なぜBLOCKEDなのか」を機械可読に補足するための追加レイヤーとして扱う。
 * TASKS.md側の「状態：」表記を置き換えるものではない。
 *
 * MANUAL_REVIEW と RESEARCH_EXHAUSTED の違い：
 * - MANUAL_REVIEW: 自動化された調査は難しいが、人手による追加調査（役所への問い合わせ等）で
 *   前進する見込みがまだあるタスク。定期的な再確認が有効。
 * - RESEARCH_EXHAUSTED: 複数回（目安3回以上）同一の結論（一次資料のURL自体が存在しない等）に
 *   達し、現在確認可能な手段ではこれ以上前進しないと判断したタスク。
 *   「一次資料が存在しないと確定した」という意味ではなく、「調査を尽くしたが確認できていない」
 *   という意味であることを必ずnotesで明記する。件数を減らす目的だけでこの状態へ変更しない。
 *   新たな一次資料の公表・関係者の新規サイト開設等、状況が変わった場合のみ再調査する。
 */
export type BlockedTaskStatus =
  | "WAITING_EXTERNAL"
  | "BLOCKED_TECHNICAL"
  | "MANUAL_REVIEW"
  | "RESEARCH_EXHAUSTED"
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
  /** status="WAITING_EXTERNAL"の場合、公式資料の想定公開時期（例：「令和8年11月頃」）。未定の場合はnull。 */
  expectedPublicationPeriod: string | null;
  attemptCount: number;
  /** 既存の自動巡回基盤（blockedTaskWatch.json等）で再確認できる対象かどうか。 */
  autoRecheck: boolean;
  autoRecheckMechanism: string | null;
  notes: string;
}
