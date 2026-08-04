export interface FinanceStackedBarSegment {
  key: string;
  label: string;
  value: number | null;
  color: string;
}

export interface FinanceStackedBarChartPoint {
  label: string;
  segments: FinanceStackedBarSegment[];
}

interface FinanceStackedBarChartProps {
  points: FinanceStackedBarChartPoint[];
  formatValue: (value: number | null) => string;
  ariaLabel?: string;
}

const CHART_HEIGHT = 180;

/**
 * 積み上げ棒グラフ（比較用）。年度・市長任期などの区分ごとに、内訳（例：財源調整用基金＋
 * その他特定目的基金）を積み上げて表示する。値がnull（未確認）の区分は高さ0とし、
 * 直後の凡例・数値表で「確認中」であることを明示する（0と未確認の混同を避けるため）。
 */
export function FinanceStackedBarChart({ points, formatValue, ariaLabel = "積み上げ比較棒グラフ" }: FinanceStackedBarChartProps) {
  const maxTotal = Math.max(
    ...points.map((p) => p.segments.reduce((sum, s) => sum + (s.value ?? 0), 0)),
    1,
  );
  const legend = points[0]?.segments ?? [];

  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="flex items-end justify-around gap-3 sm:gap-6">
        {points.map((p, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="flex w-full max-w-[64px] flex-col-reverse overflow-hidden rounded-t-lg bg-surface-container-high"
              style={{ height: CHART_HEIGHT }}
            >
              {p.segments.map((s) => {
                const heightPct = maxTotal > 0 ? ((s.value ?? 0) / maxTotal) * 100 : 0;
                return (
                  <div
                    key={s.key}
                    style={{ height: `${heightPct}%`, backgroundColor: s.value == null ? "var(--color-outline-variant)" : s.color }}
                  />
                );
              })}
            </div>
            <span className="text-center text-[11px] leading-tight text-on-surface-variant sm:text-xs">{p.label}</span>
          </div>
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-3">
        {legend.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {points.map((p, i) => (
          <li key={i} className="rounded-lg border border-outline-variant px-2 py-1.5 text-xs">
            <p className="text-on-surface-variant">{p.label}</p>
            {p.segments.map((s) => (
              <p key={s.key} className="font-semibold text-on-surface">
                {s.label}：{formatValue(s.value)}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
