import type { CouncilMemberSpeechRecord, CouncilSession, GeneralQuestionItem } from "../types";
import { allPublicSpeeches, questionLikeSpeeches } from "./councilSpeeches";
import { formatJapaneseDate, toFiscalYearLabel } from "../config/site";
import questionCollectionStatusData from "../data/questionCollectionStatus.json";
import {
  councilSessionIdFromSessionName,
  councilSessionPhaseLabels,
  type CouncilSessionPhase,
} from "./councilSessions";

/**
 * サイト全体で「一般質問の件数」を表示する箇所（トップページ・ダッシュボード・
 * データ収録状況・一般質問一覧等）が、それぞれ独自に件数を数えて表示が食い違わないよう、
 * この1ファイルだけを唯一の情報源とする。
 *
 * 【用語の区別】
 * - 確認済み：councilSpeechSummaries.json（会議録本文を実際に読んで要約・登録した一般質問）。
 *   会議録取得済みの全12会期（TRANSCRIPT_AVAILABLE_SESSION_IDS）を対象とした累計件数。
 * - 予定：generalQuestions.json（会議録がまだ公開されていない会期について、
 *   質問通告書＝事前提出された質問予告のみを登録したもの。実際の質疑応答内容の
 *   確認はまだできていない）。会議録が未公開の会期が複数同時に存在する場合（例：
 *   開催済みだが会議録未公開の会期と、開催前で通告書のみの会期が並行する場合）は、
 *   会期ごとに分けて集計する（Phase：令和8年9月定例会追加時に単一会期前提から拡張）。
 * この2つは対象が重ならない別々の集合であり、単純に足し合わせて「合計件数」として
 * 表示しない（予定質問は、実際に登壇するか・内容が変わるかを会議録で未確認のため）。
 */
export interface ScheduledQuestionSession {
  /** 会期名（例："令和8年6月定例会"）。 */
  sessionName: string;
  /** 会期名から導出した会期ID（例："2026-06"）。導出できない表記の場合はnull。 */
  sessionId: string | null;
  /**
   * Phase203：会期の進行状態。questionCollectionStatus.jsonへ登録済み＝会期が終了して
   * 収録対象になった会期を"completed"、まだ登録されていない会期（開催前または開催中で、
   * 議決結果・会議録のいずれも未確認）を"upcoming"とする。判定に今日の日付は使わない。
   */
  phase: CouncilSessionPhase;
  /** この会期の予定質問件数（generalQuestions.json内で該当sessionNameを持つ件数）。 */
  count: number;
  /** この会期で質問を予定している議員の人数（同一議員の複数件は1名と数える）。 */
  memberCount: number;
  /** 質問通告書に記載された質問予定日のうち最も早い日（generalQuestions.jsonの実値のみ）。 */
  firstQuestionDate?: string;
  /** 同じく最も遅い日。1日だけの場合はfirstQuestionDateと同じ値になる。 */
  lastQuestionDate?: string;
  /** TASK-079：この会期の予定質問について、「のべおか市議会だより」で開催・実施を
   * 確認済みかどうか。会期内の全件がnewsletterConfirmed:trueの場合のみtrue。 */
  newsletterConfirmed: boolean;
  /** 会議録本文を確認済みか（questionCollectionStatus.jsonのtranscriptAvailable）。 */
  transcriptAvailable: boolean;
}

/** questionCollectionStatus.json（会期の収録状況の単一情報源）の読み出し。 */
const questionCollectionStatus = questionCollectionStatusData as {
  generatedAt: string;
  sessions: { sessionId: string; sessionTitle: string; transcriptAvailable: boolean }[];
};

/**
 * 質問通告書ベースの予定質問（generalQuestions.json）を会期ごとにまとめ、
 * 会期の進行状態（Phase203）を付与する。
 *
 * 会議録本文を確認済みの一般質問（councilSpeechSummaries.json）を必要としないため、
 * 会期一覧ページなど重いデータを読み込みたくない画面からも単独で呼び出せる。
 */
export function scheduledQuestionSessions(generalQuestions: GeneralQuestionItem[]): ScheduledQuestionSession[] {
  const registeredSessionIds = new Map(
    questionCollectionStatus.sessions.map((s) => [s.sessionId, s.transcriptAvailable]),
  );
  const membersBySession = new Map<string, Set<string>>();
  const sessions: ScheduledQuestionSession[] = [];

  for (const q of generalQuestions) {
    let session = sessions.find((s) => s.sessionName === q.sessionName);
    if (!session) {
      const sessionId = councilSessionIdFromSessionName(q.sessionName);
      session = {
        sessionName: q.sessionName,
        sessionId,
        phase: councilSessionPhaseForSessionName(q.sessionName),
        count: 0,
        memberCount: 0,
        newsletterConfirmed: true,
        transcriptAvailable: (sessionId !== null && registeredSessionIds.get(sessionId)) === true,
      };
      sessions.push(session);
      membersBySession.set(q.sessionName, new Set());
    }
    session.count += 1;
    membersBySession.get(q.sessionName)?.add(q.memberId);
    if (q.newsletterConfirmed !== true) session.newsletterConfirmed = false;
    if (q.questionDate) {
      if (!session.firstQuestionDate || q.questionDate < session.firstQuestionDate) {
        session.firstQuestionDate = q.questionDate;
      }
      if (!session.lastQuestionDate || q.questionDate > session.lastQuestionDate) {
        session.lastQuestionDate = q.questionDate;
      }
    }
  }

  for (const session of sessions) {
    session.memberCount = membersBySession.get(session.sessionName)?.size ?? 0;
  }

  // 会期IDの昇順（開催年月順）に並べる。IDを導出できない会期は末尾に置く。
  return sessions.sort((a, b) => {
    if (a.sessionId && b.sessionId) return a.sessionId.localeCompare(b.sessionId);
    if (a.sessionId) return -1;
    if (b.sessionId) return 1;
    return a.sessionName.localeCompare(b.sessionName, "ja");
  });
}

/**
 * 会期名1件分の進行状態（Phase203）。questionCollectionStatus.jsonへ登録済み＝会期が終了して
 * 収録対象になった会期は"completed"、未登録の会期は"upcoming"（開催前または開催中）。
 * 今日の日付は使わない（プリレンダリング済みHTMLと閲覧時で表示が食い違わないようにするため）。
 * 会期IDを導出できない表記は、根拠なく「開催予定」と表示しないよう"completed"側に倒す。
 */
export function councilSessionPhaseForSessionName(sessionName: string): CouncilSessionPhase {
  const sessionId = councilSessionIdFromSessionName(sessionName);
  if (sessionId === null) return "completed";
  return questionCollectionStatus.sessions.some((s) => s.sessionId === sessionId) ? "completed" : "upcoming";
}

/**
 * 質問通告書に記載された質問予定日の範囲を表示用の文字列にする。
 * 日付が1件も無い会期はundefinedを返す（推測した日付を作らない）。
 */
export function formatScheduledQuestionPeriod(session: ScheduledQuestionSession): string | undefined {
  const { firstQuestionDate, lastQuestionDate } = session;
  if (!firstQuestionDate) return undefined;
  if (!lastQuestionDate || lastQuestionDate === firstQuestionDate) return formatJapaneseDate(firstQuestionDate);
  return `${formatJapaneseDate(firstQuestionDate)}〜${formatJapaneseDate(lastQuestionDate)}`;
}

/**
 * 「会議録未公開会期の予定質問」の内訳説明文。トップページ・ダッシュボード・データ収録状況で
 * 同じ文言になるよう、ここを唯一の情報源とする（会期名・件数・日付はすべて引数の実データから）。
 * 会期の状態（開催済み／開催予定・開催中）を必ず併記し、直近の確認済み会期と混同しないようにする。
 */
export function scheduledSessionBreakdownHint(sessions: ScheduledQuestionSession[]): string {
  return sessions
    .map((s) => {
      const parts = [`${s.count}件`, "質問通告書ベース"];
      const period = formatScheduledQuestionPeriod(s);
      if (period) parts.push(`一般質問の予定日 ${period}`);
      if (s.newsletterConfirmed) parts.push("市議会だよりで開催確認済み");
      return `${s.sessionName}（${councilSessionPhaseLabels[s.phase]}）：${parts.join("／")}`;
    })
    .join("　");
}

export interface GeneralQuestionStats {
  /** 会議録本文で内容を確認済みの一般質問・代表質問・関連質問・総括質疑の累計件数。 */
  confirmedCount: number;
  /**
   * 確認済み一般質問（confirmedCount）の中で扱われた個別テーマ・質問項目（questionItems）の
   * 累計件数。1件の一般質問に複数の質問項目が含まれることが多いため、confirmedCountより
   * 大きい値になる。
   */
  totalQuestionItemCount: number;
  /** 質問通告書に基づく、会議録未公開の会期ごとの予定質問件数（会期名・件数・だより確認有無）。
   * 会議録未公開の会期が0件なら空配列。 */
  scheduledSessions: ScheduledQuestionSession[];
  /** scheduledSessionsの件数の合計（会議録未公開の全会期分の予定質問の合計件数）。 */
  scheduledCount: number;
  /**
   * Phase203：scheduledSessionsのうち、会期が終了して収録対象へ登録済みのもの
   * （＝「直近の確認済み会期」側。会議録の公開待ち）。
   */
  completedScheduledSessions: ScheduledQuestionSession[];
  /** completedScheduledSessionsの予定質問件数の合計。 */
  completedScheduledCount: number;
  /**
   * Phase203：scheduledSessionsのうち、これから開催される、または開催中の会期
   * （＝「次回・開催予定の会期」側。議決結果・会議録とも未確認）。
   */
  upcomingScheduledSessions: ScheduledQuestionSession[];
  /** upcomingScheduledSessionsの予定質問件数の合計。 */
  upcomingScheduledCount: number;
  /** 現議員任期以降の収録対象会期数（questionCollectionStatus.json全件）。 */
  targetSessionCount: number;
  /** 会議録取得済み（transcriptAvailable:true）会期数。 */
  collectedSessionCount: number;
  /** 会議録未取得会期数。 */
  uncollectedSessionCount: number;
  /** 会議録が未取得の会期名の一覧。 */
  uncollectedSessionNames: string[];
  /** この集計の基準日（questionCollectionStatus.jsonのgeneratedAt）。 */
  lastCheckedAt: string;
}

export function calculateGeneralQuestionStats(
  speechRecords: CouncilMemberSpeechRecord[],
  generalQuestions: GeneralQuestionItem[],
): GeneralQuestionStats {
  const confirmedSpeeches = questionLikeSpeeches(allPublicSpeeches(speechRecords));
  const confirmedCount = confirmedSpeeches.length;
  // Phase193：軽量インデックス（councilSpeechIndex.json）はquestionItems本文を持たず、
  // 件数だけをquestionItemCountとして保持する。どちらの入力でも同じ件数になるようにする。
  const totalQuestionItemCount = confirmedSpeeches.reduce(
    (sum, speech) => sum + (speech.questionItemCount ?? speech.questionItems.length),
    0,
  );

  const status = questionCollectionStatus;
  const targetSessionCount = status.sessions.length;
  const uncollectedSessions = status.sessions.filter((s) => !s.transcriptAvailable);

  const scheduledSessions = scheduledQuestionSessions(generalQuestions);
  const completedScheduledSessions = scheduledSessions.filter((s) => s.phase === "completed");
  const upcomingScheduledSessions = scheduledSessions.filter((s) => s.phase === "upcoming");
  const sumCount = (list: ScheduledQuestionSession[]) => list.reduce((sum, s) => sum + s.count, 0);

  return {
    confirmedCount,
    totalQuestionItemCount,
    scheduledSessions,
    scheduledCount: generalQuestions.length,
    completedScheduledSessions,
    completedScheduledCount: sumCount(completedScheduledSessions),
    upcomingScheduledSessions,
    upcomingScheduledCount: sumCount(upcomingScheduledSessions),
    targetSessionCount,
    collectedSessionCount: targetSessionCount - uncollectedSessions.length,
    uncollectedSessionCount: uncollectedSessions.length,
    uncollectedSessionNames: uncollectedSessions.map((s) => s.sessionTitle),
    lastCheckedAt: status.generatedAt,
  };
}

/** 議員別の確認済み一般質問件数（上位表示用）の集計1件分。評価・順位付け目的ではない。 */
export interface QuestionCountByKey {
  key: string;
  label: string;
  count: number;
}

/**
 * 確認済み一般質問（councilSpeechSummaries.json）を議員別に集計する。
 * 現職議員はmembers.json、現職に一致しない場合はresolveMemberDisplayNameで解決した氏名を使う。
 */
export function aggregateConfirmedQuestionsByMember(
  speechRecords: CouncilMemberSpeechRecord[],
  resolveDisplayName: (memberId: string) => string,
): QuestionCountByKey[] {
  const counts = new Map<string, number>();
  for (const speech of questionLikeSpeeches(allPublicSpeeches(speechRecords))) {
    counts.set(speech.memberId, (counts.get(speech.memberId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([memberId, count]) => ({ key: memberId, label: resolveDisplayName(memberId), count }))
    .sort((a, b) => b.count - a.count);
}

/** 確認済み一般質問（councilSpeechSummaries.json）をテーマ（topics）別に集計する。 */
export function aggregateConfirmedQuestionsByTopic(speechRecords: CouncilMemberSpeechRecord[]): QuestionCountByKey[] {
  const counts = new Map<string, number>();
  for (const speech of questionLikeSpeeches(allPublicSpeeches(speechRecords))) {
    for (const topic of speech.topics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ key: topic, label: topic, count }))
    .sort((a, b) => b.count - a.count);
}

/** 確認済み一般質問（councilSpeechSummaries.json）を年度（councilSessions.jsonのfiscalYear）別に集計する。 */
export function aggregateConfirmedQuestionsByFiscalYear(
  speechRecords: CouncilMemberSpeechRecord[],
  councilSessions: CouncilSession[],
): QuestionCountByKey[] {
  const fiscalYearBySessionId = new Map(councilSessions.map((s) => [s.id, s.fiscalYear]));
  const counts = new Map<number, number>();
  for (const speech of questionLikeSpeeches(allPublicSpeeches(speechRecords))) {
    const fiscalYear = fiscalYearBySessionId.get(speech.sessionId);
    if (fiscalYear === undefined) continue; // 対応する定例会がcouncilSessions.jsonに無い場合は集計対象外（推測しない）
    counts.set(fiscalYear, (counts.get(fiscalYear) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([fiscalYear, count]) => ({ key: String(fiscalYear), label: toFiscalYearLabel(`${fiscalYear}-04-01`), count }))
    .sort((a, b) => a.key.localeCompare(b.key, "ja"));
}
