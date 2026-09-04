/**
 * 本番サイトの実レンダリング確認。
 * HTTP 200 だけで判定せず、実際に描画した本文の内容を検証する。
 *
 * 検査対象:
 *   - 実在しない元号年度（令和0年度・令和マイナス年度ほか）／Phase219
 *   - 二重語（Phase201）と廃止した旧ラベル（Phase202）
 *   - 会期の「直近」と「開催予定」の分離（Phase203）と状態表示（Phase221）
 *   - 議案の「個別の提案理由なし」表示（Phase206-207）と会期年度ラベル（Phase220）
 *   - 公約の予算・議案の状態表示（Phase208）と資料待ち（Phase213）
 *   - 内部用語・内部フィールド名の露出（Phase209・212・217）
 *   - h1／title／横スクロール／console エラー（hydration を含む）
 *
 * 使い方: node scripts/verify-production.mjs
 */
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE ?? "https://nobeoka-shisei-portal.pages.dev";

/** 予算議案（会期年度と議案名の年度が食い違いやすい）。 */
const BUDGET_BILLS = ["2026-06-gian-20", "2026-06-gian-5", "2026-06-gian-6", "2026-06-gian-7", "2023-05-gian-7"];
/** 通常議案（条例・契約など）。 */
const NORMAL_BILLS = ["2026-06-gian-14", "2026-06-gian-19", "2026-06-gian-8", "2026-06-gian-9", "2026-06-gian-10"];
/** 旧任期の一般質問詳細（収録範囲の説明が現任期専用になっていないか）。 */
const OLD_TERM_QUESTIONS = [
  "/members/fm01/questions/fm01-2019-06-27-ippan-shitsumon/",
  "/members/fm01/questions/fm01-2020-09-ippan-shitsumon/",
  "/members/fm01/questions/fm01-2021-06-ippan-shitsumon/",
];
/** 現任期の一般質問詳細。 */
const CURRENT_TERM_QUESTIONS = ["/questions/gq2026-06-m01/", "/questions/gq2026-06-m02/", "/questions/gq2026-06-m03/"];

const PAGES = [
  "/", "/dashboard/", "/data-status/", "/questions/", "/bills/", "/political-funds/",
  "/finance/", "/finance/funds/", "/mayor/", "/mayor/policy-progress/", "/timeline/",
  ...OLD_TERM_QUESTIONS,
  ...CURRENT_TERM_QUESTIONS,
  ...BUDGET_BILLS.map((id) => `/bills/votes/${id}/`),
  ...NORMAL_BILLS.map((id) => `/bills/votes/${id}/`),
];
const VIEWPORTS = [320, 375, 390, 430, 768, 1280, 1440];

/** 実在しない元号年度。1件でも出たら不合格。 */
const ERA_ANOMALIES = [/令和0年/, /令和-\d+年/, /平成0年/, /平成-\d+年/, /昭和0年/, /NaN\s*年/, /undefined\s*年/];
/** 本文に現れてはいけない表示バグ。 */
const BANNED = ["約約", "円円", "億円円", "年年度", "月月", "件件", "人人", "％％", "。。", "、、"];
/** 廃止した旧ラベル。 */
const RETIRED_LABELS = ["市長公約の登録数", "公約分野", "全公約数", "マニフェストの大項目"];
/**
 * 市民向けページに出てはいけない内部用語。
 * `/data-status` と `/methodology/*` は意味の説明付きで内部状態を示す画面のため対象外。
 */
const INTERNAL_TERMS = [
  /(^|[^/A-Za-z0-9._-])[a-z][A-Za-z0-9]*\.json(?![A-Za-z0-9])/,
  /(^|[^A-Za-z0-9_])[a-z][A-Za-z0-9]*Yen(?![A-Za-z0-9_])/,
  /(^|[^A-Za-z0-9_])(?:verificationStatus|verificationNote|sourceRefs?|reasonCode|partiallyVerified|sourceUnavailable|unconfirmed)(?![A-Za-z0-9_])/,
  /(^|[^A-Za-z0-9_])(?:HUMAN_ACTION_REQUIRED|MANUAL_REVIEW|NO_SEPARATE_BILL_LIKELY|BUDGET_BILL_INCLUDED|SHARED_REASON|EXPLAINABLE_FROM_PRIMARY|NOT_IN_MAJOR_PROJECT_LIST)(?![A-Za-z0-9_])/,
  /(^|[^A-Za-z0-9_])Level[123](?![A-Za-z0-9_])/,
];
const AUDIT_ROUTES = ["/data-status", "/methodology"];

const browser = await chromium.launch({ headless: true });
const rows = [];
let failures = 0;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp, height: 900 } });
  for (const route of PAGES) {
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120)); });
    page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 120)));

    const row = { vp, route, status: null, overflow: null, era: [], banned: [], retired: [], internal: [], h1: null, title: null, err: null, textLen: 0 };
    try {
      const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
      row.status = res ? res.status() : null;
      await page.waitForSelector("main", { timeout: 20000 });
      // クライアント側で日付依存の表示が確定するのを待つ（Phase221）
      await page.waitForTimeout(600);
      const info = await page.evaluate(() => ({
        text: document.querySelector("main").innerText,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        h1: document.querySelectorAll("h1").length,
        title: document.title,
      }));
      row.textLen = info.text.trim().length;
      row.overflow = info.overflow;
      row.h1 = info.h1;
      row.title = info.title;
      row.era = ERA_ANOMALIES.filter((re) => re.test(info.text)).map(String);
      row.banned = BANNED.filter((p) => info.text.includes(p));
      row.retired = RETIRED_LABELS.filter((p) => info.text.includes(p));
      if (!AUDIT_ROUTES.some((a) => route.startsWith(a))) {
        row.internal = INTERNAL_TERMS.filter((re) => re.test(info.text)).map((re) => String(re).slice(0, 40));
      }
      if (vp === 390) row.text = info.text;
    } catch (e) {
      row.err = String(e).split("\n")[0];
    }
    row.consoleErrors = consoleErrors.length;
    row.consoleSample = consoleErrors[0] ?? null;

    row.ok =
      row.status === 200 && !row.err && row.textLen > 150 && row.overflow <= 1 &&
      row.era.length === 0 && row.banned.length === 0 && row.retired.length === 0 &&
      row.internal.length === 0 && row.consoleErrors === 0 &&
      row.h1 === 1 && typeof row.title === "string" && row.title.length > 0;
    if (!row.ok) failures++;
    rows.push(row);
    await page.close();
  }
  await ctx.close();
}
await browser.close();

for (const r of rows.filter((x) => !x.ok)) {
  console.log(
    `  NG ${r.vp}px ${r.route} status=${r.status} overflow=${r.overflow} h1=${r.h1} ` +
      `era=${JSON.stringify(r.era)} banned=${JSON.stringify(r.banned)} retired=${JSON.stringify(r.retired)} ` +
      `internal=${JSON.stringify(r.internal)} console=${r.consoleErrors}${r.consoleSample ? " " + r.consoleSample : ""} err=${r.err ?? "-"}`,
  );
}

const at = (route) => rows.find((r) => r.route === route && r.vp === 390);
const has = (route, s) => Boolean(at(route)?.text?.includes(s));
console.log(`\n[verify] ${BASE}`);
console.log(`[verify] ${PAGES.length}ページ × ${VIEWPORTS.length}viewport = ${rows.length}件`);
console.log(`[verify] 合格 ${rows.length - failures} / 不合格 ${failures}`);
console.log(`[verify] 実在しない元号年度: ${rows.filter((r) => r.era.length).length}件`);
console.log(`[verify] 二重語: ${rows.filter((r) => r.banned.length).length}件 / 旧ラベル: ${rows.filter((r) => r.retired.length).length}件`);
console.log(`[verify] 内部用語の露出: ${rows.filter((r) => r.internal.length).length}件`);
console.log(`[verify] consoleエラー（hydration含む）: ${rows.reduce((a, r) => a + r.consoleErrors, 0)}件`);
console.log(`[verify] 横スクロール最大: ${Math.max(...rows.map((r) => r.overflow ?? 0))}px`);
console.log(`[verify] h1が1個でないページ: ${rows.filter((r) => r.h1 !== 1).length}件 / titleなし: ${rows.filter((r) => !r.title).length}件`);
console.log(`\n--- 個別確認（390px）---`);
console.log(`  会期年度ラベル（予算議案）: ${has(`/bills/votes/${BUDGET_BILLS[0]}/`, "会期年度")}`);
console.log(`  年度が2つある説明: ${BUDGET_BILLS.some((id) => has(`/bills/votes/${id}/`, "年度が2つ"))}`);
console.log(`  旧任期の収録範囲説明: ${OLD_TERM_QUESTIONS.some((r) => has(r, "収録"))}`);
console.log(`  会期の直近/予定の分離: ${has("/dashboard/", "直近の確認済み会期") && has("/dashboard/", "次回・開催予定")}`);
console.log(`  公開画面リンク切れの定義: ${has("/data-status/", "公開画面")}`);
console.log(`  公約の資料待ち: ${has("/mayor/policy-progress/", "予算資料の確認待ち")}`);
console.log(`  基金グラフの欠損説明: ${has("/finance/funds/", "斜線の区間は資料未確認")}`);

process.exit(failures > 0 ? 1 : 0);
