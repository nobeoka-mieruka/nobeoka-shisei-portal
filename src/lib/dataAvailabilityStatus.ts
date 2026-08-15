/**
 * TASK-074：「0件」「未確認」「未収録」等の表記をサイト全体で区別するための共通語彙。
 *
 * サイト内では従来から、フィールドごとに個別の状態型（BillVerificationStatus、
 * VoteDisclosureCategory、ArchiveVerificationStatus等）を用いて「確認済みかどうか」を
 * 表現してきた。これらは対象データの性質に応じた粒度を持つため、本モジュールが
 * 既存の型を置き換えるものではない。本モジュールは、新規に状態を表示する箇所や、
 * 複数の既存型をまたいで一覧化する箇所（DataStatusPage等）で使う、5区分の
 * 共通語彙を提供する。
 *
 * 対応関係（ユーザー指示のA〜E区分）：
 *   A 確認済み0件           → "confirmed"（0件そのものが公式資料で確認済み）
 *   B 未収録                → "not_collected"（本サイトがまだ収集していない）
 *   C 未確認                → "under_review"（存在は推定されるが確認作業が済んでいない）
 *   D 資料自体が非公開・不存在 → "unavailable"（公式資料が非公開・不存在と確認済み）
 *   E 調査中                → "unknown"（現時点でどれに該当するか判別できていない）
 */
export type DataAvailabilityStatus = "confirmed" | "not_collected" | "under_review" | "unavailable" | "unknown";

export const DATA_AVAILABILITY_STATUS_LABELS: Record<DataAvailabilityStatus, string> = {
  confirmed: "確認済み",
  not_collected: "未収録",
  under_review: "未確認",
  unavailable: "非公開・不存在",
  unknown: "調査中",
};

/** 短い注記文。「0件」等の数値表示に添えて、意味の取り違えを防ぐために使う。 */
export const DATA_AVAILABILITY_STATUS_NOTES: Record<DataAvailabilityStatus, string> = {
  confirmed: "0件であること自体を公式資料で確認済みです。",
  not_collected: "本サイトがまだ収集・登録していません（存在しないという意味ではありません）。",
  under_review: "存在する可能性はありますが、確認作業がまだ済んでいません。",
  unavailable: "公式資料が非公開、または現存しないことを確認済みです。",
  unknown: "現時点でどの状態に該当するか調査中です。",
};
