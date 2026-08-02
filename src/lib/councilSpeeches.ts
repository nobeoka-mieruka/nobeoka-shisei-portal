import type {
  CouncilMemberSpeechRecord,
  CouncilSpeech,
  CouncilSpeechSummaryData,
  MemberSpeechAnalysis,
  MemberSpeechAnalysisStatus,
  SpeechSummaryStatus,
} from "../types";
import { isWithinCouncilSpeechPeriod } from "../config/councilSpeechPeriod";
import { normalizeTopicLabel } from "./topicNormalization";

export const memberSpeechAnalysisStatusLabels: Record<MemberSpeechAnalysisStatus, string> = {
  verified: "AI分析・内容確認済み",
  "partially-verified": "AI分析・一部確認済み",
  pending: "AI分析・確認待ち・暫定掲載",
  "insufficient-data": "分析に必要なデータが不足",
  "not-analyzed": "現在解析中",
};

export function findMemberSpeechAnalysis(
  analyses: MemberSpeechAnalysis[],
  memberId: string,
): MemberSpeechAnalysis | undefined {
  return analyses.find((a) => a.memberId === memberId);
}

export const speechSummaryStatusLabels: Record<SpeechSummaryStatus, string> = {
  "minutes-not-fetched": "会議録本文未取得",
  "source-unavailable": "公式資料不足",
  pending: "AI要約・確認待ち・暫定掲載",
  "partially-verified": "AI要約・一部確認済み",
  verified: "AI要約・内容確認済み",
  "speaker-identification-pending": "発言者確認中",
  "question-answer-link-pending": "質問と答弁の対応確認中",
};

/** 未設定時のフォールバック（このデータ形式では常にsummaryStatusを持つ想定）。 */
export function speechSummaryStatusLabel(status: SpeechSummaryStatus): string {
  return speechSummaryStatusLabels[status] ?? status;
}

export function findMemberSpeechRecord(
  data: CouncilMemberSpeechRecord[],
  memberId: string,
): CouncilMemberSpeechRecord | undefined {
  return data.find((m) => m.memberId === memberId);
}

/**
 * 一般公開してよい発言だけを返す（isPublished:true、かつ収録対象期間内のみ）。
 * 期間の判定はsrc/config/councilSpeechPeriod.tsが単一情報源（validate-data.mjs・
 * scripts/lib/public-routes.mjsの対応するチェックと同じ基準）。
 */
export function publicSpeeches(record: CouncilMemberSpeechRecord | undefined): CouncilSpeech[] {
  return record ? record.speeches.filter((s) => s.isPublished && isWithinCouncilSpeechPeriod(s.date)) : [];
}

export function findPublishedSpeech(
  data: CouncilSpeechSummaryData,
  memberId: string,
  speechId: string,
): CouncilSpeech | undefined {
  const record = findMemberSpeechRecord(data.members, memberId);
  return record?.speeches.find((s) => s.id === speechId && s.isPublished && isWithinCouncilSpeechPeriod(s.date));
}

/** テーマ1件分の会期単位集計。会期数（sessionCount）は同一会期内の重複を除いた実会期数。 */
export interface TopicAggregate {
  topic: string;
  sessionCount: number;
  sessionIds: string[];
  /** このテーマが登場した会期の中で最も新しいsessionId（表示順のタイブレークに使う）。 */
  latestSessionId: string;
  sourceSpeechIds: string[];
  /** 正規化前の原語（正規化辞書で統合された場合、複数になり得る）。 */
  rawTopics: string[];
}

/**
 * 公開済み・収録対象期間内の発言（publicSpeeches()の結果）から、議員1名分のテーマ別
 * 会期数集計を機械的に算出する。手入力・別ファイルへの重複保存はしない
 * （councilSpeechSummaries.jsonのspeech.topics/sessionIdから常に再計算する）。
 * テーマ名はsrc/lib/topicNormalization.tsの辞書で正規化してから集計する。
 * 会期数の多い順→最終登場会期が新しい順→五十音順（近似）で並べる。
 */
export function aggregateMemberTopics(speeches: CouncilSpeech[]): TopicAggregate[] {
  const byTopic = new Map<string, { sessionIds: Set<string>; speechIds: Set<string>; rawTopics: Set<string> }>();
  for (const speech of speeches) {
    for (const rawTopic of speech.topics) {
      const topic = normalizeTopicLabel(rawTopic);
      const entry = byTopic.get(topic) ?? { sessionIds: new Set(), speechIds: new Set(), rawTopics: new Set() };
      entry.sessionIds.add(speech.sessionId);
      entry.speechIds.add(speech.id);
      entry.rawTopics.add(rawTopic);
      byTopic.set(topic, entry);
    }
  }

  const aggregates: TopicAggregate[] = [...byTopic.entries()].map(([topic, { sessionIds, speechIds, rawTopics }]) => {
    const sortedSessionIds = [...sessionIds].sort();
    return {
      topic,
      sessionCount: sessionIds.size,
      sessionIds: sortedSessionIds,
      latestSessionId: sortedSessionIds[sortedSessionIds.length - 1],
      sourceSpeechIds: [...speechIds],
      rawTopics: [...rawTopics],
    };
  });

  return aggregates.sort((a, b) => {
    if (b.sessionCount !== a.sessionCount) return b.sessionCount - a.sessionCount;
    if (a.latestSessionId !== b.latestSessionId) return b.latestSessionId.localeCompare(a.latestSessionId);
    return a.topic.localeCompare(b.topic, "ja");
  });
}

/** 年別の質問・質疑集計1件分。 */
export interface YearlySpeechCount {
  year: number;
  /** A: その年に、質問・質疑を確認した会期数（同一年内の会期の重複は除く）。 */
  sessionsWithQuestions: number;
  /** B: その年に公開されている質問項目（questionItems）数。 */
  publishedItemCount: number;
  /** その年の対象会期数（councilSessions.json基準、収録対象期間内のみ）。 */
  targetSessionCount: number;
}

/**
 * 議員1名分の、年別の質問・質疑集計を機械的に算出する（別ファイルへの保存はしない）。
 * 「質問・質疑を確認した会期数」と「未解析、またはこの議員の質問が確認されなかった会期数」を
 * 区別するため、対象年の全会期数（targetSessionCount）もあわせて返す
 * （この2つを厳密に切り分けるには会期単位の解析状況データが必要なため、現状はまとめて示す）。
 */
export function aggregateYearlySpeechCounts(
  speeches: CouncilSpeech[],
  allSessionIdsInPeriod: string[],
): YearlySpeechCount[] {
  const sessionYear = (sessionId: string) => Number(sessionId.slice(0, 4));

  const targetCountByYear = new Map<number, number>();
  for (const sessionId of allSessionIdsInPeriod) {
    const year = sessionYear(sessionId);
    targetCountByYear.set(year, (targetCountByYear.get(year) ?? 0) + 1);
  }

  const sessionsByYear = new Map<number, Set<string>>();
  const itemCountByYear = new Map<number, number>();
  for (const speech of speeches) {
    const year = sessionYear(speech.sessionId);
    const set = sessionsByYear.get(year) ?? new Set();
    set.add(speech.sessionId);
    sessionsByYear.set(year, set);
    itemCountByYear.set(year, (itemCountByYear.get(year) ?? 0) + speech.questionItems.length);
  }

  const years = [...new Set([...targetCountByYear.keys(), ...sessionsByYear.keys()])].sort();
  return years.map((year) => ({
    year,
    sessionsWithQuestions: sessionsByYear.get(year)?.size ?? 0,
    publishedItemCount: itemCountByYear.get(year) ?? 0,
    targetSessionCount: targetCountByYear.get(year) ?? 0,
  }));
}
