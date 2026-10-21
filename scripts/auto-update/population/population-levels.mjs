/**
 * 人口Updaterのサーキットブレーカーと総合判定（update-population.mjs から分離した純粋関数。
 * update-population.mjs は読み込むと main() を実行するため、テストからはこちらを読み込む）。
 */
import { checkCircuitBreaker } from "../core/classify.mjs";

/**
 * 人口の監視対象は常に1件（人口・世帯数の推移xls）で、1回の実行で新しく見つかる基準日は
 * 通常の月次更新なら1件だけである。既定の閾値（既知件数の30%）をそのまま当てると、
 * 既知件数1件に対して新規1件＝100%となり、正常な月次更新のたびに発動してしまっていた
 * （2026-10-20のdry-run #61で、YELLOW1件・RED0件なのに総合REDになった原因）。
 * そこで人口では割合判定を使わず、「1回で2件以上の新しい基準日」または「検出0件」のときだけ発動する。
 */
export function checkPopulationCircuitBreaker({ target = "population", newCount, detectedTotal }) {
  return checkCircuitBreaker(
    { target, newCount, updatedCount: 0, removedCandidateCount: 0, detectedTotal, previousKnownTotal: 1 },
    { maxNewAbsolute: 1, maxNewRatio: Number.POSITIVE_INFINITY },
  );
}

/**
 * 総合判定。サーキットブレーカー発動・RED項目・出典URL解決のRED異常のいずれかがあればRED、
 * YELLOW項目または出典URL解決のYELLOW異常があればYELLOW、それ以外はGREEN。
 */
export function computePopulationOverallLevel({ circuitBreakerTripped, summary, resolutionSeverity }) {
  if (circuitBreakerTripped || summary.red > 0 || summary.error > 0 || resolutionSeverity === "RED") return "RED";
  if (summary.yellow > 0 || resolutionSeverity === "YELLOW") return "YELLOW";
  return "GREEN";
}
