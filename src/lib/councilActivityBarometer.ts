import membersData from "../data/members.json";
import generalQuestionsData from "../data/generalQuestions.json";
import billVotesData from "../data/billVotes.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import councilSessionsData from "../data/councilSessions.json";
import type { CouncilMember, GeneralQuestionItem, BillVoteItem, CouncilSpeechSummaryData, CouncilSession } from "../types";
import { publicBills } from "./billVotes";
import { findMemberSpeechRecord, publicSpeeches, currentTermPublicSpeeches } from "./councilSpeeches";
import {
  calculateAttendanceIndex,
  calculateInformationDisclosureIndex,
  calculateProposalActivityIndex,
  calculateQuestionActivityIndex,
  calculateSpeechActivityIndex,
  calculateVotingDisclosureIndex,
  eligibleSessionIdsFor,
  TRANSCRIPT_AVAILABLE_SESSION_IDS,
  type RadarMetric,
} from "./activityRadar";

/**
 * 「延岡市議会 議員活動バロメーター」（/council-activity、/council-activity/:memberId）用の
 * 集計モジュール。
 *
 * 【方針】数値は `src/pages/MemberDetailPage.tsx` の議員詳細ページに既に表示している
 * 「議会活動データ」レーダーチャートと**同一のロジック・同一の値**になるよう、算定処理は
 * `src/lib/activityRadar.ts` の各calculate関数をそのまま再利用する（重複実装・数値の食い違いを
 * 防ぐため、このファイルは既存ロジックの「対象議員26名分の一括呼び出し」のみを担当し、
 * 新しい計算式は追加しない）。対象は現職議員（`members.json`）のみとし、特定の人数を
 * コードへ固定しない（`members`配列の長さをそのまま使う）。
 *
 * 議員の能力・優劣・人物評価・推薦順位を示すものではない。総合順位（複数指標の合算）は
 * 意図的に算出しない（画面側で単一指標ごとのソートのみ提供する）。
 */

const members = membersData as CouncilMember[];
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const billVotes = publicBills(billVotesData as BillVoteItem[]);
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const councilSessions = councilSessionsData as CouncilSession[];

const PLACEHOLDER_PROFILE = "情報確認中";

/** 議員別の賛否内訳（memberVotes）が1件でも登録されている議案数（サイト全体での分母）。 */
const billsWithAnyMemberVoteDisclosed = billVotes.filter((b) => b.memberVotes.length > 0).length;

const radarEligibleSessions = eligibleSessionIdsFor({ isFormerMember: false });

export interface MemberActivityEntry {
  member: CouncilMember;
  metrics: RadarMetric[];
  /** 元データへのリンク先（数値クリックで根拠ページへ移動するために使う）。 */
  links: {
    question: string;
    speech: string;
    voting: string;
    disclosure: string;
  };
}

/**
 * 指定した現職議員1名分の6指標を算定する。`MemberDetailPage.tsx`と全く同じ入力・同じ
 * calculate関数を使うため、議員詳細ページの値と常に一致する。
 */
export function getMemberActivityMetrics(member: CouncilMember): RadarMetric[] {
  const memberQuestions = generalQuestions.filter((q) => q.memberId === member.id);
  const speechRecord = findMemberSpeechRecord(speechSummaryData.members, member.id);
  const publishedMemberSpeeches = publicSpeeches(speechRecord);
  const currentTermSpeechesForRadar = currentTermPublicSpeeches(speechRecord);
  const memberAllBillVotes = billVotes.filter((b) => b.memberVotes.some((v) => v.memberId === member.id));
  const isProfileConfirmed = member.profile !== PLACEHOLDER_PROFILE;
  const updatedAt = member.updatedAt ?? member.verifiedAt;

  return [
    calculateQuestionActivityIndex(currentTermSpeechesForRadar, radarEligibleSessions, updatedAt),
    calculateSpeechActivityIndex(currentTermSpeechesForRadar, radarEligibleSessions, updatedAt),
    calculateAttendanceIndex(),
    calculateVotingDisclosureIndex(memberAllBillVotes.length, billsWithAnyMemberVoteDisclosed),
    calculateProposalActivityIndex(),
    calculateInformationDisclosureIndex(
      [
        { label: "経歴", filled: isProfileConfirmed },
        { label: "所属会派", filled: !!member.factionId },
        { label: "所属委員会", filled: member.committees.length > 0 },
        { label: "当選回数", filled: !!member.termCount },
        { label: "公式ページ", filled: !!member.profileUrl },
        { label: "SNS", filled: member.sns.length > 0 },
        { label: "一般質問履歴", filled: memberQuestions.length > 0 || publishedMemberSpeeches.length > 0 },
        { label: "議案賛否履歴", filled: memberAllBillVotes.length > 0 },
      ],
      updatedAt,
    ),
  ];
}

/** 対象議員全員（現職、人数をコードへ固定しない）分のエントリ一覧。 */
export function getAllCurrentMemberActivity(): MemberActivityEntry[] {
  return members.map((member) => ({
    member,
    metrics: getMemberActivityMetrics(member),
    links: {
      question: `/members/${member.id}#questions`,
      speech: `/members/${member.id}#questions`,
      voting: `/members/${member.id}#votes`,
      disclosure: `/members/${member.id}`,
    },
  }));
}

/** RadarMetricの配列からkeyで1件取り出す（見つからない場合はundefined）。 */
export function metricByKey(metrics: RadarMetric[], key: string): RadarMetric | undefined {
  return metrics.find((m) => m.key === key);
}

/**
 * 対象期間の表示用ラベルを、ハードコードではなくデータ（councilSessions.json ×
 * 会議録取得済み会期一覧）から動的に算出する。将来、任期が切り替わってもコード変更が
 * 不要になるようにするための設計（TRANSCRIPT_AVAILABLE_SESSION_IDSが更新されれば
 * このラベルも自動的に追従する）。
 */
export function activityTargetPeriodLabel(): string {
  const eligible = councilSessions.filter((s) => TRANSCRIPT_AVAILABLE_SESSION_IDS.includes(s.id));
  if (eligible.length === 0) return "確認中";
  const sorted = [...eligible].sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first.id === last.id) return `${first.title}（会議録取得済みの会期）`;
  return `${first.title}〜${last.title}（会議録取得済みの会期、計${eligible.length}会期）`;
}

/** 「発言量TOP3」等のサマリーカード用に、value降順で上位N件を返す（missingは除外）。 */
export function topByMetric(entries: MemberActivityEntry[], key: string, n: number): MemberActivityEntry[] {
  return entries
    .filter((e) => metricByKey(e.metrics, key)?.value !== null && metricByKey(e.metrics, key)?.value !== undefined)
    .sort((a, b) => (metricByKey(b.metrics, key)!.value! as number) - (metricByKey(a.metrics, key)!.value! as number))
    .slice(0, n);
}
