import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import archivePoliciesData from "../data/archivePolicies.json";
import archiveCouncilDocumentsData from "../data/archiveCouncilDocuments.json";
import billVotesData from "../data/billVotes.json";
import electionResultsData from "../data/electionResults.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import archiveMemberAffiliationsData from "../data/archiveMemberAffiliations.json";
import archiveMemberTermsData from "../data/archiveMemberTerms.json";
import committeeReportActivityData from "../data/committeeReportActivity.json";
import type { BillVoteItem, CouncilMember, CouncilSpeechSummaryData, FormerMember } from "../types";
import type { ElectionResult } from "../types/election";
import type {
  ArchiveCouncilDocument,
  ArchiveMayor,
  ArchiveMayorTerm,
  ArchiveMemberAffiliation,
  ArchiveMemberProfile,
  ArchiveMemberTerm,
  ArchivePolicy,
} from "../types/historicalArchive";
import { QUESTION_LIKE_SPEECH_TYPES } from "./questionLikeSpeechTypes";
import { getPersonTimeline } from "./personTimeline";
import { getFormerMemberDataTier, type FormerMemberDataTier } from "./formerMemberActivity";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const archivePolicies = archivePoliciesData as ArchivePolicy[];
const archiveCouncilDocuments = archiveCouncilDocumentsData as ArchiveCouncilDocument[];
const billVotes = billVotesData as BillVoteItem[];
const electionResults = electionResultsData as ElectionResult[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];
const archiveMemberAffiliations = archiveMemberAffiliationsData as ArchiveMemberAffiliation[];
const archiveMemberTerms = archiveMemberTermsData as ArchiveMemberTerm[];

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
  /** Phase129：選挙で当選した年（西暦、electionResults.json由来）。在職年代（tenureYears）とは
   * 別概念のため区別する（選挙年から在職期間を自動推定しない）。 */
  electionYears: number[];
  verificationStatus: "verified" | "partiallyVerified" | "needsReview" | "sourceUnavailable";
  /** 「政策（公約）」「議案・条例・請願・陳情アーカイブ」に個別に紐付けられている件数のみ。
   * 一般質問・議案賛否（個人別）・委員会・選挙は含まない（TASK-073：activityBreakdown参照）。 */
  relatedDocumentCount: number;
  /** TASK-073：関連資料0件が「この人物には活動実績がない」と誤解されないよう、
   * 一般質問・議案賛否・委員会・政策・議案等アーカイブ・選挙をカテゴリ別に個別集計したもの。 */
  activityBreakdown: PersonActivityBreakdown;
  /** Phase130：元議員限定のデータ充足レベル（人物評価ではない。formerMemberActivity.ts参照）。
   * 現職議員・市長には算出しない（対象データ構造が異なるため、今回は元議員限定で導入）。 */
  dataTier?: FormerMemberDataTier;
}

/** TASK-073：カテゴリ別の活動・関連資料件数。0件と「未確認」を区別するため、
 * relatedDocumentCount（政策＋議案等アーカイブ）に含まれない項目も個別に保持する。 */
export interface PersonActivityBreakdown {
  generalQuestionCount: number;
  billVoteCount: number;
  committeeLinked: boolean;
  policyCount: number;
  councilDocumentCount: number;
  electionCount: number;
  totalCount: number;
}

/** 議員1名分の活動・関連資料をカテゴリ別に集計する（既存の各データセットを横断参照するのみで、
 * 新しい判定ロジックや推測値は追加しない）。 */
function personActivityBreakdownFor(personType: PersonType, id: string): PersonActivityBreakdown {
  const speechRecord = speechSummaryData.members.find((m) => m.memberId === id);
  const generalQuestionCount = speechRecord
    ? speechRecord.speeches.filter((s) => QUESTION_LIKE_SPEECH_TYPES.has(s.speechType)).length
    : 0;
  const billVoteCount = billVotes.filter((b) => (b.memberVotes ?? []).some((v) => v.memberId === id)).length;
  const committeeLinked =
    (personType === "member" && (members.find((m) => m.id === id)?.committees?.length ?? 0) > 0) ||
    archiveMemberAffiliations.some((a) => {
      if (a.affiliationType !== "committee") return false;
      const profile = archiveMemberProfiles.find((p) => p.id === a.memberProfileId);
      return profile?.legacyMemberId === id || profile?.legacyFormerMemberId === id;
    }) ||
    (committeeReportActivityData as { events: { memberId: string }[] }).events.some((e) => e.memberId === id);
  const policyCount = archivePolicies.filter((p) => {
    if (p.ownerId !== id) return false;
    if (personType === "member") return p.ownerType === "member";
    if (personType === "former-member") return p.ownerType === "formerMember";
    return p.ownerType === "mayor";
  }).length;
  const councilDocumentCount = archiveCouncilDocuments.filter((d) => {
    const ids = [...(d.proposerIds ?? []), ...(d.relatedMemberIds ?? []), ...(d.relatedMayorIds ?? [])];
    return ids.includes(id);
  }).length;
  const electionCount = electionResults.reduce(
    (sum, e) => sum + (e.candidates ?? []).filter((c) => c.linkedProfileId === id).length,
    0,
  );
  return {
    generalQuestionCount,
    billVoteCount,
    committeeLinked,
    policyCount,
    councilDocumentCount,
    electionCount,
    totalCount:
      generalQuestionCount + billVoteCount + policyCount + councilDocumentCount + (committeeLinked ? 1 : 0) + electionCount,
  };
}

/** 元議員1名分のデータ充足レベルを、統合タイムラインのイベント種別集合から算出する。 */
function formerMemberDataTierOf(formerMemberId: string): FormerMemberDataTier {
  const eventTypes = new Set(getPersonTimeline(formerMemberId).map((e) => e.eventType));
  return getFormerMemberDataTier(eventTypes);
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

  // Phase129：electionResults.jsonのlinkedProfileIdから、人物ごとの当選年（西暦）を求める。
  // 在職年代（tenureYears）とは別概念として管理し、選挙年から在職期間を自動推定しない。
  const electionYearsByPersonId = new Map<string, number[]>();
  for (const e of electionResults) {
    const year = Number.parseInt(e.electionDate.slice(0, 4), 10);
    if (!Number.isInteger(year)) continue;
    for (const c of e.candidates ?? []) {
      if (!c.elected || !c.linkedProfileId) continue;
      const list = electionYearsByPersonId.get(c.linkedProfileId) ?? [];
      list.push(year);
      electionYearsByPersonId.set(c.linkedProfileId, list);
    }
  }

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
      electionYears: [...new Set(electionYearsByPersonId.get(m.id) ?? [])],
      verificationStatus: m.profileUrl ? "verified" : "needsReview",
      relatedDocumentCount: relatedDocumentCountFor("member", m.id),
      activityBreakdown: personActivityBreakdownFor("member", m.id),
    });
  }

  for (const fm of formerMembers) {
    const electionYears = [...new Set(electionYearsByPersonId.get(fm.id) ?? [])];
    const tenureLabel =
      fm.servedSessions.length > 0
        ? `元議員（在職確認済み会期：${fm.servedSessions.join("、")}）`
        : electionYears.length > 0
          ? `元議員（選挙記録：${electionYears.join("、")}年当選。正式な任期は未確認）`
          : "元議員（在職期間は確認中）";
    people.push({
      personType: "former-member",
      id: fm.id,
      slug: personSlug("former-member", fm.id),
      name: fm.name,
      nameKana: fm.nameKana ?? undefined,
      isCurrent: false,
      tenureLabel,
      tenureYears: yearsFromSessionIds(fm.servedSessions),
      electionYears,
      verificationStatus: fm.lastVerified ? "partiallyVerified" : "needsReview",
      relatedDocumentCount: relatedDocumentCountFor("former-member", fm.id),
      activityBreakdown: personActivityBreakdownFor("former-member", fm.id),
      dataTier: formerMemberDataTierOf(fm.id),
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
      electionYears: [...new Set(electionYearsByPersonId.get(mayor.id) ?? [])],
      verificationStatus: mayor.sourceRefs[0]?.verificationStatus ?? "needsReview",
      relatedDocumentCount: relatedDocumentCountFor("mayor", mayor.id),
      activityBreakdown: personActivityBreakdownFor("mayor", mayor.id),
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

/**
 * Phase124：/data-status向けの人物データ収録状況サマリー。「収録人数」（本サイトが
 * 登録済みの人数）と「実際に存在した歴代議員総数」は別概念であり混同しない
 * （後者は本サイトが把握できていない人物を含みうるため、算出しない）。
 */
export interface PeopleDataStatus {
  currentMemberCount: number;
  formerMemberCount: number;
  mayorCount: number;
  totalPersonIdCount: number;
  electionLinkedCount: number;
  generalQuestionLinkedCount: number;
  speechLinkedCount: number;
  voteLinkedCount: number;
  committeeLinkedCount: number;
  /** 選挙・一般質問・議会発言・議案賛否・委員会のいずれの根拠も無い人物ID数。 */
  unconfirmedPersonCount: number;
  /** Phase129：元議員（formerMembers.json）限定の内訳。選挙日を任期開始日とみなさない方針のため、
   * 「任期確認」は`archiveMemberTerms.json`に独立したレコードがある場合のみカウントする。 */
  formerMemberTermConfirmedCount: number;
  /** 会派（factions.json、議会内の会派）ではなく、選挙時点の届出党派（party）の履歴が確認できた人数。 */
  formerMemberPartyConfirmedCount: number;
  formerMemberCommitteeConfirmedCount: number;
  formerMemberGeneralQuestionConfirmedCount: number;
  formerMemberSpeechConfirmedCount: number;
  formerMemberVoteConfirmedCount: number;
  /** 選挙記録のみ確認できている（任期・議会活動のいずれも未確認）元議員数。データ充足レベルD相当。 */
  formerMemberElectionOnlyCount: number;
  /** Phase130：データ充足レベル別の元議員数（人物評価ではない。formerMemberActivity.ts参照）。 */
  formerMemberTierACount: number;
  formerMemberTierBCount: number;
  formerMemberTierCCount: number;
  formerMemberTierDCount: number;
}

export function getPeopleDataStatus(): PeopleDataStatus {
  const allIds = [...members.map((m) => m.id), ...formerMembers.map((m) => m.id)];

  const electionLinked = new Set<string>();
  for (const e of electionResults) {
    for (const c of e.candidates ?? []) {
      if (c.linkedProfileId) electionLinked.add(c.linkedProfileId);
    }
  }

  const speechLinked = new Set<string>();
  const questionLinked = new Set<string>();
  for (const m of speechSummaryData.members) {
    if ((m.speeches?.length ?? 0) > 0) speechLinked.add(m.memberId);
    if ((m.speeches ?? []).some((s) => QUESTION_LIKE_SPEECH_TYPES.has(s.speechType))) questionLinked.add(m.memberId);
  }

  const voteLinked = new Set<string>();
  for (const b of billVotes) {
    for (const v of b.memberVotes ?? []) voteLinked.add(v.memberId);
  }

  const profileToLegacyId = new Map(archiveMemberProfiles.map((p) => [p.id, p.legacyMemberId ?? p.legacyFormerMemberId]));
  const committeeLinked = new Set<string>();
  for (const m of members) {
    if ((m.committees?.length ?? 0) > 0) committeeLinked.add(m.id);
  }
  for (const a of archiveMemberAffiliations) {
    if (a.affiliationType !== "committee") continue;
    const legacyId = profileToLegacyId.get(a.memberProfileId);
    if (legacyId) committeeLinked.add(legacyId);
  }
  for (const e of (committeeReportActivityData as { events: { memberId: string }[] }).events) {
    committeeLinked.add(e.memberId);
  }

  const unconfirmedPersonCount = allIds.filter(
    (id) => !electionLinked.has(id) && !speechLinked.has(id) && !voteLinked.has(id) && !committeeLinked.has(id),
  ).length;

  // Phase129：元議員限定の内訳（archiveMemberTerms／archiveMemberAffiliationsの"party"型を活用）。
  const termConfirmedProfileIds = new Set(archiveMemberTerms.map((t) => t.memberProfileId));
  const partyConfirmedProfileIds = new Set(
    archiveMemberAffiliations.filter((a) => a.affiliationType === "party").map((a) => a.memberProfileId),
  );
  const formerIds = formerMembers.map((m) => m.id);
  const formerMemberTermConfirmedCount = formerIds.filter((id) => {
    const profile = archiveMemberProfiles.find((p) => p.legacyFormerMemberId === id);
    return profile && termConfirmedProfileIds.has(profile.id);
  }).length;
  const formerMemberPartyConfirmedCount = formerIds.filter((id) => {
    const profile = archiveMemberProfiles.find((p) => p.legacyFormerMemberId === id);
    return profile && partyConfirmedProfileIds.has(profile.id);
  }).length;
  const formerMemberCommitteeConfirmedCount = formerIds.filter((id) => committeeLinked.has(id)).length;
  const formerMemberGeneralQuestionConfirmedCount = formerIds.filter((id) => questionLinked.has(id)).length;
  const formerMemberSpeechConfirmedCount = formerIds.filter((id) => speechLinked.has(id)).length;
  const formerMemberVoteConfirmedCount = formerIds.filter((id) => voteLinked.has(id)).length;
  const formerMemberElectionOnlyCount = formerIds.filter(
    (id) =>
      electionLinked.has(id) &&
      !questionLinked.has(id) &&
      !speechLinked.has(id) &&
      !voteLinked.has(id) &&
      !committeeLinked.has(id) &&
      !(() => {
        const profile = archiveMemberProfiles.find((p) => p.legacyFormerMemberId === id);
        return profile && termConfirmedProfileIds.has(profile.id);
      })(),
  ).length;

  const formerMemberTierCounts = { A: 0, B: 0, C: 0, D: 0 };
  for (const fm of formerMembers) {
    formerMemberTierCounts[formerMemberDataTierOf(fm.id)]++;
  }

  return {
    currentMemberCount: members.length,
    formerMemberCount: formerMembers.length,
    mayorCount: archiveMayors.length,
    totalPersonIdCount: members.length + formerMembers.length + archiveMayors.length,
    electionLinkedCount: allIds.filter((id) => electionLinked.has(id)).length,
    generalQuestionLinkedCount: allIds.filter((id) => questionLinked.has(id)).length,
    speechLinkedCount: allIds.filter((id) => speechLinked.has(id)).length,
    voteLinkedCount: allIds.filter((id) => voteLinked.has(id)).length,
    committeeLinkedCount: allIds.filter((id) => committeeLinked.has(id)).length,
    unconfirmedPersonCount,
    formerMemberTermConfirmedCount,
    formerMemberPartyConfirmedCount,
    formerMemberCommitteeConfirmedCount,
    formerMemberGeneralQuestionConfirmedCount,
    formerMemberSpeechConfirmedCount,
    formerMemberVoteConfirmedCount,
    formerMemberElectionOnlyCount,
    formerMemberTierACount: formerMemberTierCounts.A,
    formerMemberTierBCount: formerMemberTierCounts.B,
    formerMemberTierCCount: formerMemberTierCounts.C,
    formerMemberTierDCount: formerMemberTierCounts.D,
  };
}
