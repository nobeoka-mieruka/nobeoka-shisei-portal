/**
 * 本番サイトの実レンダリング・スモークテスト。
 * HTTP 200 だけで合格としない。実際に描画したうえで
 * 見出し・主要コンテンツ・横スクロール・console エラーを確認する。
 */
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE ?? "https://nobeoka-shisei-portal.pages.dev";
const PAGES = [
  "/", "/dashboard", "/data-status", "/people", "/questions", "/bills/votes",
  "/committees", "/finance", "/history", "/mayor", "/mayors",
  "/mayor/policy-progress", "/compare", "/search",
];
const VIEWPORTS = [
  { name: "sp320", width: 320, height: 568 },
  { name: "sp390", width: 390, height: 844 },
  { name: "pc1280", width: 1280, height: 720 },
];

const browser = await chromium.launch({ headless: true });
const results = [];
let failures = 0;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  for (const path of PAGES) {
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    let status = null, h1 = null, textLen = 0, overflow = null, err = null;
    try {
      const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
      status = res ? res.status() : null;
      await page.waitForSelector("main", { timeout: 15000 });
      h1 = await page.$eval("h1", (e) => e.textContent.trim()).catch(() => null);
      textLen = await page.$eval("main", (e) => e.innerText.trim().length).catch(() => 0);
      overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
    } catch (e) { err = String(e).split("\n")[0]; }
    const ok = status === 200 && !!h1 && textLen > 200 && overflow !== null && overflow <= 1 && !err;
    if (!ok) failures++;
    results.push({ vp: vp.name, path, status, h1, textLen, overflowPx: overflow, consoleErrors: consoleErrors.length, err, ok });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

for (const r of results) {
  if (!r.ok) console.log(`  NG ${r.vp} ${r.path} status=${r.status} h1=${JSON.stringify(r.h1)} text=${r.textLen} overflow=${r.overflowPx} err=${r.err}`);
}
const withConsole = results.filter((r) => r.consoleErrors > 0);
console.log(`\n[smoke] ${BASE}`);
console.log(`[smoke] 検証: ${PAGES.length}ページ × ${VIEWPORTS.length}viewport = ${results.length}件`);
console.log(`[smoke] 合格 ${results.length - failures} / 不合格 ${failures}`);
console.log(`[smoke] consoleエラーのあったページ: ${withConsole.length}件`);
withConsole.slice(0, 5).forEach((r) => console.log(`   ${r.vp} ${r.path}: ${r.consoleErrors}件`));
console.log(`[smoke] 横スクロール最大: ${Math.max(...results.map((r) => r.overflowPx ?? 0))}px`);
process.exit(failures > 0 ? 1 : 0);
