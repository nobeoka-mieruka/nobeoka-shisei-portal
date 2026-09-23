import committeesData from "../data/committees.json";
import billVotesData from "../data/billVotes.json";
import committeeActivityReportsData from "../data/committeeActivityReports.json";
import committeeReportActivityData from "../data/committeeReportActivity.json";
import archiveCommitteeMembersData from "../data/archiveCommitteeMembers.json";
import committeeMeetingScheduleData from "../data/committeeMeetingSchedule.json";
import type {
  Committee,
  BillVoteItem,
  CommitteeActivityReport,
  CommitteeReportActivityEvent,
  ArchiveCommitteeMemberTerm,
  CommitteeMeetingScheduleItem,
} from "../types";

/**
 * 委員会（常任委員会・議会運営委員会・特別委員会）関連のデータアクセスヘルパー。
 *
 * 審査議案の一覧は billVotes.json の committee フィールドから逆引きする（重複保持しない）。
 * 予算審査特別委員会・決算審査特別委員会・長期総合計画審査特別委員会等、会期ごとに
 * 議長（決算審査特別委員会は議長及び監査委員）を除く全議員で構成・設置される臨時の委員会は committees.json には収録していないが、
 * 審査議案の逆引き自体は committee 名が一致すれば表示できる。
 */

export const committees = committeesData as Committee[];
const billVotes = billVotesData as BillVoteItem[];
const committeeActivityReports = committeeActivityReportsData as CommitteeActivityReport[];
const committeeReportActivity = (committeeReportActivityData as { events: CommitteeReportActivityEvent[] }).events;
const archiveCommitteeMembers = archiveCommitteeMembersData as ArchiveCommitteeMemberTerm[];

export function sortedCommittees(): Committee[] {
  const order = { 常任委員会: 0, 議会運営委員会: 1, 特別委員会: 2 } as const;
  return [...committees].sort((a, b) => {
    const orderDiff = (order[a.type] ?? 9) - (order[b.type] ?? 9);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, "ja");
  });
}

export function getCommittee(id: string): Committee | undefined {
  return committees.find((c) => c.id === id);
}

/** 委員会名（表示名）から委員会レコードを探す。会期ごとの臨時委員会など、名簿に無い場合はundefined。 */
export function getCommitteeByName(name: string): Committee | undefined {
  // 議員の所属欄は「厚生教育委員会（委員長）」のように役職を括弧書きで添えているため、括弧書きを除いて照合する。
  const bare = name.replace(/（[^）]*）$/, "").trim();
  return committees.find((c) => c.name === name || c.name === bare);
}

/**
 * 委員会が自ら提出した議案（意見書案・決議案など）か。
 *
 * billVotes.json の committee 欄には、付託先の委員会のほかに、議案を提出した委員会が
 * 入っているものがある（例：議会運営委員会の31件はすべて委員会提出の意見書案等で、付託ではない。
 * 会議録でも委員長が「提案理由の説明」を行っている）。公式資料の【委員会提出議案】欄と同じ
 * 区分（proposerType: "committee"）を使って、付託と提出を取り違えない。
 */
export function isSubmittedByCommittee(b: BillVoteItem): boolean {
  return b.proposerType === "committee";
}

/** 指定した委員会名が付託先として登録されている議案を、議決日の新しい順で返す（委員会自身の提出議案は除く）。 */
export function billsForCommittee(committeeName: string): BillVoteItem[] {
  return billVotes
    .filter((b) => b.committee === committeeName && !isSubmittedByCommittee(b))
    .sort((a, b) => (b.votingDate ?? "").localeCompare(a.votingDate ?? ""));
}

/** 指定した委員会が提出した議案（意見書案・決議案など）を、議決日の新しい順で返す。 */
export function billsSubmittedByCommittee(committeeName: string): BillVoteItem[] {
  return billVotes
    .filter((b) => b.committee === committeeName && isSubmittedByCommittee(b))
    .sort((a, b) => (b.votingDate ?? "").localeCompare(a.votingDate ?? ""));
}

/** 指定した議員が所属している委員会の一覧（現行の委員会名簿に基づく）。 */
export function committeesForMember(memberId: string): Committee[] {
  return committees.filter((c) => c.members.some((m) => m.memberId === memberId));
}

/** 指定した委員会（committees.jsonのid）の活動報告書（所管事務調査報告書）を、年度の新しい順で返す。 */
export function reportsForCommittee(committeeId: string): CommitteeActivityReport[] {
  return committeeActivityReports
    .filter((r) => r.committeeId === committeeId)
    .sort((a, b) => b.fiscalYear - a.fiscalYear);
}

/** 指定した議員が本会議で行った委員長・副委員長報告の記録（Phase101、会議録から機械抽出・氏名完全一致確認済み）。 */
/**
 * 本会議での委員長・副委員長報告のうち、会議録で氏名を確認できた記録（個人に帰属できるもの）。
 * 件数を説明文へ直書きしないための単一情報源。
 */
export const committeeReportActivityEvents: CommitteeReportActivityEvent[] = committeeReportActivity.filter(
  (e) => !!e.memberId,
);

/**
 * 本会議での委員長・副委員長の発言の種類（発言の冒頭の本文から判定済み）。
 * 議会運営委員会の委員長の発言は、付託案件の審査結果の報告ではなく、
 * 委員会として提出した意見書案・議案の提案理由の説明である。取り違えない。
 */
export const COMMITTEE_SPEECH_KIND_LABELS_JA: Record<NonNullable<CommitteeReportActivityEvent["speechKind"]>, string> = {
  review_report: "審査結果の報告",
  investigation_report: "調査の報告（中間・最終）",
  activity_report: "活動の報告",
  proposal_explanation: "提案理由の説明",
};

export function committeeSpeechKindLabel(e: CommitteeReportActivityEvent): string {
  return e.speechKind ? COMMITTEE_SPEECH_KIND_LABELS_JA[e.speechKind] : "報告";
}

export function committeeReportActivityForMember(memberId: string): CommitteeReportActivityEvent[] {
  return committeeReportActivity
    .filter((e) => e.memberId === memberId)
    .sort((a, b) => (b.meetingDate ?? "").localeCompare(a.meetingDate ?? ""));
}

/**
 * 指定した委員会（committees.jsonのid）の過去（現行任期より前）の構成員履歴を、
 * 任期開始日の新しい順・委員長→副委員長→委員の順で返す（Phase170、会議録ベース）。
 */
export function membershipHistoryForCommittee(committeeId: string): ArchiveCommitteeMemberTerm[] {
  const roleOrder: Record<string, number> = { 委員長: 0, 副委員長: 1, 委員: 2 };
  return archiveCommitteeMembers
    .filter((r) => r.committeeId === committeeId)
    .sort((a, b) => {
      const termDiff = b.termStart.localeCompare(a.termStart);
      if (termDiff !== 0) return termDiff;
      return (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
    });
}

const committeeMeetingSchedule = (
  committeeMeetingScheduleData as unknown as { items: CommitteeMeetingScheduleItem[] }
).items;

/** 開催予定表のうち、指定した委員会の予定（日付の新しい順）。予定であり、開催の事実ではない。 */
export function meetingScheduleForCommittee(committeeId: string): CommitteeMeetingScheduleItem[] {
  return committeeMeetingSchedule
    .filter((s) => s.committeeId === committeeId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
