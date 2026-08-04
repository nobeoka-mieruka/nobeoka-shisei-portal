import { Link, useLocation, useParams } from "react-router-dom";
import archivePoliciesData from "../data/archivePolicies.json";
import archivePolicyCategoriesData from "../data/archivePolicyCategories.json";
import archivePolicyQuestionRelationsData from "../data/archivePolicyQuestionRelations.json";
import archivePolicyFiscalRelationsData from "../data/archivePolicyFiscalRelations.json";
import archiveMayorsData from "../data/archiveMayors.json";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import factionsData from "../data/factions.json";
import generalQuestionsData from "../data/generalQuestions.json";
import type {
  ArchivePolicy,
  ArchivePolicyCategory,
  ArchivePolicyFiscalRelation,
  ArchivePolicyQuestionRelation,
  ArchiveMayor,
} from "../types/historicalArchive";
import type { CouncilMember, FormerMember } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { BackLink } from "../components/BackLink";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { GlobeIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  categoryLabel,
  policyOwnerLinkTo,
  policyOwnerName,
  policyOwnerTypeLabel,
  policyQuestionRelationTypeLabel,
  policySourceTypeLabel,
  policyStatusLabel,
  questionRelationsForPolicy,
} from "../lib/archivePolicies";
import { archiveVerificationStatusLabel } from "../lib/archiveMayors";

const archivePolicies = archivePoliciesData as ArchivePolicy[];
const archivePolicyCategories = archivePolicyCategoriesData as ArchivePolicyCategory[];
const archivePolicyQuestionRelations = archivePolicyQuestionRelationsData as ArchivePolicyQuestionRelation[];
const archivePolicyFiscalRelations = archivePolicyFiscalRelationsData as ArchivePolicyFiscalRelation[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const factions = factionsData as { id: string; name: string }[];
const generalQuestions = generalQuestionsData as { id: string; title: string; memberName?: string }[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function PolicyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const policy = archivePolicies.find((p) => p.slug === slug);

  if (!policy) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to="/policies" label="政策一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された政策情報は見つかりませんでした。
        </p>
      </div>
    );
  }

  const ownerLookup = { members, formerMembers, mayors: archiveMayors, factions };
  const ownerName = policyOwnerName(policy, ownerLookup);
  const ownerLinkTo = policyOwnerLinkTo(policy, { mayors: archiveMayors, formerMembers });
  const questionRelations = questionRelationsForPolicy(archivePolicyQuestionRelations, policy.id);
  const fiscalRelations = archivePolicyFiscalRelations.filter((r) => r.policyId === policy.id);
  const questionById = new Map(generalQuestions.map((q) => [q.id, q]));

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/policies" label="政策一覧に戻る" />

      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-on-surface sm:text-2xl">{policy.title}</h1>
          <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
            {policyStatusLabel(policy.status)}
          </span>
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">
          {policyOwnerTypeLabel(policy.ownerType)}：
          {ownerLinkTo ? (
            <Link to={ownerLinkTo} className={`text-primary hover:underline ${linkClass}`}>
              {ownerName}
            </Link>
          ) : (
            ownerName
          )}
          {policy.announcedDate ? `／${policy.announcedDate}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {policy.categoryIds.map((cid) => (
            <span key={cid} className="rounded-full bg-primary-container px-2 py-0.5 text-xs text-on-primary-container">
              {categoryLabel(archivePolicyCategories, cid)}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">概要</h2>
        <p className="mt-2 text-sm leading-loose text-on-surface">{policy.summary}</p>
        {policy.sourceOriginalText && (
          <div className="mt-3 rounded-lg border border-outline-variant bg-surface p-3">
            <p className="text-xs font-medium text-on-surface-variant">原文</p>
            <p className="mt-1 whitespace-pre-line text-sm text-on-surface">{policy.sourceOriginalText}</p>
          </div>
        )}
        <p className="mt-3 text-xs text-on-surface-variant">
          資料区分：{policySourceTypeLabel(policy.sourceType)}
        </p>
        {policy.notes && <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{policy.notes}</p>}
      </section>

      {questionRelations.length > 0 && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">関連する一般質問</h2>
          <ul className="mt-2 space-y-2">
            {questionRelations.map((r) => {
              const question = questionById.get(r.questionId);
              return (
                <li key={r.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {question ? (
                      <Link to={`/questions/${r.questionId}`} className={`text-primary hover:underline ${linkClass}`}>
                        {question.title}
                      </Link>
                    ) : (
                      <span className="text-on-surface-variant">確認中（{r.questionId}）</span>
                    )}
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                      {policyQuestionRelationTypeLabel(r.relationType)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {fiscalRelations.length > 0 && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">関連する財政データ</h2>
          <ul className="mt-2 space-y-2">
            {fiscalRelations.map((r) => (
              <li key={r.id} className="rounded-lg border border-outline-variant p-3 text-sm text-on-surface">
                {r.fiscalYear}年度／{r.amountYen != null ? `${r.amountYen.toLocaleString()}円` : "金額未確認"}
                {r.amountDefinition ? `（${r.amountDefinition}）` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">出典・確認状況</h2>
        {policy.sourceRefs.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">出典は登録されていません。</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {policy.sourceRefs.map((ref, i) => (
              <li key={`${ref.sourceUrl ?? "source"}-${i}`} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {ref.sourceUrl ? (
                    <a
                      href={ref.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${ref.sourceTitle ?? "出典"}を新しいタブで開く`}
                      className={`inline-flex items-center gap-1.5 text-primary hover:underline ${linkClass}`}
                    >
                      <GlobeIcon className="h-4 w-4 shrink-0" aria-hidden />
                      {ref.sourceTitle ?? ref.sourceUrl}
                    </a>
                  ) : (
                    <span className="text-on-surface-variant">出典URL未確認</span>
                  )}
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                    {archiveVerificationStatusLabel(ref.verificationStatus)}
                  </span>
                </div>
                {ref.notes && <p className="mt-1 text-xs text-on-surface-variant">{ref.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName={`${policy.title}（政策）`} />
      </div>
    </div>
  );
}
