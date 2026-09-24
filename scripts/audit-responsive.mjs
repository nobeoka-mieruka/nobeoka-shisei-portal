/**
 * 実レンダリング・レスポンシブ監査（Phase191）
 *
 * ビルド済み dist/ を `vite preview` で配信し、headless Chromium（playwright-core）で
 * 実際に描画したうえで、機械的に検出できる表示崩れだけを収集する。
 *
 * 検出項目：
 *  - 横スクロール（document.documentElement.scrollWidth > innerWidth）
 *  - 要素のビューポート外突出（右端はみ出し・左端はみ出し）
 *  - overflow:hidden による文字切れ（scrollWidth > clientWidth かつ省略記号指定なし）
 *  - table の横溢れ（横スクロール可能な祖先を持たない table のはみ出し）
 *  - 小さすぎるタップ領域（44x44 未満の操作要素。本文中のインラインリンクは別分類）
 *  - fixed / sticky 要素同士の重なり
 *  - modal / tooltip（role=dialog / role=tooltip）のビューポート外配置
 *
 * 使い方：
 *   npm run build
 *   node scripts/audit-responsive.mjs               # vite preview を自動起動して監査
 *   node scripts/audit-responsive.mjs --base-url=http://localhost:4173  # 既存サーバを使う
 *   node scripts/audit-responsive.mjs --label=after # レポートのラベル（before/after比較用）
 *
 * 出力：
 *   reports/phase191-responsive/audit-<label>.json      機械可読レポート（Git管理）
 *   reports/phase191-responsive/screenshots/*.png       不具合検出時のみ保存（Git管理外）
 *
 * 注意：本番サイト（Cloudflare Pages）へはアクセスしない。常にローカルの dist/ を対象にする。
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.length ? rest.join("=") : "true"];
  }),
);

const LABEL = args.get("label") ?? "latest";
const PORT = Number(args.get("port") ?? 4183);
const EXTERNAL_BASE_URL = args.get("base-url");
const SAVE_SCREENSHOTS = args.get("screenshots") !== "false";
/** core：市民向け主要ページ×主要幅の短時間監査／full：詳細ページを含む全組合せ（既定） */
const PRESET = args.get("preset") ?? "full";
/** 監査全体の上限時間。超えたら残りは NOT_RUN として記録し、待たずに終了する。 */
const MAX_MINUTES = Number(args.get("max-minutes") ?? 15);
/** 1組合せ（1ページ×1ビューポート）の上限時間。goto・評価・スクリーンショットをすべて含む。 */
const PAGE_TIMEOUT_MS = Number(args.get("page-timeout") ?? 25000);

const OUT_DIR = join(root, "reports", "phase191-responsive");
const SHOT_DIR = join(OUT_DIR, "screenshots", LABEL);

/** core プリセットのビューポート（320〜1280の8通り）。 */
const CORE_VIEWPORTS = [
  { name: "320x568", width: 320, height: 568, mobile: true },
  { name: "360x800", width: 360, height: 800, mobile: true },
  { name: "375x812", width: 375, height: 812, mobile: true },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "414x896", width: 414, height: 896, mobile: true },
  { name: "768x1024", width: 768, height: 1024, mobile: false },
  { name: "1024x768", width: 1024, height: 768, mobile: false },
  { name: "1280x720", width: 1280, height: 720, mobile: false },
];

/** core プリセットのページ。/general-questions は実在ルートではない（一般質問は /questions）ため、NotFound表示の崩れ確認として含める。 */
const CORE_PAGES = [
  { path: "/", kind: "top" },
  { path: "/search", kind: "index" },
  { path: "/themes", kind: "index" },
  { path: "/themes/education", kind: "theme-detail" },
  { path: "/timeline", kind: "index" },
  { path: "/questions", kind: "index" },
  { path: "/general-questions", kind: "not-found" },
  { path: "/council-activity", kind: "index" },
  { path: "/finance", kind: "index" },
  { path: "/data-status", kind: "index" },
  { path: "/members/m01", kind: "member-detail" },
];

/** 監査対象ビューポート（full プリセット）。 */
const FULL_VIEWPORTS = [
  { name: "320x568", width: 320, height: 568, mobile: true },
  { name: "360x800", width: 360, height: 800, mobile: true },
  { name: "375x812", width: 375, height: 812, mobile: true },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "430x932", width: 430, height: 932, mobile: true },
  { name: "414x896", width: 414, height: 896, mobile: true },
  { name: "1024x768", width: 1024, height: 768, mobile: false },
  { name: "768x1024", width: 768, height: 1024, mobile: false },
  { name: "1280x720", width: 1280, height: 720, mobile: false },
  { name: "1440x900", width: 1440, height: 900, mobile: false },
  { name: "1920x1080", width: 1920, height: 1080, mobile: false },
];

/**
 * 監査対象ページ。主要な一覧・ダッシュボードに加え、詳細ページ（議員・一般質問・議案・歴代市長）
 * を指示どおりの件数で含める。ルートは scripts/lib/public-routes.mjs の実在URLと一致させている。
 */
const FULL_PAGES = [
  { path: "/", kind: "top" },
  { path: "/dashboard", kind: "index" },
  { path: "/data-status", kind: "index" },
  { path: "/people", kind: "index" },
  { path: "/questions", kind: "index" },
  { path: "/bills", kind: "index" },
  { path: "/bills/votes", kind: "index" },
  { path: "/committees", kind: "index" },
  { path: "/finance", kind: "index" },
  { path: "/finance/budget", kind: "index" },
  { path: "/elections", kind: "index" },
  // Phase274：選挙資料（選挙公報の12項目・出典カード）を含む詳細ページ
  { path: "/elections/election-mayor-2025", kind: "election-detail" },
  { path: "/timeline", kind: "index" },
  { path: "/search", kind: "index" },
  { path: "/themes", kind: "index" },
  { path: "/themes/education", kind: "theme-detail" },
  { path: "/themes/finance-reform", kind: "theme-detail" },
  { path: "/council-documents/2026-06", kind: "session-detail" },
  { path: "/mayor", kind: "index" },
  { path: "/mayors", kind: "index" },
  { path: "/mayor/policy-progress", kind: "index" },
  { path: "/compare", kind: "index" },
  { path: "/compensation", kind: "index" },
  { path: "/council-activity", kind: "index" },
  // 議員活動の記録（会期単位）：一般質問実施率の分子・分母、会期ごとの内訳、議長の「対象外」表示
  { path: "/council-activity/m24", kind: "council-activity-member" },
  { path: "/council-activity/m18", kind: "council-activity-member" },
  { path: "/methodology/council-activity", kind: "index" },
  // 議員詳細（3件以上）
  { path: "/members/m01", kind: "member-detail" },
  { path: "/members/m02", kind: "member-detail" },
  { path: "/members/m03", kind: "member-detail" },
  { path: "/members/m04", kind: "member-detail" },
  // 一般質問詳細（3件以上）
  { path: "/questions/gq2026-06-m24", kind: "question-detail" },
  { path: "/questions/gq2026-06-m17", kind: "question-detail" },
  { path: "/questions/gq2026-06-m14", kind: "question-detail" },
  { path: "/questions/gq2026-06-m08", kind: "question-detail" },
  // 議案詳細（5件以上）
  { path: "/bills/votes/2019-06-gian-10", kind: "bill-detail" },
  { path: "/bills/votes/2019-06-chinjo-1", kind: "bill-detail" },
  { path: "/bills/bill-fy2026-general-account-supplementary-budget-2", kind: "bill-detail" },
  { path: "/bills/bill-auditor-appointment-2026-06", kind: "bill-detail" },
  { path: "/bills/bill-bridge-repair-contract-2026-06", kind: "bill-detail" },
  // 市長公約の詳細（Phase267で追加した指標・年度別数値のカード表示を含む）
  { path: "/mayor/policy-progress/1-1", kind: "promise-detail" },
  { path: "/mayor/policy-progress/4-3", kind: "promise-detail" },
  { path: "/mayor/policy-progress/2-3", kind: "promise-detail" },
  // 歴代市長詳細（3件以上）
  { path: "/mayors/aoki-yoshisuke", kind: "mayor-detail" },
  { path: "/mayors/miura-hisatomo", kind: "mayor-detail" },
  { path: "/mayors/fusano-hiroshi", kind: "mayor-detail" },
];

const VIEWPORTS = PRESET === "core" ? CORE_VIEWPORTS : FULL_VIEWPORTS;
const PAGES = PRESET === "core" ? CORE_PAGES : FULL_PAGES;

/** ブラウザ内で実行する監査本体。DOMに触れるだけで副作用は持たない。 */
/* eslint-disable */
function collectIssues() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TAP_MIN = 44;
  const TOL = 1; // サブピクセル誤差の許容

  const issues = [];
  const seenSelectors = new Set();

  function selectorOf(el) {
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && depth < 5) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        part += "#" + cur.id;
        parts.unshift(part);
        break;
      }
      const cls = (cur.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 4);
      if (cls.length) part += "." + cls.join(".");
      parts.unshift(part);
      cur = cur.parentElement;
      depth += 1;
    }
    return parts.join(" > ");
  }

  function textOf(el) {
    const t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    return t.length > 80 ? t.slice(0, 80) + "…" : t;
  }

  function isVisible(el, rect, style) {
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return false;
    if (rect.width <= 0 || rect.height <= 0) return false;
    return true;
  }

  /**
   * スクリーンリーダー専用テキスト（Tailwindのsr-only）は、1x1へ意図的に切り詰めて
   * 視覚的に隠す実装であり、表示崩れではない。文字切れ・タップ領域の検出から除外する。
   */
  function isScreenReaderOnly(el, rect, style) {
    if (/(^|\s)sr-only(\s|$)/.test(el.getAttribute("class") || "")) return true;
    return (
      style.position === "absolute" &&
      Math.round(rect.width) <= 1 &&
      Math.round(rect.height) <= 1 &&
      (style.clip !== "auto" || style.clipPath !== "none" || style.overflow === "hidden")
    );
  }

  function push(issue) {
    const key = issue.type + "|" + issue.selector + "|" + (issue.detail || "");
    if (seenSelectors.has(key)) return;
    seenSelectors.add(key);
    issues.push(issue);
  }

  // --- 1. ページ全体の横スクロール ---
  const docScrollWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body ? document.body.scrollWidth : 0,
  );
  const horizontalScroll = docScrollWidth > vw + TOL;

  const all = Array.from(document.body.querySelectorAll("*"));
  const styles = new Map();
  const rects = new Map();
  for (const el of all) {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    styles.set(el, style);
    rects.set(el, rect);
  }

  function scrollableAncestor(el) {
    let cur = el.parentElement;
    while (cur && cur !== document.body) {
      const s = styles.get(cur) || window.getComputedStyle(cur);
      if (s.overflowX === "auto" || s.overflowX === "scroll" || s.overflow === "auto" || s.overflow === "scroll") {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  for (const el of all) {
    const style = styles.get(el);
    const rect = rects.get(el);
    if (!isVisible(el, rect, style)) continue;
    if (isScreenReaderOnly(el, rect, style)) continue;

    // --- 2. ビューポート外突出（横スクロール可能な祖先の内側は正当な横スクロールとみなす） ---
    const overflowRight = rect.right - vw;
    const overflowLeft = -rect.left;
    if ((overflowRight > TOL || overflowLeft > TOL) && !scrollableAncestor(el)) {
      // 子も同じくはみ出す場合は最も深い要素だけを記録したいので、子にはみ出す要素があればスキップ
      const childOverflows = Array.from(el.children).some((c) => {
        const r = rects.get(c);
        return r && (r.right - vw > TOL || -r.left > TOL);
      });
      if (!childOverflows) {
        push({
          type: overflowRight > TOL ? "viewport-overflow-right" : "viewport-overflow-left",
          selector: selectorOf(el),
          detail: `overflowPx=${Math.round(Math.max(overflowRight, overflowLeft))}`,
          overflowPx: Math.round(Math.max(overflowRight, overflowLeft)),
          tag: el.tagName.toLowerCase(),
          text: textOf(el),
        });
      }
    }

    // --- 3. overflow:hidden による文字切れ ---
    const clipsX = style.overflowX === "hidden" || style.overflow === "hidden" || style.overflowX === "clip";
    if (clipsX && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      const hasEllipsis = style.textOverflow === "ellipsis" || /line-clamp/.test(el.className || "");
      const t = textOf(el);
      if (!hasEllipsis && t.length > 0 && el.children.length === 0) {
        push({
          type: "text-clipped",
          selector: selectorOf(el),
          detail: `scrollWidth=${el.scrollWidth} clientWidth=${el.clientWidth}`,
          overflowPx: el.scrollWidth - el.clientWidth,
          tag: el.tagName.toLowerCase(),
          text: t,
        });
      }
    }

    // --- 4. table の横溢れ ---
    if (el.tagName === "TABLE") {
      const scroller = scrollableAncestor(el);
      const availableWidth = scroller ? scroller.clientWidth : vw;
      if (rect.width > availableWidth + TOL && !scroller) {
        push({
          type: "table-overflow",
          selector: selectorOf(el),
          detail: `tableWidth=${Math.round(rect.width)} available=${Math.round(availableWidth)}`,
          overflowPx: Math.round(rect.width - availableWidth),
          tag: "table",
          text: textOf(el),
        });
      }
    }

    // --- 5. タップ領域 ---
    const isControl =
      el.matches("a[href], button, summary, select, input, textarea, [role='button'], [role='tab'], [role='link']");
    if (isControl && !el.hasAttribute("disabled")) {
      const w = rect.width;
      const h = rect.height;
      if (w < TAP_MIN - TOL || h < TAP_MIN - TOL) {
        // 本文中のインラインリンク（段落・リスト内で display:inline のもの）は
        // 拡大すると文章が読みにくくなるため別分類にする
        const inlineInText =
          style.display === "inline" && !!el.closest("p, li, dd, td, blockquote, figcaption");
        push({
          type: inlineInText ? "tap-target-inline-link" : "tap-target-small",
          selector: selectorOf(el),
          detail: `${Math.round(w)}x${Math.round(h)}`,
          width: Math.round(w),
          height: Math.round(h),
          tag: el.tagName.toLowerCase(),
          text: textOf(el),
        });
      }
    }

    // --- 7. modal / tooltip のビューポート外 ---
    const role = el.getAttribute("role");
    if (role === "dialog" || role === "alertdialog" || role === "tooltip") {
      if (rect.right > vw + TOL || rect.left < -TOL || rect.bottom > vh + TOL || rect.top < -TOL) {
        push({
          type: "overlay-out-of-viewport",
          selector: selectorOf(el),
          detail: `rect=${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.right)},${Math.round(rect.bottom)} viewport=${vw}x${vh}`,
          tag: el.tagName.toLowerCase(),
          text: textOf(el),
        });
      }
    }
  }

  // --- 6. fixed / sticky 要素の重なり ---
  // sticky要素は「実際に張り付いている状態（rect.topが指定top値と一致）」のときだけ対象にする。
  // 通常フローのまま画面下部に写り込んでいるだけの状態を重なりとして数えないため。
  const pinned = all.filter((el) => {
    const s = styles.get(el);
    const r = rects.get(el);
    if (!s || !r) return false;
    if (!isVisible(el, r, s)) return false;
    if (s.position === "fixed") return true;
    if (s.position !== "sticky") return false;
    const topValue = parseFloat(s.top);
    return Number.isFinite(topValue) && Math.abs(r.top - topValue) < 2;
  });
  for (let i = 0; i < pinned.length; i += 1) {
    for (let j = i + 1; j < pinned.length; j += 1) {
      const a = pinned[i];
      const b = pinned[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = rects.get(a);
      const rb = rects.get(b);
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 4 && oy > 4) {
        push({
          type: "pinned-overlap",
          selector: selectorOf(a) + " ⨯ " + selectorOf(b),
          detail: `overlap=${Math.round(ox)}x${Math.round(oy)}`,
          overlapArea: Math.round(ox * oy),
        });
      }
    }
  }

  return {
    horizontalScroll,
    docScrollWidth,
    viewportWidth: vw,
    overflowPx: Math.max(0, docScrollWidth - vw),
    issues,
  };
}
/* eslint-enable */


class TimeoutError extends Error {}

/** どんな処理も必ず ms 以内に決着させる（Playwright の evaluate 等は既定でタイムアウトを持たないため）。 */
function withTimeout(promise, ms, label) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${label} が ${ms}ms を超えました`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

function waitForServer(url, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(3000) });
        if (res.ok) return resolve(true);
      } catch {
        /* まだ起動していない */
      }
      if (Date.now() - started > timeoutMs) return reject(new Error(`サーバが起動しませんでした: ${url}`));
      setTimeout(tick, 400);
    };
    tick();
  });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "localhost");
  });
}

/** 前回の監査が残した vite preview 等とぶつからないよう、空いているポートを探す。 */
async function findFreePort(start) {
  for (let p = start; p < start + 20; p += 1) {
    if (await isPortFree(p)) return p;
  }
  throw new Error(`空きポートが見つかりません（${start}〜${start + 19}）`);
}

/** shell 経由で起動した vite を子孫プロセスごと確実に止める（server.kill() だけでは vite 本体が残る）。 */
function killServer(server) {
  if (!server || server.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-server.pid, "SIGTERM");
    }
  } catch {
    try {
      server.kill();
    } catch {
      /* すでに終了している */
    }
  }
}

/** 同一オリジン以外（GA・Google Fonts等）への通信は遮断し、外部応答待ちで監査が止まらないようにする。 */
async function openPage(browser, vp, baseOrigin) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    userAgent: vp.mobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : undefined,
  });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(baseOrigin) || url.startsWith("data:") || url.startsWith("blob:")) {
      return route.continue();
    }
    return route.abort();
  });
  context.setDefaultTimeout(PAGE_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);
  const page = await context.newPage();
  return { context, page };
}

async function auditOne(page, url) {
  await page.goto(url, { waitUntil: "load" });
  // 外部通信は遮断済みなので networkidle はすぐ成立する。成立しなくても上限付きで先へ進む。
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(120);
  const record = await page.evaluate(collectIssues);
  // sticky要素は最上部までスクロールした状態では「張り付いていない」ため、
  // ページ中ほどまでスクロールした状態でもう一度、固定表示同士の重なりだけを確認する。
  await page.evaluate(() => window.scrollTo(0, Math.round(document.body.scrollHeight / 2)));
  await page.waitForTimeout(160);
  const scrolled = await page.evaluate(collectIssues);
  const seen = new Set(record.issues.map((i) => i.type + "|" + i.selector + "|" + (i.detail || "")));
  for (const issue of scrolled.issues) {
    if (issue.type !== "pinned-overlap" && issue.type !== "overlay-out-of-viewport") continue;
    const key = issue.type + "|" + issue.selector + "|" + (issue.detail || "");
    if (seen.has(key)) continue;
    seen.add(key);
    record.issues.push({ ...issue, scrollState: "mid-page" });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(80);
  return record;
}

const state = {
  baseUrl: null,
  startedAt: Date.now(),
  results: [],
  screenshotCount: 0,
  deadlineHit: false,
  reportWritten: false,
};

function statusCounts(results) {
  const counts = { PASS: 0, ISSUES: 0, TIMEOUT: 0, ERROR: 0, NOT_RUN: 0 };
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  return counts;
}

function writeReports() {
  if (state.reportWritten) return;
  state.reportWritten = true;
  const { results } = state;

  // まだ実行していない組合せは NOT_RUN として明示する（黙って省略しない）
  const done = new Set(results.map((r) => r.viewport + " " + r.path));
  for (const vp of VIEWPORTS) {
    for (const target of PAGES) {
      if (!done.has(vp.name + " " + target.path)) {
        results.push({ path: target.path, kind: target.kind, viewport: vp.name, status: "NOT_RUN", issues: [] });
      }
    }
  }

  const countByType = {};
  for (const r of results) {
    for (const i of r.issues) countByType[i.type] = (countByType[i.type] || 0) + 1;
  }
  const horizontalScrollCombos = results.filter((r) => r.horizontalScroll);
  const byViewport = {};
  for (const vp of VIEWPORTS) {
    const rs = results.filter((r) => r.viewport === vp.name);
    byViewport[vp.name] = {
      pages: rs.length,
      ...statusCounts(rs),
      horizontalScrollPages: rs.filter((r) => r.horizontalScroll).length,
      issues: rs.reduce((n, r) => n + r.issues.length, 0),
      blockingIssues: rs.reduce(
        (n, r) => n + r.issues.filter((i) => i.type !== "tap-target-inline-link").length,
        0,
      ),
    };
  }
  const statuses = statusCounts(results);

  const report = {
    label: LABEL,
    preset: PRESET,
    generatedAt: new Date().toISOString(),
    elapsedSeconds: Math.round((Date.now() - state.startedAt) / 1000),
    limits: { maxMinutes: MAX_MINUTES, pageTimeoutMs: PAGE_TIMEOUT_MS, deadlineHit: state.deadlineHit },
    baseUrl: state.baseUrl,
    viewports: VIEWPORTS.map((v) => v.name),
    pages: PAGES.map((p) => p.path),
    summary: {
      viewportCount: VIEWPORTS.length,
      pageCount: PAGES.length,
      combinations: VIEWPORTS.length * PAGES.length,
      renderedCombinations: statuses.PASS + statuses.ISSUES,
      statuses,
      screenshots: state.screenshotCount,
      horizontalScrollCombinations: horizontalScrollCombos.length,
      totalIssues: Object.values(countByType).reduce((a, b) => a + b, 0),
      issuesByType: countByType,
      byViewport,
    },
    results,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outFile = join(OUT_DIR, `audit-${LABEL}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n", "utf8");

  // 全組合せの明細（数MB）はGit管理せず、種類＋要素セレクタ単位に集約した要約だけをGitへ残す。
  const grouped = new Map();
  for (const r of results) {
    for (const i of r.issues) {
      const key = `${i.type} ${i.selector}`;
      let g = grouped.get(key);
      if (!g) {
        g = {
          type: i.type,
          selector: i.selector,
          occurrences: 0,
          viewports: new Set(),
          paths: new Set(),
          sizes: new Set(),
          maxOverflowPx: 0,
          sampleText: i.text ?? "",
        };
        grouped.set(key, g);
      }
      g.occurrences += 1;
      g.viewports.add(r.viewport);
      g.paths.add(r.path);
      if (i.detail) g.sizes.add(i.detail);
      if (typeof i.overflowPx === "number") g.maxOverflowPx = Math.max(g.maxOverflowPx, i.overflowPx);
    }
  }
  const summaryReport = {
    ...report,
    note: "results（全組合せの明細）は audit-<label>.json 側にのみ保存する（Git管理外）。ここでは種類＋要素セレクタ単位に集約した結果と、PASS以外の組合せを記録する。",
    results: undefined,
    nonPassing: results
      .filter((r) => r.status === "TIMEOUT" || r.status === "ERROR" || r.status === "NOT_RUN")
      .map((r) => ({ path: r.path, viewport: r.viewport, status: r.status, error: r.error })),
    issueGroups: [...grouped.values()]
      .sort((a, b) => b.occurrences - a.occurrences)
      .map((g) => ({
        type: g.type,
        selector: g.selector,
        occurrences: g.occurrences,
        viewports: [...g.viewports],
        paths: [...g.paths].slice(0, 8),
        pathCount: g.paths.size,
        sizes: [...g.sizes].slice(0, 5),
        maxOverflowPx: g.maxOverflowPx || undefined,
        sampleText: g.sampleText,
      })),
  };
  delete summaryReport.results;
  const summaryFile = join(OUT_DIR, `audit-${LABEL}-summary.json`);
  writeFileSync(summaryFile, JSON.stringify(summaryReport, null, 2) + "\n", "utf8");

  console.log("\n=== Phase191 レスポンシブ監査サマリ ===");
  console.log(
    `プリセット: ${PRESET} / ビューポート: ${VIEWPORTS.length} / ページ: ${PAGES.length} / 組合せ: ${VIEWPORTS.length * PAGES.length}`,
  );
  console.log(`経過: ${report.elapsedSeconds}秒${state.deadlineHit ? `（上限${MAX_MINUTES}分に到達）` : ""}`);
  console.log(
    `PASS ${statuses.PASS} / ISSUES ${statuses.ISSUES} / TIMEOUT ${statuses.TIMEOUT} / ERROR ${statuses.ERROR} / NOT_RUN ${statuses.NOT_RUN}`,
  );
  console.log(`横スクロール発生: ${horizontalScrollCombos.length} 組合せ`);
  console.log(`検出件数: ${JSON.stringify(countByType, null, 2)}`);
  for (const r of summaryReport.nonPassing) console.log(`  ${r.status} ${r.viewport} ${r.path} ${r.error ?? ""}`);
  console.log(`レポート（明細）: ${outFile}`);
  console.log(`レポート（集約）: ${summaryFile}`);
}

async function main() {
  if (!existsSync(join(root, "dist", "index.html"))) {
    throw new Error("dist/index.html がありません。先に `npm run build` を実行してください。");
  }

  let server = null;
  const deadline = state.startedAt + MAX_MINUTES * 60 * 1000;

  // 最終防衛線：ループ側の締め切り判定が何らかの理由で効かなくても、上限+2分で必ず結果を書いて終了する。
  const watchdog = setTimeout(
    () => {
      console.error(`[audit-responsive] 上限 ${MAX_MINUTES}分+2分 を超えたため強制終了します`);
      state.deadlineHit = true;
      writeReports();
      killServer(server);
      process.exit(2);
    },
    (MAX_MINUTES + 2) * 60 * 1000,
  );
  watchdog.unref();
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.once(sig, () => {
      killServer(server);
      process.exit(130);
    });
  }

  let baseUrl = EXTERNAL_BASE_URL;
  if (!baseUrl) {
    const port = await findFreePort(PORT);
    baseUrl = `http://localhost:${port}`;
    console.log(`[audit-responsive] vite preview を起動します (${baseUrl})`);
    server = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], {
      cwd: root,
      shell: true,
      stdio: "ignore",
      detached: process.platform !== "win32",
    });
    await waitForServer(baseUrl);
  }
  state.baseUrl = baseUrl;
  const baseOrigin = new URL(baseUrl).origin;

  mkdirSync(OUT_DIR, { recursive: true });
  if (SAVE_SCREENSHOTS) {
    rmSync(SHOT_DIR, { recursive: true, force: true });
    mkdirSync(SHOT_DIR, { recursive: true });
  }

  let browser = null;
  let session = null; // { context, page }

  const closeBrowser = async () => {
    if (session) await withTimeout(session.context.close(), 5000, "context.close").catch(() => {});
    session = null;
    if (browser) await withTimeout(browser.close(), 10000, "browser.close").catch(() => {});
    browser = null;
  };
  const ensureSession = async (vp) => {
    if (browser && !browser.isConnected()) {
      browser = null;
      session = null;
    }
    if (!browser) browser = await withTimeout(chromium.launch({ headless: true }), 30000, "chromium.launch");
    if (!session) session = await withTimeout(openPage(browser, vp, baseOrigin), 15000, "newPage");
    return session.page;
  };
  /** タイムアウトやクラッシュの後は、固まったページを使い回さず作り直す。 */
  const resetSession = async () => {
    if (session) await withTimeout(session.context.close(), 5000, "context.close").catch(() => {});
    session = null;
    if (browser && !browser.isConnected()) browser = null;
  };

  try {
    outer: for (const vp of VIEWPORTS) {
      // 長時間の監査でChromiumが落ちることがあるため、ビューポートごとにブラウザを起動し直す。
      await closeBrowser();
      for (const target of PAGES) {
        if (Date.now() > deadline) {
          state.deadlineHit = true;
          console.log(`[audit-responsive] 上限 ${MAX_MINUTES}分に到達。残りは NOT_RUN として記録します`);
          break outer;
        }
        const url = baseUrl + target.path;
        const t0 = Date.now();
        const base = { path: target.path, kind: target.kind, viewport: vp.name };
        let entry;
        try {
          const page = await ensureSession(vp);
          const record = await withTimeout(auditOne(page, url), PAGE_TIMEOUT_MS, "ページ監査");
          const blocking = record.issues.filter((i) => i.type !== "tap-target-inline-link");
          entry = {
            ...base,
            status: record.horizontalScroll || blocking.length > 0 ? "ISSUES" : "PASS",
            horizontalScroll: record.horizontalScroll,
            overflowPx: record.overflowPx,
            issues: record.issues,
          };
          if (SAVE_SCREENSHOTS && entry.status === "ISSUES") {
            const file = join(
              SHOT_DIR,
              `${vp.name}__${target.path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "root"}.png`,
            );
            try {
              await withTimeout(page.screenshot({ path: file, fullPage: true, timeout: 10000 }), 12000, "screenshot");
              entry.screenshot = file.replace(root + "\\", "").replace(root + "/", "").replace(/\\/g, "/");
              state.screenshotCount += 1;
            } catch {
              /* スクリーンショット失敗は監査自体を止めない */
            }
          }
        } catch (err) {
          const isTimeout = err instanceof TimeoutError || err?.name === "TimeoutError";
          entry = {
            ...base,
            status: isTimeout ? "TIMEOUT" : "ERROR",
            error: String(err?.message || err).split("\n")[0],
            issues: [],
          };
          await resetSession();
        }
        entry.ms = Date.now() - t0;
        state.results.push(entry);
        console.log(`[audit-responsive] ${entry.status.padEnd(7)} ${vp.name} ${target.path} (${entry.ms}ms)`);
      }
      console.log(`[audit-responsive] ${vp.name} 完了 (${PAGES.length}ページ)`);
    }
  } finally {
    await closeBrowser();
    killServer(server);
    clearTimeout(watchdog);
  }

  writeReports();
  const s = statusCounts(state.results);
  if (s.TIMEOUT + s.ERROR + s.NOT_RUN > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  if (state.results.length) writeReports();
  process.exit(1);
});
