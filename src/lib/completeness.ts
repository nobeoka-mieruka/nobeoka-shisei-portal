/**
 * データセットの「収録件数」と「収録率」を分離して扱うための共通ロジック。
 *
 * 重要な方針（Phase 17）：
 * - 母数（totalKnown）は、公式一覧・公式会期一覧・公式議員一覧等、一次資料から確認できる
 *   場合のみ設定する。推測で母数を作らない。母数が分からない場合は必ずnullとし、
 *   coverageRateもnullになる（画面側は「収録率：算出不可」等と表示すること）。
 * - 「0件」「未収録」「未確認」を区別する。0件を安易にnot_collectedやunknownと
 *   混同しない（confirmed_zeroという専用の状態を用意する）。
 *
 * このファイルはReact/JSXに依存しないため、ページコンポーネント（ブラウザ・SSR）と
 * Node製の検証スクリプト（scripts/validate-completeness.mjs）の両方から
 * `node --experimental-strip-types`で直接importできる（拡張子なしの相対importを
 * 増やさないこと。既存のsrc/lib/questionLikeSpeechTypes.tsと同じ「leafモジュール」方針）。
 */

export type CompletenessStatus =
  | "complete" // 公式母数と照合して完全収録
  | "partial" // 一部収録
  | "not_collected" // 存在確認済みだが未収録
  | "not_available" // 一次資料が非公開・未公表
  | "unknown" // 母数・存在自体が未確認
  | "under_review" // 調査中
  | "confirmed_zero"; // 一次資料を確認した結果、本当に0件

export interface CompletenessMetric {
  /** 現在サイトに収録している件数。 */
  collected: number;
  /**
   * 一次資料で確認できた母数。分からない場合は必ずnull（推測しない）。
   * confirmed_zeroの場合は0を設定する（「確認した結果ゼロだった」という意味の0であり、
   * 「調べていない」という意味のnullとは異なる）。
   */
  totalKnown: number | null;
  /** collected / totalKnown（totalKnownがnullの場合はnull。0〜100の範囲）。 */
  coverageRate: number | null;
  status: CompletenessStatus;
}

/**
 * collected件・totalKnown件（またはnull＝母数不明）から、CompletenessMetricを組み立てる。
 * statusは明示的に渡す（自動推測しない）。confirmed_zeroの場合はtotalKnownに0を渡すこと。
 */
export function completenessMetric(
  collected: number,
  totalKnown: number | null,
  status: CompletenessStatus,
): CompletenessMetric {
  const coverageRate = totalKnown === null || totalKnown === 0 ? (totalKnown === 0 && collected === 0 ? 100 : null) : Math.min(100, Math.max(0, (collected / totalKnown) * 100));
  return { collected, totalKnown, coverageRate, status };
}

/** 母数が既知の単純ケース（collected件／totalKnown件）向けの簡易ヘルパー。 */
export function simpleCompleteness(collected: number, totalKnown: number): CompletenessMetric {
  if (totalKnown === 0) {
    return completenessMetric(collected, 0, "confirmed_zero");
  }
  const status: CompletenessStatus = collected >= totalKnown ? "complete" : collected > 0 ? "partial" : "not_collected";
  return completenessMetric(collected, totalKnown, status);
}

/** 母数不明のケース向けの簡易ヘルパー。 */
export function unknownTotalCompleteness(collected: number): CompletenessMetric {
  return completenessMetric(collected, null, "unknown");
}

export const COMPLETENESS_STATUS_LABELS: Record<CompletenessStatus, string> = {
  complete: "完全収録",
  partial: "一部収録",
  not_collected: "未収録",
  not_available: "一次資料未公開",
  unknown: "母数未確認",
  under_review: "調査中",
  confirmed_zero: "確認済み0件",
};

/**
 * 収録率を市民向けの短い文字列にする（母数不明ならその旨を明示）。
 * 四捨五入で99.9%のような値が「100%」に見えてしまうと、「完全収録ではない」という
 * 実態と矛盾して見えるため、実際にちょうど100%（＝complete）でない限り、
 * 表示上は99%が上限になるよう切り捨てる。
 */
export function formatCoverageRate(metric: CompletenessMetric): string {
  if (metric.coverageRate === null) return "算出不可（母数未確認）";
  if (metric.coverageRate >= 100) return "100%";
  return `${Math.min(99, Math.floor(metric.coverageRate))}%`;
}
