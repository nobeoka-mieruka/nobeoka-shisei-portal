/**
 * Phase221：会期の進行状態（開催予定／開催中／一般質問終了・結果確認中／開催済み）の
 * 境界値テストと、プリレンダリング（サーバー生成HTML）との整合テスト。
 *
 * 検証すること：
 * 1. 判定はすべて日本標準時（Asia/Tokyo）の暦日を基準とすること。
 *    閲覧端末の時間帯がUTC・America/Los_Angelesでも、同じ瞬間なら同じ日本時間の日付になる。
 * 2. 境界値（開始日前日／開始当日／会期中／終了日／終了翌日）で状態が正しく切り替わること。
 * 3. 「今日」が未確定（today=null。プリレンダリング済みHTML・JavaScript無効時）のときは、
 *    日付に依存した断定を一切せず、必ず"pending"になること。
 *    → ビルド日時の状態がHTMLへ焼き付くことが構造的に起こらないことの回帰テスト。
 * 4. 実データ（generalQuestions.json／questionCollectionStatus.json）でも同じ判定になり、
 *    会期名から一意の状態が決まること（ページ間で状態が食い違わないことの担保）。
 * 5. 日程が1日も確認できていない会期を、推測で「開催予定」等に分類しないこと。
 *
 * 使い方: node --experimental-strip-types scripts/test-council-session-schedule-state.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

const {
  COUNCIL_SESSION_TIME_ZONE,
  councilSessionScheduleInfo,
  councilSessionScheduleState,
  councilSessionScheduleStateLabel,
  dateStringInTimeZone,
  questionDateLabelPrefix,
  resolveCouncilSessionSchedulePeriod,
} = await import("../src/lib/councilSessionSchedule.ts");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

console.log("\nPhase221-1：判定基準は日本標準時（Asia/Tokyo）であること");

check("COUNCIL_SESSION_TIME_ZONEはAsia/Tokyo（延岡市議会の日程はすべて日本時間で公表されるため）", () => {
  assert.equal(COUNCIL_SESSION_TIME_ZONE, "Asia/Tokyo");
});

check("UTCで日付が変わる前後（15:00Z）でも、日本時間の暦日は正しく翌日になる", () => {
  // 2026-09-07T14:59:59Z = 2026-09-07 23:59:59 JST
  assert.equal(dateStringInTimeZone(new Date("2026-09-07T14:59:59Z")), "2026-09-07");
  // 2026-09-07T15:00:00Z = 2026-09-08 00:00:00 JST
  assert.equal(dateStringInTimeZone(new Date("2026-09-07T15:00:00Z")), "2026-09-08");
});

check("閲覧端末の時間帯がUTC・米国西海岸でも、同じ瞬間なら同じ日本時間の日付になる（端末設定に依存しない）", () => {
  const instant = new Date("2026-09-07T16:30:00Z");
  const jst = dateStringInTimeZone(instant, "Asia/Tokyo");
  assert.equal(jst, "2026-09-08");
  // 同じ瞬間でも、端末の時間帯をそのまま使うと9月7日になってしまう（＝日本時間へ揃える必要がある）
  assert.equal(dateStringInTimeZone(instant, "UTC"), "2026-09-07");
  assert.equal(dateStringInTimeZone(instant, "America/Los_Angeles"), "2026-09-07");
});

check("年またぎ・月またぎでも日本時間の暦日を正しく返す", () => {
  assert.equal(dateStringInTimeZone(new Date("2026-12-31T14:59:00Z")), "2026-12-31");
  assert.equal(dateStringInTimeZone(new Date("2026-12-31T15:00:00Z")), "2027-01-01");
  assert.equal(dateStringInTimeZone(new Date("2026-08-31T15:00:00Z")), "2026-09-01");
});

console.log("\nPhase221-2：境界値（開始日前日／開始当日／会期中／終了日／終了翌日）");

// 実データ（令和8年9月定例会）と同じ日程の会期を使う。日付は境界値の検査用に列挙する。
const upcomingSession = {
  phase: "upcoming",
  firstQuestionDate: "2026-09-08",
  lastQuestionDate: "2026-09-10",
};

const BOUNDARY_CASES = [
  { today: "2026-09-07", expected: "upcoming", note: "開始日の前日" },
  { today: "2026-09-08", expected: "ongoing", note: "開始当日" },
  { today: "2026-09-09", expected: "ongoing", note: "会期中" },
  { today: "2026-09-10", expected: "ongoing", note: "終了日（当日は開催中のまま）" },
  { today: "2026-09-11", expected: "awaiting-results", note: "終了日の翌日" },
];

for (const { today, expected, note } of BOUNDARY_CASES) {
  check(`${note}（日本標準時 ${today}）は "${expected}"`, () => {
    assert.equal(councilSessionScheduleState(upcomingSession, today), expected);
  });
}

check("境界値5件で、市民向けラベルが「開催予定」→「開催中」→「一般質問終了・結果確認中」と切り替わる", () => {
  const labels = BOUNDARY_CASES.map(({ today }) => councilSessionScheduleInfo(upcomingSession, today).label);
  assert.deepEqual(labels, ["開催予定", "開催中", "開催中", "開催中", "一般質問終了・結果確認中"]);
});

check("会期の開会日・閉会日を公式資料で確認できている場合は、そちらを優先して判定する", () => {
  const withSessionPeriod = { ...upcomingSession, startDate: "2026-09-01", endDate: "2026-09-25" };
  const period = resolveCouncilSessionSchedulePeriod(withSessionPeriod);
  assert.equal(period.basis, "session-period");
  assert.equal(period.from, "2026-09-01");
  assert.equal(period.to, "2026-09-25");
  // 一般質問の予定日より前でも、会期そのものは既に始まっている
  assert.equal(councilSessionScheduleState(withSessionPeriod, "2026-08-31"), "upcoming");
  assert.equal(councilSessionScheduleState(withSessionPeriod, "2026-09-01"), "ongoing");
  assert.equal(councilSessionScheduleState(withSessionPeriod, "2026-09-05"), "ongoing");
  assert.equal(councilSessionScheduleState(withSessionPeriod, "2026-09-25"), "ongoing");
  assert.equal(councilSessionScheduleState(withSessionPeriod, "2026-09-26"), "awaiting-results");
  // 会期の日程で判定できる場合は「開催済み・結果確認中」と言い切れる
  assert.equal(councilSessionScheduleStateLabel("awaiting-results", "session-period"), "開催済み・結果確認中");
});

check("一般質問の予定日しか確認できていない場合、閉会日を推測せず「一般質問終了・結果確認中」と表示する", () => {
  const info = councilSessionScheduleInfo(upcomingSession, "2026-09-11");
  assert.equal(info.basis, "question-dates");
  assert.equal(info.label, "一般質問終了・結果確認中");
  assert.match(info.description, /会期そのものの開会日・閉会日は、公式資料でまだ確認できていません。/);
});

check("質問予定日が1日だけの会期でも、当日は開催中・翌日は結果確認中になる", () => {
  const oneDay = { phase: "upcoming", firstQuestionDate: "2026-09-08" };
  assert.equal(councilSessionScheduleState(oneDay, "2026-09-07"), "upcoming");
  assert.equal(councilSessionScheduleState(oneDay, "2026-09-08"), "ongoing");
  assert.equal(councilSessionScheduleState(oneDay, "2026-09-09"), "awaiting-results");
});

console.log("\nPhase221-3：プリレンダリング（サーバー生成HTML）との整合");

check("today=null（サーバー生成HTML・JavaScript無効時）は、日程を持っていても必ず\"pending\"（ビルド日時の状態を焼き付けない）", () => {
  assert.equal(councilSessionScheduleState(upcomingSession, null), "pending");
  const withSessionPeriod = { ...upcomingSession, startDate: "2026-09-01", endDate: "2026-09-25" };
  assert.equal(councilSessionScheduleState(withSessionPeriod, null), "pending");
});

check("\"pending\"のラベルは、どれか1つの状態へ断定しない表記（開催予定または開催中）である", () => {
  const label = councilSessionScheduleStateLabel("pending", "question-dates");
  assert.equal(label, "開催予定または開催中");
  // 「開催中」等の単一状態と同じ文字列になっていない（＝断定していない）
  for (const state of ["upcoming", "ongoing", "awaiting-results", "completed"]) {
    assert.notEqual(label, councilSessionScheduleStateLabel(state, "question-dates"));
  }
});

check("today=nullのときの説明文は、日付に依存した断定を含まず、判定がご覧の端末の日付で行われることを伝える", () => {
  const info = councilSessionScheduleInfo(upcomingSession, null);
  assert.match(info.description, /ご覧の端末の日付（日本標準時）で判定します。/);
  assert.doesNotMatch(info.description, /時点の状態です。/);
});

check("today=nullでも、日程そのもの（実データ）はHTMLへ出せる（市民が自分で判断できる情報は落とさない）", () => {
  const info = councilSessionScheduleInfo(upcomingSession, null);
  assert.equal(info.periodText, "2026年9月8日〜2026年9月10日");
});

check("収録対象として登録済みの会期（phase=completed）は日付に依存せず、today有無にかかわらず「開催済み」", () => {
  const completed = { phase: "completed", firstQuestionDate: "2026-06-23", lastQuestionDate: "2026-06-25" };
  assert.equal(councilSessionScheduleState(completed, null), "completed");
  assert.equal(councilSessionScheduleState(completed, "2026-06-01"), "completed");
  assert.equal(councilSessionScheduleState(completed, "2030-01-01"), "completed");
  assert.equal(councilSessionScheduleInfo(completed, null).label, "開催済み");
});

check("日程を1日も確認できていない会期は、推測で開催予定・開催中に分類せず「日程未確認」にする", () => {
  const noDates = { phase: "upcoming" };
  assert.equal(resolveCouncilSessionSchedulePeriod(noDates), null);
  assert.equal(councilSessionScheduleState(noDates, "2026-09-05"), "schedule-unconfirmed");
  assert.equal(councilSessionScheduleInfo(noDates, "2026-09-05").label, "日程未確認");
});

console.log("\nPhase221-4：質問日の見出し語（予定日と実施済みの日を取り違えない）");

check("会議録確認済みの会期（completed）の質問日には「質問予定日」を付けない", () => {
  assert.equal(questionDateLabelPrefix("completed", "2025-09-10", "2026-09-05"), "");
  assert.equal(questionDateLabelPrefix("completed", "2025-09-10", null), "");
});

check("未確認の会期の質問日は、当日までは「質問予定日」・翌日以降は付けない", () => {
  assert.equal(questionDateLabelPrefix("upcoming", "2026-09-08", "2026-09-07"), "質問予定日 ");
  assert.equal(questionDateLabelPrefix("upcoming", "2026-09-08", "2026-09-08"), "質問予定日 ");
  assert.equal(questionDateLabelPrefix("upcoming", "2026-09-08", "2026-09-09"), "");
});

check("today=null（サーバー生成HTML）では、質問通告書ベースであることが分かる「質問予定日」表記を保つ", () => {
  assert.equal(questionDateLabelPrefix("upcoming", "2026-09-08", null), "質問予定日 ");
});

console.log("\nPhase221-5：実データでの整合（ページ間で会期の状態が食い違わないこと）");

const generalQuestions = readJson("src/data/generalQuestions.json");
const questionCollectionStatus = readJson("src/data/questionCollectionStatus.json");
const registeredSessionIds = new Set(questionCollectionStatus.sessions.map((s) => s.sessionId));

/** 会期名から会期ID（例："令和8年9月定例会" → "2026-09"）。councilSessions.tsと同じ規則。 */
function sessionIdFromName(sessionName) {
  const m = sessionName.match(/^令和(\d+)年(\d{1,2})月(定例会|臨時会)$/);
  if (!m) return null;
  return `${2019 + Number(m[1]) - 1}-${String(Number(m[2])).padStart(2, "0")}${m[3] === "臨時会" ? "-extraordinary" : ""}`;
}

/** 実データから、会期ごとの判定入力（データ上の状態＋一般質問の予定日の範囲）を作る。 */
function scheduleInputsFromData() {
  const bySession = new Map();
  for (const q of generalQuestions) {
    const sessionId = sessionIdFromName(q.sessionName);
    let entry = bySession.get(q.sessionName);
    if (!entry) {
      entry = {
        sessionName: q.sessionName,
        phase: sessionId !== null && registeredSessionIds.has(sessionId) ? "completed" : "upcoming",
      };
      bySession.set(q.sessionName, entry);
    }
    if (!q.questionDate) continue;
    if (!entry.firstQuestionDate || q.questionDate < entry.firstQuestionDate) entry.firstQuestionDate = q.questionDate;
    if (!entry.lastQuestionDate || q.questionDate > entry.lastQuestionDate) entry.lastQuestionDate = q.questionDate;
  }
  return [...bySession.values()];
}

const dataSessions = scheduleInputsFromData();

check(`generalQuestions.jsonの全会期（${dataSessions.length}会期）が、日程または収録状況から状態を判定できる（「日程未確認」が0件）`, () => {
  const unconfirmed = dataSessions.filter(
    (s) => councilSessionScheduleState(s, "2026-09-05") === "schedule-unconfirmed",
  );
  assert.equal(unconfirmed.length, 0, `日程を確認できない会期: ${unconfirmed.map((s) => s.sessionName).join("、")}`);
});

check("実データの全会期について、同じ日付を与えれば必ず同じ状態になる（ページごとに別の判定をしていない）", () => {
  for (const session of dataSessions) {
    for (const today of ["2026-09-05", "2026-09-08", "2026-09-11", null]) {
      const first = councilSessionScheduleState(session, today);
      const second = councilSessionScheduleState({ ...session }, today);
      assert.equal(first, second, `${session.sessionName}（${today ?? "日付未確定"}）で判定が揺れています`);
    }
  }
});

check("実データの全会期は、today=nullのとき「開催済み」か「開催予定または開催中」のどちらかにしかならない（サーバー生成HTMLに日付依存の断定が入らない）", () => {
  const allowed = new Set(["開催済み", "開催予定または開催中"]);
  for (const session of dataSessions) {
    const label = councilSessionScheduleInfo(session, null).label;
    assert.ok(allowed.has(label), `${session.sessionName}のサーバー生成時ラベルが想定外です: ${label}`);
  }
});

check("収録対象へ未登録の会期は、一般質問の予定日を基準に判定している（会期の開会日・閉会日を推測していない）", () => {
  const upcoming = dataSessions.filter((s) => s.phase === "upcoming");
  assert.ok(upcoming.length > 0, "収録対象へ未登録の会期が実データに存在しません");
  for (const session of upcoming) {
    const period = resolveCouncilSessionSchedulePeriod(session);
    assert.ok(period, `${session.sessionName}の日程を解決できません`);
    assert.equal(period.basis, "question-dates", `${session.sessionName}の判定基準が想定外です`);
    assert.ok(
      generalQuestions.some((q) => q.sessionName === session.sessionName && q.questionDate === period.from),
      `${session.sessionName}の開始日${period.from}がgeneralQuestions.jsonの実値ではありません`,
    );
    assert.ok(
      generalQuestions.some((q) => q.sessionName === session.sessionName && q.questionDate === period.to),
      `${session.sessionName}の終了日${period.to}がgeneralQuestions.jsonの実値ではありません`,
    );
  }
});

check("収録対象へ未登録の会期は、日付を進めていくと 開催予定 → 開催中 → 結果確認中 の順に一度ずつ遷移する（逆行・重複がない）", () => {
  for (const session of dataSessions.filter((s) => s.phase === "upcoming")) {
    const period = resolveCouncilSessionSchedulePeriod(session);
    const day = (iso, offset) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    const sequence = [
      councilSessionScheduleState(session, day(period.from, -1)),
      councilSessionScheduleState(session, period.from),
      councilSessionScheduleState(session, period.to),
      councilSessionScheduleState(session, day(period.to, 1)),
    ];
    assert.deepEqual(
      sequence,
      ["upcoming", "ongoing", "ongoing", "awaiting-results"],
      `${session.sessionName}の状態遷移が想定外です: ${sequence.join(" → ")}`,
    );
  }
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
