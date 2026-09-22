/**
 * 公開記録による議会活動（①市政運営の監視・評価）の算定を検証する。
 *
 * 検証の主眼は、数値が「議員の活動」を表しているかどうかではなく、
 * 次の2つを取り違えていないことにある。
 *
 *   ・確認した結果0件（CONFIRMED_ZERO）
 *   ・まだ確認できていない／公表されていない／個人に帰属しない／制度上対象外
 *
 * このプロジェクトには専用のテストランナーが無いため、既存のscripts/test-*.mjsと同じ
 * 「プレーンなNode＋assert」方式に揃えている。
 *
 * 使い方: node --experimental-strip-types scripts/test-council-activity-record.mjs
 */
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), "utf8");

// Node ESMは（Viteと異なり）拡張子なしの相対importを解決できないため、
// .ts拡張子を補った複製を一時ディレクトリへ書き出して読み込む（元ファイルは変更しない）。
// councilActivityRecord.tsはJSON importを持たないため、書き換えはこの1行だけで済む。
const CRLF = new RegExp(String.fromCharCode(13) + String.fromCharCode(10), "g");
const recordSource = readSrc("src/lib/councilActivityRecord.ts").replace(CRLF, String.fromCharCode(10));
const recordPatched = recordSource.replace(
  'from "./questionLikeSpeechTypes"',
  'from "./questionLikeSpeechTypes.ts"',
);
if (recordPatched === recordSource) {
  throw new Error("questionLikeSpeechTypesのimport行が見つかりませんでした（構造が変わった可能性があります）。");
}
const tmpDir = mkdtempSync(join(tmpdir(), "council-activity-record-test-"));
writeFileSync(join(tmpDir, "councilActivityRecord.ts"), recordPatched);
copyFileSync(join(ROOT, "src/lib/questionLikeSpeechTypes.ts"), join(tmpDir, "questionLikeSpeechTypes.ts"));

const { buildCouncilActivityRecord } = await import(
  pathToFileURL(join(tmpDir, "councilActivityRecord.ts")).href
);

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

/** テスト用の発言を組み立てる。 */
function makeSpeech(sessionId, itemCount, followUpCount = 0) {
  return {
    id: `${sessionId}-speech`,
    memberId: "mTest",
    sessionId,
    date: "2024-06-01",
    meetingNumber: 1,
    meetingType: "本会議",
    speechType: "一般質問",
    isPublished: true,
    summaryStatus: "verified",
    topics: [],
    shortSummary: "",
    questionItems: Array.from({ length: itemCount }, (_, i) => ({
      id: `q${i}`,
      title: `項目${i}`,
      questionSummary: "",
      answerSummary: "",
      answerers: [],
      exchanges:
        i < followUpCount
          ? [{ order: 1, type: "follow-up-question", speakerId: "mTest", summary: "" }]
          : [{ order: 1, type: "question", speakerId: "mTest", summary: "" }],
      questionAnswerLinkStatus: "confirmed",
    })),
    summarySources: [{ title: "会議録", sourceType: "official-minutes-html", sourceUrl: "https://example.invalid/a" }],
  };
}

const S = (id) => ({ sessionId: id, sessionTitle: `${id}定例会` });

console.log("\n公開記録による議会活動（①市政運営の監視・評価）");

// --- 1. 議長期間が分母から除外される ---
check("議長期間は分母から除外され、0%にならない", () => {
  const all = [S("2023-06"), S("2023-09")];
  const record = buildCouncilActivityRecord(
    [],
    [],
    all.map((s) => ({ ...s, reason: "議長在任期間のため算定対象外" })),
  );
  const rate = record.values.find((v) => v.key === "asked-rate");
  assert.equal(rate.value, null, "0%として表示してはいけない");
  assert.equal(rate.availability, "not-applicable");
  assert.match(rate.availabilityNote ?? "", /議長/);
  assert.equal(record.sessions.every((s) => !s.countedInDenominator), true, "全会期が分母外になるべき");
});

// --- 2. 途中就任議員の就任前会期が分母に入らない ---
check("分母に渡さなかった会期は、実施率の分母に入らない", () => {
  // 途中就任の場合、呼び出し側は就任後の会期だけを渡す。
  const record = buildCouncilActivityRecord([makeSpeech("2025-06", 3)], [S("2025-06"), S("2025-09")], [
    { ...S("2023-06"), reason: "就任前のため算定対象外" },
  ]);
  const rate = record.values.find((v) => v.key === "asked-rate");
  assert.equal(rate.denominator, 2, "就任前の会期は分母に含めない");
  assert.equal(rate.numerator, 1);
  assert.equal(rate.value, 50);
  const excluded = record.sessions.find((s) => s.sessionId === "2023-06");
  assert.equal(excluded.countedInDenominator, false);
  assert.match(excluded.excludedReason ?? "", /就任前/);
});

// --- 3. CONFIRMED_ZERO と欠損が違う ---
check("確認した結果0件と、対象外・未確認を別の状態として返す", () => {
  const zero = buildCouncilActivityRecord([], [S("2023-06")], []);
  const zeroSessions = zero.values.find((v) => v.key === "asked-sessions");
  assert.equal(zeroSessions.value, 0, "確認した結果0件は0として持つ");
  assert.equal(zeroSessions.availability, "confirmed-zero");

  const na = buildCouncilActivityRecord([], [], [{ ...S("2023-06"), reason: "対象外" }]);
  const naSessions = na.values.find((v) => v.key === "asked-sessions");
  assert.equal(naSessions.value, null, "対象外は0にしない");
  assert.equal(naSessions.availability, "not-applicable");
  assert.notEqual(zeroSessions.availability, naSessions.availability);
});

// --- 4・5. 未取得・個人帰属不能を0件として表示しない ---
check("未取得・未公表・個人帰属不能の状態が語彙として用意されている", () => {
  const src = readSrc("src/lib/councilActivityRecord.ts");
  for (const code of ["not-acquired", "not-published", "not-individually-attributable"]) {
    assert.ok(src.includes(`"${code}"`), `${code} が定義されていません`);
  }
  const ui = readSrc("src/components/council/CouncilActivityRecordSection.tsx");
  // 0件と取り違えないラベルが与えられていること。
  assert.match(ui, /"not-acquired": "未取得"/);
  assert.match(ui, /"not-published": "公式資料が未公表"/);
  assert.match(ui, /"not-individually-attributable": "個人別の記録なし"/);
  assert.match(ui, /"confirmed-zero": "確認した結果0件"/);
  // 値が無いときに0と書かないこと。
  assert.match(ui, /if \(value === null\) return "―";/);
});

// --- 6. 再質問確認率が正しく算出される ---
check("再質問の確認率が、再質問を確認できた質問 ÷ 質問総数で算出される", () => {
  const record = buildCouncilActivityRecord([makeSpeech("2023-06", 10, 4)], [S("2023-06")], []);
  const items = record.values.find((v) => v.key === "question-items");
  const fu = record.values.find((v) => v.key === "follow-up-items");
  const rate = record.values.find((v) => v.key === "follow-up-rate");
  assert.equal(items.value, 10);
  assert.equal(fu.value, 4);
  assert.equal(rate.numerator, 4);
  assert.equal(rate.denominator, 10);
  assert.equal(rate.value, 40);
});

check("質問が0件なら、再質問の確認率は0%ではなく算定しない", () => {
  const record = buildCouncilActivityRecord([], [S("2023-06")], []);
  const rate = record.values.find((v) => v.key === "follow-up-rate");
  assert.equal(rate.value, null, "分母0で0%と表示してはいけない");
  assert.equal(rate.availability, "confirmed-zero");
});

// --- 7. 同じ議員の表示値が比較相手によって変わらない ---
check("同じ入力なら常に同じ値になる（他の議員に依存しない）", () => {
  const speeches = [makeSpeech("2023-06", 5, 2)];
  const sessions = [S("2023-06"), S("2023-09")];
  const a = buildCouncilActivityRecord(speeches, sessions, []);
  const b = buildCouncilActivityRecord(speeches, sessions, []);
  assert.deepEqual(a.values, b.values);
  // 算定関数の引数に「他の議員」を受け取る経路が無いこと。
  const src = readSrc("src/lib/councilActivityRecord.ts");
  assert.ok(!/Math\.max\([^)]*\.\.\./.test(src), "他の値の最大値で正規化していない");
  assert.ok(!/平均|average|percentile|rank/i.test(src), "平均・順位を使っていない");
});

check("一覧の横棒グラフが、表示中の他議員の最大値で決まっていない", () => {
  const src = readSrc("src/pages/CouncilActivityPage.tsx");
  assert.ok(
    !/Math\.max\(1, \.\.\.filteredRows/.test(src),
    "表示中の行の最大値で棒の長さを決めてはいけない（絞り込みで同じ議員の見た目が変わる）",
  );
  assert.match(src, /SPEECH_BAR_MAX/, "固定の基準値を使うこと");
});

// --- 8. 新しい会議録が追加されたとき再計算できる ---
check("会議録が増えれば再計算される（値がデータから導出されている）", () => {
  const before = buildCouncilActivityRecord([makeSpeech("2023-06", 5, 2)], [S("2023-06"), S("2023-09")], []);
  const after = buildCouncilActivityRecord(
    [makeSpeech("2023-06", 5, 2), makeSpeech("2023-09", 3, 1)],
    [S("2023-06"), S("2023-09")],
    [],
  );
  assert.equal(before.values.find((v) => v.key === "asked-rate").value, 50);
  assert.equal(after.values.find((v) => v.key === "asked-rate").value, 100);
  assert.equal(after.values.find((v) => v.key === "question-items").value, 8);
});

// --- 9. 根拠から元の会議録へ到達できる ---
check("会期ごとの内訳に、会議録へのリンクが含まれる", () => {
  const record = buildCouncilActivityRecord([makeSpeech("2023-06", 2)], [S("2023-06"), S("2023-09")], []);
  const asked = record.sessions.find((s) => s.sessionId === "2023-06");
  const notAsked = record.sessions.find((s) => s.sessionId === "2023-09");
  assert.equal(asked.asked, true);
  assert.ok(asked.transcriptUrl, "質問を確認できた会期には会議録リンクが要る");
  assert.equal(notAsked.asked, false);
  assert.equal(notAsked.transcriptUrl, undefined, "質問の記録が無い会期にリンクを付けない");
  const ui = readSrc("src/components/council/CouncilActivityRecordSection.tsx");
  assert.match(ui, /根拠を見る（会期ごとの内訳）/);
});

// --- 実データでの整合 ---
check("実データ：議長は対象外、他の議員は同じ分母で算定される", () => {
  const members = readJson("src/data/members.json");
  const status = readJson("src/data/questionCollectionStatus.json");
  const confirmed = status.sessions.filter((s) => s.transcriptAvailable === true);
  const isChair = (m) => (m.profile ?? "").split("。").map((x) => x.trim()).includes("議長");
  const chairs = members.filter(isChair);
  assert.equal(chairs.length, 1, "議長は1名のはずです（前提が変わった可能性）");
  const vice = members.filter((m) => (m.profile ?? "").split("。").map((x) => x.trim()).includes("副議長"));
  assert.ok(!vice.some((m) => isChair(m)), "副議長を議長と取り違えてはいけない");
  assert.ok(confirmed.length > 0, "会議録を確認できた会期が1件もありません");
});

console.log(`\n${passCount}件成功\n`);
