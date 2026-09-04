/**
 * 本番サイトの実レンダリング確認。
 * HTTP 200 だけで判定せず、実際に描画した本文の内容を検証する。
 *
 * 検査対象:
 *   - 二重語（Phase201）
 *   - 廃止した旧ラベル（Phase202）
 *   - 会期の「直近」と「開催予定」の分離（Phase203）
 *   - 議案の「個別の提案理由なし」表示（Phase206-207）
 *   - 公約の予算・議案の状態表示（Phase208）
 *   - 内部用語・内部フィールド名の露出（Phase209）
 *   - 横スクロール / console エラー
 *
 * 使い方: node scripts/verify-production.mjs
 */
import { chromium } from "playwright-core";

const BASE = process.env.SMOKE_BASE ?? "https://nobeoka-shisei-portal.pages.dev";

/** 議案詳細は、説明あり・共通説明・説明なしが混ざるように選ぶ。 */
const BILL_IDS = [
  "2023-05-gian-7", "2023-05-extraordinary-gian-3", "2023-05-extraordinary-gian-4",
  "2023-05-extraordinary-gian-5", "2023-06-gian-11", "2023-09-gian-52",
  "2023-09-gian-53", "2026-06-gian-14", "2026-06-gian-19", "2026-06-gian-20",
];

const PAGES = [
  "/", "/dashboard", "/bills", "/bills/votes", "/mayor", "/mayor/policy-progress",
  "/timeline", "/data-status", "/finance", "/questions",
  ...BILL_IDS.map((id) => `/bills/votes/${id}`),
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
/** 廃止した旧ラベル（更新履歴での引用を除く）。 */
const RETIRED_LABELS = ["市長公約の登録数", "公約分野", "全公約数", "マニフェストの大項目"];
/**
 * 市民向けページに出てはいけない内部用語。
 * `/data-status` と `/methodology/*` は意味の説明付きで内部状態を示す画面のため対象外。
 */
const INTERNAL_TERMS = [
  /(^|[^/A-Za-z0-9._-])[a-z][A-Za-z0-9]*\.json(?![A-Za-z0-9])/,
  /(^|[^A-Za-z0-9_])[a-z][A-Za-z0-9]*Yen(?![A-Za-z0-9_])/,
  /(^|[^A-Za-z0-9_])(?:verificationStatus|verificationNote|sourceRefs?|reasonCode|partiallyVerified|sourceUnavailable|unconfirmed)(?![A-Za-z0-9_])/,
  /(^|[^A-Za-z0-9_])(?:HUMAN_ACTION_REQUIRED|MANUAL_REVIEW|RESEARCH_EXHAUSTED|NO_SEPARATE_BILL_LIKELY|BUDGET_BILL_INCLUDED|SHARED_REASON|EXPLAINABLE_FROM_PRIMARY)(?![A-Za-z0-9_])/,
  /(^|[^A-Za-z0-9_])Level[123](?![A-Za-z0-9_])/,
];
const AUDIT_ROUTES = ["/data-status", "/methodology"];

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

    const row = { vp: vp.name, route, status: null, overflow: null, banned: [], retired: [], internal: [], err: null, textLen: 0 };
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
      if (!AUDIT_ROUTES.some((a) => route.startsWith(a))) {
        row.internal = INTERNAL_TERMS.filter((re) => re.test(text)).map((re) => String(re).slice(0, 45));
      }
      row.noReasonShown = text.includes("この議案だけの提案理由を確認できませんでした");
      row.sharedShown = text.includes("まとめて説明されたとき");
      row.promiseState = ["予算議案に含まれています", "関連議案を確認済み", "追加確認中", "独立した関連議案は確認されていません"]
        .filter((p) => text.includes(p));
      row.sessionSplit = text.includes("直近の確認済み会期") && text.includes("次回・開催予定");
    } catch (e) {
      row.err = String(e).split("\n")[0];
    }
    row.consoleErrors = consoleErrors.length;

    row.ok =
      row.status === 200 && !row.err && row.textLen > 150 && row.overflow <= 1 &&
      row.banned.length === 0 && row.retired.length === 0 &&
      row.internal.length === 0 && row.consoleErrors === 0;
    if (!row.ok) failures++;
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
      `internal=${JSON.stringify(r.internal)} console=${r.consoleErrors} err=${r.err ?? "-"}`,
  );
}

const at = (route) => rows.find((r) => r.route === route && r.vp === "390");
console.log(`\n[verify] ${BASE}`);
console.log(`[verify] ${PAGES.length}ページ × ${VIEWPORTS.length}viewport = ${rows.length}件`);
console.log(`[verify] 合格 ${rows.length - failures} / 不合格 ${failures}`);
console.log(`[verify] 二重語のあったページ: ${rows.filter((r) => r.banned.length).length}件`);
console.log(`[verify] 旧ラベルの残るページ: ${rows.filter((r) => r.retired.length).length}件`);
console.log(`[verify] 内部用語の露出したページ: ${rows.filter((r) => r.internal.length).length}件`);
console.log(`[verify] consoleエラー: ${rows.reduce((a, r) => a + r.consoleErrors, 0)}件`);
console.log(`[verify] 横スクロール最大: ${Math.max(...rows.map((r) => r.overflow ?? 0))}px`);
console.log(`[verify] 議案詳細で「個別の提案理由なし」表示: ${rows.filter((r) => r.noReasonShown).length}件`);
console.log(`[verify] 議案詳細で「まとめて説明」表示: ${rows.filter((r) => r.sharedShown).length}件`);
console.log(`[verify] 公約の状態表示（390px /mayor）: ${JSON.stringify(at("/mayor")?.promiseState)}`);
console.log(`[verify] 会期の直近/予定の分離（390px /dashboard）: ${at("/dashboard")?.sessionSplit}`);

process.exit(failures > 0 ? 1 : 0);
