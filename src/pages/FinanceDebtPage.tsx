import { Link, useLocation } from "react-router-dom";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import type { ArchiveFiscalYear } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { FinanceTable } from "../components/finance/FinanceTable";
import { FinanceMetricSection } from "../components/finance/FinanceMetricSection";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { ChartBarIcon } from "../components/icons";
import { GlossaryNote } from "../components/GlossaryNote";
import { SourceRefList } from "../components/SourceRefList";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  formatOkuYenOrConfirming,
  fiscalYearLabel,
  sortedFiscalYears,
  municipalBondIssuanceValueTypeLabel,
  missingFiscalYears,
  formatMissingFiscalYearsNote,
  fiscalYearGapNote,
  hasDebtData,
} from "../lib/archiveFinance";
import { financeMetricByKey } from "../lib/archiveFinanceMetrics";

const debtIssuanceMetric = financeMetricByKey("debtIssuance")!;
const debtBalanceGeneralMetric = financeMetricByKey("debtBalanceGeneral")!;

const archiveFiscalYears = sortedFiscalYears(archiveFiscalYearsData as ArchiveFiscalYear[]);
const yearGapNote = fiscalYearGapNote(archiveFiscalYears);

export function FinanceDebtPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const rows = archiveFiscalYears.filter(hasDebtData);
  const missingYearsNote = formatMissingFiscalYearsNote(missingFiscalYears(archiveFiscalYears, hasDebtData), "市債残高");

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市債の推移</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          市債の発行額（その年度に新たに借り入れた額）と、年度末の残高は別の数値です。また「市債残高」は資料によって、一般会計のみの残高・普通会計の地方債残高・特別会計を含む残高・企業会計を含む全会計残高・市民1人当たり残高、と定義が異なります。定義が異なる数値を同一のグラフで直接比較しないでください。
        </p>
      </div>

      <div className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        収録年度：{rows.length}／{archiveFiscalYears.length}年度（{fiscalYearLabel(archiveFiscalYears[0]?.fiscalYear)}〜
        {fiscalYearLabel(archiveFiscalYears[archiveFiscalYears.length - 1]?.fiscalYear)}）。
        {missingYearsNote ?? "対象期間の全年度で市債残高を確認済みです。"}
        市債の増減は市長個人だけの成果・責任ではなく、国の制度・大型事業・災害復旧など複数の要因が影響します。市長・議員の評価目的での単純な比較には利用しないでください。
        {yearGapNote && <span className="mt-1 block">{yearGapNote}</span>}
      </div>

      <GlossaryNote
        term="市債"
        definition="自治体が公共施設整備等のために借り入れる、いわば「借金」です。道路や学校などの整備費用を複数年度に分散して負担する仕組みで、市債があること自体が問題というわけではありません。"
      />

      <SectionCard title="市債発行額の年度推移">
        <FinanceMetricSection metric={debtIssuanceMetric} years={rows} />
      </SectionCard>

      <SectionCard title="年度末市債残高（一般会計）の年度推移">
        <FinanceMetricSection metric={debtBalanceGeneralMetric} years={rows} />
      </SectionCard>

      <SectionCard title="年度別 市債発行額・残高（一覧）">
        {rows.length === 0 ? (
          <p className="text-sm text-on-surface-variant">登録済みの年度データはまだありません。</p>
        ) : (
          <FinanceTable
            caption="年度別の市債発行額・残高（区分別）"
            rows={rows}
            rowKey={(y) => String(y.fiscalYear)}
            columns={[
              { header: "年度", render: (y) => fiscalYearLabel(y.fiscalYear) },
              {
                header: "発行額（値の種類）",
                align: "right",
                render: (y) => {
                  const label = municipalBondIssuanceValueTypeLabel(y.debt?.municipalBondIssuanceValueType);
                  const formatted = formatOkuYenOrConfirming(y.debt?.municipalBondIssuanceYen);
                  return label ? `${formatted}（${label}）` : formatted;
                },
              },
              { header: "一般会計残高", align: "right", render: (y) => formatOkuYenOrConfirming(y.debt?.balance.generalAccountBondBalanceYen) },
              { header: "普通会計残高", align: "right", render: (y) => formatOkuYenOrConfirming(y.debt?.balance.ordinaryAccountLocalBondBalanceYen) },
              { header: "一人当たり", align: "right", render: (y) => (y.debt?.balance.perCapitaYen != null ? `${y.debt.balance.perCapitaYen.toLocaleString("ja-JP")}円` : "確認中") },
            ]}
          />
        )}
      </SectionCard>

      {rows.map((y) => (
        <SectionCard
          key={y.fiscalYear}
          title={`${fiscalYearLabel(y.fiscalYear)}の定義・出典`}
          action={
            <Link to={`/timeline/${y.fiscalYear}`} className="shrink-0 text-xs text-primary hover:underline">
              この年度のタイムラインを見る
            </Link>
          }
        >
          <p className="text-xs leading-relaxed text-on-surface-variant">{y.debt?.balance.definitionNote}</p>
          {y.debt?.notes && <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{y.debt.notes}</p>}
          <div className="mt-2 space-y-2">
            <SourceRefList refs={y.debt?.balance.sourceRefs ?? []} />
            <SourceRefList refs={y.debt?.municipalBondIssuanceSourceRefs ?? []} />
          </div>
        </SectionCard>
      ))}

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        当該年度の一般会計の歳入における市債の計上額（予算・決算の区分は各年度データを参照）は
        <Link to="/finance/budget" className="mx-1 text-primary hover:underline">
          予算・決算規模の推移
        </Link>
        でも確認できます。年度を選んで並べて比較したい場合は
        <Link to="/compare/debt" className="mx-1 text-primary hover:underline">
          市債の比較
        </Link>
        をご利用ください。
      </p>

      <LastUpdated className="mt-4" />
      <div className="mt-4">
        <CorrectionRequestButton pageName="市債の推移" />
      </div>
    </div>
  );
}
