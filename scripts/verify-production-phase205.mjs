/**
 * Phase201〜205 の本番反映確認。
 * HTTP 200 だけで判定せず、実際にレンダリングした本文の内容を検証する。
 *
 * 使い方: node scripts/verify-production-phase205.mjs
 */
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE ?? "https://nobeoka-shisei-portal.pages.dev";

const PAGES = [
  "/", "/dashboard", "/finance", "/timeline",
  "/mayor", "/mayor/policy-progress", "/data-status", "/bills", "/questions",
];
const VIEWPORTS = [
  { name: "320", width: 320, height: 568 },
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "1280", width: 1280, height: 720 },
  { name: "1440", width: 1440, height: 900 },
];

/** 本文に現れてはいけない表示バグ。 */
const BANNED = ["約約", "円円", "億円円", "年年度", "月月", "件件", "人人", "％％", "。。", "、、"];
/** 廃止した旧ラベル（更新履歴での引用を除き、UIラベルとしては現れない）。 */
const RETIRED_LABELS = ["市長公約の登録数", "公約分野", "全公約数", "マニフェストの大項目"];

const browser = await chromium.launch({ headless: true });
const rows = [];
let failures = 0;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  for (const route of PAGES) {
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));

    const row = { vp: vp.name, route, status: null, overflow: null, banned: [], retired: [], err: null };
    try {
      const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
      row.status = res ? res.status() : null;
      await page.waitForSelector("main", { timeout: 15000 });
      const text = await page.$eval("main", (el) => el.innerText);
      row.textLen = text.trim().length;
      row.overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      row.banned = BANNED.filter((p) => text.includes(p));
      row.retired = RETIRED_LABELS.filter((p) => text.includes(p));
      row.terms = {
        政策分野: text.includes("政策分野"),
        個別公約: text.includes("個別公約"),
        個別施策: text.includes("個別施策"),
      };
      row.session = {
        直近: text.includes("直近の確認済み会期"),
        予定: text.includes("次回・開催予定"),
        旧表記: text.includes("今の会期"),
      };
      row.sourceShown = /出典|情報源/.test(text);
    } catch (e) {
      row.err = String(e).split("\n")[0];
    }
    row.consoleErrors = consoleErrors.length;

    const ok =
      row.status === 200 && !row.err && row.textLen > 200 &&
      row.overflow <= 1 && row.banned.length === 0 &&
      row.retired.length === 0 && row.consoleErrors === 0 && !row.session.旧表記;
    row.ok = ok;
    if (!ok) failures++;
    rows.push(row);
    await page.close();
  }
  await ctx.close();
}
await browser.close();

for (const r of rows.filter((x) => !x.ok)) {
  console.log(
    `  NG ${r.vp}px ${r.route} status=${r.status} overflow=${r.overflow} ` +
      `banned=${JSON.stringify(r.banned)} retired=${JSON.stringify(r.retired)} ` +
      `console=${r.consoleErrors} err=${r.err ?? "-"}`,
  );
}

const at = (route) => rows.find((r) => r.route === route && r.vp === "390");
console.log(`\n[verify] ${BASE}`);
console.log(`[verify] ${PAGES.length}ページ × ${VIEWPORTS.length}viewport = ${rows.length}件`);
console.log(`[verify] 合格 ${rows.length - failures} / 不合格 ${failures}`);
console.log(`[verify] 二重語のあったページ: ${rows.filter((r) => r.banned.length).length}件`);
console.log(`[verify] 旧ラベルの残るページ: ${rows.filter((r) => r.retired.length).length}件`);
console.log(`[verify] consoleエラー: ${rows.reduce((a, r) => a + r.consoleErrors, 0)}件`);
console.log(`[verify] 横スクロール最大: ${Math.max(...rows.map((r) => r.overflow ?? 0))}px`);
console.log(
  `[verify] 公約3階層の表示（390px）: /mayor ${JSON.stringify(at("/mayor")?.terms)} ` +
    `/mayor/policy-progress ${JSON.stringify(at("/mayor/policy-progress")?.terms)}`,
);
console.log(
  `[verify] 会期表示（390px）: /dashboard ${JSON.stringify(at("/dashboard")?.session)}`,
);
console.log(
  `[verify] 出典表示: ${rows.filter((r) => r.sourceShown).length}/${rows.length}件のページで確認`,
);

process.exit(failures > 0 ? 1 : 0);
