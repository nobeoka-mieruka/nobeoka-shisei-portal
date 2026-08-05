import type { CouncilSpeech } from "../types";
import questionCollectionStatusData from "../data/questionCollectionStatus.json";

/**
 * 議員詳細ページの「議会活動データ」レーダーチャート用の集計モジュール。
 *
 * 【最重要方針】この指数は議員の優劣・能力・人物評価・推薦順位を示すものではない。
 * 既存の一次情報・公開データを、項目ごとに共通基準で0〜100へ機械的に換算し、
 * 「公開情報から確認できる活動状況」を可視化するだけである。独自の総合点・順位・
 * 星評価・優秀/不十分などの判定は一切行わない。
 *
 * データが存在しない・不十分な項目は0点にせず、必ずdataStatus:"missing"（対象記録なし）
 * またはdataStatus:"partial"（一部データのみ収録）として扱い、valueをnullのまま返す
 * （呼び出し側は value===null を「未収録」として表示し、0を実データとして描画しない）。
 */

export type RadarDataStatus = "complete" | "partial" | "missing";

export interface RadarMetric {
  key: string;
  label: string;
  /** 0〜100。データ未収録・算定不能の場合はnull（0点として扱わない）。 */
  value: number | null;
  /** 正規化前の生値（参考表示用）。 */
  rawValue?: number;
  numerator?: number;
  denominator?: number;
  /** この指標が何を表すかの説明文（画面・ツールチップ表示用）。 */
  description: string;
  /** 算定方法の短い説明（ツールチップ用）。 */
  methodNote: string;
  /** 出典（データソース）の表示名。 */
  sourceLabel: string;
  updatedAt?: string;
  dataStatus: RadarDataStatus;
}

/** 一般質問・議会発言の集計対象とする質問系区分（討論・動議・議事進行等は含めない）。 */
const QUESTION_LIKE_TYPES = new Set(["一般質問", "代表質問", "関連質問", "総括質疑", "総括質疑・一般質問"]);

/**
 * 発言データの収録対象期間内で、実際に会議録本文を取得・検証済み（transcriptAvailable:true）の
 * 定例会IDの一覧（単一情報源はsrc/data/questionCollectionStatus.json）。
 * 会議録が未公開の会期（例：令和8年6月定例会）は、活動なしと誤解されないよう、
 * 分母からも分子からも除外する。
 */
export const TRANSCRIPT_AVAILABLE_SESSION_IDS: string[] = (
  questionCollectionStatusData as { sessions: { sessionId: string; transcriptAvailable: boolean }[] }
).sessions.filter((s) => s.transcriptAvailable).map((s) => s.sessionId);

function clamp0to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * 在職期間を考慮した「対象となる会期ID一覧」を求める。
 * - 現職議員：全員が同一の選挙日（councilSpeechPeriod.from）を任期開始とするため、
 *   会議録取得済みの全会期（TRANSCRIPT_AVAILABLE_SESSION_IDS）をそのまま対象とする。
 * - 元議員：公式資料で在職・発言を確認できた会期（formerMembers.jsonのservedSessions）
 *   のみを対象とする。servedSessionsは「活動が確認できた会期」であり、在職期間全体を
 *   保証するものではないため、この分母は「確認できた在職会期数」である旨を必ず明示する。
 */
export function eligibleSessionIdsFor(options: { isFormerMember: boolean; servedSessions?: string[] }): string[] {
  if (!options.isFormerMember) return TRANSCRIPT_AVAILABLE_SESSION_IDS;
  const served = options.servedSessions ?? [];
  return served.filter((id) => TRANSCRIPT_AVAILABLE_SESSION_IDS.includes(id));
}

/** 指定した議員の発言のうち、公開・確認済み（isPublished:true）のものだけを対象にする。 */
function publicQuestionLikeSpeeches(speeches: CouncilSpeech[]): CouncilSpeech[] {
  return speeches.filter((s) => s.isPublished && QUESTION_LIKE_TYPES.has(s.speechType));
}

/**
 * 1. 一般質問：対象会期のうち、一般質問（代表質問等含む）を行った会期の割合。
 * 「一般質問を行った定例会数 ÷ 質問可能だった定例会数 × 100」。
 */
export function calculateQuestionActivityIndex(
  speeches: CouncilSpeech[],
  eligibleSessionIds: string[],
  updatedAt?: string,
): RadarMetric {
  const base = {
    key: "question",
    label: "一般質問",
    description: "在職中に会議録を取得・確認できた定例会のうち、一般質問・代表質問等を行ったことが確認できた会期の割合です。",
    methodNote: "確認できた質問会期数 ÷ 対象会期数 × 100（在職中かつ会議録取得済みの定例会のみを分母とする）。",
    sourceLabel: "会議録本文（councilSpeechSummaries.json）",
    updatedAt,
  };
  if (eligibleSessionIds.length === 0) {
    return { ...base, value: null, dataStatus: "missing" };
  }
  const activeSessions = new Set(publicQuestionLikeSpeeches(speeches).map((s) => s.sessionId));
  const numerator = eligibleSessionIds.filter((id) => activeSessions.has(id)).length;
  const denominator = eligibleSessionIds.length;
  const value = clamp0to100((numerator / denominator) * 100);
  return { ...base, value, numerator, denominator, dataStatus: "complete" };
}

/**
 * 2. 議会発言：発言した会期の割合（配分50%）と、質問項目数の対数正規化（配分50%）を組み合わせる。
 * 長文・多数項目の発言だけが有利にならないよう、項目数は上限20件で対数変換して頭打ちにする。
 */
export function calculateSpeechActivityIndex(
  speeches: CouncilSpeech[],
  eligibleSessionIds: string[],
  updatedAt?: string,
): RadarMetric {
  const base = {
    key: "speech",
    label: "議会発言",
    description: "会議録を取得・確認できた会期のうち、発言（一般質問等）が確認できた会期の割合と、確認できた質問項目数を組み合わせた指数です。長い発言ほど高得点にならないよう、項目数は上限を設けて頭打ちにしています。",
    methodNote: "（発言確認会期数÷対象会期数×50）＋（質問項目数を上限20件でlog正規化した値×50）。",
    sourceLabel: "会議録本文（councilSpeechSummaries.json）",
    updatedAt,
  };
  if (eligibleSessionIds.length === 0) {
    return { ...base, value: null, dataStatus: "missing" };
  }
  const published = publicQuestionLikeSpeeches(speeches);
  const activeSessions = new Set(published.map((s) => s.sessionId));
  const numerator = eligibleSessionIds.filter((id) => activeSessions.has(id)).length;
  const denominator = eligibleSessionIds.length;
  const coverageComponent = (numerator / denominator) * 50;

  const CAP = 20;
  const totalItems = published.reduce((sum, s) => sum + s.questionItems.length, 0);
  const volumeComponent = totalItems > 0 ? (Math.log(1 + Math.min(totalItems, CAP)) / Math.log(1 + CAP)) * 50 : 0;

  const value = clamp0to100(coverageComponent + volumeComponent);
  return {
    ...base,
    value,
    rawValue: totalItems,
    numerator,
    denominator,
    dataStatus: "complete",
  };
}

/**
 * 3. 出席状況：本サイトは現時点で本会議・委員会の個別出席記録を収録していないため、
 * 常にdataStatus:"missing"を返す（0点として描画しない）。
 */
export function calculateAttendanceIndex(): RadarMetric {
  return {
    key: "attendance",
    label: "出席状況",
    value: null,
    description: "本会議・委員会ごとの出席記録を確認できた割合を示す項目です。",
    methodNote: "出席回数 ÷ 出席対象会議数 × 100（公務・病気・議長職等の公式な欠席理由が確認できる場合は注記します）。",
    sourceLabel: "出席記録（未収録）",
    dataStatus: "missing",
  };
}

/**
 * 4. 議案等の意思表示：公開・記名採決のうち、賛否・棄権・欠席等の意思表示が確認できた割合。
 * 賛成・反対の「内容」を評価しない（賛成=高得点のような算定は行わない）。
 * 既存データ（billVotes.json）は議案ごとの議決結果のみで、議員個人の賛否内訳
 * （memberVotes）は現時点で全件未登録のため、常にdataStatus:"missing"を返す。
 */
export function calculateVotingDisclosureIndex(numerator: number, denominator: number, updatedAt?: string): RadarMetric {
  const base = {
    key: "voting",
    label: "議案等の意思表示",
    description: "公開されている記名採決のうち、この議員の賛否・棄権・欠席等の意思表示が確認できた議案の割合です。賛成・反対どちらであるかを評価するものではありません。",
    methodNote: "意思表示を確認できた議案数 ÷ 対象議案数 × 100（賛成・反対の内容は得点化しない）。",
    sourceLabel: "議案ごとの賛否（billVotes.json）",
    updatedAt,
  };
  if (denominator === 0) {
    return {
      ...base,
      value: null,
      dataStatus: "missing",
    };
  }
  const value = clamp0to100((numerator / denominator) * 100);
  return { ...base, value, numerator, denominator, dataStatus: numerator > 0 ? "complete" : "missing" };
}

/**
 * 5. 提案・討論等：議案提出・修正案提出・請願紹介・討論・動議・要望提案・委員長報告等の件数。
 * 現時点でarchiveCouncilDocuments.jsonに議員別の提案者・関連議員情報が未収録のため、
 * 常にdataStatus:"missing"を返す。
 */
export function calculateProposalActivityIndex(): RadarMetric {
  return {
    key: "proposal",
    label: "提案・討論等",
    value: null,
    description: "議案提出、修正案提出、請願・陳情の紹介、賛成・反対討論、動議、要望・政策提案、委員長報告等が確認できた件数を示す項目です。",
    methodNote: "確認できた提案・討論等の件数を基に算定します（現在データ整備中）。",
    sourceLabel: "議案・条例・請願・陳情アーカイブ（未収録）",
    dataStatus: "missing",
  };
}

export interface InformationDisclosureChecklistItem {
  label: string;
  filled: boolean;
}

/**
 * 6. 情報公開：議員本人の能力・活動量ではなく、ポータル上のプロフィール情報の充足状況。
 * SNS未利用等の不作為をマイナス評価しない（「未確認」ではなく単純な充足率として扱う）。
 */
export function calculateInformationDisclosureIndex(
  checklist: InformationDisclosureChecklistItem[],
  updatedAt?: string,
): RadarMetric {
  const base = {
    key: "disclosure",
    label: "情報公開",
    description: "経歴、所属会派、所属委員会、当選回数、公式ページ・SNS、一般質問履歴、議案賛否履歴など、ポータル上で確認できるプロフィール情報の充足状況です。SNSを利用していないこと自体を低評価とするものではありません。",
    methodNote: "確認できた項目数 ÷ 確認対象項目数 × 100。",
    sourceLabel: "議員プロフィール（members.json等）",
    updatedAt,
  };
  if (checklist.length === 0) {
    return { ...base, value: null, dataStatus: "missing" };
  }
  const numerator = checklist.filter((c) => c.filled).length;
  const denominator = checklist.length;
  const value = clamp0to100((numerator / denominator) * 100);
  // チェックリストの各項目は「確認済みか否か」を必ず判定できるため、結果が0件（未記入が多い）
  // であっても、それは「データが無くて算定できない」のではなく「確認した結果0件だった」という
  // 確定した値である。したがってchecklist自体が空（算定不能）の場合のみmissingとし、
  // それ以外は常にcompleteとして扱う（valueをそのまま実データとして表示する）。
  return {
    ...base,
    value,
    numerator,
    denominator,
    dataStatus: "complete",
  };
}

/** 全指標が"missing"（対象記録なし）かどうか。チャートの表示可否判定に使う。 */
export function allMetricsMissing(metrics: RadarMetric[]): boolean {
  return metrics.every((m) => m.value === null);
}
