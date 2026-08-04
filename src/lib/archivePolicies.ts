import type {
  ArchivePolicy,
  ArchivePolicyCategory,
  ArchivePolicyOwnerType,
  ArchivePolicyQuestionRelation,
  ArchivePolicyQuestionRelationType,
  ArchivePolicySourceType,
  ArchivePolicyStatus,
} from "../types/historicalArchive";
import type { CouncilMember, FormerMember } from "../types";
import type { ArchiveMayor } from "../types/historicalArchive";

export function policyOwnerTypeLabel(type: ArchivePolicyOwnerType): string {
  switch (type) {
    case "mayor":
      return "市長";
    case "member":
      return "議員";
    case "formerMember":
      return "元議員";
    case "faction":
      return "会派";
    case "city":
      return "市";
  }
}

export function policySourceTypeLabel(type: ArchivePolicySourceType): string {
  switch (type) {
    case "electionManifesto":
      return "選挙公約";
    case "policyDocument":
      return "政策文書";
    case "councilQuestion":
      return "一般質問";
    case "mayorPolicySpeech":
      return "市長施政方針";
    case "budgetDocument":
      return "予算資料";
    case "settlementDocument":
      return "決算資料";
    case "comprehensivePlan":
      return "総合計画";
    case "ordinance":
      return "条例";
    case "bill":
      return "議案";
    case "officialStatement":
      return "公式発表";
    case "otherOfficialSource":
      return "その他公式資料";
  }
}

export function policyStatusLabel(status?: ArchivePolicyStatus): string {
  switch (status) {
    case "proposed":
      return "提案・公約";
    case "planned":
      return "計画掲載";
    case "budgeted":
      return "予算計上";
    case "started":
      return "事業開始";
    case "ongoing":
      return "継続中";
    case "completed":
      return "完了";
    case "changed":
      return "内容変更";
    case "suspended":
      return "停止";
    case "notVerified":
      return "確認できず";
    default:
      return "確認中";
  }
}

export function policyQuestionRelationTypeLabel(type: ArchivePolicyQuestionRelationType): string {
  switch (type) {
    case "proposedInQuestion":
      return "一般質問で提案";
    case "discussedInQuestion":
      return "一般質問で議論";
    case "requestedInQuestion":
      return "一般質問で要望";
    case "answeredByCity":
      return "市が答弁";
    case "relatedTheme":
      return "関連テーマ";
    case "needsReview":
      return "要確認（候補）";
  }
}

export function categoryLabel(categories: ArchivePolicyCategory[], categoryId: string): string {
  return categories.find((c) => c.id === categoryId)?.label ?? categoryId;
}

export function policiesInCategory(policies: ArchivePolicy[], categoryId: string): ArchivePolicy[] {
  return policies.filter((p) => p.categoryIds.includes(categoryId));
}

export function questionRelationsForPolicy(
  relations: ArchivePolicyQuestionRelation[],
  policyId: string,
): ArchivePolicyQuestionRelation[] {
  return relations.filter((r) => r.policyId === policyId);
}

export interface PolicyOwnerLookup {
  members: CouncilMember[];
  formerMembers: FormerMember[];
  mayors: ArchiveMayor[];
  factions: { id: string; name: string }[];
}

/** ownerType/ownerIdから表示用の所有者名を解決する。参照先が見つからない場合は「確認中」を返す。 */
export function policyOwnerName(policy: ArchivePolicy, lookup: PolicyOwnerLookup): string {
  if (policy.ownerType === "city") return "延岡市";
  if (!policy.ownerId) return "確認中";
  switch (policy.ownerType) {
    case "mayor":
      return lookup.mayors.find((m) => m.id === policy.ownerId)?.name ?? "確認中";
    case "member":
      return lookup.members.find((m) => m.id === policy.ownerId)?.name ?? "確認中";
    case "formerMember":
      return lookup.formerMembers.find((m) => m.id === policy.ownerId)?.name ?? "確認中";
    case "faction":
      return lookup.factions.find((f) => f.id === policy.ownerId)?.name ?? "確認中";
    default:
      return "確認中";
  }
}

/**
 * ownerType/ownerIdに対応する詳細ページへのリンク先。
 * /mayors/:slug・/members/former/:slug はslugベースのルートのため、ownerId（id）を
 * そのまま使わずlookupで正しいslugを解決する。存在しない・確認できない場合はundefined。
 */
export function policyOwnerLinkTo(
  policy: ArchivePolicy,
  lookup: Pick<PolicyOwnerLookup, "mayors" | "formerMembers">,
): string | undefined {
  if (!policy.ownerId) return undefined;
  switch (policy.ownerType) {
    case "mayor": {
      const mayor = lookup.mayors.find((m) => m.id === policy.ownerId);
      return mayor ? `/mayors/${mayor.slug}` : undefined;
    }
    case "member":
      return `/members/${policy.ownerId}`;
    case "formerMember": {
      const former = lookup.formerMembers.find((m) => m.id === policy.ownerId);
      return former ? `/members/former/${former.id}` : undefined;
    }
    default:
      return undefined;
  }
}
