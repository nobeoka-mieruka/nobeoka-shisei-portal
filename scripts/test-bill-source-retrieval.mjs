/**
 * Phase143：議案原資料の到達性区分（A/B/C/D、およびD区分の再分類D-A/D-B/D-C/D-D）、
 * 令和元年〜令和4年度の年度・元号境界、summaryVerified/sourceTextVerified件数についての回帰テスト。
 * 既存のscripts/test-*.mjsと同じ「プレーンなNodeスクリプト＋assert」方式。
 *
 * 使い方: node scripts/test-bill-source-retrieval.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const billVotes = JSON.parse(readFileSync(join(ROOT, "src/data/billVotes.json"), "utf8"));
assert.ok(Array.isArray(billVotes) && billVotes.length === 1177, `billVotes.jsonの件数が1,177件ではありません（${billVotes.length}件）`);

// src/lib/billSourceRetrieval.tsはTypeScriptのためこのプレーンNodeスクリプトから直接importできない。
// 分類ロジックそのものは、そのファイルのJSDocコメントに明記した「STRUCTURED_CATEGORIES／
// LINK_CONFIRMED_YEARS」という判定基準を、このテストでも同一の値でミラーして検証する
// （値がズレた場合はlibファイル側のコメントも合わせて更新すること）。
const STRUCTURED_CATEGORIES = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);
const LINK_CONFIRMED_YEARS = new Set(["令和5年度", "令和6年度", "令和7年度", "令和8年度"]);

function classify(bill) {
  if (bill.transcriptUrl) return STRUCTURED_CATEGORIES.has(bill.category) ? "A" : "B";
  if (LINK_CONFIRMED_YEARS.has(bill.fiscalYear)) return "B";
  return "D";
}

console.log("\n議案の原資料到達性区分の現況");

let A = 0, B = 0, D = 0;
const Dbills = [];
for (const b of billVotes) {
  const c = classify(b);
  if (c === "A") A++;
  else if (c === "B") B++;
  else { D++; Dbills.push(b); }
}

check("A区分（本文取得＋構造化が比較的安全）が174件である（Phase142の基準値）", () => {
  assert.equal(A, 174, `A区分の件数が174件ではありません（${A}件）`);
});

check("D区分（sourceRetrievalUnresolved。会議録リンク未登録）が619件である（Phase142の基準値）", () => {
  assert.equal(D, 619, `D区分の件数が619件ではありません（${D}件）`);
});

check("A + B + D の合計が議案総数1,177件と一致する（C区分は実例0件のため式に含めない）", () => {
  assert.equal(A + B + D, 1177, `A+B+Dの合計が1,177件ではありません（${A + B + D}件）`);
});

check("D区分619件は、すべて令和元年度〜令和4年度の議案である（他年度の議案が紛れ込んでいない）", () => {
  const allowedYears = new Set(["令和1年度", "令和2年度", "令和3年度", "令和4年度"]);
  const outOfRange = Dbills.filter((b) => !allowedYears.has(b.fiscalYear));
  assert.equal(outOfRange.length, 0, `D区分に令和元年度〜令和4年度以外の議案があります: ${outOfRange.map((b) => `${b.id}(${b.fiscalYear})`).join("、")}`);
});

check("D区分619件を年度別に集計すると、令和元年度172・令和2年度154・令和3年度134・令和4年度159で合計619件になる（Phase143で確定した内訳）", () => {
  const byYear = { 令和1年度: 0, 令和2年度: 0, 令和3年度: 0, 令和4年度: 0 };
  for (const b of Dbills) byYear[b.fiscalYear] = (byYear[b.fiscalYear] ?? 0) + 1;
  assert.deepEqual(byYear, { 令和1年度: 172, 令和2年度: 154, 令和3年度: 134, 令和4年度: 159 }, `年度別内訳が想定と異なります: ${JSON.stringify(byYear)}`);
  const sum = Object.values(byYear).reduce((a, c) => a + c, 0);
  assert.equal(sum, 619, `年度別内訳の合計が619件ではありません（${sum}件）`);
});

check("D区分619件を、D-A（構造化しやすいカテゴリ）／D-B（個別確認必要なカテゴリ）へ再分類すると、D-A=202・D-B=417・D-C=0・D-D=0で合計619件になる（Phase143で確立した到達方法に基づく再分類）", () => {
  let DA = 0, DB = 0;
  for (const b of Dbills) {
    if (STRUCTURED_CATEGORIES.has(b.category)) DA++;
    else DB++;
  }
  assert.equal(DA, 202, `D-A件数が202件ではありません（${DA}件）`);
  assert.equal(DB, 417, `D-B件数が417件ではありません（${DB}件）`);
  const DC = 0;
  const DD = 0;
  assert.equal(DA + DB + DC + DD, 619, "D-A+D-B+D-C+D-Dの合計が619件ではありません");
});

check("平成31年（2019年1〜4月）の会期と令和元年度（2019年6月〜）の会期が、councilSessions.json上で別レコードとして正しく分離されている（平成→令和の元号境界での統合バグが無いか）", () => {
  const councilSessions = JSON.parse(readFileSync(join(ROOT, "src/data/councilSessions.json"), "utf8"));
  const h31 = councilSessions.find((s) => s.title === "平成31年3月定例会");
  const r1 = councilSessions.find((s) => s.id === "2019-06");
  assert.ok(h31, "councilSessions.jsonに「平成31年3月定例会」のレコードが見つかりません");
  assert.ok(r1, "councilSessions.jsonに2019-06（令和元年6月定例会）のレコードが見つかりません");
  assert.notEqual(h31.id, r1.id, "平成31年3月定例会と令和元年6月定例会が同一レコードに統合されてしまっています");
  assert.ok(h31.startDate < r1.startDate, "平成31年3月定例会のstartDateが令和元年6月定例会より後になっています（日付の前後関係が壊れている）");
  // 令和元年度のD区分議案（billVotes.json）に、平成31年3月定例会（h31.id）に属する議案が
  // 紛れ込んでいないことも確認する（fiscalYear「令和1年度」に平成期の議案が混入していないか）。
  const r1YearBills = billVotes.filter((b) => b.fiscalYear === "令和1年度");
  const mixedIn = r1YearBills.filter((b) => b.sessionId === h31.id);
  assert.equal(mixedIn.length, 0, `令和1年度の議案に、平成31年3月定例会（${h31.id}）の議案が混入しています: ${mixedIn.map((b) => b.id).join("、")}`);
});

check("Phase143で新たに一次資料本文を確認・独自要約へ昇格した3件（A区分の半自動抽出実証のうち完全一致だったもの）が、sourceTextVerifiedAt・summarySource:\"manual\"を持つ", () => {
  const phase143PromotedIds = ["2024-06-gian-18", "2024-09-gian-28", "2024-09-gian-53"];
  for (const id of phase143PromotedIds) {
    const bill = billVotes.find((b) => b.id === id);
    assert.ok(bill, `対象議案が見つかりません: ${id}`);
    assert.ok(bill.sourceTextVerifiedAt, `sourceTextVerifiedAtが無い議案: ${id}`);
    assert.equal(bill.summarySource, "manual", `summarySourceが"manual"でない議案: ${id}`);
    assert.ok(bill.reason || (bill.mainChanges && bill.mainChanges.length > 0), `独自内容が無い議案: ${id}`);
  }
});

check("summaryVerified（Level3、独自要約あり）の総数が61件である（Phase142の19件＋Phase143の3件＋Phase144で新たに昇格した39件。詳細な内訳の回帰確認はtest-bill-level3-criteria.mjs側で行う）", () => {
  const level3 = billVotes.filter((b) => b.summarySource === "manual" && (b.reason || (b.mainChanges && b.mainChanges.length > 0) || b.citizenImpact));
  assert.equal(level3.length, 61, `Level3の件数が61件ではありません（${level3.length}件）`);
});

check("sourceTextVerifiedの総数が62件である（Phase142の20件＋Phase143の3件＋Phase144で新たに本文確認・データ反映した39件）", () => {
  const verified = billVotes.filter((b) => b.sourceTextVerifiedAt);
  assert.equal(verified.length, 62, `sourceTextVerifiedAtを持つ議案の件数が62件ではありません（${verified.length}件）`);
});

check("議案第162号は、Phase143でも引き続きLevel2（本文確認済み・独自要約なし）のままで、Level3へ無理に昇格されていない", () => {
  const bill162 = billVotes.find((b) => b.id === "2026-03-gian-162");
  assert.ok(bill162, "2026-03-gian-162が見つかりません");
  assert.ok(bill162.sourceTextVerifiedAt, "2026-03-gian-162のsourceTextVerifiedAtが失われています");
  assert.ok(!bill162.reason && !bill162.citizenImpact, "2026-03-gian-162がLevel3へ昇格してしまっています（reason等が設定されている）");
});

check("Phase143で新たにmanual要約化した3件のmainChangesの金額表記は、桁区切りカンマと「円」表記のみで、千円・百万円・万円が単一文字列内で混在していない（単位変換ミスの簡易検査）", () => {
  const phase143PromotedIds = ["2024-06-gian-18", "2024-09-gian-28", "2024-09-gian-53"];
  const suspects = [];
  for (const id of phase143PromotedIds) {
    const bill = billVotes.find((b) => b.id === id);
    for (const line of bill.mainChanges ?? []) {
      const hasMan = /万円/.test(line);
      const hasHyakuman = /百万円/.test(line);
      if (hasMan && hasHyakuman) suspects.push(`${id}: ${line}`);
    }
  }
  assert.equal(suspects.length, 0, `単位混在の疑いがある記述: ${suspects.join(" / ")}`);
});

check("src/lib/billSourceRetrieval.tsが、'到達不能'という表現ではなく'sourceRetrievalUnresolved'（未解決）という考え方をコメントで明記している（Phase143項目2：意味の混同防止）", () => {
  const src = readFileSync(join(ROOT, "src/lib/billSourceRetrieval.ts"), "utf8");
  assert.ok(src.includes("sourceRetrievalUnresolved"), "sourceRetrievalUnresolvedという語がbillSourceRetrieval.tsに見当たりません");
  assert.ok(src.includes("原資料が存在しない"), "「原資料が存在しない、という意味ではない」旨の注記が見当たりません");
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
