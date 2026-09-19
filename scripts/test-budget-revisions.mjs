#!/usr/bin/env node
/**
 * Phase261：当初予算・補正予算の段階別データ（budgetRevisions.json）と「予算→事業→議案→議決」の回帰テスト。
 *
 * 守ること：
 * 1. 令和8年度9月補正（2次分）の総額・事業額・財源が延岡市の概要書（attachment/28903.pdf）の値と一致する。
 * 2. 当初予算→各補正の連鎖（前の段階の補正後＝次の段階の補正前）が崩れていない。
 * 3. 9月補正（1次）と9月補正（2次分）が別の議案（第29号・第49号）に正しく関連付いている。
 * 4. 議決結果・議員別賛否を予算データへ複製せず、議案データの射影と一致している（議員別賛否を推測で作らない）。
 * 5. 財政ダッシュボードに事業一覧の重複コピーが残っていない。
 * 6. 予算ページの資料リンクを段階名で区別し、同じ月の2つの補正を取り違えない（自動更新）。
 *
 * 使い方: node scripts/test-budget-revisions.mjs
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { classifyBudgetListing, parseBudgetListingLink } from "./lib/budget-listing.mjs";

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  [PASS] ${label}`);
}
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

console.log("[test-budget-revisions] 開始");

const revisions = readJson("src/data/budgetRevisions.json");
const bills = readJson("src/data/billVotes.json");
const billIndex = readJson("src/data/budgetRevisionBillsIndex.json");
const byId = new Map(revisions.map((r) => [r.id, r]));
const sep2 = byId.get("fy2026-sep-2");

check("9月補正（2次分）：一般会計の補正前・補正額・補正後・財源が概要書と一致する", () => {
  const a = sep2.accounts.find((x) => x.accountName === "一般会計");
  assert.equal(a.billNumber, "議案第49号");
  assert.equal(a.beforeThousandYen, 70936764);
  assert.equal(a.supplementaryThousandYen, 74985);
  assert.equal(a.afterThousandYen, 71011749);
  assert.deepEqual(
    [a.funding.nationalPrefecturalThousandYen, a.funding.localBondThousandYen, a.funding.otherThousandYen, a.funding.generalRevenueThousandYen],
    [62716, null, 300, 11969],
  );
  assert.equal(a.funding.otherNote, "寄附金");
  assert.equal(a.funding.generalRevenueNote, "繰越金");
});

check("9月補正（2次分）：6事業の名称・担当課・補正額が概要書と一致する", () => {
  const actual = sep2.projects.map((p) => [p.name, p.department, p.supplementaryThousandYen]);
  assert.deepEqual(actual, [
    ["図書カード配布による読書活動応援事業", "総合政策課", 21537],
    ["障がい者施設物価高騰対策給付金支給事業", "障がい福祉課", 9988],
    ["介護施設等物価高騰対策給付金支給事業", "介護保険課", 34435],
    ["保育施設等物価高騰対策給付金支給事業", "こども保育課", 3839],
    ["祖母・傾・大崩ユネスコエコパーク推進事業", "地域政策課", 4886],
    ["学校図書館図書整備事業", "学校支援課", 300],
  ]);
  assert.deepEqual(
    sep2.projectGroupTotals.map((g) => g.supplementaryThousandYen),
    [69799, 5186],
  );
});

check("令和8年度の一般会計：当初69,066,000千円から6段階がつながり、最新は71,011,749千円", () => {
  const list = revisions.filter((r) => r.fiscalYear === 2026).sort((a, b) => a.sequence - b.sequence);
  assert.deepEqual(
    list.map((r) => [r.label, r.accounts[0].billNumber]),
    [
      ["当初予算", "議案第129号"],
      ["補正予算（第1号）", "議案第169号"],
      ["6月補正", "議案第5号"],
      ["6月補正（2次分）", "議案第20号"],
      ["9月補正", "議案第29号"],
      ["9月補正（2次分）", "議案第49号"],
    ],
  );
  assert.equal(list[0].accounts[0].afterThousandYen, 69066000);
  for (let i = 1; i < list.length; i++) {
    assert.equal(list[i].accounts[0].beforeThousandYen, list[i - 1].accounts[0].afterThousandYen, `${list[i].label}の補正前`);
  }
  assert.equal(list.at(-1).accounts[0].afterThousandYen, 71011749);
});

check("9月補正と9月補正（2次分）は別の議案・別のIDで、同じ定例会でも回次で区別される", () => {
  const sep1 = byId.get("fy2026-sep-1");
  assert.equal(sep1.sessionId, sep2.sessionId);
  assert.notEqual(sep1.round, sep2.round);
  assert.equal(sep1.accounts[0].billId, "2026-09-gian-29");
  assert.equal(sep2.accounts[0].billId, "2026-09-gian-49");
  const bill49 = bills.find((b) => b.id === "2026-09-gian-49");
  assert.match(bill49.billTitle, /二次分/);
});

check("議決結果・議員別賛否は議案データの射影で、予算データに複製していない", () => {
  for (const r of revisions) {
    for (const a of r.accounts) {
      assert.ok(!("result" in a) && !("memberVotes" in a) && !("votingDate" in a), `${r.id}に議決情報を複製しています`);
      const bill = bills.find((b) => b.id === a.billId);
      const idx = billIndex.find((b) => b.id === a.billId);
      assert.ok(bill && idx, `${a.billId}が議案データ・射影にありません`);
      assert.equal(idx.result, bill.result);
      assert.equal(idx.votingDate, bill.votingDate);
      assert.equal(idx.memberVoteCount, (bill.memberVotes ?? []).length, "議員別賛否の件数が議案データと異なります（推測で作っていないか）");
    }
  }
  const idx49 = billIndex.find((b) => b.id === "2026-09-gian-49");
  assert.equal(idx49.result, "原案可決");
  assert.equal(idx49.votingDate, "2026-09-18");
});

check("市長公約との関連は公式資料で明記されたものだけ（今回は0件）で、画面に「公約実現」等の判定語が無い", () => {
  for (const p of sep2.projects) assert.deepEqual(p.relatedPromiseIds, []);
  const src = readFileSync("src/components/finance/BudgetRevisionsSection.tsx", "utf8");
  for (const word of ["公約実現", "公約達成", "達成率"]) assert.ok(!src.includes(word), `「${word}」が含まれています`);
});

check("財政ダッシュボードに補正予算の事業一覧の重複コピーが残っていない", () => {
  const dashboard = readJson("src/data/financeDashboard.json");
  assert.ok(!("supplementaryBudgetProjects" in dashboard));
  assert.ok(!dashboard.sources.some((s) => s.section === "supplementaryBudgetProjects"));
});

check("予算ページのリンク文言から段階名と資料種別を分ける（ファイル情報の付記を除く）", () => {
  assert.deepEqual(parseBudgetListingLink("9月補正（2次分）（概要書） [PDFファイル／302KB]"), { stageLabel: "9月補正（2次分）", sourceType: "概要書" });
  assert.deepEqual(parseBudgetListingLink("1号補正（予算書） [PDFファイル／351KB]"), { stageLabel: "1号補正", sourceType: "予算書" });
  assert.equal(parseBudgetListingLink("掲載はこちら"), null);
});

check("同じ月の2つの補正を別の段階として扱い、未登録の段階だけを検出する", () => {
  const base = "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/";
  const links = [
    { text: "9月補正（予算書） [PDFファイル／2.11MB]", url: `${base}28795.pdf` },
    { text: "9月補正（概要書） [PDFファイル／381KB]", url: `${base}28796.pdf` },
    { text: "9月補正（2次分）（予算書） [PDFファイル／473KB]", url: `${base}28987.pdf` },
    { text: "9月補正（2次分）（概要書） [PDFファイル／302KB]", url: `${base}28903.pdf` },
    { text: "12月補正（概要書） [PDFファイル／300KB]", url: `${base}99999.pdf` },
  ];
  const registered = new Set(revisions.flatMap((r) => r.sources.map((s) => s.url)));
  const { stages, unregistered } = classifyBudgetListing(links, registered);
  assert.deepEqual(stages.map((s) => s.stageLabel), ["9月補正", "9月補正（2次分）", "12月補正"]);
  assert.deepEqual(unregistered.map((s) => s.stageLabel), ["12月補正"]);
});

console.log(`\n${passCount}件成功`);
