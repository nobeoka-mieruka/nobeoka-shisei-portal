import type { ArchiveFiscalYear } from "../../types/historicalArchive";
import type { FinanceMetricDefinition } from "../../lib/archiveFinanceMetrics";
import { fiscalYearLabel } from "../../lib/archiveFinance";
import { archiveVerificationStatusLabel } from "../../lib/archiveMayors";
import { FinanceLineChart } from "./FinanceLineChart";
import { FinanceBarChart } from "./FinanceBarChart";
import { CompareTable } from "../compare/CompareTable";
import { CompareSourceNotice } from "../compare/CompareSourceNotice";
import { humanizeDataNote } from "../../lib/citizenTermLabels";
import { continuousFiscalYearSeries, formatFiscalYearRanges } from "../../lib/financeChartSeries";

interface FinanceMetricSectionProps {
  metric: FinanceMetricDefinition;
  /** 昇順（古い年度が先）に並べた年度データ。全年度の推移にも、2〜4件の選択比較にも使う。 */
  years: ArchiveFiscalYear[];
  /**
   * 数値表（年度・値・定義・確認状況・出典）を表示するか。
   * 既定はtrue。年度一覧ページでFinanceYearCardsと内容が重複する場合はfalseにして、
   * グラフと「未確認年度」の注記だけを残す。
   */
  showTable?: boolean;
  /**
   * Phase216：折れ線グラフの横軸を「1年度＝1目盛り」の連続した年度軸にそろえるか。
   * 全年度の推移を見せるページ（/finance/funds等）ではtrueにする。年度を2〜4件選んで
   * 並べる比較ページでは、選ばなかった年度まで軸に並んでしまうためfalse（既定）のままにする。
   * trueにしても値は生成せず、確認できていない年度は「値なし」として点も線も描かない。
   */
  continuousYearAxis?: boolean;
}

/**
 * 財政指標1件分の「グラフ＋数値表＋出典」をまとめた共通表示。
 * グラフはmetric.chartKindに応じて折れ線（ストック値の推移）・棒（フロー値の年度別比較）を
 * 自動選択し、未確認（null）の年度を0として描画しない（棒は灰色0幅、折れ線は該当年度を除外し注記する）。
 * 数値表は年度・値・定義・確認状況・出典を併記する（単位は値の文字列に既に含まれるため独立した列にはしない）。
 */
export function FinanceMetricSection({
  metric,
  years,
  showTable = true,
  continuousYearAxis = false,
}: FinanceMetricSectionProps) {
  const points = years.map((y) => ({ year: y.fiscalYear, ...metric.getPoint(y) }));
  const nonNullPoints = points.filter((p) => p.value != null);
  const showValueTypeColumn = points.some((p) => p.valueTypeLabel != null);

  /*
   * Phase216：折れ線グラフには「値を確認できた年度」だけでなく、未確認の年度も値なしの点として
   * 渡す。以前はnullの年度を渡す前に取り除いていたため、FinanceLineChartの「欠損年度をまたいで
   * 直線補間しない」保護が働かず、例えば/finance/fundsの基金総額では1989年度と2009年度が
   * 隣り合う目盛りとして直線で結ばれ、資料が無い19年分があたかも連続的に推移したかのように
   * 見えていた。値は生成せず、横軸の並びと線の切り方だけを事実に合わせる。
   */
  const rawLinePoints = points.map((p) => ({ year: p.year, label: fiscalYearLabel(p.year), value: p.value }));
  const linePoints = continuousYearAxis
    ? continuousFiscalYearSeries(rawLinePoints, fiscalYearLabel)
    : rawLinePoints;
  // グラフに表示していない年度（先頭・末尾の未確認年度）も含めて注記に列挙する。
  const omittedYears = [
    ...new Set([
      ...points.filter((p) => p.value == null).map((p) => p.year),
      ...linePoints.filter((p) => p.value == null).map((p) => p.year),
    ]),
  ].sort((a, b) => a - b);

  // 概要（最新値・表示期間中の最高値/最低値・前年度比）。2件以上の確認済みデータがある場合のみ表示する。
  // 「最高値/最低値」はあくまで表示範囲内（全年度推移／2〜4件の選択比較の両方で使われるため）の値であり、
  // 過去最高・過去最低（史上record）を意味しない旨を明記する。
  const latestPoint = nonNullPoints.length > 0 ? nonNullPoints[nonNullPoints.length - 1] : null;
  const numericPoints = nonNullPoints as Array<{ year: number; value: number }>;
  const maxPoint =
    numericPoints.length > 0 ? numericPoints.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const minPoint =
    numericPoints.length > 0 ? numericPoints.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const prevPoint =
    nonNullPoints.length >= 2 ? nonNullPoints[nonNullPoints.length - 2] : null;
  const yoyChangePercent =
    latestPoint &&
    prevPoint &&
    typeof latestPoint.value === "number" &&
    typeof prevPoint.value === "number" &&
    prevPoint.value !== 0 &&
    latestPoint.year - prevPoint.year === 1
      ? ((latestPoint.value - prevPoint.value) / Math.abs(prevPoint.value)) * 100
      : null;

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
        単位：{metric.unit}。{humanizeDataNote(metric.definitionNote)}
      </p>

      {nonNullPoints.length === 0 ? (
        <p className="rounded-lg bg-surface-container-high p-3 text-sm text-on-surface-variant">
          確認できたデータがまだありません。
        </p>
      ) : (
        <>
          {metric.chartKind === "line" ? (
            <FinanceLineChart
              points={linePoints}
              formatValue={(v) => metric.formatValue(v)}
              ariaLabel={`${metric.label}の年度推移グラフ。グラフ直後の年度別一覧に各年度の値を掲載しています。`}
            />
          ) : (
            <FinanceBarChart
              points={points.map((p) => ({ label: fiscalYearLabel(p.year), value: p.value }))}
              formatValue={(v) => metric.formatValue(v)}
              ariaLabel={`${metric.label}の年度別比較棒グラフ。詳細は直後の表を参照してください。`}
            />
          )}
          {metric.chartKind === "line" && omittedYears.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
              値を確認できていない年度：{formatFiscalYearRanges(omittedYears)}
              。これらの年度は0ではなく「分からない」という意味で、グラフでは点を打たず線もつないでいません
              {showTable ? "（詳細は下の表を参照してください）" : ""}。
            </p>
          )}

          {numericPoints.length >= 2 && latestPoint && maxPoint && minPoint && (
            <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-surface-container-high p-3 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-on-surface-variant">最新値（{fiscalYearLabel(latestPoint.year)}）</dt>
                <dd className="mt-0.5 font-semibold text-on-surface">{metric.formatValue(latestPoint.value)}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">前年度比</dt>
                <dd className="mt-0.5 font-semibold text-on-surface">
                  {yoyChangePercent == null
                    ? "算出不可"
                    : `${yoyChangePercent >= 0 ? "+" : ""}${yoyChangePercent.toFixed(1)}%`}
                </dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">表示期間中の最高値（{fiscalYearLabel(maxPoint.year)}）</dt>
                <dd className="mt-0.5 font-semibold text-on-surface">{metric.formatValue(maxPoint.value)}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">表示期間中の最低値（{fiscalYearLabel(minPoint.year)}）</dt>
                <dd className="mt-0.5 font-semibold text-on-surface">{metric.formatValue(minPoint.value)}</dd>
              </div>
            </dl>
          )}
        </>
      )}

      {showTable && (
        <>
          <CompareTable
            caption={`${metric.label}の年度別数値表`}
            rows={points}
            rowKey={(p) => String(p.year)}
            columns={[
              { header: "年度", render: (p) => fiscalYearLabel(p.year) },
              { header: "値", align: "right", render: (p) => metric.formatValue(p.value) },
              ...(showValueTypeColumn
                ? [{ header: "値の種類", render: (p: (typeof points)[number]) => p.valueTypeLabel ?? "-" }]
                : []),
              { header: "定義", wrap: true, render: (p) => humanizeDataNote(p.definitionNoteOverride ?? metric.definitionNote) },
              {
                header: "確認状況",
                render: (p) =>
                  p.statusLabelOverride ??
                  (p.sourceRefs[0]
                    ? archiveVerificationStatusLabel(p.sourceRefs[0].verificationStatus)
                    : p.value == null
                      ? "確認中"
                      : "出典未登録"),
              },
              {
                header: "出典",
                wrap: true,
                render: (p) =>
                  p.sourceRefs.length === 0 ? (
                    "出典未登録"
                  ) : (
                    <span className="space-x-1">
                      {p.sourceRefs.map((ref, i) =>
                        ref.sourceUrl ? (
                          <a
                            key={i}
                            href={ref.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            {ref.sourceTitle ?? "出典"}
                          </a>
                        ) : (
                          <span key={i}>出典URL未確認</span>
                        ),
                      )}
                    </span>
                  ),
              },
            ]}
          />

          <CompareSourceNotice
            className="mt-3"
            items={points
              .filter((p) => p.sourceRefs.length > 0)
              .map((p) => ({
                label: fiscalYearLabel(p.year),
                sourceRefs: p.sourceRefs,
                definitionNote: humanizeDataNote(p.definitionNoteOverride),
                unit: metric.unit,
              }))}
          />
        </>
      )}
    </div>
  );
}
