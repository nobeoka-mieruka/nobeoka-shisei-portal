import { useLocation, useSearchParams } from "react-router-dom";
import archivePoliciesData from "../data/archivePolicies.json";
import archivePolicyCategoriesData from "../data/archivePolicyCategories.json";
import archiveMayorsData from "../data/archiveMayors.json";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import factionsData from "../data/factions.json";
import type { ArchivePolicy, ArchivePolicyCategory, ArchiveMayor } from "../types/historicalArchive";
import type { CouncilMember, FormerMember } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { FinanceTable } from "../components/finance/FinanceTable";
import { CompareItemPicker } from "../components/compare/CompareItemPicker";
import { DocumentIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { categoryLabel, policyOwnerName, policyOwnerTypeLabel, policyStatusLabel } from "../lib/archivePolicies";
import { archiveVerificationStatusLabel } from "../lib/archiveMayors";
import { parseCompareSelection, buildCompareSearchParams, MIN_COMPARE_ITEMS } from "../lib/archiveCompare";

const archivePolicies = archivePoliciesData as ArchivePolicy[];
const archivePolicyCategories = archivePolicyCategoriesData as ArchivePolicyCategory[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const factions = factionsData as { id: string; name: string }[];
const ownerLookup = { members, formerMembers, mayors: archiveMayors, factions };
const policyIds = archivePolicies.map((p) => p.id);

export function PolicyComparePage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();

  const selected = parseCompareSelection(searchParams, policyIds);
  const selectedPolicies = selected
    .map((id) => archivePolicies.find((p) => p.id === id))
    .filter((p): p is ArchivePolicy => !!p);

  const handleChange = (ids: string[]) => {
    setSearchParams(buildCompareSearchParams(ids), { replace: true });
  };

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/compare" label="比較トップに戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <DocumentIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">政策の比較</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          市長・議員・会派・市の政策を最大4件まで選んで、所有者・テーマ・状況を比較できます。達成・未達成の独自判定や優劣評価は行っていません。
        </p>
      </div>

      <SectionCard title="比較する政策を選ぶ">
        <CompareItemPicker
          legend="政策"
          options={archivePolicies.map((p) => ({
            id: p.id,
            label: p.title,
            sublabel: policyOwnerName(p, ownerLookup),
          }))}
          selected={selected}
          onChange={handleChange}
        />
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          現在登録されている政策は{archivePolicies.length}件です。公式資料で根拠を確認できたものから少数ずつ登録しています。
        </p>
      </SectionCard>

      {selectedPolicies.length > 0 && selectedPolicies.length < MIN_COMPARE_ITEMS && (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
          比較には{MIN_COMPARE_ITEMS}件以上の選択が必要です。もう{MIN_COMPARE_ITEMS - selectedPolicies.length}件選んでください。
        </p>
      )}

      {selectedPolicies.length >= MIN_COMPARE_ITEMS && (
        <SectionCard title="比較結果">
          <FinanceTable
            caption="選択した政策の所有者・テーマ・状況の比較"
            rows={selectedPolicies}
            rowKey={(p) => p.id}
            columns={[
              { header: "政策", render: (p) => p.title },
              { header: "所有者種別", render: (p) => policyOwnerTypeLabel(p.ownerType) },
              { header: "所有者", render: (p) => policyOwnerName(p, ownerLookup) },
              {
                header: "テーマ",
                render: (p) => p.categoryIds.map((cid) => categoryLabel(archivePolicyCategories, cid)).join("、") || "確認中",
              },
              { header: "状況", render: (p) => policyStatusLabel(p.status) },
              {
                header: "確認状況",
                render: (p) =>
                  p.sourceRefs[0] ? archiveVerificationStatusLabel(p.sourceRefs[0].verificationStatus) : "確認中",
              },
            ]}
          />

          <div className="mt-4 space-y-3">
            {selectedPolicies.map((p) => (
              <div key={p.id} className="rounded-lg border border-outline-variant p-3 text-xs">
                <p className="font-semibold text-on-surface">{p.title}の出典</p>
                <ul className="mt-1 space-y-1">
                  {p.sourceRefs.map((ref, i) => (
                    <li key={i} className="text-on-surface-variant">
                      {ref.sourceUrl ? (
                        <a
                          href={ref.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {ref.sourceTitle ?? ref.sourceUrl}
                        </a>
                      ) : (
                        "出典URL未確認"
                      )}
                      （{archiveVerificationStatusLabel(ref.verificationStatus)}）
                    </li>
                  ))}
                  {p.sourceRefs.length === 0 && <li className="text-on-surface-variant">出典未登録</li>}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
