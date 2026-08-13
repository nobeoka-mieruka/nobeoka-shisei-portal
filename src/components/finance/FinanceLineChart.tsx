interface FinanceLineChartPoint {
  label: string;
  /** 未確認・未収録の年度はnullを渡すこと。0を代入すると「実際に0だった」と誤解されるため使わない。 */
  value: number | null;
  isEstimate?: boolean;
}

interface FinanceLineChartProps {
  points: FinanceLineChartPoint[];
  formatValue: (value: number) => string;
  /** スクリーンリーダー向けの説明。省略時は汎用の「推移グラフ」を使う（直後の表で詳細を確認できる）。 */
  ariaLabel?: string;
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD_X = 24;
const PAD_Y = 20;

/**
 * 財政・人口等の年度推移グラフ（自前SVG実装）。
 *
 * 【方針】未確認・未収録の年度（value===null）は0点として描画しない。折れ線は値がある点
 * 同士だけをつなぎ（欠損年度をまたいで直線補間しない）、欠損点には丸マーカーを打たず、
 * 凡例（下部の一覧）には「確認中」と表示する（ActivityRadarChart.tsxの欠損データの扱いと
 * 同じ考え方）。
 */
export function FinanceLineChart({ points, formatValue, ariaLabel = "推移グラフ" }: FinanceLineChartProps) {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const max = values.length > 0 ? Math.max(...values) : 1;
  const min = values.length > 0 ? Math.min(...values) : 0;
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? PAD_X + (i * (WIDTH - PAD_X * 2)) / (points.length - 1) : WIDTH / 2;
    const y = p.value === null ? null : HEIGHT - PAD_Y - ((p.value - min) / range) * (HEIGHT - PAD_Y * 2);
    return { ...p, x, y };
  });

  // 欠損点（value===null）をまたいで直線補間しないよう、連続する非欠損区間ごとに別のpathセグメントへ分ける。
  const segments: string[] = [];
  let current: string[] = [];
  for (const c of coords) {
    if (c.y === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${current.length === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`);
  }
  if (current.length > 1) segments.push(current.join(" "));

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
        <line
          x1={PAD_X}
          y1={HEIGHT - PAD_Y}
          x2={WIDTH - PAD_X}
          y2={HEIGHT - PAD_Y}
          stroke="var(--color-outline-variant)"
          strokeWidth="1"
        />
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
        ))}
        {coords
          .filter((c) => c.y !== null)
          .map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y!}
              r={c.isEstimate ? 5 : 4}
              fill={c.isEstimate ? "var(--color-surface)" : "var(--color-primary)"}
              stroke="var(--color-primary)"
              strokeWidth="2"
            />
          ))}
      </svg>
      <div className="mt-1 flex justify-between gap-1 px-1">
        {points.map((p, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[9px] leading-tight text-on-surface-variant sm:text-xs"
          >
            {p.label}
          </span>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {points.map((p, i) => (
          <li key={i} className="min-w-[92px] flex-1 rounded-lg border border-outline-variant px-2 py-1.5 text-xs">
            <p className="text-on-surface-variant">
              {p.label}
              {p.isEstimate ? "（見込）" : ""}
            </p>
            <p className="font-semibold text-on-surface">{p.value === null ? "確認中" : formatValue(p.value)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
