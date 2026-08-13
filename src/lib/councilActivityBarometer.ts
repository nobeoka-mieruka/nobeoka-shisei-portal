import membersData from "../data/members.json";
import generalQuestionsData from "../data/generalQuestions.json";
import billVotesData from "../data/billVotes.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import councilSessionsData from "../data/councilSessions.json";
import type {
  CouncilMember,
  GeneralQuestionItem,
  BillVoteItem,
  BillMemberVoteStatus,
  CouncilSpeechSummaryData,
  CouncilSession,
} from "../types";
import { publicBills } from "./billVotes";
import {
  findMemberSpeechRecord,
  publicSpeeches,
  currentTermPublicSpeeches,
  aggregateMemberTopics,
  aggregateYearlySpeechCounts,
  classifyAnswererRole,
  type TopicAggregate,
  type YearlySpeechCount,
} from "./councilSpeeches";
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

/** councilSessions.jsonが収録している全会期ID（現議員任期以降のみ、既存データの構造上の前提）。 */
const allSessionIdsInPeriod = councilSessions.map((s) => s.id);

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

/**
 * Phase96：一般質問・議会内発言の詳細エビデンス（/council-activity/:memberId用）。
 *
 * 【用語の混同防止】
 * - 登壇回数（appearanceCount）＝本会議で一般質問・代表質問等のために発言した「回数」
 *   （＝currentTermSpeechesForRadarの件数。1回の登壇で複数の項目を質問することが多いため、
 *   質問項目数より小さい値になるのが通常）。
 * - 質問項目数（questionItemCount）＝全登壇を通じて確認できた個別の質問項目の合計数。
 * - 発言件数という表現は、議会内発言指数（speech指標）の「確認できた質問項目数」と同じ値を
 *   指すため、画面側では「質問項目数」に統一し、別の呼び方をしない。
 */
export interface MemberQuestionEvidence {
  /** 登壇回数：本会議で一般質問・代表質問等のために発言した回数（会期単位ではなく発言記録単位）。 */
  appearanceCount: number;
  /** 質問項目数：全登壇の質問項目（questionItems）の合計数。 */
  questionItemCount: number;
  /** 市長が答弁した質問項目の数（項目単位、questionItem.answerersまたはexchangesから判定）。 */
  mayorAnsweredItemCount: number;
  /** 市長以外の執行部（副市長・教育長・部長級等）が答弁した質問項目の数。 */
  executiveAnsweredItemCount: number;
  /** 年度別推移（既存のaggregateYearlySpeechCountsをそのまま利用、新規計算式は追加しない）。 */
  yearlyTrend: YearlySpeechCount[];
  /** 主な質問テーマ（既存のaggregateMemberTopicsをそのまま利用）。上位5件。 */
  topTopics: TopicAggregate[];
  /** 対象期間中の全会期のうち、この議員が一般質問・代表質問等を行った会期のID一覧。 */
  sessionIdsWithQuestion: string[];
  /** 対象期間（在職・会議録取得済みの全会期）の会期数。 */
  targetSessionCount: number;
}

export function getMemberQuestionEvidence(member: CouncilMember): MemberQuestionEvidence {
  const speechRecord = findMemberSpeechRecord(speechSummaryData.members, member.id);
  const speeches = currentTermPublicSpeeches(speechRecord);

  let questionItemCount = 0;
  let mayorAnsweredItemCount = 0;
  let executiveAnsweredItemCount = 0;
  for (const speech of speeches) {
    for (const item of speech.questionItems) {
      questionItemCount++;
      const roles = (item.answerers ?? []).map((name) => classifyAnswererRole(name));
      if (roles.includes("mayor")) mayorAnsweredItemCount++;
      if (roles.some((r) => r !== "mayor" && r !== "unknown")) executiveAnsweredItemCount++;
    }
  }

  return {
    appearanceCount: speeches.length,
    questionItemCount,
    mayorAnsweredItemCount,
    executiveAnsweredItemCount,
    yearlyTrend: aggregateYearlySpeechCounts(speeches, allSessionIdsInPeriod),
    topTopics: aggregateMemberTopics(speeches).slice(0, 5),
    sessionIdsWithQuestion: [...new Set(speeches.map((s) => s.sessionId))].sort(),
    targetSessionCount: radarEligibleSessions.length,
  };
}

/**
 * Phase97：個人別賛否データ（/council-activity/:memberId用）。
 *
 * 既存の`BillMemberVoteStatus`（approve/oppose/departed/absent/recused/notVoting/abstained/
 * unconfirmed）をそのまま利用し、新しい状態区分は作らない。議案によっては個人別の賛否が
 * 公開されていない場合があるため、その場合は「0件」ではなく「確認できない」ことが分かる形で返す
 * （呼び出し側で`disclosedBillCount`と`totalBillCountSitewide`の差分を必ず文言化すること）。
 */
export interface MemberVoteEvidence {
  /** この議員個人の賛否（memberVotes）が確認できた議案数。 */
  disclosedBillCount: number;
  /** 賛否の内訳（disclosedBillCountの内数、vote種別ごとの件数）。 */
  breakdown: Partial<Record<BillMemberVoteStatus, number>>;
  /** 直近5件（新しい順）。全件は/members/:idで確認できるため一覧化はしない。 */
  recentBills: { id: string; billNumber: string; billTitle: string; votingDate: string | null; vote: BillMemberVoteStatus }[];
  /** サイト全体の登録議案数（この議員に限らない、比較の分母の参考値）。 */
  totalBillCountSitewide: number;
}

export function getMemberVoteEvidence(member: CouncilMember): MemberVoteEvidence {
  const disclosed = billVotes
    .filter((b) => b.memberVotes.some((v) => v.memberId === member.id))
    .sort((a, b) => (b.votingDate ?? "").localeCompare(a.votingDate ?? ""));

  const breakdown: Partial<Record<BillMemberVoteStatus, number>> = {};
  for (const b of disclosed) {
    const vote = b.memberVotes.find((v) => v.memberId === member.id)!.vote;
    breakdown[vote] = (breakdown[vote] ?? 0) + 1;
  }

  return {
    disclosedBillCount: disclosed.length,
    breakdown,
    recentBills: disclosed.slice(0, 5).map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      billTitle: b.billTitle,
      votingDate: b.votingDate ?? null,
      vote: b.memberVotes.find((v) => v.memberId === member.id)!.vote,
    })),
    totalBillCountSitewide: billVotes.length,
  };
}

/**
 * Phase100：26名×6指標のデータ充足マトリクス集計（「データ充足状況」表示・data-status用）。
 * 議員ごとの点数ではなく「資料がどこまで揃っているか」を示す。既存のdataStatus
 * （complete/partial/missing）をそのまま集計するのみで、新しい判定ロジックは追加しない。
 */
export interface IndicatorCoverage {
  indicatorKey: string;
  indicatorLabel: string;
  /** 算定可能（complete、confirmed_zeroを含む）な議員数。 */
  completeCount: number;
  /** 一部データのみ（partial）の議員数。 */
  partialCount: number;
  /** 対象記録なし（missing）の議員数。一次資料未収録・非公開・調査中等が含まれる。 */
  missingCount: number;
  totalCount: number;
  /** completeCount / totalCount（0〜100）。分母は必ず対象議員数。 */
  coveragePercent: number;
}

export function getIndicatorCoverage(): IndicatorCoverage[] {
  const entries = getAllCurrentMemberActivity();
  const indicatorDefs = [
    { key: "question", label: "一般質問" },
    { key: "speech", label: "議会内発言" },
    { key: "attendance", label: "出席状況" },
    { key: "voting", label: "議案等の意思表示" },
    { key: "proposal", label: "請願・提案等" },
    { key: "disclosure", label: "情報発信・プロフィール充足度" },
  ];
  return indicatorDefs.map((def) => {
    const completeCount = entries.filter((e) => metricByKey(e.metrics, def.key)?.dataStatus === "complete").length;
    const partialCount = entries.filter((e) => metricByKey(e.metrics, def.key)?.dataStatus === "partial").length;
    const missingCount = entries.filter((e) => metricByKey(e.metrics, def.key)?.dataStatus === "missing").length;
    return {
      indicatorKey: def.key,
      indicatorLabel: def.label,
      completeCount,
      partialCount,
      missingCount,
      totalCount: entries.length,
      coveragePercent: entries.length > 0 ? Math.round((completeCount / entries.length) * 100) : 0,
    };
  });
}
