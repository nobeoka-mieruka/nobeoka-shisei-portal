import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import type { ArchiveFiscalYear } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CompareTable } from "../components/compare/CompareTable";
import { CompareItemPicker } from "../components/compare/CompareItemPicker";
import { FinanceMetricSection } from "../components/finance/FinanceMetricSection";
import { ChartBarIcon } from "../components/icons";
import { GlossaryNote } from "../components/GlossaryNote";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatOkuYenOrConfirming, formatPercentOrConfirming, fiscalYearLabel, sortedFiscalYears } from "../lib/archiveFinance";
import { FINANCE_GLOSSARY } from "../lib/financeGlossary";
import { parseCompareSelection, buildCompareSearchParams, MIN_COMPARE_ITEMS } from "../lib/archiveCompare";
import {
  FINANCE_METRICS,
  FINANCE_METRIC_GROUP_LABELS,
  financeMetricsByGroup,
  financeMetricByKey,
  type FinanceMetricGroup,
} from "../lib/archiveFinanceMetrics";
import { computePerCapitaYen, describePerCapita, formatPerCapitaYen } from "../lib/archivePerCapita";

const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]);
const yearIds = archiveFiscalYears.map((y) => String(y.fiscalYear));
const METRIC_GROUPS: FinanceMetricGroup[] = ["population", "budget", "debt", "fund", "ratio"];

export function CompareFinancePage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();
  const [metricKey, setMetricKey] = useState<string>("financialStrengthIndex");

  const selected = parseCompareSelection(searchParams, yearIds, "years");
  const selectedRows = archiveFiscalYears
    .filter((y) => selected.includes(String(y.fiscalYear)))
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  const handleChange = (ids: string[]) => setSearchParams(buildCompareSearchParams(ids, "years"), { replace: true });
  const activeMetric = financeMetricByKey(metricKey) ?? FINANCE_METRICS[0];

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/compare" label="比較トップに戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">年度別財政の比較</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          人口・予算・市債・基金・財政健全化判断比率を、最大4年度まで選んで一覧で比較できます。市の公式評価がない指標について独自の順位づけ・優劣判定は行っていません。当初予算・補正後予算・決算、市債発行額・残高、基金総額・財源調整用基金は、それぞれ定義が異なるため単純比較できません。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <GlossaryNote term="財政力指数" definition={FINANCE_GLOSSARY["財政力指数"]} />
        <GlossaryNote term="経常収支比率" definition={FINANCE_GLOSSARY["経常収支比率"]} />
        <GlossaryNote term="実質公債費比率" definition={FINANCE_GLOSSARY["実質公債費比率"]} />
        <GlossaryNote term="将来負担比率" definition={FINANCE_GLOSSARY["将来負担比率"]} />
      </div>

      <SectionCard title="比較する年度を選ぶ">
        <CompareItemPicker
          legend="年度"
          options={archiveFiscalYears.map((y) => ({ id: String(y.fiscalYear), label: fiscalYearLabel(y.fiscalYear) }))}
          selected={selected}
          onChange={handleChange}
        />
      </SectionCard>

      {selected.length < MIN_COMPARE_ITEMS && (
        <p className="rounded-xl border border-primary/30 bg-primary-container/40 p-4 text-sm font-medium text-on-surface">
          {selected.length === 0
            ? `比較したい年度を${MIN_COMPARE_ITEMS}件以上選んでください（上の一覧をタップ）。`
            : `比較には${MIN_COMPARE_ITEMS}件以上の選択が必要です。もう${MIN_COMPARE_ITEMS - selected.length}件選んでください。`}
        </p>
      )}

      {selectedRows.length >= MIN_COMPARE_ITEMS && (
        <>
          <SectionCard title="指標を選んで比較">
            <div className="space-y-3">
              {METRIC_GROUPS.map((group) => (
                <div key={group}>
                  <p className="mb-1.5 text-xs font-semibold text-on-surface-variant">{FINANCE_METRIC_GROUP_LABELS[group]}</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`${FINANCE_METRIC_GROUP_LABELS[group]}の指標切り替え`}>
                    {financeMetricsByGroup(group).map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setMetricKey(m.key)}
                        aria-pressed={metricKey === m.key}
                        className={`inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          metricKey === m.key
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <FinanceMetricSection metric={activeMetric} years={selectedRows} />
            </div>
          </SectionCard>

          <SectionCard title="年度別 比較表（人口・予算・市債・基金・財政指標）">
            <CompareTable
              caption="選択した年度の主要財政指標の比較"
              rows={selectedRows}
              rowKey={(y) => String(y.fiscalYear)}
              columns={[
                { header: "年度", render: (y) => fiscalYearLabel(y.fiscalYear) },
                {
                  header: "人口",
                  align: "right",
                  render: (y) => (y.population?.population != null ? `${y.population.population.toLocaleString("ja-JP")}人` : "確認中"),
                },
                { header: "当初予算", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.generalAccountInitialBudgetYen) },
                { header: "補正後予算", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.generalAccountFinalBudgetYen) },
                { header: "決算額", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.generalAccountSettlementYen) },
                { header: "市税", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.localTaxRevenueYen) },
                { header: "地方交付税", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.localAllocationTaxYen) },
                { header: "国庫支出金", align: "right", render: (y) => formatOkuYenOrConfirming(y.budget?.nationalSubsidiesYen) },
                { header: "市債発行額", align: "right", render: (y) => formatOkuYenOrConfirming(y.debt?.municipalBondIssuanceYen) },
                { header: "市債残高（一般会計）", align: "right", render: (y) => formatOkuYenOrConfirming(y.debt?.balance.generalAccountBondBalanceYen) },
                { header: "基金総額", align: "right", render: (y) => formatOkuYenOrConfirming(y.fund?.balance.totalYen) },
                { header: "財源調整用基金", align: "right", render: (y) => formatOkuYenOrConfirming(y.fund?.balance.fiscalAdjustmentFundYen) },
                { header: "財政力指数", align: "right", render: (y) => (y.finance?.financialStrengthIndex != null ? y.finance.financialStrengthIndex.toFixed(2) : "確認中") },
                { header: "実質公債費比率", align: "right", render: (y) => formatPercentOrConfirming(y.finance?.realDebtServiceRatioPercent) },
                { header: "将来負担比率", align: "right", render: (y) => formatPercentOrConfirming(y.finance?.futureBurdenRatioPercent) },
              ]}
            />
            <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
              市債残高（区分別）・基金の内訳は
              <Link to="/compare/debt" className="mx-1 text-primary underline">
                市債の比較
              </Link>
              ・
              <Link to="/compare/funds" className="mx-1 text-primary underline">
                基金の比較
              </Link>
              でも確認できます。定義が異なる数値（当初予算・補正後予算・決算、市債の発行額・残高、基金総額・財源調整用基金）は単純比較できません。
            </p>
          </SectionCard>

          <SectionCard title="市民1人当たりの金額（当サイトによる算出値）">
            <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
              同じ年度の確認済み人口で当サイトが単純に割り算した参考値です。延岡市が公式に発表した「1人当たり」指標ではありません。金額・人口のいずれかが未確認の年度は算出していません。
            </p>
            <CompareTable
              caption="年度別 一人当たり一般会計当初予算・決算額（算出値）"
              rows={selectedRows}
              rowKey={(y) => String(y.fiscalYear)}
              columns={[
                { header: "年度", render: (y) => fiscalYearLabel(y.fiscalYear) },
                {
                  header: "一人当たり当初予算",
                  align: "right",
                  render: (y) => {
                    const r = computePerCapitaYen(y.budget?.generalAccountInitialBudgetYen, "一般会計当初予算", y.budget?.sourceRefs ?? [], y);
                    return r ? formatPerCapitaYen(r.value) : "確認中";
                  },
                },
                {
                  header: "一人当たり決算額",
                  align: "right",
                  render: (y) => {
                    const r = computePerCapitaYen(y.budget?.generalAccountSettlementYen, "一般会計決算", y.budget?.sourceRefs ?? [], y);
                    return r ? formatPerCapitaYen(r.value) : "確認中";
                  },
                },
                {
                  header: "一人当たり市債残高",
                  align: "right",
                  render: (y) => {
                    const r = computePerCapitaYen(
                      y.debt?.balance.ordinaryAccountLocalBondBalanceYen,
                      "市債残高（普通会計地方債）",
                      y.debt?.balance.sourceRefs ?? [],
                      y,
                    );
                    return r ? formatPerCapitaYen(r.value) : "確認中";
                  },
                },
                {
                  header: "一人当たり財政調整基金",
                  align: "right",
                  render: (y) => {
                    const r = computePerCapitaYen(
                      y.fund?.balance.fiscalReserveFundYen,
                      "財政調整基金残高",
                      y.fund?.balance.sourceRefs ?? [],
                      y,
                    );
                    return r ? formatPerCapitaYen(r.value) : "確認中";
                  },
                },
                {
                  header: "分母（人口・年度）",
                  align: "right",
                  render: (y) =>
                    y.population?.population != null ? `${y.population.population.toLocaleString("ja-JP")}人（${fiscalYearLabel(y.fiscalYear)}）` : "確認中",
                },
              ]}
            />
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-on-surface-variant">
              {selectedRows.flatMap((y) => {
                const items: string[] = [];
                const initial = computePerCapitaYen(y.budget?.generalAccountInitialBudgetYen, "一般会計当初予算", y.budget?.sourceRefs ?? [], y);
                const settlement = computePerCapitaYen(y.budget?.generalAccountSettlementYen, "一般会計決算", y.budget?.sourceRefs ?? [], y);
                const debt = computePerCapitaYen(
                  y.debt?.balance.ordinaryAccountLocalBondBalanceYen,
                  "市債残高（普通会計地方債）",
                  y.debt?.balance.sourceRefs ?? [],
                  y,
                );
                const fund = computePerCapitaYen(y.fund?.balance.fiscalReserveFundYen, "財政調整基金残高", y.fund?.balance.sourceRefs ?? [], y);
                if (initial) items.push(`${fiscalYearLabel(y.fiscalYear)}の${describePerCapita(initial, "一人当たり当初予算")}`);
                if (settlement) items.push(`${fiscalYearLabel(y.fiscalYear)}の${describePerCapita(settlement, "一人当たり決算額")}`);
                if (debt) items.push(`${fiscalYearLabel(y.fiscalYear)}の${describePerCapita(debt, "一人当たり市債残高")}`);
                if (fund) items.push(`${fiscalYearLabel(y.fiscalYear)}の${describePerCapita(fund, "一人当たり財政調整基金")}`);
                return items;
              }).map((text, i) => <li key={i}>{text}</li>)}
            </ul>
          </SectionCard>

          <SectionCard title="市民1人当たりの市債残高・基金残高（元資料掲載値）">
            <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
              延岡市の資料に「1人当たり」として掲載されている値をそのまま表示しています。当サイトでは算出していません（元資料側の分母・算式は非公開のため）。上記の一人当たり予算・決算額（当サイトによる算出値）とは性質が異なります。
            </p>
            <CompareTable
              caption="年度別 一人当たり市債残高・基金残高（元資料掲載値）"
              rows={selectedRows}
              rowKey={(y) => String(y.fiscalYear)}
              columns={[
                { header: "年度", render: (y) => fiscalYearLabel(y.fiscalYear) },
                {
                  header: "一人当たり市債残高",
                  align: "right",
                  render: (y) => (y.debt?.balance.perCapitaYen != null ? formatPerCapitaYen(y.debt.balance.perCapitaYen) : "確認中"),
                },
                {
                  header: "一人当たり基金残高",
                  align: "right",
                  render: (y) => (y.fund?.balance.perCapitaYen != null ? formatPerCapitaYen(y.fund.balance.perCapitaYen) : "確認中"),
                },
              ]}
            />
          </SectionCard>

          <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
            年度別の詳細な出来事（市長任期・議案・一般質問等）は
            <Link to="/timeline" className="mx-1 text-primary underline">
              延岡市政の年表
            </Link>
            でも確認できます。
          </p>
        </>
      )}
    </div>
  );
}
