interface FinanceLineChartPoint {
  label: string;
  value: number;
  isEstimate?: boolean;
}

interface FinanceLineChartProps {
  points: FinanceLineChartPoint[];
  formatValue: (value: number) => string;
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD_X = 24;
const PAD_Y = 20;

export function FinanceLineChart({ points, formatValue }: FinanceLineChartProps) {
  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? PAD_X + (i * (WIDTH - PAD_X * 2)) / (points.length - 1) : WIDTH / 2;
    const y = HEIGHT - PAD_Y - ((p.value - min) / range) * (HEIGHT - PAD_Y * 2);
    return { ...p, x, y };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="推移グラフ">
        <line
          x1={PAD_X}
          y1={HEIGHT - PAD_Y}
          x2={WIDTH - PAD_X}
          y2={HEIGHT - PAD_Y}
          stroke="var(--color-outline-variant)"
          strokeWidth="1"
        />
        <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
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
            <p className="font-semibold text-on-surface">{formatValue(p.value)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
