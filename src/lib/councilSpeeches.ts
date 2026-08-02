import type {
  CouncilMemberSpeechRecord,
  CouncilSpeech,
  CouncilSpeechSummaryData,
  MemberSpeechAnalysis,
  MemberSpeechAnalysisStatus,
  SpeechSummaryStatus,
} from "../types";
import { isWithinCouncilSpeechPeriod } from "../config/councilSpeechPeriod";

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
}

/**
 * 公開済み・収録対象期間内の発言（publicSpeeches()の結果）から、議員1名分のテーマ別
 * 会期数集計を機械的に算出する。手入力・別ファイルへの重複保存はしない
 * （councilSpeechSummaries.jsonのspeech.topics/sessionIdから常に再計算する）。
 * 会期数の多い順→最終登場会期が新しい順→五十音順（近似）で並べる。
 */
export function aggregateMemberTopics(speeches: CouncilSpeech[]): TopicAggregate[] {
  const byTopic = new Map<string, { sessionIds: Set<string>; speechIds: Set<string> }>();
  for (const speech of speeches) {
    for (const topic of speech.topics) {
      const entry = byTopic.get(topic) ?? { sessionIds: new Set(), speechIds: new Set() };
      entry.sessionIds.add(speech.sessionId);
      entry.speechIds.add(speech.id);
      byTopic.set(topic, entry);
    }
  }

  const aggregates: TopicAggregate[] = [...byTopic.entries()].map(([topic, { sessionIds, speechIds }]) => {
    const sortedSessionIds = [...sessionIds].sort();
    return {
      topic,
      sessionCount: sessionIds.size,
      sessionIds: sortedSessionIds,
      latestSessionId: sortedSessionIds[sortedSessionIds.length - 1],
      sourceSpeechIds: [...speechIds],
    };
  });

  return aggregates.sort((a, b) => {
    if (b.sessionCount !== a.sessionCount) return b.sessionCount - a.sessionCount;
    if (a.latestSessionId !== b.latestSessionId) return b.latestSessionId.localeCompare(a.latestSessionId);
    return a.topic.localeCompare(b.topic, "ja");
  });
}
