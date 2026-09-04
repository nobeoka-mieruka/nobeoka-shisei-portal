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
 * Phase211：横軸ラベルの間引き幅。
 *
 * 【背景】横軸ラベルは1点につき1マスの等幅レイアウトで並べているが、ラベル自体（例「2014年度」）は
 * それ以上縮まない幅を持つため、点数が多いとラベル列が描画領域からあふれ、右側のラベルが
 * 画面外へ切れていた。実測（375px幅・/finance/funds の26点グラフ）では26件中13件が切れ、
 * 「2021〜2025年度の折れ線が2010〜2012年度のラベルの上に見える」という、年度を読み違える
 * 表示になっていた（グラフ自体は全幅で描かれるため、残ったラベルと点の位置が対応しなくなる）。
 *
 * 【方針】ラベルを間引いて表示する。マス自体は全点分そのまま残し、間引いたラベルは
 * `visibility:hidden`（Tailwindの`invisible`）にするため、点とラベルの位置対応はずれない。
 * 値そのものはグラフ直下の一覧に全点分を表示しているため、情報は失われない。
 *
 * 下記は「その画面幅で無理なく並べられるラベル数の上限」の目安（実測に基づく）。
 * 画面が広い段は狭い段より必ず多く表示し、狭い段で表示するラベルは広い段でも必ず表示する
 * （間引き幅を互いの倍数にすることで担保する）。
 */
const AXIS_LABEL_CAPACITY = [
  /** 〜639px（ラベル9px）。 */ { className: "", capacity: 12 },
  /** 640〜767px（ラベル12px）。 */ { className: "invisible sm:visible", capacity: 17 },
  /** 768〜1023px。 */ { className: "invisible md:visible", capacity: 21 },
  /** 1024px〜（本文の最大幅に達する）。 */ { className: "invisible lg:visible", capacity: 30 },
] as const;

/**
 * 画面幅の段ごとの間引き幅（何点おきにラベルを表示するか）を求める。
 * 広い段から順に決め、狭い段の間引き幅は必ず広い段の倍数にする
 * （狭い段で表示するラベルが広い段で消える、という逆転を防ぐ）。
 * 最新年度が必ず表示されるよう、末尾（最後の点）を基準に間引く。
 */
function axisLabelSteps(total: number): number[] {
  const steps: number[] = [];
  let step = 1;
  for (let i = AXIS_LABEL_CAPACITY.length - 1; i >= 0; i--) {
    const { capacity } = AXIS_LABEL_CAPACITY[i];
    while (Math.ceil(total / step) > capacity) step += steps.length === 0 ? 1 : step;
    steps.unshift(step);
  }
  return steps;
}

/** 各ラベルに与える表示クラス。狭い段で表示されるものは空文字（＝常時表示）。 */
function axisLabelClassName(index: number, total: number, steps: number[]): string {
  const fromEnd = total - 1 - index;
  for (let i = 0; i < steps.length; i++) {
    if (fromEnd % steps[i] === 0) return AXIS_LABEL_CAPACITY[i].className;
  }
  return "invisible";
}

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

  const labelSteps = axisLabelSteps(points.length);

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
      {/*
        横軸ラベル。`minmax(0, 1fr)`の等幅グリッドにすることで、ラベルの文字幅にかかわらず
        マスの幅が必ず等しくなり、グラフ上の点とラベルの位置が一致する（flexでは幅の広い
        ラベルのマスだけが広がり、点とラベルがずれていた）。ラベル自身は`w-min`で
        最小幅にとどめ、マスの中央に置く。
      */}
      <div
        className="mt-1 grid gap-1 px-1"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((p, i) => (
          <span
            key={i}
            className={`w-min justify-self-center text-center text-[9px] leading-tight text-on-surface-variant sm:text-xs ${axisLabelClassName(i, points.length, labelSteps)}`}
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
