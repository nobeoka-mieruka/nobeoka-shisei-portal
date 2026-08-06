import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import archivePoliciesData from "../data/archivePolicies.json";
import archiveCouncilDocumentsData from "../data/archiveCouncilDocuments.json";
import billVotesData from "../data/billVotes.json";
import type { BillVoteItem, CouncilMember, FormerMember } from "../types";
import type { ArchiveCouncilDocument, ArchiveMayor, ArchiveMayorTerm, ArchivePolicy } from "../types/historicalArchive";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const archivePolicies = archivePoliciesData as ArchivePolicy[];
const archiveCouncilDocuments = archiveCouncilDocumentsData as ArchiveCouncilDocument[];
const billVotes = billVotesData as BillVoteItem[];

export type PersonType = "member" | "former-member" | "mayor";

export interface PersonSummary {
  personType: PersonType;
  id: string;
  /** /people/:slug 用。personType別プレフィックスを付け、既存/members/:id等とURL空間を分離する。 */
  slug: string;
  name: string;
  nameKana?: string;
  isCurrent: boolean;
  factionId?: string;
  /** 表示用の在籍期間・任期の要約テキスト。確認できない場合は「確認中」を含む。 */
  tenureLabel: string;
  /** 絞り込み用の在籍年度（西暦、確認できる範囲のみ）。 */
  tenureYears: number[];
  verificationStatus: "verified" | "partiallyVerified" | "needsReview" | "sourceUnavailable";
  relatedDocumentCount: number;
}

export function personSlug(personType: PersonType, id: string): string {
  return `${personType}-${id}`;
}

export function parsePersonSlug(slug: string): { personType: PersonType; id: string } | undefined {
  for (const type of ["member", "former-member", "mayor"] as PersonType[]) {
    const prefix = `${type}-`;
    if (slug.startsWith(prefix)) return { personType: type, id: slug.slice(prefix.length) };
  }
  return undefined;
}

function relatedDocumentCountFor(personType: PersonType, id: string): number {
  let count = 0;
  for (const p of archivePolicies) {
    if (p.ownerId !== id) continue;
    if (personType === "member" && p.ownerType === "member") count++;
    if (personType === "former-member" && p.ownerType === "formerMember") count++;
    if (personType === "mayor" && p.ownerType === "mayor") count++;
  }
  for (const d of archiveCouncilDocuments) {
    const ids = [...(d.proposerIds ?? []), ...(d.relatedMemberIds ?? []), ...(d.relatedMayorIds ?? [])];
    if (ids.includes(id)) count++;
  }
  return count;
}

const CURRENT_YEAR = new Date().getFullYear();

/** servedSessions（例: "2024-12"）から年（西暦）だけを取り出す。 */
function yearsFromSessionIds(sessionIds: string[]): number[] {
  return [...new Set(sessionIds.map((s) => Number.parseInt(s.slice(0, 4), 10)).filter((y) => Number.isInteger(y)))];
}

function yearRangeFromTerm(termStart?: string, termEnd?: string | null): number[] {
  if (!termStart) return [];
  const startYear = Number.parseInt(termStart.slice(0, 4), 10);
  const endYear = termEnd ? Number.parseInt(termEnd.slice(0, 4), 10) : CURRENT_YEAR;
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) return [];
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);
  return years;
}

/**
 * 現職議員・元議員・歴代市長を人物単位で束ねた一覧を返す（既存3ファイルをそのまま参照し、
 * 実データを複製しない）。在籍年度は確認できる範囲のみを算出し、確認できない期間を
 * 推測で埋めない（現職議員は「在籍履歴」データが未整備のため、当年のみを在籍年度とする）。
 */
export function buildPersonIndex(): PersonSummary[] {
  const people: PersonSummary[] = [];

  for (const m of members) {
    people.push({
      personType: "member",
      id: m.id,
      slug: personSlug("member", m.id),
      name: m.name,
      nameKana: m.nameKana,
      isCurrent: true,
      factionId: m.factionId,
      tenureLabel: m.termCount ? `現職（当選${m.termCount}回）` : "現職",
      tenureYears: [CURRENT_YEAR],
      verificationStatus: m.profileUrl ? "verified" : "needsReview",
      relatedDocumentCount: relatedDocumentCountFor("member", m.id),
    });
  }

  for (const fm of formerMembers) {
    people.push({
      personType: "former-member",
      id: fm.id,
      slug: personSlug("former-member", fm.id),
      name: fm.name,
      nameKana: fm.nameKana ?? undefined,
      isCurrent: false,
      tenureLabel: fm.servedSessions.length > 0 ? `元議員（在職確認済み会期：${fm.servedSessions.join("、")}）` : "元議員（在職期間は確認中）",
      tenureYears: yearsFromSessionIds(fm.servedSessions),
      verificationStatus: fm.lastVerified ? "partiallyVerified" : "needsReview",
      relatedDocumentCount: relatedDocumentCountFor("former-member", fm.id),
    });
  }

  for (const mayor of archiveMayors) {
    const terms = archiveMayorTerms.filter((t) => t.mayorId === mayor.id);
    const tenureYears = terms.flatMap((t) => yearRangeFromTerm(t.termStart, t.termEnd));
    // 全任期が職務代理（acting/temporaryActing）のみの人物は、公選の市長と混同しないよう表記を分ける。
    const isActingOnly = terms.length > 0 && terms.every((t) => t.mayorRole === "acting" || t.mayorRole === "temporaryActing");
    const roleLabel = mayor.isCurrentMayor ? "現市長" : isActingOnly ? "元市長職務代理者" : "元市長";
    people.push({
      personType: "mayor",
      id: mayor.id,
      slug: personSlug("mayor", mayor.id),
      name: mayor.name,
      nameKana: mayor.nameKana,
      isCurrent: mayor.isCurrentMayor,
      tenureLabel: terms.length > 0 ? `${roleLabel}（${terms.length}期）` : roleLabel,
      tenureYears: [...new Set(tenureYears)],
      verificationStatus: mayor.sourceRefs[0]?.verificationStatus ?? "needsReview",
      relatedDocumentCount: relatedDocumentCountFor("mayor", mayor.id),
    });
  }

  return people;
}

export function personTypeLabel(type: PersonType): string {
  switch (type) {
    case "member":
      return "現職議員";
    case "former-member":
      return "元議員";
    case "mayor":
      return "市長";
  }
}

/** 人物詳細ページ内で、その人物に紐づく確認済み政策を返す（archivePolicies.jsonの確定データ）。 */
export function policiesForPerson(personType: PersonType, id: string): ArchivePolicy[] {
  const ownerType = personType === "member" ? "member" : personType === "former-member" ? "formerMember" : "mayor";
  return archivePolicies.filter((p) => p.ownerType === ownerType && p.ownerId === id);
}

/** 人物詳細ページ内で、その人物が提出者・関係者として確認できる議案・条例・請願・陳情を返す。 */
export function councilDocumentsForPerson(id: string): ArchiveCouncilDocument[] {
  return archiveCouncilDocuments.filter((d) => {
    const ids = [...(d.proposerIds ?? []), ...(d.relatedMemberIds ?? []), ...(d.relatedMayorIds ?? [])];
    return ids.includes(id);
  });
}

/** billVotes.json全体が実際にカバーしている議決日の範囲（最古・最新）。データが無ければundefined。 */
function billVotesCoverageRange(): { start: string; end: string } | undefined {
  const dates = billVotes.map((b) => b.votingDate).filter((d): d is string => !!d).sort();
  if (dates.length === 0) return undefined;
  return { start: dates[0], end: dates[dates.length - 1] };
}

/**
 * 市長が提出した議案（billVotes.jsonのproposerType==="mayor"）のうち、その市長の在任期間内に
 * 議決されたものの件数を返す。archiveCouncilDocuments.json（proposerIds等）は市長の紐付けが
 * ほぼ未収録のため、より網羅的なbillVotes.jsonの議決日と任期を突き合わせて算出する。
 *
 * hasDataCoverage:falseは「その市長の任期がbillVotes.jsonの収録期間と全く重ならない」ことを示す
 * （＝0件ではなく「未収録」）。任期が確認できない市長も同様にfalseとする。
 * 任期終了日が未確認（termEnd:null。現職、または退任日未確認）の場合は、収録期間の終端まで
 * 在任していたものとして扱う。
 */
export function mayorSubmittedBillCount(mayorId: string): { count: number; hasDataCoverage: boolean } {
  const coverage = billVotesCoverageRange();
  const terms = archiveMayorTerms.filter((t) => t.mayorId === mayorId);
  if (!coverage || terms.length === 0) return { count: 0, hasDataCoverage: false };

  const inTerm = (dateIso: string) =>
    terms.some((t) => dateIso >= t.termStart && dateIso <= (t.termEnd ?? coverage.end));

  const overlapsCoverage = terms.some((t) => t.termStart <= coverage.end && (t.termEnd ?? coverage.end) >= coverage.start);
  if (!overlapsCoverage) return { count: 0, hasDataCoverage: false };

  const count =
    billVotes.filter((b) => b.proposerType === "mayor" && b.votingDate && inTerm(b.votingDate)).length +
    councilDocumentsForPerson(mayorId).length;
  return { count, hasDataCoverage: true };
}

/** 既存billVotes.json（議員別賛否記録）で、この人物（議員）の賛否が確認できる議案件数。 */
export function voteCountForPerson(id: string): number {
  return billVotes.filter((b) => b.memberVotes.some((v) => v.memberId === id)).length;
}
