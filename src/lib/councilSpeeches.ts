import type {
  AnswererRole,
  CouncilMemberSpeechRecord,
  CouncilSpeech,
  CouncilSpeechExchange,
  CouncilSpeechQuestionItem,
  CouncilSpeechSummaryData,
  MemberSpeechAnalysis,
  MemberSpeechAnalysisStatus,
  SpeechSummaryStatus,
} from "../types";
import { isWithinCouncilSpeechPeriod } from "../config/councilSpeechPeriod";
import { normalizeTopicLabel } from "./topicNormalization";
import { classifyTopicToThemeSlug } from "./themeClassification";

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

/** 全議員分の公開・収録対象期間内の発言を1つの配列にまとめる。 */
export function allPublicSpeeches(records: CouncilMemberSpeechRecord[]): CouncilSpeech[] {
  return records.flatMap((record) => publicSpeeches(record));
}

/** テーマ1件分の会期横断集計（/themes 一覧ページ用）。件数はすべて公開・確認済みの実データに基づく事実集計。 */
export interface ThemeAggregate {
  slug: string;
  sessionIds: string[];
  memberIds: string[];
  speechIds: string[];
}

/**
 * 議員横断で、テーマ別（src/data/themes.jsonのslug）に会期・議員・発言を集計する。
 * speech.topicsをclassifyTopicToThemeSlugで分類するのみで、別ファイルへは保存しない。
 */
export function aggregateSpeechesByTheme(records: CouncilMemberSpeechRecord[]): ThemeAggregate[] {
  const bySlug = new Map<string, { sessionIds: Set<string>; memberIds: Set<string>; speechIds: Set<string> }>();
  for (const speech of allPublicSpeeches(records)) {
    const slugs = new Set(speech.topics.map(classifyTopicToThemeSlug));
    for (const slug of slugs) {
      const entry = bySlug.get(slug) ?? { sessionIds: new Set(), memberIds: new Set(), speechIds: new Set() };
      entry.sessionIds.add(speech.sessionId);
      entry.memberIds.add(speech.memberId);
      entry.speechIds.add(speech.id);
      bySlug.set(slug, entry);
    }
  }
  return [...bySlug.entries()].map(([slug, { sessionIds, memberIds, speechIds }]) => ({
    slug,
    sessionIds: [...sessionIds].sort(),
    memberIds: [...memberIds],
    speechIds: [...speechIds],
  }));
}

/** テーマ詳細ページで表示する、該当テーマの発言1件分（議員・会期の紐付き情報を含む）。 */
export interface ThemeSpeechMatch {
  memberId: string;
  speech: CouncilSpeech;
  matchedTopics: string[];
}

/** 指定テーマslugに一致する発言を、公開・収録対象期間内のデータから抽出する。 */
export function findSpeechesByThemeSlug(records: CouncilMemberSpeechRecord[], themeSlug: string): ThemeSpeechMatch[] {
  const matches: ThemeSpeechMatch[] = [];
  for (const speech of allPublicSpeeches(records)) {
    const matchedTopics = speech.topics.filter((t) => classifyTopicToThemeSlug(t) === themeSlug);
    if (matchedTopics.length > 0) {
      matches.push({ memberId: speech.memberId, speech, matchedTopics });
    }
  }
  return matches;
}

/**
 * 答弁者名（自由記述）から役職区分を機械的に分類する。データとしては保存しない計算結果。
 * 「副市長」は「市長」を含むため、必ず先に判定する。判別できない場合はunknownとし、推測しない。
 */
export function classifyAnswererRole(speakerName: string | undefined): AnswererRole {
  if (!speakerName) return "unknown";
  if (speakerName.includes("副市長")) return "deputyMayor";
  if (speakerName.includes("市長")) return "mayor";
  if (speakerName.includes("教育長")) return "superintendent";
  if (speakerName.includes("部長")) return "departmentDirector";
  if (speakerName.includes("課長")) return "sectionManager";
  if (/局長|次長|室長|事務局長|管理者|消防長/.test(speakerName)) return "otherExecutive";
  return "unknown";
}

export const answererRoleLabels: Record<AnswererRole, string> = {
  mayor: "市長",
  deputyMayor: "副市長",
  superintendent: "教育長",
  departmentDirector: "部長級",
  sectionManager: "課長級",
  otherExecutive: "その他執行部",
  unknown: "確認中",
};

/** /executive-answers 検索対象の答弁1件分。 */
export interface ExecutiveAnswerEntry {
  id: string;
  memberId: string;
  speechId: string;
  sessionId: string;
  date: string | null;
  questionTitle: string;
  answererName: string;
  answererRole: AnswererRole;
  summary: string;
  topics: string[];
  /** 原本（会議録・PDF等）へのリンク。確認できた資料が無い場合はundefined（存在しないURLは作らない）。 */
  sourceUrl?: string;
}

function primarySourceUrl(speech: CouncilSpeech): string | undefined {
  return speech.summarySources.find((s) => s.sourceUrl)?.sourceUrl;
}

function answerEntriesFromExchanges(
  speech: CouncilSpeech,
  item: CouncilSpeechQuestionItem,
): ExecutiveAnswerEntry[] {
  const answerExchanges = item.exchanges.filter(
    (ex): ex is CouncilSpeechExchange & { type: "answer" | "follow-up-answer" } =>
      ex.type === "answer" || ex.type === "follow-up-answer",
  );
  return answerExchanges.map((ex) => {
    const answererName = ex.speakerName ?? "答弁者確認中";
    return {
      id: `${speech.id}-${item.id}-${ex.order}`,
      memberId: speech.memberId,
      speechId: speech.id,
      sessionId: speech.sessionId,
      date: speech.date,
      questionTitle: item.title,
      answererName,
      answererRole: classifyAnswererRole(ex.speakerName),
      summary: ex.summary,
      topics: speech.topics,
      sourceUrl: primarySourceUrl(speech),
    };
  });
}

/**
 * 全議員分の公開・収録対象期間内データから、市長・執行部の答弁を横断検索用にフラット化する。
 * exchangesがある場合はそこから、無い場合で質問と答弁の対応が確認済みの場合のみanswerSummaryから
 * 生成する。対応関係が未確認（pending/ambiguous）の質問は含めない。
 * 検索・絞り込みロジックはこの関数側に持たせ、コンポーネントからは分離する。
 */
export function collectExecutiveAnswers(records: CouncilMemberSpeechRecord[]): ExecutiveAnswerEntry[] {
  const entries: ExecutiveAnswerEntry[] = [];
  for (const speech of allPublicSpeeches(records)) {
    for (const item of speech.questionItems) {
      const fromExchanges = answerEntriesFromExchanges(speech, item);
      if (fromExchanges.length > 0) {
        entries.push(...fromExchanges);
        continue;
      }
      const isConfirmed =
        item.questionAnswerLinkStatus === "confirmed" || item.questionAnswerLinkStatus === "partially-confirmed";
      if (isConfirmed && item.answerSummary) {
        const answererName = item.answerers && item.answerers.length > 0 ? item.answerers.join("、") : "答弁者確認中";
        entries.push({
          id: `${speech.id}-${item.id}`,
          memberId: speech.memberId,
          speechId: speech.id,
          sessionId: speech.sessionId,
          date: speech.date,
          questionTitle: item.title,
          answererName,
          answererRole: classifyAnswererRole(item.answerers?.[0]),
          summary: item.answerSummary,
          topics: speech.topics,
          sourceUrl: primarySourceUrl(speech),
        });
      }
    }
  }
  return entries;
}
