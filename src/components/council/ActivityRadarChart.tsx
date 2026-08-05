import type { RadarMetric } from "../../lib/activityRadar";

const SIZE = 280;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE / 2 - 56;
const RINGS = [25, 50, 75, 100];

function pointOnAxis(index: number, count: number, radius: number): { x: number; y: number } {
  // 12時方向を起点に時計回りへ配置する。
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

/**
 * 議員の議会活動データを表すレーダーチャート（自前SVG実装、外部グラフライブラリ不使用）。
 *
 * 【方針】欠損データ（value===null）は0点として描画しない。有効なデータ点同士だけを線で結び、
 * 欠損している軸は塗りつぶし多角形に含めず、外周に「データ未収録」の破線マーカーを表示する。
 * Canvasに情報を依存させないよう、同じデータを直後にHTMLの一覧としても表示すること
 * （このコンポーネント単体はSVGのみを描画し、一覧表示は呼び出し側のActivityRadarSectionが担う）。
 */
export function ActivityRadarChart({ metrics }: { metrics: RadarMetric[] }) {
  const count = metrics.length;
  if (count < 5) return null;

  const available = metrics.map((m) => m.value !== null);

  // 塗りつぶし多角形：連続して値がある軸同士のみを線でつなぐ（欠損軸をまたいで直線補間しない）。
  const segments: string[] = [];
  let current: string[] = [];
  metrics.forEach((m, i) => {
    if (m.value === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const r = (m.value / 100) * MAX_RADIUS;
    const { x, y } = pointOnAxis(i, count, r);
    current.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));
  // 全軸に値がある場合は多角形を閉じる（最初の点を末尾に追加）。
  const allAvailable = available.every(Boolean);
  if (allAvailable && segments.length === 1) {
    const first = segments[0].split(" ")[0];
    segments[0] = `${segments[0]} ${first}`;
  }

  const ariaSummary = metrics
    .map((m) => `${m.label}：${m.value !== null ? `${Math.round(m.value)}点` : "データ未収録"}`)
    .join("、");

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto h-auto w-full max-w-[320px]"
      role="img"
      aria-label={`議会活動データのレーダーチャート。${ariaSummary}。数値は活動状況の指数であり、能力や優劣の評価ではありません。`}
    >
      {/* 同心グリッド */}
      {RINGS.map((ring) => {
        const pts = metrics.map((_, i) => {
          const { x, y } = pointOnAxis(i, count, (ring / 100) * MAX_RADIUS);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        return (
          <polygon
            key={ring}
            points={pts.join(" ")}
            fill="none"
            stroke="var(--color-outline-variant)"
            strokeWidth="1"
            opacity={ring === 100 ? 0.8 : 0.4}
          />
        );
      })}

      {/* 軸線 */}
      {metrics.map((m, i) => {
        const { x, y } = pointOnAxis(i, count, MAX_RADIUS);
        return (
          <line
            key={m.key}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke="var(--color-outline-variant)"
            strokeWidth="1"
            opacity={0.5}
          />
        );
      })}

      {/* データ多角形（欠損軸をまたがない線分のみ） */}
      {segments.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="var(--color-primary)"
          fillOpacity="0.18"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ))}

      {/* データ点・欠損マーカー */}
      {metrics.map((m, i) => {
        if (m.value === null) {
          const { x, y } = pointOnAxis(i, count, MAX_RADIUS * 0.55);
          return (
            <g key={m.key}>
              <circle
                cx={x}
                cy={y}
                r="4"
                fill="var(--color-surface)"
                stroke="var(--color-outline)"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
            </g>
          );
        }
        const r = (m.value / 100) * MAX_RADIUS;
        const { x, y } = pointOnAxis(i, count, r);
        return <circle key={m.key} cx={x} cy={y} r="3.5" fill="var(--color-primary)" />;
      })}

      {/* 軸ラベル */}
      {metrics.map((m, i) => {
        const { x, y } = pointOnAxis(i, count, MAX_RADIUS + 34);
        return (
          <text
            key={m.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--color-on-surface)] text-[11px] font-medium"
          >
            {m.label}
          </text>
        );
      })}
    </svg>
  );
}
