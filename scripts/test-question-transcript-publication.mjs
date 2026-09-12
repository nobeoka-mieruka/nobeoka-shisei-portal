#!/usr/bin/env node
/**
 * Phase252：一般質問「予定」レコードに対する会議録公開監視（check-question-transcript-publication.mjs）の
 * 判定ロジックを、ネットワークアクセスなしで検証する。
 *
 * ここで守りたい業務ルール（いずれも誤登録・二重登録の防止が目的）：
 *  1. 監視対象の件数をハードコードせず、実データから導出していること。
 *  2. 会議録が公開されていない間は WAITING_FOR_OFFICIAL_RECORD のままで、更新候補を1件も出さないこと。
 *  3. 会議録が公開されたら、**既存の質問ID** への紐付け候補だけを出すこと（新規IDを作らない）。
 *  4. 質問日と同じ日付の本会議録が実在する場合だけ「公開済み」と判定すること
 *     （日付が過ぎたことや、検索結果が0件だったことを根拠にしない）。
 */
import { readFileSync } from "node:fs";
import {
  sessionIdOfQuestionDate,
  collectPendingSessions,
  matchQuestionDates,
  decideSessionState,
} from "./check-question-transcript-publication.mjs";

let checks = 0;
let failures = 0;
function check(label, actual, expected) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.error(`  [FAIL] ${label}\n    expected: ${e}\n    actual:   ${a}`);
  }
}
function ok(label, condition) {
  checks++;
  if (!condition) {
    failures++;
    console.error(`  [FAIL] ${label}`);
  }
}

console.log("[test-question-transcript-publication] 開始");

/* --- 1. 会期IDの導出 --- */
check("質問日から会期IDを導出", sessionIdOfQuestionDate("2026-09-08"), "2026-09");
check("質問日が未登録なら空文字", sessionIdOfQuestionDate(null), "");
check("質問日が空でも例外を投げない", sessionIdOfQuestionDate(undefined), "");

/* --- 2. 監視対象の導出（transcriptAvailable === true の会期だけを確認済みとみなす） --- */
const sampleQuestions = [
  { id: "q-a1", questionDate: "2025-09-01", sessionName: "確認済み会期" },
  { id: "q-b1", questionDate: "2026-06-23", sessionName: "登録済みだが未確認の会期" },
  { id: "q-b2", questionDate: "2026-06-24", sessionName: "登録済みだが未確認の会期" },
  { id: "q-c1", questionDate: "2026-09-08", sessionName: "未登録の会期" },
  { id: "q-c2", questionDate: "2026-09-09", sessionName: "未登録の会期" },
  { id: "q-c3", questionDate: "2026-09-10", sessionName: "未登録の会期" },
];
const sampleStatus = {
  sessions: [
    { sessionId: "2025-09", transcriptAvailable: true },
    { sessionId: "2026-06", transcriptAvailable: false },
  ],
};
const pending = collectPendingSessions(sampleQuestions, sampleStatus);
check("確認済み会期は監視対象から外れる", pending.map((s) => s.sessionId), ["2026-06", "2026-09"]);
check("会期ごとの質問件数を実データから数える", pending.map((s) => s.questions.length), [2, 3]);
check(
  "questionCollectionStatusへの登録有無を区別する",
  pending.map((s) => s.registeredInCollectionStatus),
  [true, false],
);

/* --- 3. 会議録が未公開のとき：現状維持し、更新候補を出さない --- */
const emptyIndex = new Map();
const sep = pending.find((s) => s.sessionId === "2026-09");
const sepMatch = matchQuestionDates(sep, emptyIndex);
check("未公開なら一致0件", sepMatch.matched.length, 0);
check("未公開なら未一致は質問日の数だけ", sepMatch.unmatched.length, 3);
check("未公開ならWAITING_FOR_OFFICIAL_RECORD", decideSessionState(sepMatch), "WAITING_FOR_OFFICIAL_RECORD");
ok("検索結果0件を「質問なし」と解釈しない（質問件数は保持される）", sep.questions.length === 3);

/* --- 4. 質問日と無関係な会議日しか無い場合も、公開済みにしない --- */
const unrelatedIndex = new Map([
  ["2026-09-01", { fileName: "R080901A", meetingLabel: "（第1号 9月 1日）", minutesSessionLabel: "令和 8年 第27回定例会" }],
  ["2026-09-30", { fileName: "R080930A", meetingLabel: "（第9号 9月30日）", minutesSessionLabel: "令和 8年 第27回定例会" }],
]);
const unrelatedMatch = matchQuestionDates(sep, unrelatedIndex);
check(
  "会期の会議録が一部あっても、質問日が無ければ待機のまま",
  decideSessionState(unrelatedMatch),
  "WAITING_FOR_OFFICIAL_RECORD",
);

/* --- 5. 一部の質問日だけ公開された場合 --- */
const partialIndex = new Map([
  ["2026-09-08", { fileName: "R080908A", meetingLabel: "（第2号 9月 8日）", minutesSessionLabel: "令和 8年 第27回定例会" }],
]);
const partialMatch = matchQuestionDates(sep, partialIndex);
check("一部公開はPARTIALLY_AVAILABLE", decideSessionState(partialMatch), "OFFICIAL_RECORD_PARTIALLY_AVAILABLE");
check("一部公開では一致した日だけを候補にする", partialMatch.matched.map((m) => m.questionDate), ["2026-09-08"]);
check("残りは未一致として残す", partialMatch.unmatched, ["2026-09-09", "2026-09-10"]);

/* --- 6. 全質問日が公開された場合 --- */
const fullIndex = new Map([
  ["2026-09-08", { fileName: "R080908A", meetingLabel: "（第2号 9月 8日）", minutesSessionLabel: "令和 8年 第27回定例会" }],
  ["2026-09-09", { fileName: "R080909A", meetingLabel: "（第3号 9月 9日）", minutesSessionLabel: "令和 8年 第27回定例会" }],
  ["2026-09-10", { fileName: "R080910A", meetingLabel: "（第4号 9月10日）", minutesSessionLabel: "令和 8年 第27回定例会" }],
]);
const fullMatch = matchQuestionDates(sep, fullIndex);
check("全日公開はOFFICIAL_RECORD_AVAILABLE", decideSessionState(fullMatch), "OFFICIAL_RECORD_AVAILABLE");
check("会議録ファイル名を質問日ごとに対応づける", fullMatch.matched.map((m) => m.fileName), ["R080908A", "R080909A", "R080910A"]);

/* --- 7. 実データでの回帰（件数をハードコードせず、実データと一致することだけを確認する） --- */
const realQuestions = JSON.parse(readFileSync("src/data/generalQuestions.json", "utf8"));
const realStatus = JSON.parse(readFileSync("src/data/questionCollectionStatus.json", "utf8"));
const realPending = collectPendingSessions(realQuestions, realStatus);
const realPendingIds = new Set(realPending.map((s) => s.sessionId));
for (const s of realStatus.sessions) {
  if (s.transcriptAvailable === true) {
    ok(`会議録確認済みの会期（${s.sessionId}）は監視対象に入らない`, !realPendingIds.has(s.sessionId));
  }
}
const realQuestionTotal = realPending.reduce((n, s) => n + s.questions.length, 0);
ok("監視対象の質問件数が実データの合計と矛盾しない", realQuestionTotal <= realQuestions.length);
for (const s of realPending) {
  const ids = s.questions.map((q) => q.id);
  ok(`監視対象の質問IDが重複していない（${s.sessionId}）`, new Set(ids).size === ids.length);
  ok(`監視対象の質問IDがすべて実データに存在する（${s.sessionId}）`, ids.every((id) => realQuestions.some((q) => q.id === id)));
}

console.log(`[test-question-transcript-publication] ${checks} checks, ${failures} failures`);
if (failures > 0) process.exit(1);
