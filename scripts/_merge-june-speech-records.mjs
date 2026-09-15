/**
 * Phase256の作業用スクリプト（一時的）：data/minutes/june-records/speeches.json
 * （人が公式会議録本文を読んで作成した照合仕様から組み立てた発言レコード）を、
 * 公開データへ反映する。
 *
 * 反映先：
 *   1. src/data/councilSpeechSummaries.json … 議員別の発言レコードを追加（同一idは置換。新規IDは作らない）
 *   2. src/data/generalQuestions.json       … 既存の質問レコードへ会議録リンク・照合結果を追記
 *   3. src/data/questionCollectionStatus.json … 令和8年6月定例会の収録状況を更新
 *
 * 要約文は一切生成しない。speeches.json の記述をそのまま使う。
 * 何度実行しても同じ結果になる（二重登録しない）。
 */
import { readFileSync, writeFileSync } from "node:fs";

const SPEECHES = "data/minutes/june-records/speeches.json";
const SUMMARIES = "src/data/councilSpeechSummaries.json";
const QUESTIONS = "src/data/generalQuestions.json";
const STATUS = "src/data/questionCollectionStatus.json";

const SESSION_ID = "2026-06";
const CHECKED_AT = "2026-09-15";
const PHASE_NOTE_MARK = "【2026-09-15・Phase256】";

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, v) => writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`, "utf8");

const speeches = readJson(SPEECHES);

/* ---------- 1. councilSpeechSummaries.json ---------- */
const summaries = readJson(SUMMARIES);
const byMember = new Map(summaries.members.map((m) => [m.memberId, m]));
const stats = { added: 0, replaced: 0, missingMember: [] };

for (const speech of speeches) {
  const record = byMember.get(speech.memberId);
  if (!record) {
    stats.missingMember.push(speech.memberId);
    continue;
  }
  const index = record.speeches.findIndex((s) => s.id === speech.id);
  if (index >= 0) {
    record.speeches[index] = speech;
    stats.replaced++;
    continue;
  }
  // 既存の並び順は挿入履歴に基づいており、一括の並べ替えは行わない（差分と表示順を壊さない）。
  record.speeches.push(speech);
  stats.added++;

  // 会期が1つ増えたことを収録状況カウンタへ反映する（未解析会期は1つ減る）。
  record.analyzedSessionCount = (record.analyzedSessionCount ?? 0) + 1;
  record.sessionsWithSpeechCount = (record.sessionsWithSpeechCount ?? 0) + 1;
  record.unfetchedSessionCount = Math.max(0, (record.unfetchedSessionCount ?? 0) - 1);
  const from = record.analysisPeriod?.from ?? null;
  const to = record.analysisPeriod?.to ?? null;
  record.analysisPeriod = {
    from: from && from <= speech.date ? from : speech.date,
    to: to && to >= speech.date ? to : speech.date,
  };
  record.lastAnalyzedAt = CHECKED_AT;
  for (const topic of speech.topics) record.topicCounts.push({ topic, sessionCount: 1 });
}
summaries.generatedAt = CHECKED_AT;
writeJson(SUMMARIES, summaries);

/* ---------- 2. generalQuestions.json ---------- */
const questions = readJson(QUESTIONS);
const bySpeech = new Map(speeches.map((s) => [s.memberId, s]));

/** 議員ごとの、会議録本文で確認できた個別事情（原文に書かれている事実のみ）。 */
const EXTRA_NOTE = {
  m01:
    "通告13項目のうち「新副市長」の1項目は、前日の一般質問で答弁があったことを理由に、本人が質問の冒頭で割愛を申し出たため、この会期では質問・答弁が行われていません（項目の一覧は質問通告書のとおり掲載しています）。",
  m20:
    "会議録本文では、本人が冒頭で「総括質疑及び一般質問を行います」と述べています（区分は質問通告書のとおり一般質問として登録しています）。",
};
const DEFAULT_EXTRA_NOTE =
  "会議録本文に総括質疑である旨の明示はないため、区分は質問通告書のとおり一般質問として扱っています。";

const qStats = { updated: 0, transcriptAdded: 0 };
for (const question of questions) {
  const speech = bySpeech.get(question.memberId);
  if (!speech || question.questionDate !== speech.date) continue;

  const opening = speech.summarySources[0];
  if (!question.transcriptUrl) qStats.transcriptAdded++;
  question.transcriptUrl = opening.sourceUrl;
  question.transcriptReference = `令和8年第26回定例会 ${speech.meetingNumber}（令和8年6月${Number(
    speech.date.slice(8, 10),
  )}日） 本会議録・${question.memberName.replace(/\s/g, "")}議員の発言箇所`;
  question.lastVerified = CHECKED_AT;
  question.notes = [
    "本レコードは質問通告書（提出日：令和8年6月16日）に基づいて登録し、令和8年6月定例会の公式会議録が公開されたことを受けて、2026年9月15日に会議録本文と照合しました。",
    "質問項目、質問内容、答弁者、答弁内容、再質問と再答弁の順序を会議録本文で確認しています。質問と答弁の要約は議員ページの発言記録に収録しており、本文の転載は行っていません。",
    EXTRA_NOTE[question.memberId] ?? DEFAULT_EXTRA_NOTE,
  ].join("");
  qStats.updated++;
}

// 稲田議員の概要は「13項目について質問した」となっていたが、会議録では12項目のみ質問された。
const m01 = questions.find((q) => q.id === "gq2026-06-m01");
if (m01 && m01.summary.includes("など13項目について質問した。")) {
  m01.summary = m01.summary.replace(
    "など13項目について質問した。",
    "など13項目を通告し、うち12項目について質問した（「新副市長」は本人の申出により割愛）。",
  );
}
writeJson(QUESTIONS, questions);

/* ---------- 3. questionCollectionStatus.json ---------- */
const status = readJson(STATUS);
const session = status.sessions.find((s) => s.sessionId === SESSION_ID);
const questionItemCount = speeches.reduce((n, s) => n + s.questionItems.length, 0);
if (session) {
  session.status = "partial";
  session.registeredSpeakerCount = speeches.length;
  session.registeredQuestionCount = questionItemCount;
  session.transcriptAvailable = true;
  session.lastCheckedAt = CHECKED_AT;
  session.lastSuccessAt = CHECKED_AT;
  if (!session.notes.includes(PHASE_NOTE_MARK)) session.notes = `${session.notes} ${PHASE_NOTE_MARK}公式会議録検索システムの本会議録（R080623A・R080624A・R080625A）本文と、質問通告書ベースで登録済みの一般質問14件を照合し、質問項目${questionItemCount}件・答弁・再質問の構造を議員別の発言データへ登録した。既存の質問IDへ会議録リンクと照合結果を追記しており、新しい質問レコードは作成していない。これによりtranscriptAvailableをtrueへ更新した。`;
}
status.generatedAt = CHECKED_AT;
writeJson(STATUS, status);

console.log(
  `[merge] 発言レコード: 追加${stats.added}件 / 置換${stats.replaced}件 / 議員未登録${stats.missingMember.length}件`,
);
console.log(`[merge] 質問レコード: 更新${qStats.updated}件 / 会議録リンク新規${qStats.transcriptAdded}件`);
console.log(`[merge] 収録状況: ${SESSION_ID} 質問者${speeches.length}名 / 質問項目${questionItemCount}件`);
