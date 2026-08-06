import { Link, useLocation } from "react-router-dom";
import { sortedPoliticalFundOrganizations, latestReportForOrganization, reportsForOrganization } from "../lib/politicalFunds";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { StatCard } from "../components/StatCard";
import { EmptyState } from "../components/EmptyState";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** verifiedAtがISO日付形式ならformatJapaneseDateで整形し、そうでなければ「確認中」を返す。 */
function formatVerifiedAt(verifiedAt: string | null): string {
  if (!verifiedAt) return "確認中";
  return ISO_DATE.test(verifiedAt) ? formatJapaneseDate(verifiedAt) : verifiedAt;
}

export function PoliticalFundsPage() {
  const organizations = sortedPoliticalFundOrganizations();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);

  usePageTitle();

  const hasOrganizationsWithoutReports = organizations.some((o) => reportsForOrganization(o.id).length === 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">政治資金収支報告書</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          政治資金規正法に基づき、政治団体が総務省または都道府県選挙管理委員会へ提出し、公表された収支報告書の内容を、確認できた範囲で整理しています。当サイトは公式サイトではありません。金額の多い・少ないについての評価や、団体・個人ごとの順位付けは行っていません。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="登録済み政治団体数" value={organizations.length} unit="団体" />
      </div>

      {organizations.length === 0 ? (
        <EmptyState message="現在公開できる収支報告書データはありません" />
      ) : (
        <ul className="space-y-3">
          {organizations.map((org) => {
            const latestReport = latestReportForOrganization(org.id);
            return (
              <li key={org.id}>
                <Link
                  to={`/political-funds/${org.id}`}
                  className={`block rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high sm:p-5 ${linkClass}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-on-surface">{org.name}</p>
                    <span className="shrink-0 rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
                      {org.organizationType}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    公開状況：{latestReport ? latestReport.reportStatus : "情報未登録"}／最新年度：
                    {latestReport ? latestReport.fiscalYear : "未登録"}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">最終確認日：{formatVerifiedAt(org.verifiedAt)}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">提出先：{org.disclosureAuthority}</p>
                  <p className="mt-2 border-t border-outline-variant pt-2 text-sm text-primary">詳しく見る（収支報告書PDFへのリンクを含む）</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {organizations.length > 0 && hasOrganizationsWithoutReports && (
        <EmptyState message="収支の金額データは、多くの団体でデータベース化準備中です（公表元の収支報告書PDFが画像形式のため、当サイトの環境では自動的な読み取りができていません）。各団体のページから、公式資料のPDFを直接ご覧いただけます。" />
      )}

      <CorrectionRequestButton pageName="政治資金収支報告書" />
    </div>
  );
}
