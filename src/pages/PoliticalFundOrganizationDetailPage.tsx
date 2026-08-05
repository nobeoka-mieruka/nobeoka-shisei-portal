import { Link, useLocation, useParams } from "react-router-dom";
import { getPoliticalFundOrganization, reportsForOrganization, formatPoliticalFundYen } from "../lib/politicalFunds";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import type { CouncilMember, FormerMember, PoliticalFundIncomeBreakdown, PoliticalFundExpenditureBreakdown } from "../types";
import type { ArchiveMemberProfile } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { SourceLink } from "../components/SourceLink";
import { LastUpdatedInfo } from "../components/LastUpdatedInfo";
import { EmptyState } from "../components/EmptyState";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { findMemberOrFormerLink } from "../lib/councilSpeeches";
import { getSeoForPath } from "../lib/seo";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];

const INCOME_LABELS: Record<keyof PoliticalFundIncomeBreakdown, string> = {
  membershipFees: "個人の負担する党費又は会費",
  donationsFromIndividuals: "個人からの寄附",
  donationsFromOrganizations: "法人その他の団体からの寄附",
  donationsFromPoliticalOrganizations: "政治団体からの寄附",
  businessIncome: "機関紙誌の発行その他の事業による収入",
  loans: "借入金",
  grantsFromHeadquartersOrBranches: "本部又は支部から供与された交付金",
  other: "その他の収入",
};

const EXPENDITURE_LABELS: Record<keyof PoliticalFundExpenditureBreakdown, string> = {
  personnelExpenses: "人件費",
  utilityExpenses: "光熱水費",
  equipmentExpenses: "備品・消耗品費",
  officeExpenses: "事務所費",
  organizationActivityExpenses: "組織活動費",
  electionExpenses: "選挙関係費",
  publicationExpenses: "機関紙誌の発行その他の事業費",
  researchExpenses: "調査研究費",
  donationsAndGrantsPaid: "寄附・交付金",
  other: "その他の経費",
};

function BreakdownList({
  breakdown,
  labels,
}: {
  breakdown: Record<string, number | null> | null;
  labels: Record<string, string>;
}) {
  if (!breakdown) return <EmptyState message="内訳は情報未登録です。" />;
  return (
    <dl className="divide-y divide-outline-variant text-sm">
      {Object.keys(labels).map((key) => (
        <div key={key} className="flex items-center justify-between gap-2 py-1.5">
          <dt className="text-on-surface-variant">{labels[key]}</dt>
          <dd className="font-medium text-on-surface">{formatPoliticalFundYen(breakdown[key])}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PoliticalFundOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const organization = id ? getPoliticalFundOrganization(id) : undefined;
  const seo = getSeoForPath(location.pathname);

  usePageTitle();

  if (!organization) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
        <Breadcrumbs items={[{ label: "ホーム", to: "/" }, { label: "政治資金収支報告書", to: "/political-funds" }]} />
        <p className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          お探しの政治団体の情報が見つかりませんでした。
        </p>
        <Link
          to="/political-funds"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          政治資金収支報告書の一覧に戻る
        </Link>
      </div>
    );
  }

  const reports = reportsForOrganization(organization.id);
  // 現職・元議員のどちらでも正しい詳細ページへ遷移できるよう、既存の共通ヘルパーで解決する
  // （元議員を/members/:idへ直接リンクすると、プリレンダリング対象外のため本番で404になる既知の不具合を避ける）。
  const relatedMemberLink = findMemberOrFormerLink(
    organization.relatedMemberId ?? undefined,
    members,
    formerMembers,
    archiveMemberProfiles,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <span className="inline-flex rounded-full bg-surface-container-lowest px-2.5 py-0.5 text-xs font-semibold text-on-surface">
          {organization.organizationType}
        </span>
        <h1 className="mt-2 text-xl font-semibold leading-relaxed text-on-primary-container break-words sm:text-2xl">
          {organization.name}
        </h1>
        <p className="mt-1 text-sm text-on-primary-container/80">代表者：{organization.representativeName ?? "確認中"}</p>
        {relatedMemberLink ? (
          <Link
            to={relatedMemberLink.href}
            className="mt-2 inline-flex items-center text-sm text-on-primary-container underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            関連する{relatedMemberLink.isFormer ? "元議員" : "議員"}ページを見る
          </Link>
        ) : (
          organization.relatedPersonName && (
            <p className="mt-1 text-sm text-on-primary-container/80">関連する氏名（参考）：{organization.relatedPersonName}</p>
          )
        )}
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        出典：{organization.disclosureAuthority}の公表資料／当サイトは公式サイトではありません。掲載内容は公表資料の記載をそのまま整理したもので、金額の多い・少ないについての評価や順位付けは行っていません。
      </p>

      <SectionCard title="団体情報">
        <dl className="divide-y divide-outline-variant text-sm">
          <div className="flex items-center justify-between gap-2 py-1.5">
            <dt className="text-on-surface-variant">会計責任者</dt>
            <dd className="font-medium text-on-surface">{organization.treasurerName ?? "確認中"}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 py-1.5">
            <dt className="text-on-surface-variant">収支報告書の提出先</dt>
            <dd className="font-medium text-on-surface">{organization.disclosureAuthority}</dd>
          </div>
        </dl>
        {organization.officialListUrl && (
          <SourceLink url={organization.officialListUrl} label="公表元の一覧ページを見る" className="mt-3" />
        )}
        {organization.notes && <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">{organization.notes}</p>}
      </SectionCard>

      <SectionCard title="収支報告書">
        {reports.length === 0 ? (
          <EmptyState message="この団体の収支報告書は現在未登録です。公式資料を確認でき次第、順次追加します。" />
        ) : (
          <ul className="space-y-4">
            {reports.map((report) => (
              <li key={report.id} className="rounded-lg border border-outline-variant p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-on-surface">{report.fiscalYear}</p>
                  <span className="shrink-0 rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-on-surface">
                    {report.reportStatus}
                  </span>
                </div>

                <dl className="mt-2 divide-y divide-outline-variant text-sm">
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <dt className="text-on-surface-variant">前年繰越額</dt>
                    <dd className="font-medium text-on-surface">{formatPoliticalFundYen(report.carriedOverFromPreviousYear)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <dt className="text-on-surface-variant">本年収入額</dt>
                    <dd className="font-medium text-on-surface">{formatPoliticalFundYen(report.totalIncome)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <dt className="text-on-surface-variant">本年支出額</dt>
                    <dd className="font-medium text-on-surface">{formatPoliticalFundYen(report.totalExpenditure)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <dt className="text-on-surface-variant">翌年繰越額</dt>
                    <dd className="font-medium text-on-surface">{formatPoliticalFundYen(report.carriedOverToNextYear)}</dd>
                  </div>
                </dl>

                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    収入の内訳を見る
                  </summary>
                  <div className="mt-2">
                    <BreakdownList
                      breakdown={report.incomeBreakdown as Record<string, number | null> | null}
                      labels={INCOME_LABELS}
                    />
                  </div>
                </details>

                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    支出の内訳を見る
                  </summary>
                  <div className="mt-2">
                    <BreakdownList
                      breakdown={report.expenditureBreakdown as Record<string, number | null> | null}
                      labels={EXPENDITURE_LABELS}
                    />
                  </div>
                </details>

                {report.sourceUrl && (
                  <SourceLink url={report.sourceUrl} label={report.sourceTitle ?? "収支報告書を見る"} className="mt-3" />
                )}
                {report.notes && <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">{report.notes}</p>}
                <LastUpdatedInfo verifiedAt={report.verifiedAt ?? undefined} className="mt-3" />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <LastUpdatedInfo verifiedAt={organization.verifiedAt ?? undefined} className="px-1" />

      <CorrectionRequestButton pageName={organization.name} />
    </div>
  );
}
