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
 * Phase113で試験実装、Phase116で `/council-activity/history` へ正式に組み込み。
 * 元議員（formerMembers.json）向けの議員活動データ算定。
 *
 * 【重要な設計方針】
 * - 現職議員との総合順位・単純な優劣比較は行わない（`/council-activity/history`は
 *   現職の比較表・ソート機能とは完全に別画面とし、同一テーブルに混在させない）。
 * - 在職していなかった会期は、分母からも分子からも除外する（欠席・0点として扱わない）。
 * - 元議員間でも複数指標を合算した総合スコア・ランキングは算出しない
 *   （既存のcalculate関数をそのまま使い、指標ごとの実数のみを提示する）。
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

export interface FormerMemberActivity {
  formerMemberId: string;
  formerMemberName: string;
  formerMemberNameKana: string | null;
  servedSessionCount: number;
  /** 会議録取得済みの会期のうち、実際に在職を確認できた会期数（eligibleSessionIdsForの結果）。 */
  eligibleSessionCount: number;
  /** 在職期間の概算表示（servedSessionsの最初と最後の会期ID）。 */
  servedPeriodLabel: string;
  /** 対象の3指標（一般質問・議会内発言・議案等の意思表示）。既存のcalculate関数をそのまま再利用。 */
  metrics: RadarMetric[];
  /** 今回は算定していない指標とその理由（not_applicable）。 */
  notApplicableIndicators: { key: string; label: string; reason: string }[];
}

/** 資料が比較的揃っている元議員（servedSessions件数の多い順）を上位N名選ぶ。推測でのフィルタリングはしない。 */
export function pickFormerMembersForTrial(n: number): FormerMember[] {
  return [...formerMembers].sort((a, b) => b.servedSessions.length - a.servedSessions.length).slice(0, n);
}

/** 全元議員（人数を固定しない、formerMembers.jsonの件数をそのまま使う）。 */
export function getAllFormerMembers(): FormerMember[] {
  return formerMembers;
}

export function findFormerMemberById(id: string): FormerMember | undefined {
  return formerMembers.find((fm) => fm.id === id);
}

function servedPeriodLabelOf(fm: FormerMember): string {
  if (fm.servedSessions.length === 0) return "確認中";
  const sorted = [...fm.servedSessions].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first === last ? first : `${first}〜${last}`;
}

export function getFormerMemberActivity(fm: FormerMember): FormerMemberActivity {
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
    formerMemberNameKana: fm.nameKana ?? null,
    servedSessionCount: fm.servedSessions.length,
    eligibleSessionCount: eligibleSessions.length,
    servedPeriodLabel: servedPeriodLabelOf(fm),
    metrics,
    notApplicableIndicators: [
      { key: "attendance", label: "出席状況", reason: "現職と同様、一次資料未収録のため対象外です（0点という意味ではありません）。" },
      {
        key: "proposal",
        label: "請願・提案等",
        reason: "現職と同様、議員別の提案者情報が未収録のため対象外です（0点という意味ではありません）。",
      },
      {
        key: "disclosure",
        label: "情報発信・プロフィール充足度",
        reason: "元議員のプロフィール情報は現職ほど構造化されていないため、今回は対象外としています（今後の拡張時に別途検討します）。",
      },
    ],
  };
}

/** 全元議員分の活動データ（人数を固定しない）。ページ側でループして表示する用途。 */
export function getAllFormerMemberActivity(): FormerMemberActivity[] {
  return formerMembers.map((fm) => getFormerMemberActivity(fm));
}
