export interface FinanceBarChartPoint {
  label: string;
  value: number | null;
}

interface FinanceBarChartProps {
  points: FinanceBarChartPoint[];
  /** 表示用の値フォーマッタ。nullは呼び出し側で「確認中」等に変換すること。 */
  formatValue: (value: number | null) => string;
  ariaLabel?: string;
}

/**
 * 横棒グラフ（比較用）。値がnull（未確認）の項目は灰色・幅0で表示し、実際の0（値あり）とは
 * 色で区別する。グラフ単体では完結させず、必ず直後に数値表（FinanceTable等）を併記すること。
 */
export function FinanceBarChart({ points, formatValue, ariaLabel = "比較棒グラフ" }: FinanceBarChartProps) {
  const max = Math.max(...points.map((p) => p.value ?? 0), 0);

  return (
    <div role="img" aria-label={ariaLabel}>
      <ul className="space-y-3">
        {points.map((p, i) => {
          const pct = p.value != null && max > 0 ? Math.round((p.value / max) * 100) : 0;
          return (
            <li key={i}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="text-sm text-on-surface sm:w-24 sm:shrink-0">{p.label}</span>
                <span className="flex flex-1 items-center gap-3">
                  <span className="relative h-4 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full transition-[width]"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: p.value == null ? "var(--color-outline-variant)" : "var(--color-primary)",
                      }}
                    />
                  </span>
                  <span className="w-28 shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-on-surface">
                    {formatValue(p.value)}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
