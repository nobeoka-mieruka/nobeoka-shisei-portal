/**
 * Phase216：折れ線グラフ（FinanceLineChart）の年度系列を組み立てる共通ヘルパー。
 *
 * 【背景】/finance/funds の基金総額グラフでは、基金の値を確認できた年度が1989年度と
 * 2009〜2024年度しかないにもかかわらず、FinanceMetricSectionが未確認（null）の年度を
 * グラフへ渡す前に取り除いていたため、資料が無い11〜19年分が横軸1目盛りへ圧縮され、
 * 1989年度と2009年度が直線で結ばれていた。線で結ぶという表現は「その間も同じ傾向で
 * 推移した」という意味に読めるため、確認できていない期間について事実でない印象を与える。
 *
 * 【方針】値そのものは絶対に生成しない（欠損年度の補間・推定は行わない）。
 * 横軸だけを1年度＝1目盛りの連続した年度軸にそろえ、確認できていない年度は「値なし」の
 * 点として並べる。線は「配列上で隣り合い、かつ年度が1つ違い」の点どうしだけを結ぶ。
 */

/** 折れ線グラフ1点分のうち、年度軸の組み立てに必要な最小限の情報。 */
export interface FinanceChartYearPoint {
  /** 年度（西暦）。 */
  year: number;
  /** 横軸・一覧に表示するラベル（例「2009年度」）。 */
  label: string;
  /** 未確認・未収録の年度はnull。0を代入すると「実際に0だった」と誤解されるため使わない。 */
  value: number | null;
  isEstimate?: boolean;
}

/** 線の連結可否の判定に必要な最小限の情報（FinanceLineChartPointもこの形を満たす）。 */
export interface FinanceLineSeriesPoint {
  value: number | null;
  /** 年度が分かる系列のみ指定する。未指定の系列（国勢調査の5年おきの人口など）は年度差を判定しない。 */
  year?: number;
}

/**
 * 未確認の年度を「値なし」の点として補い、1年度＝1目盛りの連続した年度軸にそろえる。
 *
 * ・値は一切生成しない。補った点のvalueは必ずnullで、元の点の値・isEstimateはそのまま保持する。
 * ・先頭・末尾の未確認年度は表示範囲から外す（グラフの端に空白が続くだけで情報量が増えないため）。
 *   除外した年度も「資料未確認の年度」の注記には引き続き列挙する（呼び出し側の責任）。
 * ・確認済みの値が1件も無い場合は、並べ替えだけ行って元の点をそのまま返す。
 */
export function continuousFiscalYearSeries(
  points: FinanceChartYearPoint[],
  labelForYear: (year: number) => string,
): FinanceChartYearPoint[] {
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const firstIndex = sorted.findIndex((p) => p.value != null);
  if (firstIndex < 0) return sorted;
  let lastIndex = sorted.length - 1;
  while (lastIndex > firstIndex && sorted[lastIndex].value == null) lastIndex -= 1;

  const kept = sorted.slice(firstIndex, lastIndex + 1);
  const byYear = new Map(kept.map((p) => [p.year, p]));
  const filled: FinanceChartYearPoint[] = [];
  for (let year = kept[0].year; year <= kept[kept.length - 1].year; year += 1) {
    filled.push(byYear.get(year) ?? { year, label: labelForYear(year), value: null });
  }
  return filled;
}

/** 直前の点と線で結んでよいか。年度が分かる系列では「1年度違い」のときだけ結ぶ。 */
function isConnectableYear(prev: FinanceLineSeriesPoint, curr: FinanceLineSeriesPoint): boolean {
  if (prev.year === undefined || curr.year === undefined) return true;
  return curr.year - prev.year === 1;
}

/**
 * 線でつないでよい点のインデックスを、区間（セグメント）ごとに分けて返す。
 * 未確認（value===null）の点でいったん区切り、年度が飛んでいる箇所でも区切る。
 * 単独の点（前後が欠損）も長さ1のセグメントとして返す（マーカーだけを描くため）。
 */
export function financeLineSegments(points: FinanceLineSeriesPoint[]): number[][] {
  const segments: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (point.value == null) {
      if (current.length > 0) segments.push(current);
      current = [];
      continue;
    }
    const prevIndex = current.length > 0 ? current[current.length - 1] : -1;
    if (prevIndex >= 0 && !isConnectableYear(points[prevIndex], point)) {
      segments.push(current);
      current = [];
    }
    current.push(i);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

/** 線をつないでいない区間（＝資料未確認の期間）。両側に確認済みの点がある箇所だけを返す。 */
export interface FinanceLineGap {
  /** 欠損区間の左側にある、最後の確認済みの点のインデックス。 */
  fromIndex: number;
  /** 欠損区間の右側にある、最初の確認済みの点のインデックス。 */
  toIndex: number;
  /** 値を確認できていない年度の一覧（年度が分からない系列では空配列）。 */
  missingYears: number[];
}

export function financeLineGaps(points: FinanceLineSeriesPoint[]): FinanceLineGap[] {
  const segments = financeLineSegments(points);
  const gaps: FinanceLineGap[] = [];
  for (let s = 1; s < segments.length; s += 1) {
    const prevSegment = segments[s - 1];
    const fromIndex = prevSegment[prevSegment.length - 1];
    const toIndex = segments[s][0];
    const fromYear = points[fromIndex].year;
    const toYear = points[toIndex].year;
    const missingYears =
      fromYear !== undefined && toYear !== undefined
        ? Array.from({ length: Math.max(0, toYear - fromYear - 1) }, (_, k) => fromYear + 1 + k)
        : [];
    gaps.push({ fromIndex, toIndex, missingYears });
  }
  return gaps;
}

/** 年度の一覧を「1990〜2008年度、2017年度」のように区間へまとめる（長い羅列を避けるため）。 */
export function formatFiscalYearRanges(years: number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const isLast = i === sorted.length - 1;
    if (isLast || sorted[i + 1] !== sorted[i] + 1) {
      parts.push(start === i ? `${sorted[start]}年度` : `${sorted[start]}〜${sorted[i]}年度`);
      start = i + 1;
    }
  }
  return parts.join("、");
}
