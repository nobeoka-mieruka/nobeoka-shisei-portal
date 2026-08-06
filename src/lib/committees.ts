import committeesData from "../data/committees.json";
import billVotesData from "../data/billVotes.json";
import committeeActivityReportsData from "../data/committeeActivityReports.json";
import type { Committee, BillVoteItem, CommitteeActivityReport } from "../types";

/**
 * 委員会（常任委員会・議会運営委員会・特別委員会）関連のデータアクセスヘルパー。
 *
 * 審査議案の一覧は billVotes.json の committee フィールドから逆引きする（重複保持しない）。
 * 予算審査特別委員会・決算審査特別委員会・長期総合計画審査特別委員会等、会期ごとに
 * 議長を除く全議員で構成・設置される臨時の委員会は committees.json には収録していないが、
 * 審査議案の逆引き自体は committee 名が一致すれば表示できる。
 */

export const committees = committeesData as Committee[];
const billVotes = billVotesData as BillVoteItem[];
const committeeActivityReports = committeeActivityReportsData as CommitteeActivityReport[];

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
  return committees.find((c) => c.name === name);
}

/** 指定した委員会名が付託先として登録されている議案を、議決日の新しい順で返す。 */
export function billsForCommittee(committeeName: string): BillVoteItem[] {
  return billVotes
    .filter((b) => b.committee === committeeName)
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
