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

check("Phase263：年度別アーカイブの令和8年度 当初予算・補正後予算が段階別データ（当初・最新段階）と一致する", () => {
  const b = readJson("src/data/archiveFiscalYears.json").find((y) => y.fiscalYear === 2026).budget;
  assert.equal(b.generalAccountInitialBudgetYen, 69066000000, "当初予算（690.66億円）が変わっています");
  assert.equal(b.generalAccountFinalBudgetYen, 71011749000, "補正後予算が9月補正（2次分）後の71,011,749千円ではありません（6月補正後の値が残っていないか）");
  assert.equal(b.nationalSubsidiesYen, 14809569000);
  assert.equal(b.prefecturalSubsidiesYen, 6147485000);
  assert.ok(!b.sourceRefs.some((r) => (r.sourceUrl ?? "").includes("r8_june_supplementary_budget")), "6月補正時点の出典が補正後予算の根拠に残っています");
});

check("Phase264：9月補正（議案第29号）の一般会計 概要掲載事業18件が概要書（28796.pdf）の合計欄と一致する", () => {
  const sep1 = byId.get("fy2026-sep-1");
  assert.equal(sep1.projectCoverage, "listedOnly", "概要書は概要掲載事業のみのため listedOnly で登録する");
  const general = sep1.projects.filter((p) => p.accountCategory === "一般会計");
  assert.equal(general.length, 18);
  const sum = (key) => general.reduce((s, p) => s + (p[key] ?? 0), 0);
  const fsum = (key) => general.reduce((s, p) => s + (p.funding[key] ?? 0), 0);
  assert.equal(sum("supplementaryThousandYen"), 306267, "一般会計 概要掲載事業合計（306,267千円）");
  assert.equal(fsum("nationalPrefecturalThousandYen"), 6298, "国県支出金の合計（6,298千円）");
  assert.equal(fsum("localBondThousandYen") + fsum("otherThousandYen"), 214783, "地方債・その他の合計（214,783千円）");
  assert.equal(fsum("generalRevenueThousandYen"), 85186, "一般財源の合計（85,186千円）");
  const a = sep1.accounts.find((x) => x.accountName === "一般会計");
  assert.equal(a.supplementaryThousandYen, 645609);
  assert.deepEqual(
    [a.funding.nationalPrefecturalThousandYen, a.funding.localBondThousandYen, a.funding.otherThousandYen, a.funding.generalRevenueThousandYen],
    [-5002, 208100, 39369, 403142],
    "資料の△5,002（国県支出金の減額）を負の値で保持",
  );
  // 資料に明記された関連（都市公園ライトアップ事業「【No.１ 延岡にぎわい創出支援事業 関連】」）だけを関連付ける
  const lightup = sep1.projects.find((p) => p.name === "都市公園ライトアップ事業");
  assert.deepEqual(lightup.relatedProjectIds, ["fy2026-sep-1-nigiwai"]);
  assert.equal(general.filter((p) => p.relatedProjectIds.length > 0).length, 1);
});

check("Phase265：特別会計・企業会計の各段階が概要書・予算書の値と一致し、会計ごとに当初＋補正＝最新", () => {
  const byAccount = new Map();
  for (const r of revisions.filter((x) => x.fiscalYear === 2026).sort((a, b) => a.sequence - b.sequence)) {
    for (const a of r.accounts) byAccount.set(a.accountName, [...(byAccount.get(a.accountName) ?? []), [r.id, a.billNumber, a.supplementaryThousandYen, a.afterThousandYen]]);
  }
  assert.deepEqual(byAccount.get("国民健康保険特別会計"), [["fy2026-initial", "議案第130号", null, 12300148], ["fy2026-sep-1", "議案第30号", 7028, 12307176]]);
  assert.deepEqual(byAccount.get("介護保険特別会計"), [["fy2026-initial", "議案第132号", null, 14075065], ["fy2026-sep-1", "議案第31号", 152522, 14227587]]);
  assert.deepEqual(byAccount.get("水道事業会計"), [["fy2026-initial", "議案第134号", null, 4168178], ["fy2026-jun-1", "議案第6号", 0, 4168178], ["fy2026-sep-1", "議案第32号", 0, 4168178]]);
  assert.deepEqual(byAccount.get("下水道事業会計"), [["fy2026-initial", "議案第135号", null, 7019698], ["fy2026-jun-1", "議案第7号", 25000, 7044698], ["fy2026-sep-1", "議案第33号", 81763, 7126461]]);
  assert.deepEqual(byAccount.get("食肉センター特別会計"), [["fy2026-initial", "議案第131号", null, 100]]);
  assert.deepEqual(byAccount.get("後期高齢者医療特別会計"), [["fy2026-initial", "議案第133号", null, 2225521]]);
  // 一般会計の流れ（予算の変化）には特別会計・企業会計を含めない
  const sep1 = byId.get("fy2026-sep-1");
  assert.equal(sep1.accounts.find((a) => a.accountName === "一般会計").afterThousandYen, 70936764);
  assert.deepEqual(sep1.listedProjectTotals.map((t) => [t.accountCategory, t.supplementaryThousandYen]), [["一般会計", 306267], ["特別会計", 133195], ["企業会計", 77338]]);
});

check("Phase265：提出日は予算書の議案本文で確認した日付で、議決日より前", () => {
  const expected = { "議案第129号": "2026-02-16", "議案第169号": "2026-03-02", "議案第5号": "2026-06-12", "議案第20号": "2026-06-23", "議案第29号": "2026-08-28", "議案第49号": "2026-09-08" };
  for (const r of revisions) {
    for (const a of r.accounts) {
      assert.ok(a.submittedDate, `${a.billNumber}の提出日が未設定`);
      if (expected[a.billNumber]) assert.equal(a.submittedDate, expected[a.billNumber], a.billNumber);
      assert.equal(r.sources[a.submittedDateSourceIndex].sourceType, "予算書", `${a.billNumber}の提出日の出典が予算書ではありません`);
      const bill = bills.find((b) => b.id === a.billId);
      assert.ok(a.submittedDate <= bill.votingDate, `${a.billNumber}：提出日が議決日より後`);
    }
  }
});

check("Phase265：議員別賛否は「公表なし（会議録で確認済み）」と「未確認」を議案データのとおり区別する（推測で作らない）", () => {
  const idx = (id) => billIndex.find((b) => b.id === id);
  assert.equal(idx("2026-06-gian-5").individualVoteDisclosureStatus, "notDisclosed");
  assert.equal(idx("2026-09-gian-29").individualVoteDisclosureStatus, "unconfirmed");
  for (const b of billIndex) assert.equal(b.memberVoteCount, (bills.find((x) => x.id === b.id).memberVotes ?? []).length);
});

check("自動更新：段階名の種類（補正の次分・専決処分・企業会計）を判定し、同じ段階・同じ種類の資料の重複を検出する", () => {
  const base = "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/";
  const links = [
    { text: "12月補正（3次分）（概要書） [PDFファイル／1KB]", url: `${base}1.pdf` },
    { text: "専決処分（概要書） [PDFファイル／1KB]", url: `${base}2.pdf` },
    { text: "9月補正（企業会計）（予算書） [PDFファイル／1KB]", url: `${base}3.pdf` },
    { text: "12月補正（概要書） [PDFファイル／1KB]", url: `${base}4.pdf` },
    { text: "12月補正（概要書） [PDFファイル／1KB]", url: `${base}5.pdf` },
  ];
  const { stages, duplicates } = classifyBudgetListing(links, new Set());
  const byLabel = Object.fromEntries(stages.map((s) => [s.stageLabel, s]));
  assert.equal(byLabel["12月補正（3次分）"].kind, "補正予算");
  assert.equal(byLabel["12月補正（3次分）"].round, 3);
  assert.equal(byLabel["専決処分"].kind, "専決処分");
  assert.equal(byLabel["9月補正（企業会計）"].accountScope, "企業会計");
  assert.deepEqual(duplicates.map((s) => s.stageLabel), ["12月補正"]);
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
