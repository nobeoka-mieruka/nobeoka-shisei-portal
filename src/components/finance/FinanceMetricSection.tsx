import type { ArchiveFiscalYear } from "../../types/historicalArchive";
import type { FinanceMetricDefinition } from "../../lib/archiveFinanceMetrics";
import { fiscalYearLabel } from "../../lib/archiveFinance";
import { archiveVerificationStatusLabel } from "../../lib/archiveMayors";
import { FinanceLineChart } from "./FinanceLineChart";
import { FinanceBarChart } from "./FinanceBarChart";
import { CompareTable } from "../compare/CompareTable";
import { CompareSourceNotice } from "../compare/CompareSourceNotice";

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
}

/**
 * 財政指標1件分の「グラフ＋数値表＋出典」をまとめた共通表示。
 * グラフはmetric.chartKindに応じて折れ線（ストック値の推移）・棒（フロー値の年度別比較）を
 * 自動選択し、未確認（null）の年度を0として描画しない（棒は灰色0幅、折れ線は該当年度を除外し注記する）。
 * 数値表は年度・値・定義・確認状況・出典を併記する（単位は値の文字列に既に含まれるため独立した列にはしない）。
 */
export function FinanceMetricSection({ metric, years, showTable = true }: FinanceMetricSectionProps) {
  const points = years.map((y) => ({ year: y.fiscalYear, ...metric.getPoint(y) }));
  const nonNullPoints = points.filter((p) => p.value != null);
  const omittedYears = points.filter((p) => p.value == null).map((p) => p.year);
  const showValueTypeColumn = points.some((p) => p.valueTypeLabel != null);

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
        単位：{metric.unit}。{metric.definitionNote}
      </p>

      {nonNullPoints.length === 0 ? (
        <p className="rounded-lg bg-surface-container-high p-3 text-sm text-on-surface-variant">
          確認できたデータがまだありません。
        </p>
      ) : (
        <>
          {metric.chartKind === "line" ? (
            <FinanceLineChart
              points={nonNullPoints.map((p) => ({ label: fiscalYearLabel(p.year), value: p.value as number }))}
              formatValue={(v) => metric.formatValue(v)}
              ariaLabel={`${metric.label}の年度推移グラフ。詳細は直後の表を参照してください。`}
            />
          ) : (
            <FinanceBarChart
              points={points.map((p) => ({ label: fiscalYearLabel(p.year), value: p.value }))}
              formatValue={(v) => metric.formatValue(v)}
              ariaLabel={`${metric.label}の年度別比較棒グラフ。詳細は直後の表を参照してください。`}
            />
          )}
          {metric.chartKind === "line" && omittedYears.length > 0 && (
            <p className="mt-2 text-xs text-on-surface-variant">
              {omittedYears.map((y) => fiscalYearLabel(y)).join("、")}
              は資料未確認のため、グラフには表示していません（0とは扱っていません。詳細は下の表を参照してください）。
            </p>
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
              { header: "定義", render: (p) => p.definitionNoteOverride ?? metric.definitionNote },
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
                            className="text-primary hover:underline"
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
                definitionNote: p.definitionNoteOverride,
                unit: metric.unit,
              }))}
          />
        </>
      )}
    </div>
  );
}
