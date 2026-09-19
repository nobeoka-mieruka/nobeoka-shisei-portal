#!/usr/bin/env node
/**
 * Phase260：財政健全化判断比率等（5指標）の回帰テスト。
 *
 * 守ること：
 * 1. 公表ページの解析（scripts/lib/soundness-ratio-page.mjs）が、延岡市の実ページ（令和7年度・令和3年度の
 *    本文を固定したfixture）から5指標・法定基準・前年度値を正しく読むこと。
 * 2. 表の欠落・表と本文の値の食い違いを「エラー」として返すこと（誤った数値を自動反映しないため）。
 * 3. 登録データ（archiveFiscalYears.json）の令和7年度が公式資料の値と一致し、各年度の「前年度」値の連鎖が
 *    登録済みの前年度データと一致すること。
 * 4. 「該当なし」を0%として登録していないこと。値を二重登録していないこと。
 * 5. 前年度差の表示が浮動小数の誤差を出さず、評価語（悪化・危険等）を使わないこと。
 *
 * 使い方: node --experimental-strip-types scripts/test-finance-soundness-ratios.mjs
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parseSoundnessRatioPage, parseRatioCell } from "./lib/soundness-ratio-page.mjs";

const { pointDifference, describePointDifference, formatStandardPercent, formatRatioPercent, formatSoundnessValue, soundnessValueStatus, latestSoundnessYear } = await import(
  "../src/lib/financeSoundness.ts"
);

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  [PASS] ${label}`);
}
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

console.log("[test-finance-soundness-ratios] 開始");

const r7Html = readFileSync("scripts/fixtures/soundness-ratio-page-r7.html", "utf8");
const r3Html = readFileSync("scripts/fixtures/soundness-ratio-page-r3.html", "utf8");

check("令和7年度ページ：5指標・法定基準・前年度値を公式ページどおりに読む", () => {
  const r = parseSoundnessRatioPage(r7Html);
  assert.deepEqual(r.errors, []);
  assert.equal(r.fiscalYear, 2025);
  assert.equal(r.updatedDate, "2026-09-18");
  assert.deepEqual(r.ratios.actualDeficitRatio, { status: "notApplicable", percent: null, earlyWarningStandardPercent: 11.66, reconstructionStandardPercent: 20 });
  assert.deepEqual(r.ratios.consolidatedActualDeficitRatio, { status: "notApplicable", percent: null, earlyWarningStandardPercent: 16.66, reconstructionStandardPercent: 30 });
  assert.deepEqual(r.ratios.realDebtServiceRatio, { status: "reported", percent: 8.7, earlyWarningStandardPercent: 25, reconstructionStandardPercent: 35 });
  assert.deepEqual(r.ratios.futureBurdenRatio, { status: "reported", percent: 32.3, earlyWarningStandardPercent: 350, reconstructionStandardPercent: null });
  assert.deepEqual(
    r.fundShortageRatios.map((f) => [f.accountName, f.status, f.percent, f.managementSoundnessStandardPercent]),
    [
      ["水道事業会計", "notApplicable", null, 20],
      ["下水道事業会計", "notApplicable", null, 20],
      ["食肉センター特別会計", "notApplicable", null, 20],
    ],
  );
  assert.equal(r.priorYear.realDebtServiceRatio, 8.6);
  assert.equal(r.priorYear.futureBurdenRatio, 15.9);
});

check("令和3年度ページ：前年度が該当なしで前年度比較の文が無い場合は prior=null（エラーにしない）", () => {
  const r = parseSoundnessRatioPage(r3Html);
  assert.deepEqual(r.errors, []);
  assert.equal(r.fiscalYear, 2021);
  assert.equal(r.ratios.futureBurdenRatio.percent, 4);
  assert.equal(r.priorYear.futureBurdenRatio, null);
});

check("ページ構造の変化（表が無い）はエラーとして返す", () => {
  const broken = r7Html.replace(/<table[\s\S]*?<\/table>/, "");
  const r = parseSoundnessRatioPage(broken);
  assert.ok(r.errors.some((e) => e.includes("健全化判断比率の表")), r.errors.join("／"));
});

check("表と本文で値が食い違う場合はエラーとして返す", () => {
  const tampered = r7Html.replace(">32.3％<", ">23.3％<");
  const r = parseSoundnessRatioPage(tampered);
  assert.ok(r.errors.some((e) => e.includes("将来負担比率の値が表")), r.errors.join("／"));
});

check("セル値：「―」は該当なし、空欄は基準なし、それ以外の文字は不明として扱う", () => {
  assert.deepEqual(parseRatioCell("―"), { kind: "dash" });
  assert.deepEqual(parseRatioCell(" "), { kind: "empty" });
  assert.deepEqual(parseRatioCell("8.7％"), { kind: "percent", value: 8.7 });
  assert.equal(parseRatioCell("調整中").kind, "unknown");
});

const years = readJson("src/data/archiveFiscalYears.json");
const byYear = new Map(years.map((y) => [y.fiscalYear, y]));

check("登録データ：令和7年度（2025年度）が公式資料の値（8.7%・32.3%）と一致し、出典が公式ページである", () => {
  const f = byYear.get(2025)?.finance;
  assert.ok(f, "2025年度のfinanceが未登録");
  assert.equal(f.realDebtServiceRatioPercent, 8.7);
  assert.equal(f.futureBurdenRatioPercent, 32.3);
  assert.equal(f.soundness.sourceRef.sourceUrl, "https://www.city.nobeoka.miyazaki.jp/soshiki/18/51957.html");
  assert.equal(f.soundness.sourceRef.trustLevel, "PRIMARY");
  assert.equal(f.soundness.actualDeficitRatio.status, "notApplicable");
  assert.equal(f.soundness.futureBurdenRatio.reconstructionStandardPercent, null);
});

check("登録データ：過年度（令和6年度以前）の値が消えていない", () => {
  const expected = { 2007: [15.3, 142.5], 2017: [10.2, 9.3], 2023: [8.1, 2.1], 2024: [8.6, 15.9] };
  for (const [fy, [rdsr, fbr]] of Object.entries(expected)) {
    const f = byYear.get(Number(fy))?.finance;
    assert.equal(f?.realDebtServiceRatioPercent, rdsr, `${fy} 実質公債費比率`);
    assert.equal(f?.futureBurdenRatioPercent, fbr, `${fy} 将来負担比率`);
  }
});

check("登録データ：「該当なし」は0%ではなくnullで登録され、値の二重登録が無い", () => {
  for (const y of years) {
    const f = y.finance;
    if (!f?.soundness) continue;
    for (const key of ["realDebtServiceRatio", "futureBurdenRatio"]) {
      assert.ok(!("percent" in f.soundness[key]), `FY${y.fiscalYear}.${key}に値が二重登録されています`);
    }
    if (f.soundness.futureBurdenRatio.status === "notApplicable") assert.equal(f.futureBurdenRatioPercent, null);
    for (const key of ["actualDeficitRatio", "consolidatedActualDeficitRatio"]) {
      if (f.soundness[key].status === "notApplicable") assert.equal(f.soundness[key].percent, null);
    }
  }
});

check("表示ヘルパー：該当なし・確認中・算定ありを区別する", () => {
  assert.equal(soundnessValueStatus(byYear.get(2020).finance, "futureBurdenRatioPercent"), "notApplicable");
  assert.equal(soundnessValueStatus(byYear.get(2018).finance, "futureBurdenRatioPercent"), "notApplicable");
  assert.equal(soundnessValueStatus(byYear.get(2025).finance, "futureBurdenRatioPercent"), "reported");
  assert.equal(soundnessValueStatus(byYear.get(2005).finance, "futureBurdenRatioPercent"), "unconfirmed");
  assert.equal(latestSoundnessYear(years).fiscalYear, 2025);
});

check("前年度差：32.3−15.9は16.4ポイント（浮動小数の誤差なし）、評価語を使わない", () => {
  assert.equal(pointDifference(32.3, 15.9), 16.4);
  assert.equal(pointDifference(8.7, 8.6), 0.1);
  assert.equal(describePointDifference(16.4), "前年度から16.4ポイント上昇");
  assert.equal(describePointDifference(-0.5), "前年度から0.5ポイント低下");
  assert.equal(pointDifference(null, 15.9), null);
});

check("法定基準の表示桁が公表資料どおり（11.66％・25.0％・350.0％・定めなし）", () => {
  assert.equal(formatStandardPercent(11.66), "11.66％");
  assert.equal(formatStandardPercent(25), "25.0％");
  assert.equal(formatStandardPercent(350), "350.0％");
  assert.equal(formatStandardPercent(null), "定めなし");
  // 実績値も公表資料どおり小数第1位まで（令和3年度の将来負担比率は「4.0％」と公表されている）。
  assert.equal(formatRatioPercent(4), "4.0％");
  assert.equal(formatSoundnessValue(byYear.get(2021).finance, "futureBurdenRatioPercent"), "4.0％");
  assert.equal(formatSoundnessValue(byYear.get(2019).finance, "futureBurdenRatioPercent"), "該当なし");
});

check("財政ダッシュボードの出典一覧が、登録済み最新年度の公表ページを指している", () => {
  const dashboard = readJson("src/data/financeDashboard.json");
  const source = dashboard.sources.find((s) => s.section === "soundnessRatios");
  assert.ok(source, "financeDashboard.jsonにsection=soundnessRatiosの出典がありません");
  assert.equal(source.url, latestSoundnessYear(years).finance.soundness.sourceRef.sourceUrl);
});

check("表示コンポーネントに評価語（悪化・危険・健全です等）を書いていない", () => {
  const src = readFileSync("src/components/finance/SoundnessRatiosSection.tsx", "utf8") + readFileSync("src/lib/financeSoundness.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const word of ["悪化", "危険", "改善", "健全です", "良好"]) {
    assert.ok(!code.includes(word), `評価語「${word}」が含まれています`);
  }
});

console.log(`\n${passCount}件成功`);
