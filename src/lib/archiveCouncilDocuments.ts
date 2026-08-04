import type { BillVoteItem, BillVoteMemberEntry } from "../types";
import { billVoteLabels } from "./billVotes";
import type {
  ArchiveCouncilDocument,
  ArchiveCouncilDocumentResult,
  ArchiveCouncilDocumentStatus,
  ArchiveCouncilDocumentType,
  ArchiveCouncilVote,
  ArchiveCouncilVoteStatus,
  ArchiveOrdinanceEffectStatus,
  ArchiveOrdinanceRevisionType,
} from "../types/historicalArchive";

export function documentTypeLabel(type: ArchiveCouncilDocumentType): string {
  switch (type) {
    case "bill":
      return "議案";
    case "ordinance":
      return "条例";
    case "petition":
      return "請願";
    case "request":
      return "陳情";
  }
}

export function documentStatusLabel(status?: ArchiveCouncilDocumentStatus): string {
  switch (status) {
    case "submitted":
      return "提出";
    case "accepted":
      return "受理";
    case "referred":
      return "委員会付託";
    case "continuedReview":
      return "継続審査";
    case "decided":
      return "議決・審査確定";
    case "withdrawn":
      return "取下げ";
    case "unresolved":
      return "審議未了";
    default:
      return "確認中";
  }
}

const PETITION_OUTCOME_LABELS: Record<string, string> = {
  submitted: "提出",
  accepted: "受理",
  referred: "委員会付託",
  continuedReview: "継続審査",
  adopted: "採択",
  partiallyAdopted: "一部採択",
  rejected: "不採択",
  withdrawn: "取下げ",
  unresolved: "審議未了",
  sourceUnavailable: "資料未確認",
};

/** 議案・条例（既存BillVoteResultの日本語）と請願・陳情（ArchivePetitionOutcomeの英語キー）の両方に対応する。 */
export function documentResultLabel(result?: ArchiveCouncilDocumentResult): string {
  if (!result) return "確認中";
  return PETITION_OUTCOME_LABELS[result] ?? result;
}

export function ordinanceRevisionTypeLabel(type: ArchiveOrdinanceRevisionType): string {
  switch (type) {
    case "enactment":
      return "制定";
    case "fullRevision":
      return "全部改正";
    case "partialRevision":
      return "一部改正";
    case "repeal":
      return "廃止";
  }
}

export function ordinanceEffectStatusLabel(status: ArchiveOrdinanceEffectStatus): string {
  switch (status) {
    case "inForce":
      return "現行";
    case "expired":
      return "失効";
    case "unknown":
      return "確認中";
  }
}

export const councilVoteLabels: Record<ArchiveCouncilVoteStatus, string> = {
  ...billVoteLabels,
  sourceUnavailable: "資料未確認",
};

/** 既存billVotes.jsonのidから、対応するレコードを引く。 */
export function findLegacyBillVote(
  billVotes: BillVoteItem[],
  document: ArchiveCouncilDocument,
): BillVoteItem | undefined {
  if (!document.existingBillVoteId) return undefined;
  return billVotes.find((b) => b.id === document.existingBillVoteId);
}

export interface ResolvedCouncilVote {
  memberId: string;
  memberName?: string;
  faction?: string;
  vote: ArchiveCouncilVoteStatus;
}

/**
 * 議員別賛否を解決する。existingBillVoteIdが設定されている場合は既存billVotes.json側
 * （BillVoteMemberEntry）を正として使い、このファイルには重複保存しない。未設定の場合のみ
 * document.voteEntriesを使う。
 */
export function resolveCouncilVotes(
  billVotes: BillVoteItem[],
  document: ArchiveCouncilDocument,
): ResolvedCouncilVote[] {
  const legacy = findLegacyBillVote(billVotes, document);
  if (legacy) {
    return legacy.memberVotes.map((v: BillVoteMemberEntry) => ({
      memberId: v.memberId,
      memberName: v.memberName,
      faction: v.faction,
      vote: v.vote,
    }));
  }
  return (document.voteEntries ?? []).map((v: ArchiveCouncilVote) => ({
    memberId: v.memberId,
    vote: v.vote,
  }));
}

/** 出典PDF等、既存billVotes.json側の値を優先して解決する（無ければアーカイブ側のsourceRefsを使う）。 */
export function resolveDocumentSourceUrl(
  billVotes: BillVoteItem[],
  document: ArchiveCouncilDocument,
): string | undefined {
  const legacy = findLegacyBillVote(billVotes, document);
  return legacy?.resultDocumentUrl ?? legacy?.billDocumentUrl ?? document.sourceRefs[0]?.sourceUrl;
}

export function documentsOfType(
  documents: ArchiveCouncilDocument[],
  type: ArchiveCouncilDocumentType,
): ArchiveCouncilDocument[] {
  return documents.filter((d) => d.documentType === type);
}
