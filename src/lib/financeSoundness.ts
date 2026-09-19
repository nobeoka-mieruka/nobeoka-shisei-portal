/**
 * Phase260：財政健全化判断比率等（地方公共団体財政健全化法に基づく5指標）の表示用ヘルパー。
 *
 * データの単一情報源は src/data/archiveFiscalYears.json の finance
 * （実質公債費比率・将来負担比率の値は finance.realDebtServiceRatioPercent・futureBurdenRatioPercent、
 *   5指標の区分・法定基準は finance.soundness）。財政ダッシュボード・年度比較ページが
 * 同じ判定（特に「該当なし」と「確認中」の区別）を使うよう、ここへ集約する。
 *
 * 【表示方針】
 * - 延岡市の実績値と、法定基準（早期健全化基準・財政再生基準・経営健全化基準）を混同しない。
 * - 数値の変化は「前年度から○ポイント上昇」のように事実のみを示し、「悪化」「危険」等の評価はしない。
 * - 「該当なし」（赤字・資金不足が生じていない／算定されない）は0%とも「確認中」とも区別する。
 */
import type { ArchiveFinance, ArchiveFinanceSoundness, ArchiveFiscalYear } from "../types/historicalArchive";
import { toEraFiscalYearLabel } from "../config/site.ts";

export type SoundnessDisplayStatus = "reported" | "notApplicable" | "unconfirmed";

export type SoundnessValueField = "realDebtServiceRatioPercent" | "futureBurdenRatioPercent";

/** 市民向けの短い説明（「この数字は何を見るものか」）。延岡市の実際の数値の評価は含めない。 */
export const SOUNDNESS_INDICATORS = [
  {
    key: "actualDeficitRatio",
    label: "実質赤字比率",
    description:
      "福祉・教育・まちづくりなどを行う一般会計等に赤字があるとき、その赤字が財政規模（標準財政規模）に対してどの程度かを見る指標です。",
  },
  {
    key: "consolidatedActualDeficitRatio",
    label: "連結実質赤字比率",
    description:
      "一般会計に加え、国民健康保険などの特別会計や水道・下水道などの企業会計まで、市のすべての会計を合わせた赤字の程度を見る指標です。",
  },
  {
    key: "realDebtServiceRatio",
    label: "実質公債費比率",
    description:
      "市の収入（標準財政規模）に対して、借金（市債）の返済などの実質的な負担がどの程度あるかを見る指標です。",
  },
  {
    key: "futureBurdenRatio",
    label: "将来負担比率",
    description:
      "市債の残高や将来支払う予定の退職手当など、市が将来負担する可能性のある借金や負担が、財政規模に対してどの程度あるかを見る指標です。",
  },
] as const satisfies ReadonlyArray<{ key: keyof Omit<ArchiveFinanceSoundness, "fundShortageRatios" | "sourceRef">; label: string; description: string }>;

export const FUND_SHORTAGE_DESCRIPTION =
  "水道・下水道などの公営企業に資金不足があるとき、その不足額が料金収入などの事業規模に対してどの程度かを見る指標です（会計ごとに算定）。";

/**
 * 実質公債費比率・将来負担比率の区分。
 * soundness（健全化判断比率等の公表ページ由来）があればそれに従い、なければ
 * notApplicableRatios（過年度の資料で「該当なし」と明記されていたもの）を見る。
 * いずれにも該当せず値がnullなら「確認中」。
 */
export function soundnessValueStatus(finance: ArchiveFinance | undefined, field: SoundnessValueField): SoundnessDisplayStatus {
  if (!finance) return "unconfirmed";
  if (finance[field] != null) return "reported";
  const key = field === "realDebtServiceRatioPercent" ? "realDebtServiceRatio" : "futureBurdenRatio";
  if (finance.soundness?.[key].status === "notApplicable") return "notApplicable";
  if (finance.notApplicableRatios?.includes(field)) return "notApplicable";
  return "unconfirmed";
}

/** 表・一覧向けの表示文字列（「8.7％」「該当なし」「確認中」）。 */
export function formatSoundnessValue(finance: ArchiveFinance | undefined, field: SoundnessValueField): string {
  const status = soundnessValueStatus(finance, field);
  // 公表資料は小数第1位まで表記する（例：4.0％）。
  if (status === "reported") return formatRatioPercent(finance![field] as number);
  return status === "notApplicable" ? "該当なし" : "確認中";
}

export function formatStandardPercent(value: number | null): string {
  // 公表資料の桁（11.66％・25.0％・350.0％）に合わせ、小数第2位がある基準だけ2桁で表示する。
  return value === null ? "定めなし" : `${value.toFixed(Number.isInteger(Math.round(value * 100) / 10) ? 1 : 2)}％`;
}

/**
 * 前年度差（ポイント）。浮動小数の誤差（32.3 - 15.9 = 16.399999…）を避けるため、
 * 公表値の桁（小数第1位）に丸める。どちらかが数値でなければnull。
 */
export function pointDifference(current: number | null | undefined, prior: number | null | undefined): number | null {
  if (typeof current !== "number" || typeof prior !== "number") return null;
  return Math.round((current - prior) * 10) / 10;
}

/** 「前年度から16.4ポイント上昇」のような客観的な表現。評価語（悪化・改善等）は使わない。 */
export function describePointDifference(diff: number | null): string | null {
  if (diff === null) return null;
  if (diff === 0) return "前年度と同じ";
  return `前年度から${Math.abs(diff).toFixed(1)}ポイント${diff > 0 ? "上昇" : "低下"}`;
}

/** soundness（5指標の区分・法定基準）が登録されている最新年度。 */
export function latestSoundnessYear(years: ArchiveFiscalYear[]): ArchiveFiscalYear | undefined {
  return [...years].filter((y) => y.finance?.soundness).sort((a, b) => b.fiscalYear - a.fiscalYear)[0];
}

/** 「令和7年度決算」のような決算年度ラベル。 */
export function settlementLabel(fiscalYear: number): string {
  return `${toEraFiscalYearLabel(fiscalYear)}決算`;
}

/** 健全化判断比率の実績値の表示。公表資料どおり小数第1位まで表記する（4 → 「4.0％」）。 */
export function formatRatioPercent(value: number): string {
  return `${value.toFixed(1)}％`;
}
