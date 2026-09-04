import { Link, useLocation } from "react-router-dom";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import type { ArchiveFiscalYear } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { FinanceLineChart } from "../components/finance/FinanceLineChart";
import { FinanceMetricSection } from "../components/finance/FinanceMetricSection";
import { FinanceYearCards } from "../components/finance/FinanceYearCards";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LandmarkIcon } from "../components/icons";
import { GlossaryNote } from "../components/GlossaryNote";
import { SourceRefList } from "../components/SourceRefList";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  formatOkuYenOrConfirming,
  fiscalYearLabel,
  sortedFiscalYears,
  missingFiscalYears,
  formatMissingFiscalYearsNote,
  fiscalYearGapNote,
  hasFundData,
} from "../lib/archiveFinance";
import { financeMetricByKey } from "../lib/archiveFinanceMetrics";
import { continuousFiscalYearSeries, formatFiscalYearRanges } from "../lib/financeChartSeries";
import { humanizeDataNote } from "../lib/citizenTermLabels";

const fundTotalMetric = financeMetricByKey("fundTotal")!;

const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]);
const yearGapNote = fiscalYearGapNote(archiveFiscalYears);

export function FinanceFundsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const rows = archiveFiscalYears.filter(hasFundData);
  const missingYearsNote = formatMissingFiscalYearsNote(missingFiscalYears(archiveFiscalYears, hasFundData), "基金残高");
  /*
   * Phase216：財源調整用基金の推移グラフ。値を確認できている年度が飛んでいるため、横軸を
   * 1年度＝1目盛りの連続した年度軸にそろえ、未確認の年度は値なし（点も線も描かない）とする。
   * 値の補間は行わない。
   */
  const fiscalAdjustmentFundPoints = continuousFiscalYearSeries(
    rows.map((y) => ({
      year: y.fiscalYear,
      label: fiscalYearLabel(y.fiscalYear),
      value: y.fund?.balance.fiscalAdjustmentFundYen ?? null,
      isEstimate: y.fund?.isEstimate,
    })),
    fiscalYearLabel,
  );
  const fiscalAdjustmentFundOmittedYears = [
    ...new Set([
      ...rows.filter((y) => y.fund?.balance.fiscalAdjustmentFundYen == null).map((y) => y.fiscalYear),
      ...fiscalAdjustmentFundPoints.filter((p) => p.value == null).map((p) => p.year),
    ]),
  ].sort((a, b) => a - b);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <LandmarkIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">基金残高の推移</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          年度末の基金残高を年度ごとに整理しています。決算未確定の年度は「見込額」と明記し、決算額と区別しています。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <GlossaryNote
          term="基金"
          definition="将来の支出や年度間の財源変動に備えて自治体が積み立てている貯金のようなものです。目的別に複数の種類があり、定義が資料によって異なる場合があります。"
        />
        <GlossaryNote
          term="財政調整基金"
          definition="年度間の財源の過不足を調整するための基金です。基金全体の一部で、災害対応や急な財政需要への備えとしても使われます。"
        />
      </div>

      <p className="rounded-xl bg-surface-container-low p-3.5 text-xs leading-relaxed text-on-surface-variant">
        収録年度：{rows.length}／{archiveFiscalYears.length}年度（{fiscalYearLabel(archiveFiscalYears[0]?.fiscalYear)}〜
        {fiscalYearLabel(archiveFiscalYears[archiveFiscalYears.length - 1]?.fiscalYear)}）
        {missingYearsNote && <span className="block mt-1">{missingYearsNote}</span>}
        {yearGapNote && <span className="block mt-1">{yearGapNote}</span>}
      </p>

      {rows.length === 0 ? (
        <SectionCard title="年度別 基金残高">
          <p className="text-sm text-on-surface-variant">登録済みの年度データはまだありません。</p>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="財源調整用基金の推移">
            <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
              縦軸：億円／横軸：年度末。財源調整用基金の定義は年度により資料の記載が異なる場合があるため、各年度の「定義・出典」を必ずご確認ください。
            </p>
            <FinanceLineChart
              points={fiscalAdjustmentFundPoints}
              formatValue={(v) => formatOkuYenOrConfirming(v)}
              ariaLabel="財源調整用基金の年度末残高の推移グラフ。詳細は直後の表を参照してください。"
            />
            {fiscalAdjustmentFundOmittedYears.length > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                値を確認できていない年度：{formatFiscalYearRanges(fiscalAdjustmentFundOmittedYears)}
                。これらの年度は0ではなく「分からない」という意味で、グラフでは点を打たず線もつないでいません。
              </p>
            )}
            <FinanceYearCards
              caption="年度別の基金残高（財源調整用基金・その他特定目的基金・全体）"
              years={rows}
              getYear={(y) => y.fiscalYear}
              rowKey={(y) => String(y.fiscalYear)}
              detailHref={(y) => `/timeline/${y.fiscalYear}`}
              fields={[
                {
                  label: "基金全体",
                  value: (y) => y.fund?.balance.totalYen ?? null,
                  format: (v) => formatOkuYenOrConfirming(v),
                  note: (y) => (y.fund?.isEstimate ? "見込額" : null),
                },
                { label: "財源調整用基金", value: (y) => y.fund?.balance.fiscalAdjustmentFundYen ?? null, format: (v) => formatOkuYenOrConfirming(v) },
                { label: "その他特定目的基金", value: (y) => y.fund?.balance.otherSpecificPurposeFundsYen ?? null, format: (v) => formatOkuYenOrConfirming(v) },
              ]}
            />
          </SectionCard>

          <SectionCard title="基金総額の年度推移">
            <FinanceMetricSection metric={fundTotalMetric} years={rows} showTable={false} continuousYearAxis />
          </SectionCard>

          {rows.map((y) => (
            <SectionCard
              key={y.fiscalYear}
              title={`${fiscalYearLabel(y.fiscalYear)}の定義・出典`}
              action={
                <Link to={`/timeline/${y.fiscalYear}`} className="shrink-0 text-xs text-primary underline">
                  この年度のタイムラインを見る
                </Link>
              }
            >
              <p className="text-xs leading-relaxed text-on-surface-variant">{humanizeDataNote(y.fund?.balance.definitionNote)}</p>
              {y.fund?.notes && <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{humanizeDataNote(y.fund.notes)}</p>}
              <div className="mt-2">
                <SourceRefList refs={y.fund?.balance.sourceRefs ?? []} />
              </div>
            </SectionCard>
          ))}
        </>
      )}

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        年度を選んで並べて比較したい場合は
        <Link to="/compare/funds" className="mx-1 text-primary underline">
          基金の比較
        </Link>
        をご利用ください。
      </p>

      <LastUpdated className="mt-4" />
      <div className="mt-4">
        <CorrectionRequestButton pageName="基金残高の推移" />
      </div>
    </div>
  );
}
