import { Link, useLocation } from "react-router-dom";
import forestEnvironmentTaxData from "../data/forestEnvironmentTax.json";
import type { ForestEnvironmentTaxAmounts, ForestEnvironmentTaxData } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { SourceLink } from "../components/SourceLink";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const data = forestEnvironmentTaxData as ForestEnvironmentTaxData;

/** 円単位の金額を3桁区切りで表示する（換算や丸めはしない）。記載の無い欄（null）は「—」。 */
function yen(value: number | null): string {
  return value == null ? "—" : `${value.toLocaleString("ja-JP")}円`;
}

/** 決算一覧の内訳の列。表とスマートフォン用の一覧で同じ並び・見出しを使う。 */
const AMOUNT_COLUMNS: { key: keyof ForestEnvironmentTaxAmounts; label: string }[] = [
  { key: "forestTaxCurrentYen", label: "(A)譲与税 令和7年度分" },
  { key: "forestTaxCarriedOverYen", label: "(A)譲与税 令和6年度からの繰越分" },
  { key: "fundDrawdownCurrentYen", label: "(B)基金繰入金 令和7年度分" },
  { key: "fundDrawdownCarriedOverYen", label: "(B)基金繰入金 令和6年度からの繰越分" },
  { key: "otherCurrentYen", label: "(C)その他財源 令和7年度分" },
  { key: "fundDepositYen", label: "基金への積立額" },
];

const groups = [...new Set(data.settlement.rows.map((r) => r.group))];

export function FinanceForestEnvironmentTaxPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const summary = data.usageSummary;
  const settlement = data.settlement;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <LandmarkIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">森林環境譲与税の使途</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          森林環境譲与税は、森林整備などの財源として国から市町村へ配分（譲与）されるお金です。延岡市が公表した年度ごとの譲与額と、
          令和7年度に何に使ったか（決算）を、市の資料の数値のまま整理しています。
        </p>
        <SourceLink
          url={data.sourcePageUrl}
          label={data.sourcePageTitle}
          verifiedAt={data.lastVerified}
          className="mt-3"
        />
        <p className="mt-1 text-xs text-on-primary-container/80">
          公式ページの更新日：{formatJapaneseDate(data.sourcePageUpdatedAt)}／担当：{data.organization}
        </p>
      </div>

      <SectionCard title={`${summary.fiscalYearLabel}末までの活用状況`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label={`譲与額（${summary.transferredYen.cumulativeBeforeLabel}と${summary.fiscalYearLabel}の計）`} value={yen(summary.transferredYen.total)} compact />
          <StatCard label={`活用額（同じ期間の計）`} value={yen(summary.usedYen.total)} compact />
          <StatCard label="活用率" value={summary.usageRateLabel} compact hint={summary.usageRateNote} />
        </div>
        <dl className="mt-3 space-y-2 sm:hidden">
          {[
            { label: "活用額", v: summary.usedYen },
            { label: "譲与額", v: summary.transferredYen },
          ].map(({ label, v }) => (
            <div key={label} className="rounded-lg bg-surface-container-low px-3 py-2 text-sm">
              <dt className="font-medium text-on-surface">{label}</dt>
              <dd className="mt-1 space-y-0.5 text-xs text-on-surface-variant">
                <p>
                  {v.cumulativeBeforeLabel}：<span className="text-on-surface">{yen(v.cumulativeBefore)}</span>
                </p>
                <p>
                  {summary.fiscalYearLabel}：<span className="text-on-surface">{yen(v.current)}</span>
                </p>
                <p>
                  計：<span className="font-medium text-on-surface">{yen(v.total)}</span>
                </p>
              </dd>
            </div>
          ))}
        </dl>
        <div
          className="mt-3 hidden overflow-x-auto sm:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          role="region"
          aria-label="森林環境譲与税の活用額と譲与額の表"
          tabIndex={0}
        >
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <caption className="sr-only">森林環境譲与税の活用額と譲与額（円）</caption>
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
                <th scope="col" className="py-2 pr-3 font-medium">区分</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{summary.usedYen.cumulativeBeforeLabel}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{summary.fiscalYearLabel}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">計</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "活用額", v: summary.usedYen },
                { label: "譲与額", v: summary.transferredYen },
              ].map(({ label, v }) => (
                <tr key={label} className="border-b border-outline-variant last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-on-surface">{label}</th>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{yen(v.cumulativeBefore)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{yen(v.current)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{yen(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          未執行額の活用方針（市の記載）：{summary.unexecutedPolicy}
        </p>
        <SourceLink url={summary.source.url} label={summary.source.title} className="mt-2" />
      </SectionCard>

      <SectionCard title={`${summary.fiscalYearLabel}の使い道（分野別）`}>
        <ul className="space-y-2">
          {summary.categories.map((c) => (
            <li key={c.category} className="rounded-lg bg-surface-container-low px-3 py-2">
              <p className="text-sm font-medium text-on-surface">
                {c.category}
                <span className="ml-1.5 text-xs font-normal text-on-surface-variant">（{c.projectLabel}）</span>
              </p>
              <p className="mt-1 text-sm text-on-surface">
                事業費 {yen(c.projectCostYen)}／うち森林環境譲与税 {yen(c.forestTaxYen)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{c.summary}</p>
            </li>
          ))}
          <li className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface">
            合計：事業費 {yen(summary.categoriesTotal.projectCostYen)}／うち森林環境譲与税 {yen(summary.categoriesTotal.forestTaxYen)}
          </li>
          <li className="rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface">
            基金積立（{summary.fundDeposit.label}）：{yen(summary.fundDeposit.forestTaxYen)}
          </li>
        </ul>
        <SourceLink url={summary.source.url} label={summary.source.title} className="mt-3" />
      </SectionCard>

      <SectionCard title={`${settlement.fiscalYearLabel}の事業別決算`}>
        <p className="text-xs leading-relaxed text-on-surface-variant">{settlement.columnsNote}</p>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          「—」は資料に金額の記載が無い欄です（0円とは区別しています）。
        </p>

        {/* スマートフォン・タブレット：事業ごとのカード */}
        <div className="mt-3 space-y-4 lg:hidden">
          {groups.map((g) => (
            <div key={g}>
              <h3 className="text-sm font-semibold text-on-surface">{g}</h3>
              <ul className="mt-2 space-y-2">
                {settlement.rows
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <li key={r.id} className="rounded-lg bg-surface-container-low px-3 py-2">
                      <p className="text-sm font-medium text-on-surface">
                        {r.no}．{r.projectName}
                      </p>
                      <p className="text-xs text-on-surface-variant">{r.category}</p>
                      <p className="mt-1 text-sm text-on-surface">事業総額 {yen(r.totalYen)}</p>
                      <dl className="mt-1 grid grid-cols-1 gap-0.5 text-xs text-on-surface-variant">
                        {AMOUNT_COLUMNS.filter((c) => r[c.key] != null).map((c) => (
                          <div key={c.key} className="flex flex-wrap gap-x-1">
                            <dt>{c.label}：</dt>
                            <dd className="text-on-surface">{yen(r[c.key])}</dd>
                          </div>
                        ))}
                      </dl>
                      {r.remarks && <p className="mt-1 text-xs text-on-surface-variant">備考：{r.remarks}</p>}
                    </li>
                  ))}
                <li className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface">
                  小計：事業総額 {yen(settlement.groupSubtotals[g]?.totalYen ?? null)}
                </li>
              </ul>
            </div>
          ))}
          <p className="rounded-lg bg-primary-container px-3 py-2 text-sm font-medium text-on-primary-container">
            計：事業総額 {yen(settlement.grandTotal.totalYen)}／うち譲与税（令和7年度分）{yen(settlement.grandTotal.forestTaxCurrentYen)}
          </p>
        </div>

        {/* PC（1024px以上）：決算一覧と同じ金額列の表 */}
        <div
          className="mt-3 hidden overflow-x-auto lg:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          role="region"
          aria-label={`${settlement.fiscalYearLabel} 森林環境譲与税に関する決算一覧の表`}
          tabIndex={0}
        >
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">{settlement.title}（円）</caption>
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
                <th scope="col" className="min-w-[12rem] py-2 pr-2 font-medium">事業（番号・事業区分・備考）</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">事業総額</th>
                {AMOUNT_COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className="px-2 py-2 text-right font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g}>
                <tr className="bg-surface-container-low">
                  <th scope="rowgroup" colSpan={AMOUNT_COLUMNS.length + 2} className="px-3 py-1.5 text-left text-xs font-semibold text-on-surface">
                    {g}
                  </th>
                </tr>
                {settlement.rows
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <tr key={r.id} className="border-b border-outline-variant align-top">
                      <th scope="row" className="py-2 pr-2 text-left font-normal">
                        <span className="text-sm text-on-surface">
                          {r.no}．{r.projectName}
                        </span>
                        <span className="block text-on-surface-variant">{r.category}</span>
                        {r.remarks && <span className="block text-on-surface-variant">備考：{r.remarks}</span>}
                      </th>
                      <td className="px-2 py-2 text-right whitespace-nowrap text-on-surface">{yen(r.totalYen)}</td>
                      {AMOUNT_COLUMNS.map((c) => (
                        <td key={c.key} className="px-2 py-2 text-right whitespace-nowrap text-on-surface-variant">
                          {yen(r[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                <tr className="border-b border-outline-variant bg-surface-container">
                  <th scope="row" className="py-2 pr-2 pl-3 text-left font-medium text-on-surface">
                    小計
                  </th>
                  <td className="px-2 py-2 text-right whitespace-nowrap font-medium">{yen(settlement.groupSubtotals[g]?.totalYen ?? null)}</td>
                  {AMOUNT_COLUMNS.map((c) => (
                    <td key={c.key} className="px-2 py-2 text-right whitespace-nowrap">
                      {yen(settlement.groupSubtotals[g]?.[c.key] ?? null)}
                    </td>
                  ))}
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr className="bg-primary-container text-on-primary-container">
                <th scope="row" className="py-2 pr-2 pl-3 text-left font-semibold">
                  計
                </th>
                <td className="px-2 py-2 text-right whitespace-nowrap font-semibold">{yen(settlement.grandTotal.totalYen)}</td>
                {AMOUNT_COLUMNS.map((c) => (
                  <td key={c.key} className="px-2 py-2 text-right whitespace-nowrap font-semibold">
                    {yen(settlement.grandTotal[c.key])}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">{settlement.reconciliationNote}</p>
        <SourceLink url={settlement.source.url} label={settlement.source.title} className="mt-2" />
      </SectionCard>

      <SectionCard title="年度別の譲与額">
        <div
          className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          role="region"
          aria-label="森林環境譲与税の年度別譲与額の表"
          tabIndex={0}
        >
          <table className="w-full min-w-[280px] border-collapse text-sm">
            <caption className="sr-only">森林環境譲与税の年度別譲与額（円）</caption>
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
                <th scope="col" className="py-2 pr-3 font-medium">年度</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">譲与額</th>
              </tr>
            </thead>
            <tbody>
              {[...data.transferAmounts].reverse().map((t) => (
                <tr key={t.fiscalYear} className="border-b border-outline-variant">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-on-surface">{t.fiscalYearLabel}</th>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{yen(t.amountYen)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="py-2 pr-3 text-left font-medium">計</th>
                <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{yen(data.transferTotalYen)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <SourceLink url={data.transferSource.url} label={data.transferSource.title} className="mt-2" />
      </SectionCard>

      <SectionCard title="公式資料（PDF）">
        <ul className="space-y-1.5">
          {data.documents.map((d) => (
            <li key={d.url}>
              <SourceLink url={d.url} label={`${d.fiscalYearLabel}：${d.title}`} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">{data.pastYearsNote}</p>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{data.note}</p>
      </SectionCard>

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        市全体の予算・基金・市債は
        <Link to="/finance" className="mx-1 text-primary underline">
          延岡市の財政
        </Link>
        をご覧ください。
      </p>

      <LastUpdated className="mt-4" />
      <div className="mt-4">
        <CorrectionRequestButton pageName="森林環境譲与税の使途" />
      </div>
    </div>
  );
}
