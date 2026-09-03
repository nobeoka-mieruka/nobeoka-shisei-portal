import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import electionResultsData from "../data/electionResults.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import archiveMemberTermsData from "../data/archiveMemberTerms.json";
import archiveMemberAffiliationsData from "../data/archiveMemberAffiliations.json";
import committeeReportActivityData from "../data/committeeReportActivity.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import billVotesData from "../data/billVotes.json";
import billProposalRolesData from "../data/billProposalRoles.json";
import type { CouncilMember, FormerMember, CouncilSpeechSummaryData, BillVoteItem } from "../types";
import type { ElectionResult } from "../types/election";
import type { ArchiveMemberProfile, ArchiveMemberTerm, ArchiveMemberAffiliation } from "../types/historicalArchive";
import { publicBills, billVoteLabels } from "./billVotes";
import { publicSpeeches, findMemberSpeechRecord } from "./councilSpeeches";
import { QUESTION_LIKE_SPEECH_TYPES } from "./questionLikeSpeechTypes";

/**
 * Phase120：人物単位の統合活動タイムライン。
 *
 * 【設計方針】既存データ（electionResults.json／archiveMemberProfiles.json・
 * archiveMemberTerms.json・archiveMemberAffiliations.json／committeeReportActivity.json／
 * councilSpeechSummaries.json／billVotes.json）から、その都度動的に組み立てる。新しい
 * イベント専用JSONは作らない（同じ事実を複数箇所へ複製しない）。
 *
 * 【日付精度】日付が完全に分からない場合はdateをnullとし、datePrecisionで精度を明示する。
 * 推測でYYYY-MM-DDを作らない。
 *
 * 【対象外にしたイベント種別】議員提出議案・意見書・決議の提出者情報、請願紹介議員は、
 * 現時点で議員別に構造化されたデータが無いため、このタイムラインには含めない（0件と表示する
 * のではなく、呼び出し側で「確認できる資料がありません」等と案内すること）。
 */

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const electionResults = electionResultsData as ElectionResult[];
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];
const archiveMemberTerms = archiveMemberTermsData as ArchiveMemberTerm[];
const archiveMemberAffiliations = archiveMemberAffiliationsData as ArchiveMemberAffiliation[];
const billVotes = publicBills(billVotesData as BillVoteItem[]);
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;

export type TimelineEventType =
  | "election"
  | "term_start"
  | "term_end"
  | "party"
  | "committee"
  | "role"
  | "general_question"
  | "speech"
  | "vote"
  | "proposal";

export type DatePrecision = "day" | "month" | "year" | "term" | "unknown";

export interface TimelineSourceRef {
  label: string;
  url?: string;
}

export interface TimelineEvent {
  personId: string;
  eventId: string;
  eventType: TimelineEventType;
  /** ISO形式（day精度の場合のみ）。それ以外はnull（推測で埋めない）。 */
  date: string | null;
  datePrecision: DatePrecision;
  /** 精度に応じた表示用ラベル（例："2023年4月23日"／"2023年4月"／"令和5年度"／"2019年6月定例会"）。 */
  displayDate: string;
  title: string;
  summary?: string;
  relatedId?: string;
  sourceRefs: TimelineSourceRef[];
}

function sessionIdToDisplayDate(sessionId: string): string {
  const [year, month] = sessionId.split("-");
  if (!year || !month) return sessionId;
  return `${year}年${Number(month)}月定例会・臨時会`;
}

function formatDayDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

function electionEvents(personId: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const e of electionResults) {
    for (const c of e.candidates ?? []) {
      if (c.linkedProfileId !== personId) continue;
      const precision: DatePrecision = e.electionDatePrecision === "month" ? "month" : "day";
      const date = precision === "day" ? e.electionDate : null;
      events.push({
        personId,
        eventId: `election-${e.id}-${personId}`,
        eventType: "election",
        date,
        datePrecision: precision,
        displayDate: precision === "day" ? formatDayDate(e.electionDate) : e.electionDate,
        title: `${e.electionName}${c.elected ? "　当選" : "　落選"}`,
        summary: typeof c.votes === "number" ? `得票数：${c.votes.toLocaleString("ja-JP")}票` : undefined,
        sourceRefs: (e.sourceRefs ?? []).map((r) => ({ label: r.sourceTitle ?? "出典資料", url: r.sourceUrl })),
      });
    }
  }
  return events;
}

function findArchiveProfile(personId: string): ArchiveMemberProfile | undefined {
  return archiveMemberProfiles.find((p) => p.legacyMemberId === personId || p.legacyFormerMemberId === personId);
}

function termEvents(personId: string): TimelineEvent[] {
  const profile = findArchiveProfile(personId);
  if (!profile) return [];
  const events: TimelineEvent[] = [];
  for (const t of archiveMemberTerms.filter((t) => t.memberProfileId === profile.id)) {
    const sourceRefs = (t.sourceRefs ?? []).map((r) => ({ label: r.sourceTitle ?? "出典資料", url: r.sourceUrl }));
    events.push({
      personId,
      eventId: `${t.id}-start`,
      eventType: "term_start",
      date: t.termStart,
      datePrecision: "day",
      displayDate: formatDayDate(t.termStart),
      title: `第${t.termNumber ?? "?"}期　任期開始`,
      summary: "任期開始日は選挙日を基準としており、実際の就任日（初議会招集日等）とは前後する可能性があります。",
      sourceRefs,
    });
    if (t.termEnd) {
      events.push({
        personId,
        eventId: `${t.id}-end`,
        eventType: "term_end",
        date: t.termEnd,
        datePrecision: "day",
        displayDate: formatDayDate(t.termEnd),
        title: `第${t.termNumber ?? "?"}期　任期終了`,
        sourceRefs,
      });
    }
  }
  return events;
}

function affiliationEvents(personId: string): TimelineEvent[] {
  const profile = findArchiveProfile(personId);
  if (!profile) return [];
  return archiveMemberAffiliations
    .filter((a) => a.memberProfileId === profile.id)
    .map((a) => {
      const eventType: TimelineEventType =
        a.affiliationType === "committee" ? "committee" : a.affiliationType === "party" ? "party" : "role";
      const title =
        a.affiliationType === "party"
          ? `党派：${a.affiliationId}${a.endDate ? "" : "（当選時点。以降の異動は未確認）"}`
          : `${a.affiliationId}${a.role ? `　${a.role}` : ""}${a.endDate ? "" : "（継続中）"}`;
      return {
        personId,
        eventId: a.id,
        eventType,
        date: a.startDate,
        datePrecision: "day" as DatePrecision,
        displayDate: formatDayDate(a.startDate),
        title,
        summary: a.endDate
          ? `${formatDayDate(a.startDate)}〜${formatDayDate(a.endDate)}に確認`
          : `${formatDayDate(a.startDate)}以降、確認`,
        sourceRefs: [{ label: a.sourceRef.sourceTitle ?? "出典資料", url: a.sourceRef.sourceUrl }],
      };
    });
}

function committeeReportEvents(personId: string): TimelineEvent[] {
  const events = (committeeReportActivityData as { events: { id: string; memberId: string; committeeName: string; role: "chair" | "viceChair"; meetingDate?: string; sourceUrl: string }[] }).events;
  return events
    .filter((e) => e.memberId === personId)
    .map((e) => ({
      personId,
      eventId: e.id,
      eventType: "role" as TimelineEventType,
      date: e.meetingDate ?? null,
      datePrecision: (e.meetingDate ? "day" : "unknown") as DatePrecision,
      displayDate: e.meetingDate ? formatDayDate(e.meetingDate) : "日付確認中",
      title: `${e.committeeName}${e.role === "chair" ? "委員長" : "副委員長"}として本会議で報告`,
      sourceRefs: [{ label: "延岡市議会 会議録検索システム", url: e.sourceUrl }],
    }));
}

function speechEvents(personId: string): TimelineEvent[] {
  const record = findMemberSpeechRecord(speechSummaryData.members, personId);
  const speeches = publicSpeeches(record);
  return speeches.map((s) => {
    const itemCount = s.questionItems?.length ?? 0;
    const isQuestion = QUESTION_LIKE_SPEECH_TYPES.has(s.speechType);
    return {
      personId,
      eventId: s.id,
      eventType: (isQuestion ? "general_question" : "speech") as TimelineEventType,
      date: s.date,
      datePrecision: (s.date ? "day" : "unknown") as DatePrecision,
      displayDate: s.date ? formatDayDate(s.date) : sessionIdToDisplayDate(s.sessionId),
      title: `${s.speechType}${itemCount > 0 ? `（質問項目${itemCount}件）` : ""}`,
      summary: s.topics.length > 0 ? `テーマ：${s.topics.join("、")}` : undefined,
      relatedId: s.sessionId,
      sourceRefs: (s.summarySources ?? []).map((src) => ({ label: src.title, url: src.sourceUrl })),
    };
  });
}

function voteEvents(personId: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const b of billVotes) {
    const v = b.memberVotes.find((v) => v.memberId === personId);
    if (!v) continue;
    const date = b.memberVoteRecordedDate ?? b.votingDate ?? null;
    events.push({
      personId,
      eventId: `vote-${b.id}-${personId}`,
      eventType: "vote",
      date,
      datePrecision: (date ? "day" : "unknown") as DatePrecision,
      displayDate: date ? formatDayDate(date) : "日付確認中",
      title: `${b.billNumber}　${b.billTitle}　${billVoteLabels[v.vote]}`,
      relatedId: b.id,
      sourceRefs: [
        ...(b.resultDocumentUrl ? [{ label: "議案審議結果", url: b.resultDocumentUrl }] : []),
        ...(b.transcriptUrl ? [{ label: "会議録", url: b.transcriptUrl }] : []),
      ],
    });
  }
  return events;
}

const PROPOSAL_ROLE_LABELS_JA: Record<string, string> = {
  submitter: "提出者",
  co_submitter: "共同提出者",
  introducing_member: "紹介議員",
  proposer: "提案者",
  co_proposer: "共同提案者",
  signatory: "賛成者",
  other: "関係者",
};

/**
 * Phase128：議員提出議案（決議等）の提出者（会議録の提案理由説明の発言者ラベルから
 * 個別に確認できたもののみ）。請願・陳情の紹介議員は一次資料で確認できていないため
 * ここには含まれない（billProposalRoles.json自体に登録していない）。
 */
function proposalEvents(personId: string): TimelineEvent[] {
  const roles = (billProposalRolesData as { roles: { recordId: string; billId: string; personId: string; role: string; date: string | null; sourceRefs: { label: string; url?: string }[] }[] }).roles;
  const billsById = new Map(billVotes.map((b) => [b.id, b]));
  return roles
    .filter((r) => r.personId === personId)
    .map((r) => {
      const bill = billsById.get(r.billId);
      const label = PROPOSAL_ROLE_LABELS_JA[r.role] ?? r.role;
      return {
        personId,
        eventId: r.recordId,
        eventType: "proposal" as TimelineEventType,
        date: r.date,
        datePrecision: (r.date ? "day" : "unknown") as DatePrecision,
        displayDate: r.date ? formatDayDate(r.date) : "日付確認中",
        title: `${bill ? `${bill.billNumber}　${bill.billTitle}` : r.billId}　（${label}）`,
        relatedId: r.billId,
        sourceRefs: r.sourceRefs,
      };
    });
}

/** 日付の並べ替え用キー。day精度は実日付、それ以外は末尾へ寄せつつsessionId等でおおまかに並べる。 */
function sortKeyOf(e: TimelineEvent): string {
  if (e.date) return e.date;
  if (e.relatedId && /^\d{4}-\d{2}/.test(e.relatedId)) return `${e.relatedId}-99`;
  return "0000-00-00";
}

/**
 * 指定した人物（personId：現職はmembers.jsonのid、元議員はformerMembers.jsonのid）の
 * 統合活動タイムラインを、新しい日付順で返す。
 */
export function getPersonTimeline(personId: string): TimelineEvent[] {
  const isKnownPerson = members.some((m) => m.id === personId) || formerMembers.some((m) => m.id === personId);
  if (!isKnownPerson) return [];

  const events = [
    ...electionEvents(personId),
    ...termEvents(personId),
    ...affiliationEvents(personId),
    ...committeeReportEvents(personId),
    ...speechEvents(personId),
    ...voteEvents(personId),
    ...proposalEvents(personId),
  ];

  return events.sort((a, b) => sortKeyOf(b).localeCompare(sortKeyOf(a)));
}

export interface TimelineEventTypeCoverage {
  eventType: TimelineEventType;
  label: string;
  /** この種別のイベントが1件でもあるか。0件の場合、呼び出し側は「未収録」等で案内すること。 */
  hasEvents: boolean;
}

export const TIMELINE_EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  election: "選挙",
  term_start: "任期開始",
  term_end: "任期終了",
  party: "党派",
  committee: "委員会所属",
  role: "役職・委員長報告",
  general_question: "一般質問",
  speech: "議会内発言",
  vote: "議案への賛否",
  proposal: "議案提出",
};
