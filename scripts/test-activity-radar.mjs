/**
 * src/lib/activityRadar.ts の計算関数に対する単体テスト。
 *
 * このプロジェクトには専用のテストランナー（vitest/jest等）が導入されていない
 * （package.jsonに"test"スクリプトが存在せず、テストファイルも他に存在しない）。
 * 新たに大きなテスト基盤を追加する代わりに、既存のvalidate-data.mjs等と同じ
 * 「プレーンなNodeスクリプト＋assert」方式を踏襲する。
 *
 * src/lib/activityRadar.ts はNode 24のネイティブTS型除去（--experimental-strip-types相当）で
 * そのまま実行できるが、JSON importの書式（Viteのバンドラ拡張構文）だけがNode ESM単体では
 * 解決できないため、テスト実行時のみその1行を`readFileSync`ベースの読み込みに置き換えた
 * 一時ファイルを生成してテストする（元のsrc/lib/activityRadar.tsは書き換えない）。
 *
 * 使い方: node scripts/test-activity-radar.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const srcPath = join(ROOT, "src/lib/activityRadar.ts");
// Windows環境（core.autocrlf等）でCRLFとしてチェックアウトされている場合でも、
// 以降のパターン一致（LF前提の複数行リテラル）が失敗しないよう改行をLFへ正規化する。
// 一時ファイルとして実行するだけの用途のため、元ファイルの改行コードには影響しない。
const source = readFileSync(srcPath, "utf8").replace(/\r\n/g, "\n");

const patched = source.replace(
  'import type { CouncilSpeech } from "../types";\nimport questionCollectionStatusData from "../data/questionCollectionStatus.json";',
  [
    'import { readFileSync as __readFileSync } from "node:fs";',
    "const questionCollectionStatusData = JSON.parse(",
    `  __readFileSync(${JSON.stringify(join(ROOT, "src/data/questionCollectionStatus.json"))}, "utf8"),`,
    ");",
  ].join("\n"),
);

if (patched === source) {
  throw new Error("パッチ対象の行が見つかりませんでした（src/lib/activityRadar.tsの構造が変わった可能性があります）。");
}

// Node ESMは（Viteと異なり）拡張子なしの相対importを解決できないため、明示的に.tsを付ける。
const patchedWithExtension = patched.replace(
  'from "./questionLikeSpeechTypes"',
  'from "./questionLikeSpeechTypes.ts"',
);
if (patchedWithExtension === patched) {
  throw new Error("questionLikeSpeechTypesのimport行が見つかりませんでした。");
}

const tmpDir = mkdtempSync(join(tmpdir(), "activity-radar-test-"));
// Node（v22.6+）はネイティブのTS型除去（strip-only）を.ts拡張子で自動認識するため、
// .tsのまま出力する（.mjsだと型構文がそのままJSとして評価されSyntaxErrorになる）。
const tmpFile = join(tmpDir, "activityRadar.ts");
writeFileSync(tmpFile, patchedWithExtension);

// activityRadar.tsが相対importする依存先（JSON importを含まない「葉」モジュールのみ）は、
// 同じ一時ディレクトリへそのまま複製する（このファイル自体は書き換え不要）。
writeFileSync(
  join(tmpDir, "questionLikeSpeechTypes.ts"),
  readFileSync(join(ROOT, "src/lib/questionLikeSpeechTypes.ts"), "utf8"),
);

const mod = await import(pathToFileURL(tmpFile));
const {
  calculateQuestionActivityIndex,
  calculateSpeechActivityIndex,
  calculateAttendanceIndex,
  calculateVotingDisclosureIndex,
  calculateProposalActivityIndex,
  calculateInformationDisclosureIndex,
  eligibleSessionIdsFor,
  allMetricsMissing,
  TRANSCRIPT_AVAILABLE_SESSION_IDS,
} = mod;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (e) {
    console.error(`  FAIL - ${name}`);
    console.error(`    ${e.message}`);
    process.exitCode = 1;
  }
}

function makeSpeech(sessionId, speechType, itemCount = 1, isPublished = true) {
  return {
    id: `${sessionId}-${speechType}`,
    memberId: "test",
    sessionId,
    date: `${sessionId}-01`,
    meetingType: "本会議",
    speechType,
    isPublished,
    summaryStatus: "verified",
    topics: [],
    questionItems: Array.from({ length: itemCount }, (_, i) => ({
      id: `q${i}`,
      title: "",
      questionSummary: "",
      answerSummary: "",
      exchanges: [],
      relatedBills: [],
      questionAnswerLinkStatus: "confirmed",
    })),
    summarySources: [],
  };
}

console.log("TRANSCRIPT_AVAILABLE_SESSION_IDS の確認");
test("会議録取得済みの会期が1件以上ある", () => {
  assert.ok(TRANSCRIPT_AVAILABLE_SESSION_IDS.length > 0);
});
test("会議録未公開の会期（2026-06）は含まれない", () => {
  assert.ok(!TRANSCRIPT_AVAILABLE_SESSION_IDS.includes("2026-06"));
});

console.log("\ncalculateQuestionActivityIndex");
test("対象会期が0件のとき missing・valueはnull（0除算しない）", () => {
  const m = calculateQuestionActivityIndex([], []);
  assert.equal(m.dataStatus, "missing");
  assert.equal(m.value, null);
});
test("全会期で質問していれば100（100を超えない）", () => {
  const eligible = ["2023-06", "2023-09", "2023-12"];
  const speeches = eligible.map((id) => makeSpeech(id, "一般質問"));
  const m = calculateQuestionActivityIndex(speeches, eligible);
  assert.equal(m.value, 100);
  assert.equal(m.numerator, 3);
  assert.equal(m.denominator, 3);
});
test("在職期間外（対象外会期）の発言は分子に数えない", () => {
  const eligible = ["2023-06"];
  // 2099-01は対象外会期のダミー発言（在職期間外の想定）。
  const speeches = [makeSpeech("2099-01", "一般質問")];
  const m = calculateQuestionActivityIndex(speeches, eligible);
  assert.equal(m.numerator, 0);
  assert.equal(m.value, 0);
  assert.ok(m.value >= 0 && m.value <= 100);
});
test("非公開（isPublished:false）の発言は数えない", () => {
  const eligible = ["2023-06"];
  const speeches = [makeSpeech("2023-06", "一般質問", 1, false)];
  const m = calculateQuestionActivityIndex(speeches, eligible);
  assert.equal(m.numerator, 0);
});
test("討論・動議等（質問系以外）は数えない", () => {
  const eligible = ["2023-06"];
  const speeches = [makeSpeech("2023-06", "討論")];
  const m = calculateQuestionActivityIndex(speeches, eligible);
  assert.equal(m.numerator, 0);
});
test("結合型speechType「総括質疑・一般質問」も数える", () => {
  const eligible = ["2023-06"];
  const speeches = [makeSpeech("2023-06", "総括質疑・一般質問")];
  const m = calculateQuestionActivityIndex(speeches, eligible);
  assert.equal(m.numerator, 1);
});

console.log("\ncalculateSpeechActivityIndex");
test("対象会期が0件のとき missing", () => {
  const m = calculateSpeechActivityIndex([], []);
  assert.equal(m.dataStatus, "missing");
  assert.equal(m.value, null);
});
test("100を超えない・NaNにならない（大量の質問項目でも頭打ち）", () => {
  const eligible = ["2023-06"];
  const speeches = [makeSpeech("2023-06", "一般質問", 500)];
  const m = calculateSpeechActivityIndex(speeches, eligible);
  assert.ok(Number.isFinite(m.value));
  assert.ok(m.value <= 100);
  assert.ok(m.value >= 0);
});
test("発言が全くなければ0以上100以下の値になる（NaNにならない）", () => {
  const eligible = ["2023-06", "2023-09"];
  const m = calculateSpeechActivityIndex([], eligible);
  assert.ok(Number.isFinite(m.value));
  assert.equal(m.value, 0);
});
test("回帰防止：eligibleSessionIds外の会期の発言も質問項目数（volumeComponent）に加算される（呼び出し側で" +
  "currentTermPublicSpeeches等により事前に絞り込む責任がある。旧任期発言を現職memberIdへ追加する場合、" +
  "この関数自身はterm:previousを判定しないため、フィルタせずに渡すと現任期指数が汚染される）", () => {
  const eligible = ["2023-06"];
  // 2019-03は対象外の会期（旧任期発言を想定）だが、この関数はeligibleSessionIdsに関わらず
  // questionItemsを合算する仕様であることを明示するテスト。
  const previousTermSpeech = makeSpeech("2019-03", "一般質問", 10);
  const withoutOldSpeech = calculateSpeechActivityIndex([], eligible);
  const withOldSpeech = calculateSpeechActivityIndex([previousTermSpeech], eligible);
  assert.equal(withoutOldSpeech.value, 0);
  assert.ok(
    withOldSpeech.value > withoutOldSpeech.value,
    "対象期間外の発言でもvalueが増加する（=呼び出し側のフィルタが必須であることの裏付け）",
  );
});

console.log("\ncalculateAttendanceIndex / calculateProposalActivityIndex");
test("出席状況は常にmissing（0点にしない）", () => {
  const m = calculateAttendanceIndex();
  assert.equal(m.value, null);
  assert.equal(m.dataStatus, "missing");
});
test("提案・討論等は常にmissing（0点にしない）", () => {
  const m = calculateProposalActivityIndex();
  assert.equal(m.value, null);
  assert.equal(m.dataStatus, "missing");
});

console.log("\ncalculateVotingDisclosureIndex");
test("対象議案が0件（サイト全体で議員別賛否データが未登録）のとき missing", () => {
  const m = calculateVotingDisclosureIndex(0, 0);
  assert.equal(m.value, null);
  assert.equal(m.dataStatus, "missing");
});
test("対象議案があり本人の賛否が全て確認できれば100（賛否の内容自体は評価しない設計）", () => {
  const m = calculateVotingDisclosureIndex(5, 5);
  assert.equal(m.value, 100);
});
test("負の値にならない・100を超えない", () => {
  const m = calculateVotingDisclosureIndex(3, 10);
  assert.ok(m.value >= 0 && m.value <= 100);
});

console.log("\ncalculateInformationDisclosureIndex");
test("チェックリストが空なら missing", () => {
  const m = calculateInformationDisclosureIndex([]);
  assert.equal(m.dataStatus, "missing");
  assert.equal(m.value, null);
});
test("全項目確認済みなら100・complete", () => {
  const m = calculateInformationDisclosureIndex([
    { label: "a", filled: true },
    { label: "b", filled: true },
  ]);
  assert.equal(m.value, 100);
  assert.equal(m.dataStatus, "complete");
});
test("一部のみ確認済みなら0〜100の間の値（項目自体は確認済みなのでcomplete）", () => {
  const m = calculateInformationDisclosureIndex([
    { label: "a", filled: true },
    { label: "b", filled: false },
  ]);
  assert.equal(m.value, 50);
  assert.equal(m.dataStatus, "complete");
  assert.ok(m.value > 0 && m.value < 100);
});
test("全項目未確認でも0点は「確認した結果0件」というcomplete扱い（missingにしない）", () => {
  const m = calculateInformationDisclosureIndex([{ label: "a", filled: false }]);
  assert.equal(m.value, 0);
  assert.equal(m.dataStatus, "complete");
});

console.log("\neligibleSessionIdsFor");
test("現職議員は会議録取得済みの全会期が対象", () => {
  const ids = eligibleSessionIdsFor({ isFormerMember: false });
  assert.deepEqual(ids, TRANSCRIPT_AVAILABLE_SESSION_IDS);
});
test("元議員はservedSessionsのうち会議録取得済みの会期のみが対象", () => {
  const ids = eligibleSessionIdsFor({ isFormerMember: true, servedSessions: ["2023-06", "2099-01"] });
  assert.deepEqual(ids, ["2023-06"]);
});
test("元議員でservedSessions未指定なら対象0件", () => {
  const ids = eligibleSessionIdsFor({ isFormerMember: true });
  assert.deepEqual(ids, []);
});

console.log("\nallMetricsMissing");
test("全指標がnullならtrue", () => {
  assert.equal(allMetricsMissing([calculateAttendanceIndex(), calculateProposalActivityIndex()]), true);
});
test("1つでも値があればfalse", () => {
  const withValue = calculateQuestionActivityIndex([makeSpeech("2023-06", "一般質問")], ["2023-06"]);
  assert.equal(allMetricsMissing([calculateAttendanceIndex(), withValue]), false);
});

console.log(`\n${passed}件成功`);
if (process.exitCode) {
  console.error("一部のテストが失敗しました。");
} else {
  console.log("すべてのテストが成功しました。");
}
