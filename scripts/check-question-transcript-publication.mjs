#!/usr/bin/env node
/**
 * Phase252で新設：一般質問「予定」レコードに対する、公式会議録の公開監視。
 *
 * 【この監視が必要な理由】
 * 本サイトは一般質問を2段階で扱う（src/lib/generalQuestionStats.ts の方針と同じ）。
 *   - 予定    … 質問通告書だけを根拠に登録した質問予告（src/data/generalQuestions.json）
 *   - 確認済み … 公式会議録の本文を実際に読んで確認した質問（src/data/councilSpeechSummaries.json）
 * 「予定」を「確認済み」へ進められるのは、公式会議録が公開されたときだけである。
 * ところが、会議録が公開されたことを日々自動で検出する仕組みが無かったため、公開後も
 * 人が気づくまで放置される状態だった。このスクリプトはその検出だけを行う。
 *
 * 【このスクリプトが行わないこと（重要）】
 * - src/data/*.json への書き込みを一切行わない（レポート出力のみ）。
 * - 新しい質問レコードを作らない。会議録が公開されても、既存の「予定」レコードの id へ
 *   紐付ける候補として報告するだけで、予定版＋実績版の二重登録は絶対に行わない。
 * - 質問本文・答弁本文をAIで生成・補完しない（会議録本文の読み取りと確認は別工程）。
 * - 「質問予定日を過ぎた」ことだけを根拠に実施済みへ進めない。判定の根拠は、公式会議録検索
 *   システムにその質問日の本会議録が実在することだけである。
 * - 会議日が見つからないことを「質問が無かった」と解釈しない（未公開と未実施は区別する）。
 *
 * 【監視対象の決め方】件数はハードコードしない。
 * generalQuestions.json の questionDate から会期ID（YYYY-MM）を導き、
 * questionCollectionStatus.json で transcriptAvailable === true になっていない会期を
 * 「会議録確認待ち」として自動的に対象化する。
 *
 * 使い方: node scripts/check-question-transcript-publication.mjs [--verbose]
 * 失敗時（ネットワークエラー等）も自動更新ワークフロー全体を止めないよう、常にexit 0とする。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listSessionsForYear, listMeetingDays, fileNameToIsoDate } from "./lib/minutes-source.mjs";

const CODE = "48o046ot0cia1xvtw7";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERAL_QUESTIONS_PATH = join(ROOT, "src", "data", "generalQuestions.json");
const COLLECTION_STATUS_PATH = join(ROOT, "src", "data", "questionCollectionStatus.json");
const REPORT_PATH = join(ROOT, "reports", "question-transcript-publication.json");
const verbose = process.argv.includes("--verbose");

/**
 * 会議録が公開されたときに、既存の「予定」レコードへ確認・追記すべき項目。
 * どれも会議録本文の確認を伴うため、このスクリプトは項目名を候補として示すだけで値を作らない。
 */
const FIELDS_TO_CONFIRM = [
  "議員（memberId／memberName）",
  "質問日（questionDate）",
  "質問順（questionOrder）",
  "質問方式（questionType）",
  "質問本文（questionItems／summary）",
  "答弁者",
  "答弁本文",
  "出典（sourceUrl／sourceTitle）",
  "会議録本文URL（transcriptUrl）",
  "本文確認日（sourceTextVerifiedAt）",
];

/** 質問日（YYYY-MM-DD）から会期ID（YYYY-MM）を導く。questionCollectionStatus.jsonのsessionIdと同じ形式。 */
export function sessionIdOfQuestionDate(questionDate) {
  return String(questionDate ?? "").slice(0, 7);
}

/**
 * 「会議録確認待ち」の会期と、その質問レコードを実データから導出する。
 * transcriptAvailable === true の会期だけを確認済みとみなす（未登録＝未確認として扱う）。
 */
export function collectPendingSessions(questions, collectionStatus) {
  const confirmed = new Map(
    (collectionStatus.sessions ?? []).map((s) => [s.sessionId, s.transcriptAvailable === true]),
  );
  const bySession = new Map();
  for (const q of questions) {
    const sessionId = sessionIdOfQuestionDate(q.questionDate);
    if (!sessionId) continue;
    if (confirmed.get(sessionId) === true) continue;
    if (!bySession.has(sessionId)) {
      bySession.set(sessionId, {
        sessionId,
        sessionName: q.sessionName ?? null,
        registeredInCollectionStatus: confirmed.has(sessionId),
        questions: [],
      });
    }
    bySession.get(sessionId).questions.push(q);
  }
  return [...bySession.values()].sort((a, b) => a.sessionId.localeCompare(b.sessionId));
}

/**
 * 会議録検索システムから取得した「会議日→ファイル名」の対応表と、質問日を突き合わせる。
 * 質問日と同じ日付の本会議録が実在する場合だけ「その日の会議録が公開済み」と判定する。
 */
export function matchQuestionDates(pendingSession, meetingDayIndex) {
  const questionDates = [...new Set(pendingSession.questions.map((q) => q.questionDate).filter(Boolean))].sort();
  const matched = [];
  const unmatched = [];
  for (const d of questionDates) {
    const hit = meetingDayIndex.get(d);
    if (hit) matched.push({ questionDate: d, ...hit });
    else unmatched.push(d);
  }
  return { questionDates, matched, unmatched };
}

/**
 * 会期単位の状態判定。既存の語彙だけを使い、新しい状態名は増やさない。
 * - WAITING_FOR_OFFICIAL_RECORD           … 会議録が1日分も公開されていない（現状維持）
 * - OFFICIAL_RECORD_PARTIALLY_AVAILABLE   … 一部の質問日だけ公開された（会期進行中の通常状態）
 * - OFFICIAL_RECORD_AVAILABLE             … 全質問日の会議録が公開された
 */
export function decideSessionState({ matched, unmatched }) {
  if (matched.length === 0) return "WAITING_FOR_OFFICIAL_RECORD";
  if (unmatched.length === 0) return "OFFICIAL_RECORD_AVAILABLE";
  return "OFFICIAL_RECORD_PARTIALLY_AVAILABLE";
}

async function buildMeetingDayIndexForYear(year) {
  const index = new Map();
  const sessions = await listSessionsForYear({ code: CODE, year });
  for (const s of sessions) {
    const days = await listMeetingDays({ code: CODE, sessionLabel: s.treedepth });
    for (const d of days) {
      const iso = fileNameToIsoDate(d.fileName);
      if (!iso) continue;
      index.set(iso, { fileName: d.fileName, meetingLabel: d.label, minutesSessionLabel: s.label });
    }
  }
  return { index, sessionLabels: sessions.map((s) => s.label) };
}

async function main() {
  const startedAt = new Date().toISOString();
  const questions = JSON.parse(readFileSync(GENERAL_QUESTIONS_PATH, "utf8"));
  const collectionStatus = JSON.parse(readFileSync(COLLECTION_STATUS_PATH, "utf8"));
  const pendingSessions = collectPendingSessions(questions, collectionStatus);

  const years = [...new Set(pendingSessions.map((s) => Number(s.sessionId.slice(0, 4))))].filter(Number.isFinite);
  const yearIndexes = new Map();
  const fetchErrors = [];
  for (const year of years) {
    try {
      yearIndexes.set(year, await buildMeetingDayIndexForYear(year));
    } catch (e) {
      fetchErrors.push({ year, message: e.message });
    }
  }

  const sessionResults = [];
  for (const pending of pendingSessions) {
    const year = Number(pending.sessionId.slice(0, 4));
    const yearIndex = yearIndexes.get(year);
    if (!yearIndex) {
      sessionResults.push({
        sessionId: pending.sessionId,
        sessionName: pending.sessionName,
        registeredInCollectionStatus: pending.registeredInCollectionStatus,
        questionCount: pending.questions.length,
        state: "CHECK_FAILED",
        note: "会議録検索システムから会期一覧を取得できませんでした（次回の自動実行で再試行します）。",
      });
      continue;
    }
    const match = matchQuestionDates(pending, yearIndex.index);
    const state = decideSessionState(match);
    sessionResults.push({
      sessionId: pending.sessionId,
      sessionName: pending.sessionName,
      registeredInCollectionStatus: pending.registeredInCollectionStatus,
      questionCount: pending.questions.length,
      questionDates: match.questionDates,
      state,
      minutesSessionLabels: yearIndex.sessionLabels,
      matchedMeetingDays: match.matched,
      unmatchedQuestionDates: match.unmatched,
      // 会議録が公開されていた場合だけ、既存レコードへ紐付ける候補を出す。
      // ここに並ぶのは「既に存在する質問ID」だけであり、新規IDは一切作らない。
      updateCandidates:
        state === "WAITING_FOR_OFFICIAL_RECORD"
          ? []
          : pending.questions
              .filter((q) => match.matched.some((m) => m.questionDate === q.questionDate))
              .map((q) => ({
                existingQuestionId: q.id,
                memberName: q.memberName,
                questionDate: q.questionDate,
                transcriptFileName: match.matched.find((m) => m.questionDate === q.questionDate)?.fileName ?? null,
                action: "既存レコードへ会議録の確認結果を追記する（新規レコードを作らない）",
                fieldsToConfirm: FIELDS_TO_CONFIRM,
              })),
    });
  }

  const available = sessionResults.filter(
    (s) => s.state === "OFFICIAL_RECORD_AVAILABLE" || s.state === "OFFICIAL_RECORD_PARTIALLY_AVAILABLE",
  );
  const waiting = sessionResults.filter((s) => s.state === "WAITING_FOR_OFFICIAL_RECORD");
  const overallOutcome =
    fetchErrors.length > 0 && available.length === 0 ? "CHECK_FAILED" : available.length > 0 ? "UPDATE_CANDIDATE" : "NO_CHANGE";

  const report = {
    generatedAt: startedAt,
    note: "一般質問「予定」レコードに対する公式会議録の公開監視。src/data配下への書き込みは行わない（検出のみ）。新しい質問レコードは作らず、既存IDへの紐付け候補だけを報告する。",
    overallOutcome,
    dataChangeCount: 0,
    summary: {
      pendingSessionCount: sessionResults.length,
      pendingQuestionCount: sessionResults.reduce((n, s) => n + (s.questionCount ?? 0), 0),
      transcriptAvailableSessionCount: available.length,
      transcriptAvailableQuestionCount: available.reduce((n, s) => n + (s.updateCandidates?.length ?? 0), 0),
      waitingSessionCount: waiting.length,
      waitingQuestionCount: waiting.reduce((n, s) => n + (s.questionCount ?? 0), 0),
      newQuestionRecordsCreated: 0,
      duplicateRecordsCreated: 0,
    },
    fetchErrors,
    sessions: sessionResults,
  };

  if (!existsSync(dirname(REPORT_PATH))) mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

  console.log(
    `[check-question-transcript-publication] 判定=${overallOutcome} 対象会期=${sessionResults.length} 会議録公開済み会期=${available.length} 会議録確認待ち会期=${waiting.length}`,
  );
  for (const s of sessionResults) {
    const days = s.matchedMeetingDays?.length ? `／会議録=${s.matchedMeetingDays.map((m) => m.fileName).join(",")}` : "";
    console.log(`  - ${s.sessionId}（${s.sessionName ?? "会期名未登録"}）質問${s.questionCount}件: ${s.state}${days}`);
  }
  if (verbose) console.log(JSON.stringify(report, null, 2));
  console.log(`[check-question-transcript-publication] DATA CHANGE = 0（このスクリプトはsrc/dataを書き換えません）。レポート: ${REPORT_PATH}`);
}

// テストからimportされたときは実行しない（純粋関数だけを検証できるようにする）。
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("check-question-transcript-publication.mjs")) {
  main().catch((e) => {
    console.log(`[check-question-transcript-publication] 予期しないエラー（ワークフロー全体は継続します）: ${e.message}`);
  });
}
