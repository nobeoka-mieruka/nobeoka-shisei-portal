import type { CouncilMemberSpeechRecord, CouncilSession, GeneralQuestionItem } from "../types";
import { allPublicSpeeches, questionLikeSpeeches } from "./councilSpeeches";
import { toFiscalYearLabel } from "../config/site";
import questionCollectionStatusData from "../data/questionCollectionStatus.json";

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
  /** この会期の予定質問件数（generalQuestions.json内で該当sessionNameを持つ件数）。 */
  count: number;
  /** TASK-079：この会期の予定質問について、「のべおか市議会だより」で開催・実施を
   * 確認済みかどうか。会期内の全件がnewsletterConfirmed:trueの場合のみtrue。 */
  newsletterConfirmed: boolean;
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

  const status = questionCollectionStatusData as {
    generatedAt: string;
    sessions: { sessionId: string; sessionTitle: string; transcriptAvailable: boolean }[];
  };
  const targetSessionCount = status.sessions.length;
  const uncollectedSessions = status.sessions.filter((s) => !s.transcriptAvailable);

  const scheduledSessions: ScheduledQuestionSession[] = [];
  for (const q of generalQuestions) {
    let session = scheduledSessions.find((s) => s.sessionName === q.sessionName);
    if (!session) {
      session = { sessionName: q.sessionName, count: 0, newsletterConfirmed: true };
      scheduledSessions.push(session);
    }
    session.count += 1;
    if (q.newsletterConfirmed !== true) session.newsletterConfirmed = false;
  }

  return {
    confirmedCount,
    totalQuestionItemCount,
    scheduledSessions,
    scheduledCount: generalQuestions.length,
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
