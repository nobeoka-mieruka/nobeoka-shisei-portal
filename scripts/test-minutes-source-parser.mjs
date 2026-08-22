/**
 * scripts/lib/minutes-source.mjs の回帰テスト＋平成対応の検証スクリプト（Phase56）。
 *
 * 目的：
 * 1. 令和対応の既存パターンが、平成対応パッチ実装の前後で完全に同じ結果を返すことを確認する
 *    （REIWA_BEFORE_SNAPSHOTは、パッチ実装前のコードを実際に呼び出して得た結果をそのまま
 *    埋め込んだfixtureである。生成手順は本ファイル末尾のコメント参照）。
 * 2. 平成年代（2013年度＝平成25年、2005年度＝平成17年、2000年＝平成12年、2018年＝平成30年の
 *    元号境界年）が正しく年度・会期・日付を解決できることを確認する。
 * 3. fileNameToIsoDate・classifySpeakerLabelの純粋関数部分は、ネットワーク不要なユニット
 *    テストとして確認する。
 *
 * 注意：resolveYearTreedepth / listSessionsForYear は実際に
 * https://www.kensakusystem.jp/nobeoka/ へアクセスする（scripts/.cache/minutes/ に
 * キャッシュ済みであればキャッシュを使うため実ネットワークアクセスは発生しない）。
 * 初回実行時や、キャッシュが存在しない環境では実アクセスが発生する点に留意すること
 * （本番運用中の令和データ取得と同じ仕組み・同じ礼儀正しいレート制御を使う）。
 *
 * 実行方法： node scripts/test-minutes-source-parser.mjs
 */
import assert from "node:assert/strict";
import {
  resolveYearTreedepth,
  listSessionsForYear,
  fileNameToIsoDate,
  classifySpeakerLabel,
} from "./lib/minutes-source.mjs";

const CODE = "48o046ot0cia1xvtw7";

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  OK  ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e });
    console.error(`  NG  ${name}`);
    console.error(`      ${e.message}`);
  }
}

// ============================================================
// 1. 令和の回帰テスト用fixture（平成対応パッチ実装前に、変更前のコードを実際に
//    呼び出して記録した結果。生成手順は本ファイル末尾を参照）。
// ============================================================
const REIWA_BEFORE_SNAPSHOT = {
  resolveYearTreedepth: {
    2019: "令和元年",
    2020: "令和 2年",
    2021: "令和 3年",
    2022: "令和 4年",
    2023: "令和 5年",
    2024: "令和 6年",
    2025: "令和 7年",
    2026: "令和 8年",
  },
  listSessionsForYear: {
    2019: [
      { treedepth: "令和元年 第 1回臨時会 ", label: "令和元年 第 1回臨時会" },
      { treedepth: "令和元年 第 2回定例会 ", label: "令和元年 第 2回定例会" },
      { treedepth: "令和元年 第 3回定例会 ", label: "令和元年 第 3回定例会" },
      { treedepth: "令和元年 第 4回臨時会 ", label: "令和元年 第 4回臨時会" },
      { treedepth: "令和元年 第 5回定例会 ", label: "令和元年 第 5回定例会" },
    ],
    2020: [
      { treedepth: "令和 2年 第 6回定例会 ", label: "令和 2年 第 6回定例会" },
      { treedepth: "令和 2年 第 7回臨時会 ", label: "令和 2年 第 7回臨時会" },
      { treedepth: "令和 2年 第 8回定例会 ", label: "令和 2年 第 8回定例会" },
      { treedepth: "令和 2年 第 9回定例会 ", label: "令和 2年 第 9回定例会" },
      {
        treedepth: "令和 2年 第10回定例会 ",
        label: "令和 2年 第10回定例会",
        sessionNumber: "第10回",
        sessionType: "定例会",
      },
    ],
    2021: [
      { treedepth: "令和 3年 第11回臨時会 ", label: "令和 3年 第11回臨時会", sessionNumber: "第11回", sessionType: "臨時会" },
      { treedepth: "令和 3年 第12回定例会 ", label: "令和 3年 第12回定例会", sessionNumber: "第12回", sessionType: "定例会" },
      { treedepth: "令和 3年 第13回臨時会 ", label: "令和 3年 第13回臨時会", sessionNumber: "第13回", sessionType: "臨時会" },
      { treedepth: "令和 3年 第14回臨時会 ", label: "令和 3年 第14回臨時会", sessionNumber: "第14回", sessionType: "臨時会" },
      { treedepth: "令和 3年 第15回定例会 ", label: "令和 3年 第15回定例会", sessionNumber: "第15回", sessionType: "定例会" },
      { treedepth: "令和 3年 第16回定例会 ", label: "令和 3年 第16回定例会", sessionNumber: "第16回", sessionType: "定例会" },
      { treedepth: "令和 3年 第17回定例会 ", label: "令和 3年 第17回定例会", sessionNumber: "第17回", sessionType: "定例会" },
      { treedepth: "令和 3年 第18回臨時会 ", label: "令和 3年 第18回臨時会", sessionNumber: "第18回", sessionType: "臨時会" },
    ],
    2022: [
      { treedepth: "令和 4年 第19回臨時会 ", label: "令和 4年 第19回臨時会", sessionNumber: "第19回", sessionType: "臨時会" },
      { treedepth: "令和 4年 第20回臨時会 ", label: "令和 4年 第20回臨時会", sessionNumber: "第20回", sessionType: "臨時会" },
      { treedepth: "令和 4年 第21回定例会 ", label: "令和 4年 第21回定例会", sessionNumber: "第21回", sessionType: "定例会" },
      { treedepth: "令和 4年 第22回臨時会 ", label: "令和 4年 第22回臨時会", sessionNumber: "第22回", sessionType: "臨時会" },
      { treedepth: "令和 4年 第23回臨時会 ", label: "令和 4年 第23回臨時会", sessionNumber: "第23回", sessionType: "臨時会" },
      { treedepth: "令和 4年 第24回定例会 ", label: "令和 4年 第24回定例会", sessionNumber: "第24回", sessionType: "定例会" },
      { treedepth: "令和 4年 第25回臨時会 ", label: "令和 4年 第25回臨時会", sessionNumber: "第25回", sessionType: "臨時会" },
      { treedepth: "令和 4年 第26回定例会 ", label: "令和 4年 第26回定例会", sessionNumber: "第26回", sessionType: "定例会" },
      { treedepth: "令和 4年 第27回臨時会 ", label: "令和 4年 第27回臨時会", sessionNumber: "第27回", sessionType: "臨時会" },
      { treedepth: "令和 4年 第28回定例会 ", label: "令和 4年 第28回定例会", sessionNumber: "第28回", sessionType: "定例会" },
    ],
    2023: [
      { treedepth: "令和 5年 第29回定例会 ", label: "令和 5年 第29回定例会", sessionNumber: "第29回", sessionType: "定例会" },
      { treedepth: "令和 5年 第30回臨時会 ", label: "令和 5年 第30回臨時会", sessionNumber: "第30回", sessionType: "臨時会" },
      { treedepth: "令和 5年 第 1回臨時会 ", label: "令和 5年 第 1回臨時会" },
      { treedepth: "令和 5年 第 2回臨時会 ", label: "令和 5年 第 2回臨時会" },
      { treedepth: "令和 5年 第 3回定例会 ", label: "令和 5年 第 3回定例会" },
      { treedepth: "令和 5年 第 4回臨時会 ", label: "令和 5年 第 4回臨時会" },
      { treedepth: "令和 5年 第 5回臨時会 ", label: "令和 5年 第 5回臨時会" },
      { treedepth: "令和 5年 第 6回臨時会 ", label: "令和 5年 第 6回臨時会" },
      { treedepth: "令和 5年 第 7回定例会 ", label: "令和 5年 第 7回定例会" },
      { treedepth: "令和 5年 第 8回定例会 ", label: "令和 5年 第 8回定例会" },
    ],
    2024: [
      { treedepth: "令和 6年 第 9回定例会 ", label: "令和 6年 第 9回定例会" },
      { treedepth: "令和 6年 第10回臨時会 ", label: "令和 6年 第10回臨時会", sessionNumber: "第10回", sessionType: "臨時会" },
      { treedepth: "令和 6年 第11回臨時会 ", label: "令和 6年 第11回臨時会", sessionNumber: "第11回", sessionType: "臨時会" },
      { treedepth: "令和 6年 第12回定例会 ", label: "令和 6年 第12回定例会", sessionNumber: "第12回", sessionType: "定例会" },
      { treedepth: "令和 6年 第13回定例会 ", label: "令和 6年 第13回定例会", sessionNumber: "第13回", sessionType: "定例会" },
      { treedepth: "令和 6年 第14回定例会 ", label: "令和 6年 第14回定例会", sessionNumber: "第14回", sessionType: "定例会" },
    ],
    2025: [
      { treedepth: "令和 7年 第15回臨時会 ", label: "令和 7年 第15回臨時会", sessionNumber: "第15回", sessionType: "臨時会" },
      { treedepth: "令和 7年 第16回定例会 ", label: "令和 7年 第16回定例会", sessionNumber: "第16回", sessionType: "定例会" },
      { treedepth: "令和 7年 第17回臨時会 ", label: "令和 7年 第17回臨時会", sessionNumber: "第17回", sessionType: "臨時会" },
      { treedepth: "令和 7年 第18回定例会 ", label: "令和 7年 第18回定例会", sessionNumber: "第18回", sessionType: "定例会" },
      { treedepth: "令和 7年 第19回臨時会 ", label: "令和 7年 第19回臨時会", sessionNumber: "第19回", sessionType: "臨時会" },
      { treedepth: "令和 7年 第20回臨時会 ", label: "令和 7年 第20回臨時会", sessionNumber: "第20回", sessionType: "臨時会" },
      { treedepth: "令和 7年 第21回定例会 ", label: "令和 7年 第21回定例会", sessionNumber: "第21回", sessionType: "定例会" },
      { treedepth: "令和 7年 第22回定例会 ", label: "令和 7年 第22回定例会", sessionNumber: "第22回", sessionType: "定例会" },
      { treedepth: "令和 7年 第23回臨時会 ", label: "令和 7年 第23回臨時会", sessionNumber: "第23回", sessionType: "臨時会" },
    ],
    2026: [
      { treedepth: "令和 8年 第24回定例会 ", label: "令和 8年 第24回定例会", sessionNumber: "第24回", sessionType: "定例会" },
    ],
  },
  fileNameToIsoDate: {
    R080216A: "2026-02-16",
    R010601A: "2019-06-01",
    R070101A: "2025-01-01",
    R061225A: "2024-12-25",
    R050423A: "2023-04-23",
  },
};

// ============================================================
// 2. 平成年代の期待値（Phase56で実際にcurlおよび本モジュールの関数を通して
//    確認した値。reports/phase56-parser-findings.md参照）。
// ============================================================
const HEISEI_EXPECTED = {
  resolveYearTreedepth: {
    2000: "平成12年", // See.exeの最古タブ（Phase39調査で確認済みの下限）
    2005: "平成17年",
    2013: "平成25年",
    2014: "平成26年",
    2018: "平成30年", // 平成→令和の元号境界年（令和元年と混同しないことを確認する）
  },
  sessionCount: {
    2000: 6,
    2005: 6,
    2013: 7,
    2014: 6,
    2018: 7,
  },
  // 平成25年第14回定例会・平成17年第16回定例会の本会議日一覧はPhase45-47で
  // listMeetingDays()により実データ確認済み（fileName: H250611A / H170914A 等）。
  // 本テストではfileNameToIsoDate()の変換のみを検証する（4節参照）。
};

// ============================================================
// 3. テスト本体
// ============================================================
console.log("=== Phase56 minutes-source.mjs パーサテスト ===\n");

console.log("[1] 令和 回帰テスト（変更前と完全一致することを確認）");
for (const [yearStr, expected] of Object.entries(REIWA_BEFORE_SNAPSHOT.resolveYearTreedepth)) {
  const year = Number(yearStr);
  await test(`resolveYearTreedepth({ year: ${year} }) === "${expected}"`, async () => {
    const actual = await resolveYearTreedepth({ code: CODE, year });
    assert.equal(actual, expected);
  });
}
for (const [yearStr, expected] of Object.entries(REIWA_BEFORE_SNAPSHOT.listSessionsForYear)) {
  const year = Number(yearStr);
  await test(`listSessionsForYear({ year: ${year} }) と fixtureが完全一致`, async () => {
    const actual = await listSessionsForYear({ code: CODE, year });
    // JSON往復で比較する：sessionNumber/sessionTypeが明示的にundefinedのキーと、
    // キー自体が存在しない場合をJSON.stringify基準（fixture生成時と同じ基準）で
    // 同一視するため（実質的な内容は完全一致、不一致は値の差異のみを検出する）。
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)));
  });
}
for (const [fileName, expected] of Object.entries(REIWA_BEFORE_SNAPSHOT.fileNameToIsoDate)) {
  await test(`fileNameToIsoDate("${fileName}") === "${expected}"`, () => {
    assert.equal(fileNameToIsoDate(fileName), expected);
  });
}

console.log("\n[2] 平成 新規対応テスト（2010年代・2000年代）");
for (const [yearStr, expected] of Object.entries(HEISEI_EXPECTED.resolveYearTreedepth)) {
  const year = Number(yearStr);
  await test(`resolveYearTreedepth({ year: ${year} }) === "${expected}"（平成）`, async () => {
    const actual = await resolveYearTreedepth({ code: CODE, year });
    assert.equal(actual, expected);
  });
}
for (const [yearStr, expectedCount] of Object.entries(HEISEI_EXPECTED.sessionCount)) {
  const year = Number(yearStr);
  await test(`listSessionsForYear({ year: ${year} }) の会期数 === ${expectedCount}`, async () => {
    const sessions = await listSessionsForYear({ code: CODE, year });
    assert.equal(sessions.length, expectedCount);
    for (const s of sessions) {
      assert.ok(s.label.includes(`平成${year - 1988}年`), `会期ラベルに元号年が含まれない: ${s.label}`);
    }
  });
}

console.log("\n[3] fileNameToIsoDate 平成プレフィックス（ネットワーク不要）");
await test('fileNameToIsoDate("H250611A") === "2013-06-11"（平成25年6月11日、Phase45-47実データ）', () => {
  assert.equal(fileNameToIsoDate("H250611A"), "2013-06-11");
});
await test('fileNameToIsoDate("H170914A") === "2005-09-14"（平成17年9月14日、Phase45-47実データ）', () => {
  assert.equal(fileNameToIsoDate("H170914A"), "2005-09-14");
});
await test('fileNameToIsoDate("H010101A") === "1989-01-01"（平成元年、境界値）', () => {
  assert.equal(fileNameToIsoDate("H010101A"), "1989-01-01");
});
await test('fileNameToIsoDate("R080216A") === "2026-02-16"（令和、既存動作の再確認）', () => {
  assert.equal(fileNameToIsoDate("R080216A"), "2026-02-16");
});
await test("fileNameToIsoDate(不正な形式) === undefined", () => {
  assert.equal(fileNameToIsoDate("X250611A"), undefined);
  assert.equal(fileNameToIsoDate("H25061"), undefined);
  assert.equal(fileNameToIsoDate(""), undefined);
});

console.log("\n[4] classifySpeakerLabel 「助役」対応（ネットワーク不要）");
await test('classifySpeakerLabel("助役（柳田喜継君）") → speakerType: "official", title: "助役"', () => {
  const result = classifySpeakerLabel("助役（柳田喜継君）");
  assert.equal(result.speakerType, "official");
  assert.equal(result.title, "助役");
});
await test('classifySpeakerLabel("市長（首藤正治君）") は従来どおり speakerType: "mayor"（既存動作の再確認）', () => {
  const result = classifySpeakerLabel("市長（首藤正治君）");
  assert.equal(result.speakerType, "mayor");
});
await test('classifySpeakerLabel("前田遼君") は従来どおり speakerType: "member"（既存動作の再確認）', () => {
  const result = classifySpeakerLabel("前田遼君");
  assert.equal(result.speakerType, "member");
});

console.log("\n[5] 元号境界の分岐確認（2018年=平成30年 と 2019年=令和元年 を混同しないこと）");
await test("resolveYearTreedepth(2018) と resolveYearTreedepth(2019) が異なる値を返す", async () => {
  const y2018 = await resolveYearTreedepth({ code: CODE, year: 2018 });
  const y2019 = await resolveYearTreedepth({ code: CODE, year: 2019 });
  assert.equal(y2018, "平成30年");
  assert.equal(y2019, "令和元年");
  assert.notEqual(y2018, y2019);
});

// ============================================================
// 結果サマリ
// ============================================================
console.log(`\n=== 結果: ${passed}件成功 / ${failed}件失敗（regression件数=${failed > 0 ? "要確認" : 0}） ===`);
if (failed > 0) {
  console.error("\n失敗したテスト:");
  for (const f of failures) console.error(`  - ${f.name}: ${f.error.message}`);
  process.exit(1);
}
process.exit(0);

/**
 * REIWA_BEFORE_SNAPSHOT の生成手順（記録用。平成対応パッチ実装前に1回だけ実行した）：
 *
 * 1. scripts/lib/minutes-source.mjs をパッチ実装前の状態（git HEAD）でチェックアウトする。
 * 2. 以下相当のスクリプトを実行し、resolveYearTreedepth({ year })（2019〜2026年）・
 *    listSessionsForYear({ year })（同）・fileNameToIsoDate(fileName)（R080216A等）の
 *    結果をJSON化して保存する（scripts/.cache/minutes/ の既存キャッシュを使うため、
 *    追加のネットワークアクセスは発生しなかった）。
 * 3. 上記JSONをそのまま本ファイルのREIWA_BEFORE_SNAPSHOTへ埋め込んだ。
 * 4. パッチ実装後に同じスクリプトを再実行し、diffが0であることを確認した
 *    （reports/phase56-parser-findings.md参照）。
 */
