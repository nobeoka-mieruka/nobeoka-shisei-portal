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
  /** Phase133：status="RESEARCH_EXHAUSTED"のタスクで、これまでに確認した情報源の種類を
   * 一覧化する（同じオンライン検索を理由なく繰り返さないための記録）。任意項目。 */
  sourceInventory?: {
    sourceClass: string;
    /** online_checked：オンラインで確認済み（見つからなかった）／library_login_required：
     * 所在は判明しているがログイン・現物閲覧が必須／library_required：図書館等での現物確認が必要／
     * inquiry_required：関係機関への直接照会が必要／location_unknown：資料の所在自体が未確認／
     * server_unreachable：URL・所在は判明しているが、サーバー自体に接続できず内容を確認できない
     * （閲覧制限とは異なり、資料へのアクセス権の問題ではない）。 */
    status:
      | "online_checked"
      | "library_login_required"
      | "library_required"
      | "inquiry_required"
      | "location_unknown"
      | "server_unreachable";
    description: string;
  }[];
  /** Phase133：このタスクを次に前進させるための具体的な条件（人手による調査を含む）。
   * 「今回は問い合わせを実施しない」方針のタスクでも、将来ユーザーが問い合わせを行う際に
   * どの資料を確認すればよいか分かるよう明文化する。任意項目。 */
  reopenConditions?: string[];
  /** Phase141：「次に何をすれば前進するか」をstatus（5状態）より細かく分類する補助フィールド。
   * 既存のstatus・UIの表示ロジックは変更せず、追加の絞り込み・一覧化のためだけに使う。
   * needs_ndl_login：国立国会図書館個人送信サービスへのログインが必要／
   * needs_human_review：資料間の矛盾等、本人でなければ判断できない／
   * needs_offline_library：図書館等での現物確認・複写が必要／
   * source_not_published：一次資料自体がまだ存在しない／
   * research_exhausted：現在利用可能な主要オンライン資料を調査したが確認できなかった
   * （「一次資料が存在しない」と確定した意味ではない）／
   * conflicting_sources：複数資料で内容が食い違い、一方を採用できない／
   * waiting_for_publication：公表主体による定期公表を待っている（想定時期が分かる場合がある）／
   * actionable_now：追加のWeb調査で前進できる可能性がまだ残っている。任意項目。 */
  nextActionCategory?:
    | "needs_ndl_login"
    | "needs_human_review"
    | "needs_offline_library"
    | "source_not_published"
    | "research_exhausted"
    | "conflicting_sources"
    | "waiting_for_publication"
    | "actionable_now";
}
