import { Link } from "react-router-dom";
import type { ArchiveFinance, ArchiveFiscalYear } from "../../types/historicalArchive";
import { SectionCard } from "../SectionCard";
import { GlobeIcon } from "../icons";
import { FinanceLineChart, type FinanceLineChartPoint } from "./FinanceLineChart";
import { formatJapaneseDate, toEraFiscalYearLabel } from "../../config/site";
import { TRUST_LEVEL_LABEL } from "../../lib/councilGlossary";
import {
  FUND_SHORTAGE_DESCRIPTION,
  SOUNDNESS_INDICATORS,
  describePointDifference,
  formatRatioPercent,
  formatStandardPercent,
  latestSoundnessYear,
  pointDifference,
  settlementLabel,
  soundnessValueStatus,
  type SoundnessValueField,
} from "../../lib/financeSoundness";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const VALUE_FIELDS: Record<"realDebtServiceRatio" | "futureBurdenRatio", SoundnessValueField> = {
  realDebtServiceRatio: "realDebtServiceRatioPercent",
  futureBurdenRatio: "futureBurdenRatioPercent",
};

type IndicatorKey = (typeof SOUNDNESS_INDICATORS)[number]["key"];

/** 指標ごとの当年値（%）と区分。実質赤字比率等は soundness 側、実質公債費比率等は finance 本体の値を使う。 */
function indicatorValue(finance: ArchiveFinance | undefined, key: IndicatorKey): { status: "reported" | "notApplicable" | "unconfirmed"; percent: number | null } {
  if (!finance) return { status: "unconfirmed", percent: null };
  if (key === "realDebtServiceRatio" || key === "futureBurdenRatio") {
    const field = VALUE_FIELDS[key];
    return { status: soundnessValueStatus(finance, field), percent: finance[field] };
  }
  const r = finance.soundness?.[key];
  if (!r) return { status: "unconfirmed", percent: null };
  return { status: r.status, percent: r.percent };
}

function valueText(v: { status: string; percent: number | null }): string {
  if (v.status === "reported" && v.percent !== null) return formatRatioPercent(v.percent);
  return v.status === "notApplicable" ? "該当なし" : "確認中";
}

function trendPoints(years: ArchiveFiscalYear[], field: SoundnessValueField): FinanceLineChartPoint[] {
  const withData = years.filter((y) => y.finance && soundnessValueStatus(y.finance, field) !== "unconfirmed");
  if (withData.length === 0) return [];
  const first = withData[0].fiscalYear;
  const last = withData[withData.length - 1].fiscalYear;
  const points: FinanceLineChartPoint[] = [];
  for (let fy = first; fy <= last; fy += 1) {
    const finance = years.find((y) => y.fiscalYear === fy)?.finance;
    const status = soundnessValueStatus(finance, field);
    points.push({
      year: fy,
      label: `${fy}年度`,
      value: status === "reported" ? finance![field] : null,
      notApplicable: status === "notApplicable",
    });
  }
  return points;
}

/**
 * Phase260：財政健全化判断比率等（5指標）の最新年度・前年度比較・法定基準・推移グラフ。
 * データは archiveFiscalYears.json（単一情報源）から読み、財政ダッシュボードには複製しない。
 */
export function SoundnessRatiosSection({ years }: { years: ArchiveFiscalYear[] }) {
  const latest = latestSoundnessYear(years);
  if (!latest?.finance?.soundness) {
    return (
      <SectionCard title="財政健全化判断比率">
        <p className="text-sm text-on-surface-variant">財政健全化判断比率は公式資料確認中です。</p>
      </SectionCard>
    );
  }
  const finance = latest.finance;
  const soundness = latest.finance.soundness;
  const prior = years.find((y) => y.fiscalYear === latest.fiscalYear - 1)?.finance;
  const latestLabel = settlementLabel(latest.fiscalYear);
  const priorLabel = settlementLabel(latest.fiscalYear - 1);
  const ref = soundness.sourceRef;
  const sorted = [...years].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const debtServicePoints = trendPoints(sorted, "realDebtServiceRatioPercent");
  const futureBurdenPoints = trendPoints(sorted, "futureBurdenRatioPercent");
  const futureBurdenStandard = soundness.futureBurdenRatio.earlyWarningStandardPercent;
  const debtServiceStandard = soundness.realDebtServiceRatio.earlyWarningStandardPercent;
  const futureBurdenDiff = pointDifference(finance.futureBurdenRatioPercent, prior?.futureBurdenRatioPercent);

  return (
    <SectionCard title={`財政健全化判断比率（${latestLabel}）`}>
      <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
        地方公共団体財政健全化法に基づき、延岡市が毎年度の決算について公表している5つの指標です。
        「延岡市の実績値」と、法律で定められた「法定基準」（この基準以上になると財政健全化計画等の策定が必要になる水準）を分けて表示しています。当サイトによる独自の評価・順位づけは行っていません。
      </p>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SOUNDNESS_INDICATORS.map((ind) => {
          const current = indicatorValue(finance, ind.key);
          const before = indicatorValue(prior, ind.key);
          const standards = soundness[ind.key];
          const diff = pointDifference(current.percent, before.percent);
          return (
            <li key={ind.key} className="rounded-lg border border-outline-variant p-3">
              <h3 className="text-sm font-semibold text-on-surface">{ind.label}</h3>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{ind.description}</p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div>
                  <dt className="text-xs text-on-surface-variant">延岡市の実績値（{latestLabel}）</dt>
                  <dd className="text-lg font-semibold text-on-surface">{valueText(current)}</dd>
                </div>
                {prior && (
                  <div>
                    <dt className="text-xs text-on-surface-variant">前年度（{priorLabel}）</dt>
                    <dd className="text-on-surface">
                      {valueText(before)}
                      {diff !== null && <span className="ml-1 text-xs text-on-surface-variant">→ {describePointDifference(diff)}</span>}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-on-surface-variant">法定基準（延岡市の値ではありません）</dt>
                  <dd className="text-xs leading-relaxed text-on-surface">
                    早期健全化基準 {formatStandardPercent(standards.earlyWarningStandardPercent)}／財政再生基準{" "}
                    {formatStandardPercent(standards.reconstructionStandardPercent)}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
        <li className="rounded-lg border border-outline-variant p-3 sm:col-span-2">
          <h3 className="text-sm font-semibold text-on-surface">資金不足比率</h3>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{FUND_SHORTAGE_DESCRIPTION}</p>
          <ul className="mt-2 space-y-1.5">
            {soundness.fundShortageRatios.map((f) => (
              <li key={f.accountName} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                <span className="text-on-surface">{f.accountName}</span>
                <span className="font-semibold text-on-surface">
                  {f.status === "reported" && f.percent !== null ? formatRatioPercent(f.percent) : "該当なし"}
                  <span className="ml-2 text-xs font-normal text-on-surface-variant">
                    法定基準（経営健全化基準）{formatStandardPercent(f.managementSoundnessStandardPercent)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </li>
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
        「該当なし」は、赤字や資金不足が生じていない、または将来負担額を充当可能な財源等が上回っているため比率が算定されないことを示します（0％や「確認中」とは異なります）。
        延岡市の公表資料では、{toEraFiscalYearLabel(latest.fiscalYear)}決算のいずれの比率も法定基準を下回ったとされています。
      </p>

      <h3 className="mt-5 text-sm font-semibold text-on-surface">実質公債費比率の推移</h3>
      <p className="mb-2 mt-1 text-xs leading-relaxed text-on-surface-variant">
        縦軸：％／横軸：決算年度。
        {debtServiceStandard !== null &&
          `破線は法定の早期健全化基準（${formatStandardPercent(debtServiceStandard)}）です。財政再生基準は${formatStandardPercent(soundness.realDebtServiceRatio.reconstructionStandardPercent)}です。`}
      </p>
      <FinanceLineChart
        points={debtServicePoints}
        formatValue={formatRatioPercent}
        referenceLines={debtServiceStandard !== null ? [{ value: debtServiceStandard, label: `早期健全化基準 ${formatStandardPercent(debtServiceStandard)}` }] : []}
        ariaLabel="延岡市の実質公債費比率の決算年度別推移グラフ。グラフ直後の一覧に各年度の値を掲載しています。"
      />

      <h3 className="mt-5 text-sm font-semibold text-on-surface">将来負担比率の推移</h3>
      {futureBurdenDiff !== null && prior && (
        <div className="mt-2 rounded-lg bg-surface-container-high p-3">
          <p className="text-xs text-on-surface-variant">直近2年度の変化（延岡市の実績値）</p>
          <p className="mt-1 text-sm font-semibold text-on-surface">
            {priorLabel} {valueText(indicatorValue(prior, "futureBurdenRatio"))} → {latestLabel} {valueText(indicatorValue(finance, "futureBurdenRatio"))}
          </p>
          <p className="mt-0.5 text-sm text-on-surface">{describePointDifference(futureBurdenDiff)}</p>
        </div>
      )}
      <p className="mb-2 mt-2 text-xs leading-relaxed text-on-surface-variant">
        縦軸：％／横軸：決算年度。
        {futureBurdenStandard !== null &&
          `法定の早期健全化基準は${formatStandardPercent(futureBurdenStandard)}（財政再生基準は定めなし）です。実績値との差が大きく、同じ縦軸に描くと各年度の変化が読み取りにくくなるため、このグラフには基準線を描いていません。`}
      </p>
      <FinanceLineChart
        points={futureBurdenPoints}
        formatValue={formatRatioPercent}
        ariaLabel="延岡市の将来負担比率の決算年度別推移グラフ。グラフ直後の一覧に各年度の値を掲載しています。"
      />
      <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
        推移グラフの過年度の値は、各年度の「健全化判断比率等の公表」・財政状況資料集・決算カード等の公式資料で確認したものです。年度ごとの出典は
        <Link to="/compare/finance" className={`mx-1 text-primary underline ${linkClass}`}>
          年度別財政の比較
        </Link>
        や各年度の年表ページで確認できます。
      </p>

      {ref.sourceUrl && (
        <div className="mt-3 border-t border-outline-variant pt-2 text-xs text-on-surface-variant">
          <a
            href={ref.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${ref.sourceTitle ?? "出典"}を新しいタブで開く`}
            className={`inline-flex min-h-11 items-center gap-1 text-primary underline ${linkClass}`}
          >
            <GlobeIcon className="h-3.5 w-3.5" />
            {ref.sourceOrganization}「{ref.sourceTitle}」
          </a>
          <p className="mt-1">
            公表機関：{ref.sourceOrganization}
            {ref.sourceUpdatedDate && `／資料の更新日：${formatJapaneseDate(ref.sourceUpdatedDate)}`}
            {ref.accessedAt && `／当サイト確認日：${formatJapaneseDate(ref.accessedAt)}`}
            {ref.trustLevel && `／資料区分：${ref.sourceOrganization ?? ""}公式（${TRUST_LEVEL_LABEL[ref.trustLevel] ?? ref.trustLevel}）`}
          </p>
        </div>
      )}
    </SectionCard>
  );
}
