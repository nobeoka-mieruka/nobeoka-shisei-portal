/**
 * 選挙結果データ（src/data/electionResults.json）の共通ヘルパー。
 */
import electionResultsData from "../data/electionResults.json";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import type { ElectionResult } from "../types/election";
import type { CouncilMember, FormerMember } from "../types";
import type { ArchiveMayor, ArchiveMemberProfile } from "../types/historicalArchive";
import { findMemberOrFormerLink } from "./councilSpeeches";

export const electionResults = electionResultsData as ElectionResult[];
const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];

/**
 * candidate.linkedProfileId（現職議員/元議員/歴代市長のいずれかのID）から、
 * 人物詳細ページへのリンク先を解決する。どれにも一致しない場合はundefined
 * （同姓同名の誤結合を避けるため、ここでは名前一致等のフォールバックは行わない）。
 */
export function personLinkForCandidate(linkedProfileId: string | null): { href: string; label: string } | undefined {
  if (!linkedProfileId) return undefined;
  const mayor = archiveMayors.find((m) => m.id === linkedProfileId);
  if (mayor) return { href: `/mayors/${mayor.slug}`, label: mayor.isCurrentMayor ? "市長情報を見る" : "歴代市長情報を見る" };
  const link = findMemberOrFormerLink(linkedProfileId, members, formerMembers, archiveMemberProfiles);
  if (link) return { href: link.href, label: link.isFormer ? "元議員情報を見る" : "議員情報を見る" };
  return undefined;
}

export function electionResultById(id: string): ElectionResult | undefined {
  return electionResults.find((e) => e.id === id);
}

/** electionDate（"day"精度はYYYY-MM-DD、"month"精度はYYYY-MM）を表示用文字列に整形する。 */
export function formatElectionDate(e: Pick<ElectionResult, "electionDate" | "electionDatePrecision">): string {
  if (e.electionDatePrecision === "month") {
    const [y, m] = e.electionDate.split("-");
    return `${y}年${Number(m)}月（日は未確認）`;
  }
  return e.electionDate;
}

/** dataCompleteness未設定（従来データ）は全項目確認済みとして扱う。 */
export function electionCandidateListConfirmed(e: Pick<ElectionResult, "dataCompleteness">): boolean {
  return e.dataCompleteness == null || e.dataCompleteness.candidateListConfirmed !== false;
}

export function electionResultsByType(electionType: "mayor" | "councilMember"): ElectionResult[] {
  return electionResults.filter((e) => e.electionType === electionType).sort((a, b) => a.electionDate.localeCompare(b.electionDate));
}

/** 指定した人物ID（現職議員/元議員/歴代市長のID）が候補者として登場した選挙を新しい順に返す。 */
export function electionResultsForPerson(personId: string): ElectionResult[] {
  return electionResults
    .filter((e) => e.candidates.some((c) => c.linkedProfileId === personId))
    .sort((a, b) => b.electionDate.localeCompare(a.electionDate));
}
