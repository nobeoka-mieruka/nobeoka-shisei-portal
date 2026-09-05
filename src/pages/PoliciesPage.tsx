import { Link, useLocation } from "react-router-dom";
import { useHydratedSearchParams } from "../hooks/useHydratedSearchParams";
import archivePoliciesData from "../data/archivePolicies.json";
import archivePolicyCategoriesData from "../data/archivePolicyCategories.json";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archiveMayorsData from "../data/archiveMayors.json";
import factionsData from "../data/factions.json";
import type { ArchivePolicy, ArchivePolicyCategory, ArchivePolicyOwnerType, ArchiveMayor } from "../types/historicalArchive";
import type { CouncilMember, FormerMember } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { DocumentIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { policyOwnerName, policyOwnerTypeLabel, policyStatusLabel, categoryLabel } from "../lib/archivePolicies";
import { archiveVerificationStatusLabel } from "../lib/archiveMayors";

const archivePolicies = archivePoliciesData as ArchivePolicy[];
const archivePolicyCategories = archivePolicyCategoriesData as ArchivePolicyCategory[];
const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const factions = factionsData as { id: string; name: string }[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const OWNER_TYPE_OPTIONS: ArchivePolicyOwnerType[] = ["mayor", "member", "formerMember", "faction", "city"];

export function PoliciesPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useHydratedSearchParams();

  const ownerTypeFilter = searchParams.get("ownerType") ?? "";
  const categoryFilter = searchParams.get("category") ?? "";

  const filtered = archivePolicies.filter((p) => {
    if (ownerTypeFilter && p.ownerType !== ownerTypeFilter) return false;
    if (categoryFilter && !p.categoryIds.includes(categoryFilter)) return false;
    return true;
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <DocumentIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">政策（延岡市政アーカイブ）</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          市長・議員・会派・市の政策を、公式資料の原文と出典に基づいて整理しています。達成・未達成の独自判定や優劣評価は行っていません。
        </p>
      </div>

      <div className="mb-1 rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        現在登録している政策は{archivePolicies.length}件です。既存データ（市長公約・一般質問）から公式根拠を確認できたものから少数ずつ登録しています。未登録は「情報が無い」ことを意味しません。
      </div>

      <SectionCard title="絞り込み">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-on-surface-variant">所有者種別</span>
            <select
              className="min-h-[44px] max-w-full min-w-0 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              value={ownerTypeFilter}
              onChange={(e) => updateParam("ownerType", e.target.value)}
            >
              <option value="">すべて</option>
              {OWNER_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {policyOwnerTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-on-surface-variant">政策テーマ</span>
            <select
              className="min-h-[44px] max-w-full min-w-0 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              value={categoryFilter}
              onChange={(e) => updateParam("category", e.target.value)}
            >
              <option value="">すべて</option>
              {archivePolicyCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
          条件に一致する政策はまだ登録されていません。
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((policy) => (
            <li key={policy.id}>
              <Link
                to={`/policies/${policy.slug}`}
                className={`block rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-on-surface">{policy.title}</p>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                    {policyStatusLabel(policy.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {policyOwnerTypeLabel(policy.ownerType)}：{policyOwnerName(policy, { members, formerMembers, mayors: archiveMayors, factions })}
                  {policy.announcedDate ? `／${policy.announcedDate}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {policy.categoryIds.map((cid) => (
                    <span key={cid} className="rounded-full bg-primary-container px-2 py-0.5 text-xs text-on-primary-container">
                      {categoryLabel(archivePolicyCategories, cid)}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  出典：{policy.sourceRefs.length > 0 ? `${policy.sourceRefs.length}件（${archiveVerificationStatusLabel(policy.sourceRefs[0].verificationStatus)}）` : "資料未確認"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        政策同士を比較したい場合は
        <Link to="/compare/policies" className={`mx-1 text-primary underline ${linkClass}`}>
          政策比較
        </Link>
        をご利用ください。政策テーマは上の絞り込みから選べます。
      </p>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="政策" />
      </div>
    </div>
  );
}
