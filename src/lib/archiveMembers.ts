import type {
  ArchiveAffiliationType,
  ArchiveMemberAffiliation,
  ArchiveMemberProfile,
  ArchiveMemberStatus,
  ArchiveMemberTerm,
} from "../types/historicalArchive";
import type { CouncilSpeech, CouncilSpeechSummaryData } from "../types";
import { findMemberSpeechRecord, publicSpeeches } from "./councilSpeeches";

export function archiveMemberStatusLabel(status: ArchiveMemberStatus): string {
  switch (status) {
    case "current":
      return "現職";
    case "former":
      return "元職";
    case "resigned":
      return "辞職";
    case "lostOffice":
      return "失職";
    case "deceased":
      return "死去";
    case "termCompleted":
      return "任期満了";
    case "unknown":
      return "不明";
  }
}

export function affiliationTypeLabel(type: ArchiveAffiliationType): string {
  switch (type) {
    case "faction":
      return "会派";
    case "party":
      return "政党";
    case "committee":
      return "委員会";
    case "councilRole":
      return "議会内役職";
  }
}

export function termsForMemberProfile(terms: ArchiveMemberTerm[], memberProfileId: string): ArchiveMemberTerm[] {
  return terms.filter((t) => t.memberProfileId === memberProfileId).sort((a, b) => a.termStart.localeCompare(b.termStart));
}

export function affiliationsForMemberProfile(
  affiliations: ArchiveMemberAffiliation[],
  memberProfileId: string,
): ArchiveMemberAffiliation[] {
  return affiliations
    .filter((a) => a.memberProfileId === memberProfileId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function affiliationsForMemberProfileByType(
  affiliations: ArchiveMemberAffiliation[],
  memberProfileId: string,
  type: ArchiveAffiliationType,
): ArchiveMemberAffiliation[] {
  return affiliationsForMemberProfile(affiliations, memberProfileId).filter((a) => a.affiliationType === type);
}

/**
 * プロフィールに紐づく公開済み発言（一般質問等）を返す。legacyFormerMemberIdを優先し、
 * 無い場合はlegacyMemberIdで既存councilSpeechSummaries.jsonを参照する。
 * どちらも無い場合は空配列（＝「資料未確認」表示側で0件と未確認を区別すること）。
 */
export function speechesForProfile(
  profile: ArchiveMemberProfile,
  speechData: CouncilSpeechSummaryData,
): CouncilSpeech[] {
  const legacyId = profile.legacyFormerMemberId ?? profile.legacyMemberId;
  if (!legacyId) return [];
  const record = findMemberSpeechRecord(speechData.members, legacyId);
  return publicSpeeches(record);
}

export type SessionMembershipStatus = "confirmed" | "needsReview";

/**
 * 指定した会期（sessionId、例: "2024-12"）の時点でこの人物が在籍していたと
 * 確認できるかどうかを判定する。現在の所属を過去会期へ遡って適用しないため、
 * 明確な根拠（任期の期間、または既存formerMembers.jsonの在職確認済み会期リスト）が
 * ある場合のみ"confirmed"を返す。根拠がない場合は在籍扱いにせず"needsReview"とする。
 *
 * sessionIdは年月までの粒度（"YYYY-MM"）のため、期間判定は各月15日を代表日とする近似で行う。
 */
export function sessionMembershipStatus(
  profile: ArchiveMemberProfile,
  sessionId: string,
  terms: ArchiveMemberTerm[],
  legacyServedSessions?: Set<string>,
): SessionMembershipStatus {
  const own = termsForMemberProfile(terms, profile.id);
  if (own.length > 0) {
    const approxDate = `${sessionId}-15`;
    const within = own.some((t) => t.termStart <= approxDate && (t.termEnd === null || t.termEnd >= approxDate));
    if (within) return "confirmed";
  }
  if (legacyServedSessions?.has(sessionId)) return "confirmed";
  return "needsReview";
}
