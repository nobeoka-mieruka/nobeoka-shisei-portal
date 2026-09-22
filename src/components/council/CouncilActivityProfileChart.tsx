import { useId, useState } from "react";
import {
  AXIS_STATUS_LABELS_JA,
  canRenderPolygon,
  measurableAxisCount,
  POLYGON_MIN_AXES,
  type CouncilActivityAxis,
} from "../../lib/councilActivityProfile";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 凡例。色だけで状態を区別しないよう、記号と言葉を必ず添える。
 * 0（確認した結果0件）と、算定できない状態を同じ見た目にしない。
 */
const LEGEND = [
  { symbol: "●", label: "数値あり（公開資料から確認できた値）" },
  { symbol: "○", label: "0（確認した結果、該当なし）" },
  { symbol: "―", label: "N/A（個人単位で算定できない）" },
  { symbol: "△", label: "未確認（確認作業中）" },
  { symbol: "□", label: "未公開（必要な一次資料が未公開）" },
] as const;

/** 状態ごとの記号。凡例と対応させる。 */
const STATUS_SYMBOL: Record<string, string> = {
  CONFIRMED: "●",
  CONDITIONAL: "―",
  NOT_INDIVIDUALLY_ATTRIBUTABLE: "―",
  NOT_ACQUIRED: "△",
  SOURCE_NOT_PUBLISHED: "□",
  RESEARCH_EXHAUSTED: "△",
  NOT_APPLICABLE: "―",
};

const VIEWBOX = 320;
const CENTER = VIEWBOX / 2;
const MAX_RADIUS = 96;
const RINGS = 4;

/** 頂点の座標。頂点1を真上に置き、時計回りに並べる。 */
function pointAt(index: number, count: number, radius: number) {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return { x: CENTER + Math.cos(angle) * radius, y: CENTER + Math.sin(angle) * radius };
}

function ringPoints(count: number, radius: number): string {
  return Array.from({ length: count }, (_, i) => {
    const { x, y } = pointAt(i, count, radius);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

/** ラベルが図の外へはみ出さないよう、位置に応じて寄せ方を変える。 */
function labelAnchor(x: number): "start" | "middle" | "end" {
  if (x < CENTER - 8) return "end";
  if (x > CENTER + 8) return "start";
  return "middle";
}

export function CouncilActivityProfileChart({
  axes,
  memberName,
}: {
  axes: CouncilActivityAxis[];
  memberName: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();
  const count = axes.length;
  const polygon = canRenderPolygon(axes);
  const measurable = measurableAxisCount(axes);

  const summary = axes
    .map((a) =>
      a.measurement
        ? `${a.label}：${a.measurement.rateLabel}${a.measurement.rate}%（${a.measurement.numerator}／${a.measurement.denominator}）`
        : `${a.label}：${AXIS_STATUS_LABELS_JA[a.status]}`,
    )
    .join("、");


  return (
    <div>
      <div className="mx-auto w-full max-w-[20rem]">
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>{`${memberName}議員の議会活動プロフィール（7軸）`}</title>
          <desc id={descId}>
            {`公開された一次資料から確認できた活動の記録です。点数や順位ではありません。${summary}`}
          </desc>

          {/* 補助線（蜘蛛の巣） */}
          {Array.from({ length: RINGS }, (_, r) => (
            <polygon
              key={r}
              points={ringPoints(count, (MAX_RADIUS * (r + 1)) / RINGS)}
              className="fill-none stroke-outline-variant"
              strokeWidth={r === RINGS - 1 ? 1.2 : 0.8}
            />
          ))}
          {axes.map((axis, i) => {
            const p = pointAt(i, count, MAX_RADIUS);
            return (
              <line
                key={axis.key}
                x1={CENTER}
                y1={CENTER}
                x2={p.x}
                y2={p.y}
                className="stroke-outline-variant"
                strokeWidth={0.8}
              />
            );
          })}

          {/* 数値のある軸が3つ以上そろったときだけ、ポリゴンとして描く。
              少ない軸で多角形を閉じると、資料が無いことが活動の少なさに見えてしまう。 */}
          {polygon && (
            <polygon
              points={axes
                .map((a, i) => {
                  const r = a.measurement ? MAX_RADIUS * a.measurement.ratio : 0;
                  const p = pointAt(i, count, r);
                  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                })
                .join(" ")}
              className="fill-primary/25 stroke-primary"
              strokeWidth={1.6}
            />
          )}

          {/* 頂点。数値のある軸は実線の点、無い軸は破線の輪（0の位置へ落とさない）。 */}
          {axes.map((axis, i) => {
            const outer = pointAt(i, count, MAX_RADIUS);
            if (!axis.measurement) {
              return (
                <circle
                  key={axis.key}
                  cx={outer.x}
                  cy={outer.y}
                  r={5}
                  className="fill-none stroke-on-surface-variant"
                  strokeWidth={1.2}
                  strokeDasharray="3 2"
                />
              );
            }
            const p = pointAt(i, count, MAX_RADIUS * axis.measurement.ratio);
            return <circle key={axis.key} cx={p.x} cy={p.y} r={4} className="fill-primary" />;
          })}

          {/* 軸ラベル。図の外側へ置き、2行に折り返して切れないようにする。 */}
          {axes.map((axis, i) => {
            const p = pointAt(i, count, MAX_RADIUS + 26);
            const anchor = labelAnchor(p.x);
            const lines = splitLabel(axis.shortLabel);
            return (
              <text
                key={axis.key}
                x={p.x}
                y={p.y - (lines.length - 1) * 5}
                textAnchor={anchor}
                className="fill-on-surface-variant text-[9px]"
              >
                {lines.map((line, li) => (
                  <tspan key={line} x={p.x} dy={li === 0 ? 0 : 11}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
        </svg>
      </div>

      <p className="mt-1 text-center text-[11px] leading-relaxed text-on-surface-variant">
        外側ほど、その指標で確認できた活動が多いことを表します。外周は満点・優秀という意味ではありません。
      </p>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-on-surface-variant">
        {LEGEND.map((item) => (
          <li key={item.label} className="flex items-center gap-1">
            <span aria-hidden="true" className="font-mono">
              {item.symbol}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {!polygon && (
        <p className="mt-1 text-center text-[11px] leading-relaxed text-on-surface-variant">
          現在、数値として算定できている軸は{measurable}つです。{POLYGON_MIN_AXES}
          つ以上そろうまでは、形（多角形）ではなく軸ごとの状態として示しています。
        </p>
      )}

      {/* 頂点の詳細は、タップしやすいボタンの一覧として別に用意する
          （SVGの頂点だけを当たり判定にすると、指では押せないため）。 */}
      <ul className="mt-3 space-y-1.5">
        {axes.map((axis) => {
          const isOpen = openKey === axis.key;
          return (
            <li key={axis.key} className="rounded-lg border border-outline-variant">
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : axis.key)}
                aria-expanded={isOpen}
                className={`flex min-h-11 w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left ${linkClass}`}
              >
                <span className="text-xs font-medium text-on-surface">
                  {axis.order}. {axis.label}
                </span>
                <span className="text-xs text-on-surface-variant">
                  <span aria-hidden="true" className="mr-1 font-mono">
                    {axis.measurement && axis.measurement.rate === 0
                      ? "○"
                      : STATUS_SYMBOL[axis.status]}
                  </span>
                  {axis.measurement ? (
                    <>
                      <span className="font-semibold text-on-surface">
                        {axis.measurement.rate}%
                      </span>
                      <span className="ml-1">
                        （{axis.measurement.numerator}／{axis.measurement.denominator}）
                      </span>
                    </>
                  ) : (
                    AXIS_STATUS_LABELS_JA[axis.status]
                  )}
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-outline-variant px-3 py-2 text-xs leading-relaxed text-on-surface-variant">
                  {axis.measurement && (
                    <dl className="mb-2 space-y-0.5 rounded-md bg-surface-container-high p-2.5 text-on-surface">
                      <div className="flex justify-between gap-2">
                        <dt>{axis.measurement.numeratorLabel}</dt>
                        <dd className="tabular-nums font-medium">{axis.measurement.numerator}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{axis.measurement.denominatorLabel}</dt>
                        <dd className="tabular-nums font-medium">{axis.measurement.denominator}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{axis.measurement.rateLabel}</dt>
                        <dd className="tabular-nums font-medium">{axis.measurement.rate}%</dd>
                      </div>
                      <p className="mt-1 border-t border-outline-variant pt-1 tabular-nums">
                        {axis.measurement.numerator} ÷ {axis.measurement.denominator} × 100 ={" "}
                        {axis.measurement.rate}%
                      </p>
                    </dl>
                  )}
                  <p>
                    <span className="font-medium text-on-surface">状態：</span>
                    {AXIS_STATUS_LABELS_JA[axis.status]}
                  </p>
                  <p className="mt-1">{axis.reason}</p>
                  <dl className="mt-2 space-y-1 rounded-md bg-surface-container-high p-2.5">
                    <div>
                      <dt className="font-medium text-on-surface">条例上の役割</dt>
                      <dd>{axis.roleInOrdinance}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-on-surface">今回観測している活動</dt>
                      <dd>{axis.observedActivity}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-on-surface">使用データ</dt>
                      <dd>{axis.dataUsed}</dd>
                    </div>
                  </dl>
                  <p className="mt-1">
                    <span className="font-medium text-on-surface">対象期間：</span>
                    {axis.targetPeriodLabel}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium text-on-surface">測っているもの：</span>
                    {axis.measures}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium text-on-surface">測っていないもの：</span>
                    {axis.doesNotMeasure}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium text-on-surface">条例上の根拠：</span>
                    {axis.ordinanceBasis}
                  </p>
                  {axis.sourceRefs.length > 0 && (
                    <p className="mt-1">
                      <span className="font-medium text-on-surface">一次資料：</span>
                      {axis.sourceRefs.map((ref, i) => (
                        <span key={ref.label}>
                          {i > 0 && "、"}
                          {ref.url ? (
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-primary underline ${linkClass}`}
                            >
                              {ref.label}
                            </a>
                          ) : (
                            ref.label
                          )}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 長い軸名を、図からはみ出さないよう2行に折る。 */
function splitLabel(label: string): string[] {
  if (label.length <= 7) return [label];
  const separators = ["・", "と"];
  for (const sep of separators) {
    const at = label.indexOf(sep);
    if (at > 0 && at < label.length - 1) {
      return [label.slice(0, at + sep.length), label.slice(at + sep.length)];
    }
  }
  const mid = Math.ceil(label.length / 2);
  return [label.slice(0, mid), label.slice(mid)];
}
