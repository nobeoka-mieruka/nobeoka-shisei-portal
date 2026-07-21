import { useMemo } from "react";
import financeData from "../data/financeDashboard.json";
import type { FinanceDashboardData, FinanceSourceMeta } from "../types";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { FinanceBarList } from "../components/finance/FinanceBarList";
import { FinanceLineChart } from "../components/finance/FinanceLineChart";
import { FinanceTable } from "../components/finance/FinanceTable";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { GlobeIcon } from "../components/icons";

const data = financeData as FinanceDashboardData;

function formatThousandYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}千円`;
}

function formatOku(value: number): string {
  return `約${(value / 100000).toFixed(1)}億円`;
}

/** 千円単位の金額を、住民1人当たりの円単位に換算する。人口が0の場合は算出不能としてnullを返す（0除算を避ける）。 */
function yenPerPerson(amountThousandYen: number, population: number): number | null {
  if (!population) return null;
  return Math.round((amountThousandYen * 1000) / population);
}

function formatYenOrConfirming(value: number | null): string {
  return value === null ? "確認中" : `${value.toLocaleString("ja-JP")}円`;
}

function formatPercentOrConfirming(value: number | null): string {
  return value === null ? "確認中" : `${value}％`;
}

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function sourceHref(source: FinanceSourceMeta): string {
  return source.page ? `${source.url}#page=${source.page}` : source.url;
}

function SectionSource({ section }: { section: string }) {
  const source = data.sources.find((s) => s.section === section);
  if (!source) return null;
  return (
    <div className="mt-3 border-t border-outline-variant pt-2 text-xs text-on-surface-variant">
      <a
        href={sourceHref(source)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${source.title}を新しいタブで開く`}
        className={`inline-flex items-center gap-1 text-primary hover:underline ${linkClass}`}
      >
        <GlobeIcon className="h-3.5 w-3.5" />
        {source.title}
        {source.page && `（p.${source.page}）`}
      </a>
      <p className="mt-1">
        公表機関：{source.organization}／基準日：{formatJapaneseDate(source.referenceDate)}／確認日：
        {formatJapaneseDate(source.confirmedDate)}
      </p>
    </div>
  );
}

export function FinancePage() {
  usePageTitle({
    title: "延岡市の財政",
    description: `${data.fiscalYearLabel}の一般会計の歳入・歳出構成、基金残高、人口推移、財政指標を公開資料に基づいて整理しています。`,
  });

  const populationWithYoy = useMemo(
    () =>
      data.populationTrend.trend.map((p, i, arr) => {
        const prev = i > 0 ? arr[i - 1] : undefined;
        return { ...p, diff: prev ? p.population - prev.population : null };
      }),
    [],
  );

  const perCapita = useMemo(() => {
    const budgetTotal = yenPerPerson(data.generalAccount.totalThousandYen, data.populationTrend.latest.population);
    const fundReferenceYear = data.populationTrend.trend.find((p) => p.year === "令和7年");
    const fundTotal = fundReferenceYear
      ? yenPerPerson(data.fundBalance.totalFunds.total, fundReferenceYear.population)
      : null;
    return { budgetTotal, fundTotal, fundReferenceYear };
  }, []);

  const fi = data.financialIndicators;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <Breadcrumbs items={[{ label: "ホーム", to: "/" }, { label: "延岡市の財政" }]} />
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">延岡市の財政</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          {data.fiscalYearLabel}6月補正後の一般会計（基準日：{formatJapaneseDate(data.referenceDate)}
          ）を、公開資料に基づいて整理しています。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="一般会計総額（6月補正後）"
          value={formatThousandYen(data.generalAccount.totalThousandYen)}
          hint={formatOku(data.generalAccount.totalThousandYen)}
          compact
        />
        <StatCard
          label="6月補正額"
          value={formatThousandYen(data.generalAccount.supplementaryThousandYen)}
          hint={formatOku(data.generalAccount.supplementaryThousandYen)}
          compact
        />
        <StatCard
          label="補正前総額"
          value={formatThousandYen(data.generalAccount.totalBeforeThousandYen)}
          hint={formatOku(data.generalAccount.totalBeforeThousandYen)}
          compact
        />
      </div>

      <SectionCard title="歳入構成（主要項目）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          {data.fiscalYearLabel}・単位：千円（速報値ではなく6月補正後の予算額）。一般会計歳入のうち、資料で構成比が示された主要項目です。ここに挙げた項目の合計は歳入全体には一致しません。市債についての注記は本ページ下部をご覧ください。
        </p>
        <FinanceBarList items={data.revenue} />
        <FinanceTable
          caption="歳入構成（主要項目）の表形式データ"
          rows={data.revenue}
          rowKey={(r) => r.label}
          columns={[
            { header: "項目", render: (r) => r.label },
            { header: "金額（千円）", align: "right", render: (r) => r.amountThousandYen.toLocaleString("ja-JP") },
            { header: "構成比", align: "right", render: (r) => (r.percentage !== undefined ? `${r.percentage}％` : "確認中") },
          ]}
        />
        <SectionSource section="revenue" />
      </SectionCard>

      <SectionCard title="歳出構成（目的別）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          {data.fiscalYearLabel}・単位：千円。一般会計歳出を、目的別区分（民生費・総務費など）で示したものです。
        </p>
        <FinanceBarList items={data.expenditureByPurpose} />
        <FinanceTable
          caption="歳出構成（目的別）の表形式データ"
          rows={data.expenditureByPurpose}
          rowKey={(r) => r.label}
          columns={[
            { header: "項目", render: (r) => r.label },
            { header: "金額（千円）", align: "right", render: (r) => r.amountThousandYen.toLocaleString("ja-JP") },
            { header: "構成比", align: "right", render: (r) => (r.percentage !== undefined ? `${r.percentage}％` : "確認中") },
          ]}
        />
        <SectionSource section="expenditureByPurpose" />
      </SectionCard>

      <SectionCard title="歳出構成（性質別）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          {data.fiscalYearLabel}・単位：千円。一般会計歳出を、性質別区分（人件費・扶助費など）で示したものです。目的別区分とは異なる分類です。
        </p>
        <FinanceBarList items={data.expenditureByNature} />
        <FinanceTable
          caption="歳出構成（性質別）の表形式データ"
          rows={data.expenditureByNature}
          rowKey={(r) => r.label}
          columns={[
            { header: "項目", render: (r) => r.label },
            { header: "金額（千円）", align: "right", render: (r) => r.amountThousandYen.toLocaleString("ja-JP") },
            { header: "構成比", align: "right", render: (r) => (r.percentage !== undefined ? `${r.percentage}％` : "確認中") },
          ]}
        />
        <SectionSource section="expenditureByNature" />
      </SectionCard>

      <SectionCard title="6月補正予算の主な内容">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          単位：千円。6月補正予算に計上された主な事業です。市長の公約・政策との関連付けは行っていません。
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.supplementaryBudgetProjects.map((p) => (
            <li
              key={p.title}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-outline-variant p-3"
            >
              <span className="text-sm text-on-surface">{p.title}</span>
              <span className="text-sm font-semibold text-on-surface">{formatThousandYen(p.amountThousandYen)}</span>
            </li>
          ))}
        </ul>
        <SectionSource section="supplementaryBudgetProjects" />
      </SectionCard>

      <SectionCard title="財源調整用基金の推移">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          縦軸：億円／横軸：年度末・単位：千円（グラフは億円換算）。令和7年度は決算額ではなく見込額のため「令和7年度末見込」と表示し、他の年度と区別しています。財政調整基金・減債基金など基金種別ごとの複数年度推移は、公式資料で確認でき次第追加します（現時点では合算値のみ掲載）。
        </p>
        <FinanceLineChart
          points={data.fundBalance.fiscalAdjustmentFunds.map((f) => ({
            label: f.fiscalYear,
            value: f.amountThousands,
            isEstimate: f.isEstimate,
          }))}
          formatValue={formatOku}
          ariaLabel="財源調整用基金の年度末残高の推移グラフ。詳細は直後の表を参照してください。"
        />
        <FinanceTable
          caption="財源調整用基金の年度末残高の表形式データ"
          rows={data.fundBalance.fiscalAdjustmentFunds}
          rowKey={(f) => f.fiscalYear}
          columns={[
            { header: "年度末", render: (f) => f.fiscalYear },
            { header: "残高（千円）", align: "right", render: (f) => f.amountThousands.toLocaleString("ja-JP") },
            { header: "区分", render: (f) => (f.isEstimate ? "見込額" : "決算額") },
          ]}
        />
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">{data.fundBalance.definitionNote}</p>
        <SectionSource section="fundBalanceTrend" />
      </SectionCard>

      <SectionCard title={`基金全体の内訳（${data.fundBalance.totalFunds.fiscalYear}）`}>
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          単位：千円。「基金全体」は財源調整用基金とその他特定目的基金の合計です。上記の財源調整用基金の推移とは対象が異なるため、混同しないようご注意ください。
        </p>
        <FinanceBarList
          items={[
            { label: "財源調整用基金", amountThousandYen: data.fundBalance.totalFunds.fiscalAdjustmentFunds },
            { label: "その他特定目的基金", amountThousandYen: data.fundBalance.totalFunds.otherSpecificPurposeFunds },
          ]}
        />
        <StatCard
          label="基金全体"
          value={formatThousandYen(data.fundBalance.totalFunds.total)}
          hint={formatOku(data.fundBalance.totalFunds.total)}
          compact
        />
        <SectionSource section="fundBalanceTotal" />
      </SectionCard>

      <SectionCard title="市債について">
        <p className="text-sm font-semibold text-on-surface">
          {formatThousandYen(data.revenue.find((r) => r.label === "市債")?.amountThousandYen ?? 0)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{data.debtNote}</p>
        {data.debtBalanceTrend && data.debtBalanceTrend.length > 0 ? (
          <>
            <FinanceLineChart
              points={data.debtBalanceTrend.map((d) => ({
                label: d.fiscalYear,
                value: d.amountThousandYen,
                isEstimate: d.isEstimate,
              }))}
              formatValue={formatOku}
              ariaLabel="市債残高の年度推移グラフ。詳細は直後の表を参照してください。"
            />
            <FinanceTable
              caption="市債残高の年度推移の表形式データ"
              rows={data.debtBalanceTrend}
              rowKey={(d) => d.fiscalYear}
              columns={[
                { header: "年度末", render: (d) => d.fiscalYear },
                { header: "残高（千円）", align: "right", render: (d) => d.amountThousandYen.toLocaleString("ja-JP") },
                { header: "区分", render: (d) => (d.isEstimate ? "見込額" : "決算額") },
              ]}
            />
          </>
        ) : (
          <p className="mt-3 rounded-lg bg-surface-container-high p-3 text-xs leading-relaxed text-on-surface-variant">
            市債残高（決算ベースの複数年度推移）は、延岡市決算書・財政状況資料集で確認中です。確認でき次第、このページへ追加します。
          </p>
        )}
      </SectionCard>

      <SectionCard title="財政指標（健全化判断比率等）">
        {fi ? (
          <>
            <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
              {fi.fiscalYearLabel}の数値です。総務省の地方公共団体財政健全化法に基づき延岡市が公表した指標のみ掲載し、独自の評価・順位づけは行っていません。
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="実質公債費比率" value={formatPercentOrConfirming(fi.realDebtServiceRatioPercent)} compact />
              <StatCard label="将来負担比率" value={formatPercentOrConfirming(fi.futureBurdenRatioPercent)} compact />
              <StatCard
                label="財政力指数"
                value={fi.fiscalStrengthIndex === null ? "確認中" : fi.fiscalStrengthIndex.toString()}
                compact
              />
              <StatCard label="経常収支比率" value={formatPercentOrConfirming(fi.currentBalanceRatioPercent)} compact />
              <StatCard
                label="実質収支"
                value={fi.realBalanceThousandYen === null ? "確認中" : formatThousandYen(fi.realBalanceThousandYen)}
                compact
              />
            </div>
            {fi.notApplicableIndicators.length > 0 && (
              <p className="mt-3 text-xs text-on-surface-variant">
                対象なし（赤字・資金不足が生じていないため算定対象外）：{fi.notApplicableIndicators.join("、")}
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{fi.note}</p>
            <SectionSource section="financialIndicators" />
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">財政指標は公式資料確認中です。</p>
        )}
      </SectionCard>

      <SectionCard title="市民1人当たりの金額（参考値）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          延岡市が公表した金額・人口を基に、当サイトが単純に割り算した参考値です。延岡市が公式に発表した「1人当たり」指標ではありません。市民1人当たりの市債は、市債残高（決算ベース）のデータが無いため算出していません。
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label={`市民1人当たり予算額（歳入＝歳出、${data.fiscalYearLabel}一般会計）`}
            value={formatYenOrConfirming(perCapita.budgetTotal)}
            hint={`人口${data.populationTrend.latest.population.toLocaleString("ja-JP")}人（${formatJapaneseDate(data.populationTrend.latest.referenceDate)}現在）で算出。地方公共団体の予算は歳入歳出総額が同額となるよう定められています。`}
            compact
          />
          <StatCard
            label={`市民1人当たり基金残高（${data.fundBalance.totalFunds.fiscalYear}）`}
            value={formatYenOrConfirming(perCapita.fundTotal)}
            hint={
              perCapita.fundReferenceYear
                ? `人口${perCapita.fundReferenceYear.population.toLocaleString("ja-JP")}人（${formatJapaneseDate(perCapita.fundReferenceYear.referenceDate)}現在）で算出。基金の基準日（年度末）と人口の基準日は完全には一致しません。`
                : undefined
            }
            compact
          />
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">端数処理：円未満四捨五入。</p>
      </SectionCard>

      <SectionCard title="延岡市の人口推移">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          縦軸：人口／横軸：各年1月1日・単位：人。{data.populationTrend.note}
        </p>
        <FinanceLineChart
          points={data.populationTrend.trend.map((p) => ({ label: p.year, value: p.population }))}
          formatValue={(v) => `${v.toLocaleString("ja-JP")}人`}
          ariaLabel="延岡市の人口推移グラフ。詳細は直後の表を参照してください。"
        />
        <FinanceTable
          caption="延岡市の人口推移（各年1月1日現在）の表形式データ"
          rows={populationWithYoy}
          rowKey={(p) => p.year}
          columns={[
            { header: "年", render: (p) => p.year },
            { header: "人口", align: "right", render: (p) => `${p.population.toLocaleString("ja-JP")}人` },
            {
              header: "前年比",
              align: "right",
              render: (p) => (p.diff === null ? "―" : `${p.diff > 0 ? "+" : ""}${p.diff.toLocaleString("ja-JP")}人`),
            },
          ]}
        />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label={`最新値（${formatJapaneseDate(data.populationTrend.latest.referenceDate)}現在）`}
            value={`${data.populationTrend.latest.population.toLocaleString("ja-JP")}人`}
            compact
          />
          <StatCard
            label="令和2年からの減少数"
            value={`${data.populationTrend.decreaseCount.toLocaleString("ja-JP")}人`}
            compact
          />
          <StatCard label="減少率" value={`約${data.populationTrend.decreaseRatePercent}％`} compact />
        </div>
        <SectionSource section="population" />
      </SectionCard>

      <SectionCard title="出典一覧">
        <ul className="space-y-3">
          {data.sources.map((s) => (
            <li key={`${s.section}-${s.url}-${s.page}`} className="border-b border-outline-variant pb-3 last:border-0 last:pb-0">
              <a
                href={sourceHref(s)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.title}を新しいタブで開く`}
                className={`inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
              >
                <GlobeIcon className="h-4 w-4" />
                {s.title}
                {s.page && `（p.${s.page}）`}
              </a>
              <p className="mt-1 text-xs text-on-surface-variant">
                公表機関：{s.organization}／基準日：{formatJapaneseDate(s.referenceDate)}／確認日：
                {formatJapaneseDate(s.confirmedDate)}
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">{data.notes}</p>

      <p className="px-1 text-xs text-on-surface-variant">最終確認：{formatJapaneseDate(data.lastVerified)}</p>

      <CorrectionRequestButton pageName="延岡市の財政" />
    </div>
  );
}
