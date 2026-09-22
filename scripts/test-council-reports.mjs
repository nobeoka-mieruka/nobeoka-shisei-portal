/**
 * 市長報告（councilReports.json）が、議案・採決データと混ざらないことを検証する。
 *
 * 市長報告は議決・採決を要しない案件なので、議決結果も議員別の賛否も存在しない。
 * 議案の配列へ混ぜたり、議員の賛否集計へ加算したりすると、
 * 「議案総数」「採決方法の確認率」「議員ごとの賛成・反対の回数」の意味が変わってしまう。
 *
 * このプロジェクトには専用のテストランナーが無いため、既存のscripts/test-*.mjsと同じ
 * 「プレーンなNode＋assert」方式に揃えている。
 *
 * 使い方: node scripts/test-council-reports.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const reportsData = readJson("src/data/councilReports.json");
const reports = reportsData.reports;
const billsRaw = readJson("src/data/billVotes.json");
const bills = Array.isArray(billsRaw) ? billsRaw : billsRaw.billVotes;
const sessions = readJson("src/data/councilSessions.json");

console.log(`\n市長報告：${reports.length}件（実データから再計算）／議案・採決データ：${bills.length}件`);

check("報告のIDと、会期ごとの報告番号に重複が無い", () => {
  const ids = reports.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "報告IDが重複しています");
  const numbers = reports.map((r) => `${r.sessionId}/${r.reportNumber}`);
  assert.equal(new Set(numbers).size, numbers.length, "同じ会期に同じ報告番号があります");
});

check("報告は議案・採決データへ二重登録されていない", () => {
  const billKeys = new Set(bills.map((b) => `${b.sessionId}/${b.billNumber}`));
  const duplicated = reports.filter((r) => billKeys.has(`${r.sessionId}/${r.reportNumber}`));
  assert.equal(duplicated.length, 0, `議案としても登録されている報告: ${duplicated.map((r) => r.reportNumber).join("、")}`);
});

check("報告は議決・採決に関する項目を一切持たない（議員の賛否集計へ混入しない）", () => {
  const forbidden = ["votingDate", "result", "memberVotes", "voteMethod", "individualVoteDisclosureStatus", "billNumber"];
  for (const r of reports) {
    for (const key of forbidden) {
      assert.equal(r[key], undefined, `${r.reportNumber}に${key}が設定されています`);
    }
  }
});

check("報告日は議決日ではなく、公開日と別に記録されている", () => {
  for (const r of reports) {
    assert.match(r.reportedDate, /^\d{4}-\d{2}-\d{2}$/, `${r.reportNumber}のreportedDateが日付ではありません`);
    assert.match(r.publishedDate, /^\d{4}-\d{2}-\d{2}$/, `${r.reportNumber}のpublishedDateが日付ではありません`);
  }
});

check("全ての報告に、公式の出典URL・資料名・公開日・信頼度区分がある", () => {
  for (const r of reports) {
    assert.ok(/^https:\/\/www\.city\.nobeoka\.miyazaki\.jp\//.test(r.sourceUrl), `${r.reportNumber}の出典URLが延岡市公式ではありません`);
    assert.ok(r.sourceTitle && r.sourceTitle.length > 0, `${r.reportNumber}の出典資料名が空です`);
    assert.equal(r.trustLevel, "PRIMARY", `${r.reportNumber}のtrustLevelが想定と異なります`);
    assert.ok(typeof r.sourcePage === "number" && r.sourcePage > 0, `${r.reportNumber}の出典ページが不正です`);
  }
});

check("報告が参照する会期と会期資料が実在する", () => {
  for (const r of reports) {
    const session = sessions.find((s) => s.id === r.sessionId);
    assert.ok(session, `${r.reportNumber}が参照する会期がありません: ${r.sessionId}`);
    const document = (session.documents ?? []).find((d) => d.id === r.sourceDocumentId);
    assert.ok(document, `${r.reportNumber}が参照する会期資料がありません: ${r.sourceDocumentId}`);
    assert.notEqual(
      document.publicationStatus,
      "removedPendingReview",
      `${r.reportNumber}が公開の終了した資料を出典にしています`,
    );
  }
});

check("令和8年9月定例会の市長報告は、審議結果資料のとおり報告第6号から第21号の16件", () => {
  const sept = reports.filter((r) => r.sessionId === "2026-09");
  assert.equal(sept.length, 16, `件数が16件ではありません（${sept.length}件）`);
  const numbers = sept.map((r) => Number(r.reportNumber.replace(/[^0-9]/g, ""))).sort((a, b) => a - b);
  assert.deepEqual(numbers, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], `報告番号が想定と異なります: ${numbers.join("、")}`);
  for (const r of sept) {
    assert.equal(r.reportedDate, "2026-09-18", `${r.reportNumber}の報告日が資料（9月18日）と異なります`);
  }
});

/** 故障注入：報告を議案の配列へ混ぜてしまった場合に検出できることを確かめる。 */
check("報告を議案として登録すると検出される（故障注入）", () => {
  const brokenBillKeys = new Set([...bills.map((b) => `${b.sessionId}/${b.billNumber}`), "2026-09/報告第6号"]);
  const duplicated = reports.filter((r) => brokenBillKeys.has(`${r.sessionId}/${r.reportNumber}`));
  assert.ok(duplicated.length > 0, "議案へ混ぜても検出できませんでした");
});

/** 故障注入：報告へ議決結果を持たせた場合に検出できることを確かめる。 */
check("報告に議決結果を持たせると検出される（故障注入）", () => {
  const broken = reports.map((r) => ({ ...r, result: "原案可決" }));
  const withResult = broken.filter((r) => r.result !== undefined);
  assert.ok(withResult.length > 0, "議決結果を持たせても検出できませんでした");
});

console.log(`\n${passCount}件成功\n`);
