import { useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  AXIS_STATUS_LABELS_JA,
  AXIS_STATUS_SYMBOLS,
  AXIS_ZERO_SYMBOL,
  canRenderPolygon,
  measurableAxisCount,
  POLYGON_MIN_AXES,
  type CouncilActivityAxis,
} from "../../lib/councilActivityProfile";
import { formatJapaneseDate } from "../../config/site";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 凡例。色だけで状態を区別しないよう、記号と言葉を必ず添える。
 * 0（確認した結果0件）と、算定できない状態を同じ見た目にしない。
 */
const LEGEND = [
  { symbol: AXIS_STATUS_SYMBOLS.CONFIRMED, label: "数値あり（公開資料から確認できた値）" },
  { symbol: AXIS_ZERO_SYMBOL, label: "0（資料を確認した結果、該当なし）" },
  { symbol: AXIS_STATUS_SYMBOLS.NOT_ACQUIRED, label: "未確認（当サイトが取り込めていない）" },
  { symbol: AXIS_STATUS_SYMBOLS.SOURCE_NOT_PUBLISHED, label: "未公開（必要な一次資料が公開されていない）" },
  { symbol: AXIS_STATUS_SYMBOLS.NOT_INDIVIDUALLY_ATTRIBUTABLE, label: "個人単位算定不可" },
  { symbol: AXIS_STATUS_SYMBOLS.NOT_APPLICABLE, label: "対象外（制度上当てはまらない）" },
  { symbol: AXIS_STATUS_SYMBOLS.CONDITIONAL, label: "割合にしていない軸（記録は一覧で表示）" },
] as const;

/** 軸の状態を表す記号。確認した結果0件の軸は、数値ありとは別の記号にする。 */
function axisSymbol(axis: CouncilActivityAxis): string {
  if (axis.measurement && axis.measurement.numerator === 0) return AXIS_ZERO_SYMBOL;
  return AXIS_STATUS_SYMBOLS[axis.status];
}

const VIEWBOX = 320;
const CENTER = VIEWBOX / 2;
const MAX_RADIUS = 88;
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
  const [methodOpen, setMethodOpen] = useState(false);
  const titleId = useId();
  const descId = useId();
  const noticeId = useId();
  const methodPanelId = useId();
  const axisPanelIdPrefix = useId();
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
      {/* 図の直前に置き、図より先に読まれるようにする。 */}
      <p
        id={noticeId}
        className="mb-2 rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-xs leading-relaxed text-on-surface"
      >
        公開資料で確認できた議会活動の記録を図にしたものです。議員の能力・優劣を評価するものではありません（総合点・順位は作成していません）。
      </p>
      <div className="mx-auto w-full max-w-[20rem]">
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          aria-describedby={noticeId}
        >
          <title id={titleId}>{`${memberName}議員の議会活動プロフィール（${count}軸）`}</title>
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
            const p = pointAt(i, count, MAX_RADIUS + 22);
            const anchor = labelAnchor(p.x);
            const lines = splitLabel(axis.shortLabel);
            return (
              <text
                key={axis.key}
                x={p.x}
                y={p.y - (lines.length - 1) * 6 + 4}
                textAnchor={anchor}
                className="fill-on-surface-variant text-[11px]"
              >
                {lines.map((line, li) => (
                  <tspan key={line} x={p.x} dy={li === 0 ? 0 : 13}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
        </svg>
      </div>

      {/* 図の直下に、軸ごとの算定方法をその場で開けるようにする（別ページへ移動させない）。 */}
      <div className="mt-1 text-center">
        <button
          type="button"
          onClick={() => setMethodOpen((v) => !v)}
          aria-expanded={methodOpen}
          aria-controls={methodPanelId}
          className={`inline-flex min-h-11 items-center gap-1 rounded-full border border-outline-variant px-4 py-2 text-sm font-medium text-primary ${linkClass}`}
        >
          <span aria-hidden="true">{methodOpen ? "▲" : "▼"}</span>
          {methodOpen ? "算定方法を閉じる" : "算定方法を見る"}
        </button>
      </div>
      {methodOpen && (
        <div
          id={methodPanelId}
          className="mt-2 space-y-2 rounded-lg border border-outline-variant p-3 text-xs leading-relaxed text-on-surface-variant"
        >
          <p>
            軸ごとに、何を数えているか・分子と分母・除外条件・欠測値の扱い・一次資料を示します。
            すべての議員に同じ期間・同じ算定方法・同じ除外条件を適用しています。
          </p>
          {axes.map((axis) => (
            <section key={axis.key} className="rounded-md bg-surface-container-high p-2.5">
              <h3 className="text-xs font-semibold text-on-surface">
                {axis.order}. {axis.label}
              </h3>
              <dl className="mt-1 space-y-1">
                <MethodRow term="何を数えているか" value={axis.measures} />
                <MethodRow term="対象期間" value={axis.targetPeriodLabel} />
                <MethodRow term="分子" value={axis.numeratorRule} />
                <MethodRow term="分母" value={axis.denominatorRule} />
                <MethodRow term="除外条件" value={axis.notApplicableRule} />
                <MethodRow term="欠測値の扱い" value={axis.missingRule} />
                <div>
                  <dt className="inline font-medium text-on-surface">一次資料：</dt>
                  <dd className="inline">
                    {axis.sourceRefs.map((ref, i) => (
                      <span key={ref.label}>
                        {i > 0 && "、"}
                        {ref.url ? (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${ref.label}（新しいタブで開く）`}
                            className={`text-primary underline ${linkClass}`}
                          >
                            {ref.label}
                          </a>
                        ) : (
                          ref.label
                        )}
                      </span>
                    ))}
                    （{axis.dataUsed}）
                  </dd>
                </div>
                <MethodRow
                  term="最終確認日"
                  value={axis.lastCheckedAt ? formatJapaneseDate(axis.lastCheckedAt) : "記録なし"}
                />
              </dl>
            </section>
          ))}
          <Link
            to="/methodology/council-activity"
            className={`inline-flex min-h-11 items-center font-medium text-primary underline ${linkClass}`}
          >
            算定方法の全文（計算式・状態の定義）を読む
          </Link>
        </div>
      )}

      <p className="mt-2 text-center text-[11px] leading-relaxed text-on-surface-variant">
        外側ほど、その指標で確認できた記録の割合が高いことを表します。外周（100%）は満点・優秀という意味ではありません。
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
            <li key={axis.key} data-axis-key={axis.key} className="rounded-lg border border-outline-variant">
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : axis.key)}
                aria-expanded={isOpen}
                aria-controls={`${axisPanelIdPrefix}-${axis.key}`}
                className={`flex min-h-11 w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left ${linkClass}`}
              >
                <span className="text-xs font-medium text-on-surface">
                  {axis.order}. {axis.label}
                </span>
                <span className="text-xs text-on-surface-variant">
                  <span aria-hidden="true" className="mr-1 font-mono">
                    {axisSymbol(axis)}
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
                <div
                  id={`${axisPanelIdPrefix}-${axis.key}`}
                  className="border-t border-outline-variant px-3 py-2 text-xs leading-relaxed text-on-surface-variant"
                >
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

function MethodRow({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="inline font-medium text-on-surface">{term}：</dt>
      <dd className="inline">{value}</dd>
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
