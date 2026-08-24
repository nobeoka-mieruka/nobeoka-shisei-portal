/**
 * GREEN / YELLOW / RED 判定と、サーキットブレーカー（異常な大量変更の検出）の共通ロジック
 * （Workstream A：共通コア）。
 */

/**
 * 1件分の判定。
 * @param {{
 *   schemaValid: boolean,
 *   schemaErrors: string[],
 *   outcome: "new"|"updated"|"unchanged"|"reconciled"|"removed_candidate"|"error",
 *   isOfficialPrimarySource: boolean,
 *   reachable: boolean|null,
 *   httpStatus: number|null,
 *   requiresHumanReview: boolean,
 *   humanReviewReason?: string,
 *   anomalyDetected: boolean,
 *   anomalyReason?: string,
 * }} input
 * @returns {{ level: "GREEN"|"YELLOW"|"RED", reason: string }}
 */
export function classifyItem(input) {
  if (!input.schemaValid) {
    return { level: "RED", reason: `schema検証失敗: ${input.schemaErrors.join("; ")}` };
  }
  if (!input.isOfficialPrimarySource) {
    return { level: "RED", reason: "公式一次資料以外のsourceType（二次資料・報道・SNS等）は自動反映対象外" };
  }
  if (input.anomalyDetected) {
    return { level: "RED", reason: `異常値検知: ${input.anomalyReason ?? "詳細不明"}` };
  }
  if (input.outcome === "error") {
    return { level: "RED", reason: "取得・解析エラー" };
  }
  if (input.reachable === false) {
    return { level: "RED", reason: `資料本体への到達に失敗（httpStatus=${input.httpStatus}）` };
  }
  if (input.outcome === "removed_candidate") {
    // 公式サイトから見えなくなった場合でも自動削除はしない。必ずYELLOW（人間確認）にする。
    return { level: "YELLOW", reason: "公式サイトから見えなくなった資料（source_missing）。削除は自動実行しないため人間確認が必要" };
  }
  if (input.requiresHumanReview) {
    return { level: "YELLOW", reason: input.humanReviewReason ?? "人間確認が必要な項目" };
  }
  if (input.outcome === "unchanged") {
    return { level: "GREEN", reason: "既知資料・変更なし（機械的に確定）" };
  }
  if ((input.outcome === "new" || input.outcome === "updated") && input.reachable === true && input.httpStatus === 200) {
    return { level: "GREEN", reason: "公式ドメイン・schema一致・本体到達確認・異常値なし" };
  }
  // 到達確認が未実施（reachable===null）等、判断材料が不足する場合は安全側でYELLOW。
  return { level: "YELLOW", reason: "自動確定に必要な確認が一部未実施のため人間確認を推奨" };
}

/**
 * サーキットブレーカー：1回の実行で検出された変更量が、データ種別ごとの想定を大幅に超える場合に
 * 発動する。発動時はGREEN自動反映を一切行わず、RUN全体をYELLOW以上として扱う。
 *
 * @param {{ target: string, newCount: number, updatedCount: number, removedCandidateCount: number, detectedTotal: number, previousKnownTotal: number }} input
 * @param {{ maxNewRatio?: number, maxNewAbsolute?: number, maxRemovedRatio?: number }} [thresholds]
 */
export function checkCircuitBreaker(input, thresholds = {}) {
  // updatedCountは将来の閾値拡張（例：更新件数の急増検知）のためinputのJSDocには残すが、
  // 現時点では新規件数・消失件数のみを判定材料にしている。
  const { target, newCount, removedCandidateCount, detectedTotal, previousKnownTotal } = input;
  const maxNewRatio = thresholds.maxNewRatio ?? 0.3; // 既知件数の30%を超える新規は異常とみなす
  const maxNewAbsolute = thresholds.maxNewAbsolute ?? 50; // 1回の実行での新規件数の絶対上限
  const maxRemovedRatio = thresholds.maxRemovedRatio ?? 0.3;

  if (newCount > maxNewAbsolute) {
    return { tripped: true, reason: `${target}: 新規検出件数(${newCount})が1回の実行の想定上限(${maxNewAbsolute})を超過` };
  }
  if (previousKnownTotal > 0 && newCount / previousKnownTotal > maxNewRatio) {
    return {
      tripped: true,
      reason: `${target}: 新規検出件数(${newCount})が既知件数(${previousKnownTotal})の${Math.round(maxNewRatio * 100)}%を超過`,
    };
  }
  if (previousKnownTotal > 0 && removedCandidateCount / previousKnownTotal > maxRemovedRatio) {
    return {
      tripped: true,
      reason: `${target}: 消失候補件数(${removedCandidateCount})が既知件数(${previousKnownTotal})の${Math.round(maxRemovedRatio * 100)}%を超過`,
    };
  }
  if (detectedTotal === 0 && previousKnownTotal > 0) {
    return { tripped: true, reason: `${target}: 検出件数が0件（公式ページの構造変化等の可能性）` };
  }
  return { tripped: false, reason: null };
}
