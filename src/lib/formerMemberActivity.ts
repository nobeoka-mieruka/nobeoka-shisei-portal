import formerMembersData from "../data/formerMembers.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import billVotesData from "../data/billVotes.json";
import type { FormerMember, CouncilSpeechSummaryData, BillVoteItem } from "../types";
import { publicBills } from "./billVotes";
import { findMemberSpeechRecord, publicSpeeches } from "./councilSpeeches";
import {
  calculateQuestionActivityIndex,
  calculateSpeechActivityIndex,
  calculateVotingDisclosureIndex,
  eligibleSessionIdsFor,
  type RadarMetric,
} from "./activityRadar";

/**
 * Phase113：元議員（formerMembers.json）へ議員活動データモデルを拡張できるかの試験実装。
 *
 * 【重要】これは試験（プロトタイプ）であり、本番ページ（/council-activity等）へは
 * 組み込んでいない。ユーザー指示「今回は一気に全元議員をレーダーチャート評価しない」
 * 「今回は本番公開を必須としない」に基づく。将来 /council-activity/history や
 * /council-activity/:historicalMemberId へ拡張する場合の設計確認・動作確認が目的。
 *
 * 【現職向けgetMemberActivityMetrics()との違い】
 * - `currentTermPublicSpeeches()`ではなく`publicSpeeches()`を使う。前者は
 *   `record.isFormerMember`を明示的に除外する設計のため、元議員には使えない。
 * - `eligibleSessionIdsFor({isFormerMember: true, servedSessions})`を使うことで、
 *   在職していなかった会期を分母からも分子からも除外する（missingでも0でもなく、
 *   「対象外（not_applicable）」として扱う。既存のeligibleSessionIdsFor自体は
 *   Phase94以前から存在する設計で、今回は「実際に元議員に対して正しく動くか」を
 *   検証しただけで、ロジックの変更は行っていない）。
 * - 出席状況・請願提案等・情報発信の3指標は、元議員側のデータ構造
 *   （FormerMember型：id/name/nameKana/servedSessions/note/sourceNoteのみで、
 *   現職のfactionId/committees/profileUrl/sns等に相当する構造化フィールドが無い）
 *   では現職と同じ算定方法をそのまま適用できないため、今回は試験対象に含めない
 *   （"not_applicable"として明示し、無理に0や推測値を割り当てない）。
 */

const formerMembers = formerMembersData as FormerMember[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const billVotes = publicBills(billVotesData as BillVoteItem[]);
const billsWithAnyMemberVoteDisclosed = billVotes.filter((b) => b.memberVotes.length > 0).length;

export interface FormerMemberActivityTrial {
  formerMemberId: string;
  formerMemberName: string;
  servedSessionCount: number;
  /** 会議録取得済みの会期のうち、実際に在職を確認できた会期数（eligibleSessionIdsForの結果）。 */
  eligibleSessionCount: number;
  /** 試験対象の3指標（一般質問・議会内発言・議案等の意思表示）。既存のcalculate関数をそのまま再利用。 */
  metrics: RadarMetric[];
  /** 今回は算定していない指標とその理由（not_applicable）。 */
  notApplicableIndicators: { key: string; label: string; reason: string }[];
}

/** 資料が比較的揃っている元議員（servedSessions件数の多い順）を上位N名選ぶ。推測でのフィルタリングはしない。 */
export function pickFormerMembersForTrial(n: number): FormerMember[] {
  return [...formerMembers].sort((a, b) => b.servedSessions.length - a.servedSessions.length).slice(0, n);
}

export function getFormerMemberActivityTrial(fm: FormerMember): FormerMemberActivityTrial {
  const eligibleSessions = eligibleSessionIdsFor({ isFormerMember: true, servedSessions: fm.servedSessions });
  const speechRecord = findMemberSpeechRecord(speechSummaryData.members, fm.id);
  const speeches = publicSpeeches(speechRecord);
  const memberAllBillVotes = billVotes.filter((b) => b.memberVotes.some((v) => v.memberId === fm.id));

  const metrics: RadarMetric[] = [
    calculateQuestionActivityIndex(speeches, eligibleSessions, fm.lastVerified ?? undefined),
    calculateSpeechActivityIndex(speeches, eligibleSessions, fm.lastVerified ?? undefined),
    calculateVotingDisclosureIndex(memberAllBillVotes.length, billsWithAnyMemberVoteDisclosed, fm.lastVerified ?? undefined),
  ];

  return {
    formerMemberId: fm.id,
    formerMemberName: fm.name,
    servedSessionCount: fm.servedSessions.length,
    eligibleSessionCount: eligibleSessions.length,
    metrics,
    notApplicableIndicators: [
      { key: "attendance", label: "出席状況", reason: "現職と同様、一次資料未収録のため対象外（not_applicable、0点ではない）。" },
      {
        key: "proposal",
        label: "請願・提案等",
        reason: "現職と同様、議員別の提案者情報が未収録のため対象外（not_applicable、0点ではない）。",
      },
      {
        key: "disclosure",
        label: "情報発信・プロフィール充足度",
        reason:
          "FormerMember型には現職と同じプロフィール項目（所属会派・所属委員会・公式ページ・SNS等）が構造化されていないため、今回は試験対象に含めない（今後の拡張時に別途設計）。",
      },
    ],
  };
}
