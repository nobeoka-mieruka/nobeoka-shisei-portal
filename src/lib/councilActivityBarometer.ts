import membersData from "../data/members.json";
import generalQuestionsData from "../data/generalQuestions.json";
import billVotesData from "../data/billVotes.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import councilSessionsData from "../data/councilSessions.json";
import billProposalRolesData from "../data/billProposalRoles.json";
import type {
  CouncilMember,
  GeneralQuestionItem,
  BillVoteItem,
  BillMemberVoteStatus,
  CouncilSpeechSummaryData,
  CouncilSession,
} from "../types";
import { publicBills } from "./billVotes";
import { electionResultsForPerson, formatElectionDate } from "./elections";
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
import {
  evidenceAvailabilityLabel,
  evidenceAvailabilitySymbol,
  type EvidenceAvailabilityCode,
  type EvidenceAvailabilityEntry,
} from "./evidenceAvailability";

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

// プリレンダリングでは26議員分の個人ページ・一覧ページ・data-statusページ等、
// 複数のページから呼び出されるため、モジュールレベルで一度だけ計算してキャッシュする
// （議員数・指標数は変わらないビルド単位の静的データのため、キャッシュして問題ない）。
//
// 【Phase105調査メモ】commit b40d098（本メモイズ導入前）はCloudflare Pagesビルドが
// Failureとなった（`wrangler pages deployment list`で確認）。このメモイズ導入前は
// 本関数が26個人ページ＋一覧＋data-status等から未キャッシュのまま計29回前後呼ばれ、
// 26議員×6指標の再計算が毎回発生していた。ローカルでの定量比較（Node peak working
// set、`npm run build`を複数回実行）：メモイズ前 約910〜920MB → メモイズ後 約854〜
// 861MB（いずれも2回連続で再現、差は約60MB=約7%）。ローカルbuildは両条件とも
// 1GB未満・約60秒で完走しており、Cloudflareの実ビルドログ（メモリ超過等の具体的な
// 失敗メッセージ）は未確認（ブラウザ拡張未接続のため直接参照できず）。したがって
// 「メモリ不足が原因」と断定はできない一方、無駄な重複計算を除去したこと自体は
// 実装として正しい改善であり、以後のビルド（例：commit 003d1f4以降）は継続して
// 成功している。
let cachedAllCurrentMemberActivity: MemberActivityEntry[] | undefined;

/** 対象議員全員（現職、人数をコードへ固定しない）分のエントリ一覧。 */
export function getAllCurrentMemberActivity(): MemberActivityEntry[] {
  if (!cachedAllCurrentMemberActivity) {
    cachedAllCurrentMemberActivity = members.map((member) => ({
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
  return cachedAllCurrentMemberActivity;
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
  recentBills: {
    id: string;
    billNumber: string;
    billTitle: string;
    /** 個人別の賛否が実際に記録された採決日（再議等でvotingDateと異なる場合はmemberVoteRecordedDateを優先）。 */
    recordedVoteDate: string | null;
    vote: BillMemberVoteStatus;
  }[];
  /** サイト全体の登録議案数（この議員に限らない、比較の分母の参考値）。 */
  totalBillCountSitewide: number;
}

export function getMemberVoteEvidence(member: CouncilMember): MemberVoteEvidence {
  const recordedDateOf = (b: BillVoteItem) => b.memberVoteRecordedDate ?? b.votingDate;
  const disclosed = billVotes
    .filter((b) => b.memberVotes.some((v) => v.memberId === member.id))
    .sort((a, b) => (recordedDateOf(b) ?? "").localeCompare(recordedDateOf(a) ?? ""));

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
      recordedVoteDate: recordedDateOf(b) ?? null,
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

/**
 * Phase111：指標ごとの「データ充足状況」詳細（人数だけでなく、会期数・一次資料件数・
 * 不足している内容を明示する）。「活動評価値」（レーダーチャートの点数）とは別物であり、
 * この詳細は資料の網羅度の説明にとどめる（充足率が高い＝活動が優れている、ではない）。
 */
export interface IndicatorCoverageDetail {
  indicatorKey: string;
  indicatorLabel: string;
  confirmedMemberCount: number;
  totalMemberCount: number;
  /** 会議録を確認できた会期数（会期の概念がない指標はnull）。 */
  confirmedSessionCount: number | null;
  /** この指標の根拠となる一次資料の件数と、その単位の説明。 */
  sourceRecordCount: number;
  sourceRecordUnit: string;
  /** 何が不足しているかの市民向け説明。 */
  missingDescription: string;
}

export function getIndicatorCoverageDetail(): IndicatorCoverageDetail[] {
  const coverage = getIndicatorCoverage();
  const byKey = new Map(coverage.map((c) => [c.indicatorKey, c]));
  const confirmedSessionCount = TRANSCRIPT_AVAILABLE_SESSION_IDS.length;
  const speechRecordCount = speechSummaryData.members.reduce((sum, m) => sum + (m.speeches?.length ?? 0), 0);
  const questionItemCount = speechSummaryData.members.reduce(
    (sum, m) => sum + (m.speeches ?? []).reduce((s2, sp) => s2 + (sp.questionItems?.length ?? 0), 0),
    0,
  );
  const disclosedBillCount = billVotes.filter((b) => b.memberVotes.length > 0).length;

  const defs: Omit<IndicatorCoverageDetail, "confirmedMemberCount" | "totalMemberCount">[] = [
    {
      indicatorKey: "question",
      indicatorLabel: "一般質問",
      confirmedSessionCount,
      sourceRecordCount: speechRecordCount,
      sourceRecordUnit: `発言記録${speechRecordCount}件（質問項目計${questionItemCount}件）`,
      missingDescription: "会議録が未公開の会期は対象から除外しています（「質問しなかった」とはみなしません）。",
    },
    {
      indicatorKey: "speech",
      indicatorLabel: "議会内発言",
      confirmedSessionCount,
      sourceRecordCount: speechRecordCount,
      sourceRecordUnit: `発言記録${speechRecordCount}件（質問項目計${questionItemCount}件）`,
      missingDescription: "一般質問と同じ会議録本文が根拠です。会議録が未公開の会期は対象から除外しています。",
    },
    {
      indicatorKey: "attendance",
      indicatorLabel: "出席状況",
      confirmedSessionCount: 0,
      sourceRecordCount: 0,
      sourceRecordUnit: "出席記録0件",
      missingDescription: "複数の公開資料経路を調査しましたが、議員別の出席・欠席名簿を確認できていません（公開資料から確認できず）。",
    },
    {
      indicatorKey: "voting",
      indicatorLabel: "議案等の意思表示",
      confirmedSessionCount: null,
      sourceRecordCount: disclosedBillCount,
      sourceRecordUnit: `個人別賛否が公開されている議案${disclosedBillCount}件（全${billVotes.length}件中）`,
      missingDescription: "起立採決・簡易採決等、個人別の内訳が公開されていない議案は対象に含めていません（集計結果のみの議案は「公開資料から確認できず」）。",
    },
    {
      indicatorKey: "proposal",
      indicatorLabel: "請願・提案等",
      confirmedSessionCount: null,
      sourceRecordCount: 0,
      sourceRecordUnit: "議員別の提案者・紹介議員情報0件",
      missingDescription:
        "議員別の提案者・紹介議員情報は未収録です。本会議での委員長・副委員長報告（68件）は参考情報として個人ページに別途掲載していますが、この指標の算定には含めていません。",
    },
    {
      indicatorKey: "disclosure",
      indicatorLabel: "情報発信・プロフィール充足度",
      confirmedSessionCount: null,
      sourceRecordCount: members.length,
      sourceRecordUnit: `対象議員${members.length}名のプロフィール項目`,
      missingDescription: "SNS等を利用していないこと自体は低評価にしていません。確認できた項目数をそのまま示しています。",
    },
  ];

  return defs.map((d) => {
    const c = byKey.get(d.indicatorKey);
    return {
      ...d,
      confirmedMemberCount: c?.completeCount ?? 0,
      totalMemberCount: c?.totalCount ?? members.length,
    };
  });
}

/**
 * Phase111：26名×6指標＝156セルの市民向け簡易マトリクス。
 * `RadarMetric.dataStatus`（complete/partial/missing）を、Evidence Availability共通語彙の
 * 記号・ラベルへそのままマッピングする（新しい判定ロジックは追加しない）。missingは
 * 一律「research_exhausted」表記とする（出席状況・請願提案等いずれも、複数の資料経路を
 * 調査したうえで確認できていない状態のため）。「0点」という表現は使わない。
 */
export interface MatrixCell {
  indicatorKey: string;
  symbol: string;
  label: string;
}

export interface MemberMatrixRow {
  memberId: string;
  memberName: string;
  cells: MatrixCell[];
}

function dataStatusToEvidenceCode(dataStatus: RadarMetric["dataStatus"]): EvidenceAvailabilityCode {
  if (dataStatus === "complete") return "confirmed";
  if (dataStatus === "partial") return "partial";
  return "research_exhausted";
}

export function get156CellMatrix(): MemberMatrixRow[] {
  const entries = getAllCurrentMemberActivity();
  return entries.map((e) => ({
    memberId: e.member.id,
    memberName: e.member.name,
    cells: e.metrics.map((m) => {
      const code = dataStatusToEvidenceCode(m.dataStatus);
      return {
        indicatorKey: m.key,
        symbol: evidenceAvailabilitySymbol(code),
        label: evidenceAvailabilityLabel(code),
      };
    }),
  }));
}

/**
 * Phase109〜110：市民向けの「何が、どこまで確認できているか」サマリー。
 *
 * 【設計方針】`RadarMetric.dataStatus`（complete/partial/missing）はactivityRadar.tsの
 * 既存3区分のまま変更しない。本関数はその上に「なぜmissingなのか」を市民向けに説明する
 * 表示専用のレイヤーであり、新しい採点・順位付けロジックではない。
 * Phase110で、状態コード・日本語ラベルはサイト共通の`src/lib/evidenceAvailability.ts`
 * （9区分）へ寄せた。このファイルはその共通語彙を議員活動バロメーター向けに適用する
 * 呼び出し側という位置づけ。
 */
export type { EvidenceAvailabilityCode } from "./evidenceAvailability";

export interface EvidenceAvailabilityItem extends EvidenceAvailabilityEntry {
  /** 既定は状態コードの共通ラベル（evidenceAvailabilityLabel）。件数等を具体的に示したい場合のみ上書きする。 */
  statusText: string;
}

export function getEvidenceAvailabilitySummary(): EvidenceAvailabilityItem[] {
  const disclosedBillCount = billVotes.filter((b) => b.memberVotes.length > 0).length;
  const totalBillCount = billVotes.length;
  const petitionLikeCount = billVotes.filter((b) => b.category === "請願" || b.category === "陳情").length;
  const pendingMinutesCount = billVotes.filter((b) => !b.voteMethod || !b.committee).length;

  const entries: EvidenceAvailabilityEntry[] = [
    {
      key: "question",
      label: "一般質問",
      code: "confirmed",
      detail: "会議録取得済みの会期について、本会議での一般質問・代表質問の実施状況を公開会議録から確認しています。",
    },
    {
      key: "voting",
      label: "個人別賛否",
      code: "partial",
      detail: `全${totalBillCount}件の議案等のうち、議員個人別の賛否が公開資料で確認できたのは${disclosedBillCount}件のみです（残りは公表結果が賛成・反対等の集計のみ、または未確認）。`,
    },
    {
      key: "committeeInternalSpeech",
      label: "委員会内部発言",
      code: "research_exhausted",
      detail:
        "委員会そのものの会議録・発言記録が公開されているかを複数の資料経路（委員会活動報告書PDF等）で調査しましたが、確認できていません。本会議での委員長・副委員長報告は別に収録しています。",
    },
    {
      key: "attendance",
      label: "出席状況",
      code: "research_exhausted",
      detail:
        "会議録・議会だより・会議日程表等、複数の資料経路を調査しましたが、議員別の出席・欠席名簿を確認できていません。「資料が見つからない」ことは「全員出席」を意味しません。",
    },
    {
      key: "petition",
      label: "請願・陳情等",
      code: "partial",
      detail: `件名・審議結果は請願・陳情あわせて${petitionLikeCount}件を収録していますが、紹介議員（請願者ではなく、議会に取り次いだ議員）の氏名は公開会議録に記載がなく確認できていません。`,
    },
    {
      key: "pendingMinutes",
      label: "会議録公開待ち",
      code: "waiting_external",
      detail: `直近の会期の会議録が本日時点で未公開のため、採決方法・付託委員会等が未確認の議案が${pendingMinutesCount}件あります（公開され次第、自動更新で反映されます）。`,
    },
  ];

  return entries.map((e) => ({
    ...e,
    statusText: e.key === "pendingMinutes" ? `${pendingMinutesCount}件` : evidenceAvailabilityLabel(e.code),
  }));
}

/**
 * Phase135：「延岡市議会 議員活動バロメーター」一覧・個人ページの再デザイン用の追加集計。
 *
 * 【方針】ここに新しい採点・順位ロジックは追加しない。既存の一次資料（billProposalRoles.json・
 * members.json・electionResults.json）から確認できる「実数」をそのまま集計するだけであり、
 * activityRadar.tsの各指標（value・dataStatus）は一切変更しない。
 */

interface BillProposalRoleRecord {
  recordId: string;
  billId: string;
  recordType: string;
  personId: string | null;
  personName: string;
  role: string;
  date: string | null;
  sourceRefs: { label: string; url?: string }[];
  verificationStatus: string;
}

const billProposalRoles = (billProposalRolesData as { roles: BillProposalRoleRecord[] }).roles;

/**
 * 決議提出者としての件数（現職議員のみ）。
 *
 * 【重要な限定】billProposalRoles.jsonは、会議録で個人名を確認できた議員提出「決議」の
 * 提出者のみを収録している（請願・陳情の紹介議員、条例案等の一般的な議案の提出者は対象外。
 * ファイル内noteのとおり、これらは複数回の一次資料調査でも氏名を確認できていない）。
 * 議員提出決議は延岡市議会全体で計8件あり、うち1件（2021-06-ketsugi-2）のみ提出者を
 * 特定できなかった（research_exhausted）。したがって、決議提出者が0件の議員については、
 * 「決議8件のうち提出者として確認できたものが無かった」という確認済みの0件（confirmed_zero）
 * であり、missing（未調査）ではない。呼び出し側は必ず「決議の提出者に限る」旨を明記すること。
 */
export interface DecisionSubmitterEntry {
  member: CouncilMember;
  count: number;
}

export function decisionSubmitterCountFor(memberId: string): number {
  return billProposalRoles.filter((r) => r.role === "submitter" && r.personId === memberId).length;
}

export function decisionSubmitterTop(entries: MemberActivityEntry[], n: number): DecisionSubmitterEntry[] {
  return entries
    .map((e) => ({ member: e.member, count: decisionSubmitterCountFor(e.member.id) }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * 議席番号：members.jsonに構造化フィールドが無いため、既に確認済みの`profile`本文
 * （延岡市議会公式プロフィールページ由来、「議席番号◯番。」の記載）から抽出する。
 * 新しい値を推測で作らず、既存テキストの機械的な読み取りのみを行う。
 */
export function seatNumberFromProfile(member: CouncilMember): string | null {
  const matched = member.profile.match(/議席番号(\d+)番/);
  return matched ? matched[1] : null;
}

/**
 * 情報発信媒体数：本人確認済み（verificationStatus: "verified"）のSNS・Web媒体数に、
 * 議会公式プロフィールページ（profileUrl）を加えた実数。未確認（unverified）のSNSは
 * 本人のものと断定できないため含めない。
 */
export function informationChannelCount(member: CouncilMember): number {
  const verifiedSns = member.sns.filter((s) => s.verificationStatus === "verified").length;
  return verifiedSns + (member.profileUrl ? 1 : 0);
}

/**
 * rawValue（例：speechの「確認できた質問項目数」）でのTOP N。metricByKeyのvalue（0〜100の
 * 指数）と異なり、指数化していない件数そのものを「発言量」として順位付けしたい場合に使う。
 */
export function topByRawValue(entries: MemberActivityEntry[], key: string, n: number): MemberActivityEntry[] {
  return entries
    .filter((e) => (metricByKey(e.metrics, key)?.rawValue ?? 0) > 0)
    .sort((a, b) => (metricByKey(b.metrics, key)!.rawValue ?? 0) - (metricByKey(a.metrics, key)!.rawValue ?? 0))
    .slice(0, n);
}

/**
 * 選挙時得票（参考情報）。現行任期の選挙（令和5年4月23日執行）でこの議員が候補者として
 * 記録されている場合のみ返す。活動指標スコアには一切含めない、参考表示専用の値。
 */
export interface ElectionVoteReference {
  electionName: string;
  electionDateLabel: string;
  votes: number;
}

export function electionVoteReferenceFor(memberId: string): ElectionVoteReference | null {
  const results = electionResultsForPerson(memberId);
  const latest = results[0];
  if (!latest) return null;
  const candidate = latest.candidates.find((c) => c.linkedProfileId === memberId);
  if (!candidate || candidate.votes == null) return null;
  return {
    electionName: latest.electionName,
    electionDateLabel: formatElectionDate(latest),
    votes: candidate.votes,
  };
}
