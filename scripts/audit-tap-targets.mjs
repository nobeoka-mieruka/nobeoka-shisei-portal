/**
 * タップ領域・320px要対応候補の完全分類監査（Phase197）
 *
 * Phase191の `scripts/audit-responsive.mjs` は「44x44未満の操作要素」を機械的に数えるだけで、
 * 検出された1件ずつが実際に市民の利用を妨げるのかまでは判定していない。
 * 本スクリプトはPhase191と同一の検出条件を再現したうえで、各検出に判定材料を付加する。
 *
 * 付加する測定値：
 *  - 実効タップ領域（`<label>`で包まれた入力欄、`position:absolute; inset:0`の疑似要素／
 *    子リンクで拡張されたカード全面リンクなど、見た目の矩形より広い操作領域を実測する）
 *  - WCAG 2.2 達成基準 2.5.8（Target Size (Minimum)、レベルAA、24x24 CSSピクセル）の充足
 *  - WCAG 2.2 2.5.8 の「間隔」例外（他の操作要素の中心と24px以上離れているか）
 *  - WCAG 2.1 達成基準 2.5.5（Target Size、レベルAAA、44x44 CSSピクセル）の充足
 *  - 要素が属する領域（サイトヘッダー／パンくず／表のヘッダー行／本文など）
 *  - 開始タグ（class属性を含む）— 実装ファイルの特定用
 *
 * これらの測定値と、`CLASSIFICATIONS` に記録した実装ファイル単位の判断を突き合わせ、
 * 各グループを次の5分類へ割り当てる。
 *   REAL_BUG / ACCESSIBILITY_IMPROVEMENT / INTENTIONAL / FALSE_POSITIVE / NON_INTERACTIVE
 *
 * 使い方：
 *   npm run build
 *   node scripts/audit-tap-targets.mjs                 # vite preview を自動起動して監査
 *   node scripts/audit-tap-targets.mjs --label=after   # 修正後の再測定
 *   node scripts/audit-tap-targets.mjs --label=before --render-only
 *       # 測定済みJSONから分類・Markdownだけを作り直す（ブラウザを起動しない）
 *
 * 出力（`--label=before` はサフィックスなし、それ以外は `-<label>` を付けた別ファイル）：
 *   reports/phase197-tap-target-classification.json     グループ単位の分類（Git管理）
 *   reports/phase197-tap-target-classification.md       同上（可読版、Git管理）
 *   reports/phase197-320px-classification.json          320x568の要対応候補の明細（Git管理）
 *   reports/phase197-320px-classification.md            同上（可読版、Git管理）
 *   reports/phase197-screenshots/                       要素切り出し画像（再生成可能、Git管理外）
 *
 * 注意：本番サイト（Cloudflare Pages）へはアクセスしない。常にローカルの dist/ を対象にする。
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { CLASSIFICATIONS, CLASSIFICATION_LABELS, matchClassification } from "./lib/tap-target-classification.mjs";
import { render320Markdown, renderGroupMarkdown } from "./lib/tap-target-report.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.length ? rest.join("=") : "true"];
  }),
);

const LABEL = args.get("label") ?? "current";
const PORT = Number(args.get("port") ?? 4187);
const EXTERNAL_BASE_URL = args.get("base-url");
const SAVE_CLIPS = args.get("clips") !== "false";

const OUT_DIR = join(root, "reports");
const SHOT_DIR = join(OUT_DIR, "phase197-screenshots", LABEL);
/**
 * 分類レポート本体は修正前（label=before）の状態を記録したものが正であるため、
 * before はサフィックスなしの正式名で出力し、修正後の再測定などはラベル名を付けて別ファイルにする。
 */
const SUFFIX = LABEL === "before" ? "" : `-${LABEL}`;

/** Phase191と同一のビューポート。 */
const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568, mobile: true },
  { name: "360x800", width: 360, height: 800, mobile: true },
  { name: "375x812", width: 375, height: 812, mobile: true },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "430x932", width: 430, height: 932, mobile: true },
  { name: "768x1024", width: 768, height: 1024, mobile: false },
  { name: "1280x720", width: 1280, height: 720, mobile: false },
  { name: "1440x900", width: 1440, height: 900, mobile: false },
  { name: "1920x1080", width: 1920, height: 1080, mobile: false },
];

/** Phase191と同一の32ページ。 */
const PAGES = [
  "/",
  "/dashboard",
  "/data-status",
  "/people",
  "/questions",
  "/bills",
  "/bills/votes",
  "/committees",
  "/finance",
  "/timeline",
  "/mayor",
  "/mayors",
  "/mayor/policy-progress",
  "/compare",
  "/compensation",
  "/council-activity",
  "/members/m01",
  "/members/m02",
  "/members/m03",
  "/members/m04",
  "/questions/gq2026-06-m24",
  "/questions/gq2026-06-m17",
  "/questions/gq2026-06-m14",
  "/questions/gq2026-06-m08",
  "/bills/votes/2019-06-gian-10",
  "/bills/votes/2019-06-chinjo-1",
  "/bills/bill-fy2026-general-account-supplementary-budget-2",
  "/bills/bill-auditor-appointment-2026-06",
  "/bills/bill-bridge-repair-contract-2026-06",
  "/mayors/aoki-yoshisuke",
  "/mayors/miura-hisatomo",
  "/mayors/fusano-hiroshi",
];

/** ブラウザ内で実行する測定本体。DOMには触れるだけで副作用は持たない。 */
/* eslint-disable */
function collectTapTargets() {
  const vw = window.innerWidth;
  const TAP_MIN = 44; // WCAG 2.1 SC 2.5.5（AAA）
  const WCAG22_MIN = 24; // WCAG 2.2 SC 2.5.8（AA）
  const TOL = 1;
  const CONTROL_SELECTOR =
    "a[href], button, summary, select, input, textarea, [role='button'], [role='tab'], [role='link']";

  const issues = [];
  const seen = new Set();

  // --- Phase191と同一のセレクタ生成・可視判定 ---
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

  function isScreenReaderOnly(el, rect, style) {
    if (/(^|\s)sr-only(\s|$)/.test(el.getAttribute("class") || "")) return true;
    return (
      style.position === "absolute" &&
      Math.round(rect.width) <= 1 &&
      Math.round(rect.height) <= 1 &&
      (style.clip !== "auto" || style.clipPath !== "none" || style.overflow === "hidden")
    );
  }

  const all = Array.from(document.body.querySelectorAll("*"));
  const styles = new Map();
  const rects = new Map();
  for (const el of all) {
    styles.set(el, window.getComputedStyle(el));
    rects.set(el, el.getBoundingClientRect());
  }

  // --- 可視の操作要素すべて（間隔例外の判定に使う） ---
  const controls = [];
  for (const el of all) {
    if (!el.matches(CONTROL_SELECTOR)) continue;
    if (el.hasAttribute("disabled")) continue;
    const style = styles.get(el);
    const rect = rects.get(el);
    if (!isVisible(el, rect, style)) continue;
    if (isScreenReaderOnly(el, rect, style)) continue;
    controls.push({ el, rect });
  }

  /** 他の操作要素の中心との最短距離（WCAG 2.2 2.5.8「間隔」例外の判定材料）。 */
  function nearestControlDistance(el, rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let min = Infinity;
    for (const other of controls) {
      if (other.el === el) continue;
      if (other.el.contains(el) || el.contains(other.el)) continue;
      const ox = other.rect.left + other.rect.width / 2;
      const oy = other.rect.top + other.rect.height / 2;
      const d = Math.hypot(cx - ox, cy - oy);
      if (d < min) min = d;
    }
    return Number.isFinite(min) ? Math.round(min) : null;
  }

  /**
   * 実効タップ領域。見た目の矩形より広く反応する実装を実測する。
   *  1. `<label>`に包まれた入力欄（チェックボックス等）はラベル全体が操作領域になる。
   *  2. `position:absolute; inset:0` の子リンク（カード全面リンク）を持つ親は、
   *     その親の矩形が操作領域になる。
   *  3. 自身が `position:absolute; inset:0` の場合は自身の矩形がそのまま操作領域。
   */
  function effectiveRect(el, rect) {
    let best = { rect, source: "self" };

    const label = el.closest("label");
    if (label && (label.control === el || label.contains(el))) {
      const lr = rects.get(label) || label.getBoundingClientRect();
      if (lr.width * lr.height > best.rect.width * best.rect.height) {
        best = { rect: lr, source: "label" };
      }
    }

    // 疑似要素／子要素によるヒット領域の拡張
    for (const p of ["::after", "::before"]) {
      const ps = window.getComputedStyle(el, p);
      if (!ps || ps.content === "none" || ps.content === "normal") continue;
      if (ps.position !== "absolute" && ps.position !== "fixed") continue;
      if ([ps.top, ps.right, ps.bottom, ps.left].some((v) => v === "auto")) continue;
      // 疑似要素の包含ブロック＝自身が position:static でなければ自身、そうでなければ最も近い配置済み祖先
      let container = el;
      if (styles.get(el).position === "static") {
        let anc = el.parentElement;
        while (anc && anc !== document.body) {
          const s = styles.get(anc) || window.getComputedStyle(anc);
          if (s.position !== "static") break;
          anc = anc.parentElement;
        }
        container = anc || el;
      }
      const cr = rects.get(container) || container.getBoundingClientRect();
      if (cr.width * cr.height > best.rect.width * best.rect.height) {
        best = { rect: cr, source: "pseudo-overlay" };
      }
    }

    return { width: best.rect.width, height: best.rect.height, source: best.source };
  }

  /** 要素が属する画面領域。分類の手がかりにする。 */
  function regionOf(el) {
    if (el.closest("header")) return "site-header";
    if (el.closest("nav[aria-label='パンくずリスト']")) return "breadcrumb";
    if (el.closest("footer")) return "site-footer";
    if (el.closest("thead")) return "table-header";
    if (el.closest("tbody")) return "table-body";
    if (el.closest("details")) return "disclosure";
    if (el.closest("nav")) return "nav";
    return "content";
  }

  function openTagOf(el) {
    const html = el.outerHTML || "";
    const end = html.indexOf(">");
    const tag = end >= 0 ? html.slice(0, end + 1) : html.slice(0, 400);
    return tag.length > 600 ? tag.slice(0, 600) + "…" : tag;
  }

  for (const { el, rect } of controls) {
    const style = styles.get(el);
    const w = rect.width;
    const h = rect.height;
    if (w >= TAP_MIN - TOL && h >= TAP_MIN - TOL) continue;

    // Phase191と同一の分類（本文中のインラインリンクは別種別）
    const inlineInText = style.display === "inline" && !!el.closest("p, li, dd, td, blockquote, figcaption");
    const type = inlineInText ? "tap-target-inline-link" : "tap-target-small";

    // Phase197の改良判定：同じ親要素に非空のテキストノードがあれば「文章中のリンク」とみなす。
    // Phase191は祖先タグ（p / li / dd / td / blockquote / figcaption）だけを見ていたため、
    // divが直接テキストを含む注記文の中のリンクを取りこぼしていた。
    const parent = el.parentElement;
    const hasSiblingText =
      !!parent &&
      Array.from(parent.childNodes).some((n) => n.nodeType === 3 && (n.textContent || "").trim().length > 0);
    const inlineInTextRevised = style.display === "inline" && (inlineInText || hasSiblingText);
    const typeRevised = inlineInTextRevised ? "tap-target-inline-link" : "tap-target-small";
    const detail = `${Math.round(w)}x${Math.round(h)}`;
    const selector = selectorOf(el);
    const key = type + "|" + selector + "|" + detail;
    if (seen.has(key)) continue;
    seen.add(key);

    const eff = effectiveRect(el, rect);
    const effW = Math.round(eff.width);
    const effH = Math.round(eff.height);
    const nearest = nearestControlDistance(el, rect);

    // 操作要素として実際に到達可能か（NON_INTERACTIVE判定の材料）
    const tag = el.tagName.toLowerCase();
    const href = el.getAttribute("href");
    const tabindex = el.getAttribute("tabindex");
    const inertLink = tag === "a" && (!href || href === "#" || href.startsWith("javascript:"));
    const roleOnly = !el.matches("a[href], button, summary, select, input, textarea") && tabindex === null;
    const readOnly = el.hasAttribute("readonly") || el.getAttribute("aria-disabled") === "true";

    issues.push({
      type,
      typeRevised,
      selector,
      detail,
      width: Math.round(w),
      height: Math.round(h),
      effectiveWidth: effW,
      effectiveHeight: effH,
      effectiveSource: eff.source,
      meetsWcag21AAA: effW >= TAP_MIN - TOL && effH >= TAP_MIN - TOL,
      meetsWcag22AA: effW >= WCAG22_MIN - TOL && effH >= WCAG22_MIN - TOL,
      spacingExceptionOk: nearest === null ? true : nearest >= WCAG22_MIN,
      nearestControlDistance: nearest,
      region: regionOf(el),
      tag,
      role: el.getAttribute("role"),
      inertLink,
      roleOnly,
      readOnly,
      display: style.display,
      text: textOf(el),
      openTag: openTagOf(el),
      rect: {
        x: Math.round(rect.left + window.scrollX),
        y: Math.round(rect.top + window.scrollY),
        w: Math.round(w),
        h: Math.round(h),
      },
      viewportWidth: vw,
    });
  }

  return issues;
}
/* eslint-enable */

function waitForServer(url, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url, { method: "GET" });
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

function slug(s) {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "root";
}

/**
 * 測定済みJSONだけを入力に、分類テーブルとMarkdownを作り直す（ブラウザは起動しない）。
 * 分類の理由や文言を直したいだけのときに、実測をやり直さずに済むようにする。
 */
function renderFromExistingReports() {
  const groupFile = join(OUT_DIR, `phase197-tap-target-classification${SUFFIX}.json`);
  const file320 = join(OUT_DIR, `phase197-320px-classification${SUFFIX}.json`);
  const report = JSON.parse(readFileSync(groupFile, "utf8"));
  const report320 = JSON.parse(readFileSync(file320, "utf8"));

  const byKey = new Map();
  for (const g of report.groups) {
    const decision = matchClassification(g);
    g.ruleId = decision.ruleId ?? null;
    g.component = decision.component;
    g.uiCategory = decision.uiCategory;
    g.classification = decision.classification;
    g.classificationLabel = CLASSIFICATION_LABELS[decision.classification] ?? decision.classification;
    g.reason = decision.reason;
    g.userImpact = decision.userImpact ?? null;
    g.proposal = decision.proposal ?? null;
    g.detectorFix = decision.detectorFix ?? null;
    g.fixedInPhase197 = decision.fixed ?? false;
    g.fix = decision.fix ?? null;
    byKey.set(`${g.type} ${g.selector}`, g);
  }

  const byClassification = {};
  const occurrencesByClassification = {};
  const occurrences320ByClassification = {};
  for (const g of report.groups) {
    byClassification[g.classification] = (byClassification[g.classification] ?? 0) + 1;
    occurrencesByClassification[g.classification] =
      (occurrencesByClassification[g.classification] ?? 0) + g.occurrences;
    occurrences320ByClassification[g.classification] =
      (occurrences320ByClassification[g.classification] ?? 0) + g.occurrencesAt320;
  }
  report.summary.byClassification = byClassification;
  report.summary.occurrencesByClassification = occurrencesByClassification;
  report.summary.occurrences320ByClassification = occurrences320ByClassification;
  report.summary.unclassifiedGroups = report.groups.filter((g) => g.classification === "UNCLASSIFIED").length;

  const by320 = {};
  for (const f of report320.findings) {
    const g = byKey.get(`tap-target-small ${f.selector}`);
    if (g) {
      f.groupId = g.id;
      f.component = g.component;
      f.uiCategory = g.uiCategory;
      f.classification = g.classification;
      f.classificationLabel = g.classificationLabel;
      f.reason = g.reason;
      f.userImpact = g.userImpact;
    }
    by320[f.classification] = (by320[f.classification] ?? 0) + 1;
  }
  report320.byClassification = by320;

  writeFileSync(groupFile, JSON.stringify(report, null, 2) + "\n", "utf8");
  writeFileSync(file320, JSON.stringify(report320, null, 2) + "\n", "utf8");
  writeFileSync(join(OUT_DIR, `phase197-tap-target-classification${SUFFIX}.md`), renderGroupMarkdown(report), "utf8");
  writeFileSync(join(OUT_DIR, `phase197-320px-classification${SUFFIX}.md`), render320Markdown(report320), "utf8");
  console.log(`[audit-tap-targets] 測定済みJSONから再生成しました（label=${LABEL}）`);
  console.log(`分類（グループ数）: ${JSON.stringify(byClassification)}`);
  console.log(`未分類グループ: ${report.summary.unclassifiedGroups}`);
}

async function main() {
  if (args.get("render-only") === "true") {
    renderFromExistingReports();
    return;
  }

  if (!existsSync(join(root, "dist", "index.html"))) {
    throw new Error("dist/index.html がありません。先に `npm run build` を実行してください。");
  }

  let server = null;
  let baseUrl = EXTERNAL_BASE_URL;
  if (!baseUrl) {
    baseUrl = `http://localhost:${PORT}`;
    console.log(`[audit-tap-targets] vite preview を起動します (${baseUrl})`);
    server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
      cwd: root,
      shell: true,
      stdio: "ignore",
    });
    await waitForServer(baseUrl);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  if (SAVE_CLIPS) {
    rmSync(SHOT_DIR, { recursive: true, force: true });
    mkdirSync(SHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const records = [];
  const clips = new Map();

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
        userAgent: vp.mobile
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          : undefined,
      });
      const page = await context.newPage();
      for (const path of PAGES) {
        try {
          await page.goto(baseUrl + path, { waitUntil: "networkidle", timeout: 45000 });
          await page.waitForTimeout(120);
          const issues = await page.evaluate(collectTapTargets);
          for (const issue of issues) records.push({ ...issue, path, viewport: vp.name });

          // 320x568 の要対応候補は、要素の切り出し画像でも目視相当の確認ができるようにする
          if (SAVE_CLIPS && vp.name === "320x568") {
            for (const issue of issues) {
              if (issue.type !== "tap-target-small") continue;
              const clipKey = `${issue.selector}|${issue.detail}`;
              if (clips.has(clipKey)) continue;
              const pad = 16;
              const clip = {
                x: Math.max(0, issue.rect.x - pad),
                y: Math.max(0, issue.rect.y - pad),
                width: Math.min(vp.width, issue.rect.w + pad * 2),
                height: issue.rect.h + pad * 2,
              };
              const file = join(SHOT_DIR, `${slug(path)}__${slug(issue.detail)}__${clips.size}.png`);
              try {
                await page.screenshot({ path: file, clip, fullPage: true });
                clips.set(
                  clipKey,
                  file.replace(root + "\\", "").replace(root + "/", "").replace(/\\/g, "/"),
                );
              } catch {
                /* 切り出し失敗は監査を止めない */
              }
            }
          }
        } catch (err) {
          console.warn(`[audit-tap-targets] ${vp.name} ${path}: ${String(err.message || err).split("\n")[0]}`);
        }
      }
      await context.close();
      console.log(`[audit-tap-targets] ${vp.name} 完了`);
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  // ---------- 集約 ----------
  const groups = new Map();
  for (const r of records) {
    const key = `${r.type} ${r.selector}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        type: r.type,
        selector: r.selector,
        occurrences: 0,
        viewports: new Set(),
        paths: new Set(),
        sizes: new Set(),
        minWidth: Infinity,
        minHeight: Infinity,
        minEffectiveWidth: Infinity,
        minEffectiveHeight: Infinity,
        effectiveSources: new Set(),
        regions: new Set(),
        tags: new Set(),
        meetsWcag22AA: true,
        spacingExceptionOk: true,
        anyInertLink: false,
        anyRoleOnly: false,
        anyReadOnly: false,
        revisedTypes: new Set(),
        minNearestControlDistance: Infinity,
        sampleText: r.text,
        sampleOpenTag: r.openTag,
        occurrencesAt320: 0,
        occurrencesMobile: 0,
        clip: null,
      };
      groups.set(key, g);
    }
    g.occurrences += 1;
    g.viewports.add(r.viewport);
    g.paths.add(r.path);
    g.sizes.add(r.detail);
    g.minWidth = Math.min(g.minWidth, r.width);
    g.minHeight = Math.min(g.minHeight, r.height);
    g.minEffectiveWidth = Math.min(g.minEffectiveWidth, r.effectiveWidth);
    g.minEffectiveHeight = Math.min(g.minEffectiveHeight, r.effectiveHeight);
    g.effectiveSources.add(r.effectiveSource);
    g.regions.add(r.region);
    g.tags.add(r.tag);
    if (!r.meetsWcag22AA) g.meetsWcag22AA = false;
    if (!r.spacingExceptionOk) g.spacingExceptionOk = false;
    if (r.inertLink) g.anyInertLink = true;
    if (r.roleOnly) g.anyRoleOnly = true;
    if (r.readOnly) g.anyReadOnly = true;
    g.revisedTypes.add(r.typeRevised);
    if (typeof r.nearestControlDistance === "number") {
      g.minNearestControlDistance = Math.min(g.minNearestControlDistance, r.nearestControlDistance);
    }
    if (r.viewport === "320x568") g.occurrencesAt320 += 1;
    if (["320x568", "360x800", "375x812", "390x844", "430x932"].includes(r.viewport)) {
      g.occurrencesMobile += 1;
    }
    if (!g.clip) {
      const c = clips.get(`${r.selector}|${r.detail}`);
      if (c) g.clip = c;
    }
    if (!g.sampleText && r.text) g.sampleText = r.text;
  }

  const groupList = [...groups.values()]
    .sort((a, b) => b.occurrences - a.occurrences)
    .map((g, i) => {
      const decision = matchClassification(g);
      return {
        id: `G${String(i + 1).padStart(3, "0")}`,
        type: g.type,
        typeRevised: [...g.revisedTypes].join("/"),
        reclassifiedByRevisedDetector: !g.revisedTypes.has(g.type) || g.revisedTypes.size > 1,
        selector: g.selector,
        ruleId: decision.ruleId ?? null,
        component: decision.component,
        uiCategory: decision.uiCategory,
        classification: decision.classification,
        classificationLabel: CLASSIFICATION_LABELS[decision.classification] ?? decision.classification,
        reason: decision.reason,
        userImpact: decision.userImpact ?? null,
        proposal: decision.proposal ?? null,
        detectorFix: decision.detectorFix ?? null,
        fixedInPhase197: decision.fixed ?? false,
        fix: decision.fix ?? null,
        anyInertLink: g.anyInertLink,
        anyRoleOnlyWithoutTabindex: g.anyRoleOnly,
        anyReadOnly: g.anyReadOnly,
        occurrences: g.occurrences,
        occurrencesAt320: g.occurrencesAt320,
        occurrencesMobile: g.occurrencesMobile,
        viewports: [...g.viewports],
        paths: [...g.paths].sort(),
        pathCount: g.paths.size,
        sizes: [...g.sizes].sort(),
        minWidth: g.minWidth,
        minHeight: g.minHeight,
        minEffectiveWidth: g.minEffectiveWidth,
        minEffectiveHeight: g.minEffectiveHeight,
        effectiveSources: [...g.effectiveSources],
        regions: [...g.regions],
        tags: [...g.tags],
        meetsWcag21AAA_44px: g.minEffectiveWidth >= 43 && g.minEffectiveHeight >= 43,
        meetsWcag22AA_24px: g.meetsWcag22AA,
        spacingExceptionOk: g.spacingExceptionOk,
        minNearestControlDistance: Number.isFinite(g.minNearestControlDistance)
          ? g.minNearestControlDistance
          : null,
        sampleText: g.sampleText,
        sampleOpenTag: g.sampleOpenTag,
        clipScreenshot: g.clip,
      };
    });

  const byClassification = {};
  const occurrencesByClassification = {};
  const occurrences320ByClassification = {};
  for (const g of groupList) {
    byClassification[g.classification] = (byClassification[g.classification] ?? 0) + 1;
    occurrencesByClassification[g.classification] =
      (occurrencesByClassification[g.classification] ?? 0) + g.occurrences;
    occurrences320ByClassification[g.classification] =
      (occurrences320ByClassification[g.classification] ?? 0) + g.occurrencesAt320;
  }

  const smallGroups = groupList.filter((g) => g.type === "tap-target-small");
  const inlineGroups = groupList.filter((g) => g.type === "tap-target-inline-link");
  const total = (list, k) => list.reduce((n, g) => n + g[k], 0);

  const report = {
    label: LABEL,
    generatedAt: new Date().toISOString(),
    baseUrl,
    phase: "Phase197",
    purpose:
      "Phase191の検出条件をそのまま再現したうえで、各検出へ実効タップ領域・WCAG 2.2 2.5.8（AA・24px）／WCAG 2.1 2.5.5（AAA・44px）の充足・間隔例外・所属領域を付加し、5分類へ割り当てる。件数をゼロにすることは目的にしていない。",
    criteria: {
      REAL_BUG: "実効タップ領域が小さく、かつ隣接する操作要素と近接しており、実際に押し間違いが起きる（市民の利用を妨げる）もの。",
      ACCESSIBILITY_IMPROVEMENT:
        "押し間違いは起きないが、WCAG 2.2 達成基準2.5.8（AA・24x24）またはWCAG 2.1 達成基準2.5.5（AAA・44x44）に届かず、改善すべきもの。",
      INTENTIONAL: "設計上の意図があり、拡大すると別の不具合（レイアウト前提の崩れ、全ページの情報量減）を招くもの。理由を必ず記述する。",
      FALSE_POSITIVE: "実効タップ領域は十分あり、検出器（見た目の矩形だけを見る条件）の誤りであるもの。",
      NON_INTERACTIVE: "セレクタには一致するが、実際には操作対象でないもの。",
    },
    viewports: VIEWPORTS.map((v) => v.name),
    pages: PAGES,
    summary: {
      tapTargetSmall: {
        groups: smallGroups.length,
        occurrences: total(smallGroups, "occurrences"),
        occurrencesAt320: total(smallGroups, "occurrencesAt320"),
        occurrencesMobile: total(smallGroups, "occurrencesMobile"),
      },
      tapTargetInlineLink: {
        groups: inlineGroups.length,
        occurrences: total(inlineGroups, "occurrences"),
        occurrencesAt320: total(inlineGroups, "occurrencesAt320"),
      },
      revisedDetector: {
        note:
          "Phase191の判定は「display:inline かつ p / li / dd / td / blockquote / figcaption を祖先に持つ」場合だけを" +
          "本文中のインラインリンクとみなしていた。Phase197ではこれに「同じ親要素に非空のテキストノードがある」場合を加え、" +
          "divが直接テキストを含む注記文の中のリンクも本文中のリンクとして扱う。",
        tapTargetSmallPhase191: records.filter((r) => r.type === "tap-target-small").length,
        tapTargetSmallPhase197: records.filter((r) => r.typeRevised === "tap-target-small").length,
        reclassifiedToInlineLink: records.filter(
          (r) => r.type === "tap-target-small" && r.typeRevised === "tap-target-inline-link",
        ).length,
      },
      nonInteractiveEvidence: {
        note: "セレクタに一致するが操作対象でない要素の実測。検出器はsr-only・disabled・大きさ0の要素を既に除外している。",
        inertLinks: records.filter((r) => r.inertLink).length,
        roleOnlyWithoutTabindex: records.filter((r) => r.roleOnly).length,
        readOnlyControls: records.filter((r) => r.readOnly).length,
      },
      byClassification,
      occurrencesByClassification,
      occurrences320ByClassification,
      unclassifiedGroups: groupList.filter((g) => g.classification === "UNCLASSIFIED").length,
    },
    groups: groupList,
  };

  writeFileSync(
    join(OUT_DIR, `phase197-tap-target-classification${SUFFIX}.json`),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );

  // ---------- 320x568 の要対応候補（明細） ----------
  const groupBySelector = new Map(groupList.map((g) => [`${g.type} ${g.selector}`, g]));
  const findings320 = records
    .filter((r) => r.viewport === "320x568" && r.type === "tap-target-small")
    .map((r, i) => {
      const g = groupBySelector.get(`${r.type} ${r.selector}`);
      return {
        no: i + 1,
        path: r.path,
        viewport: r.viewport,
        groupId: g?.id ?? null,
        component: g?.component ?? null,
        uiCategory: g?.uiCategory ?? null,
        classification: g?.classification ?? "UNCLASSIFIED",
        classificationLabel: CLASSIFICATION_LABELS[g?.classification] ?? null,
        reason: g?.reason ?? null,
        element: r.tag + (r.role ? `[role=${r.role}]` : ""),
        text: r.text,
        selector: r.selector,
        size: r.detail,
        effectiveSize: `${r.effectiveWidth}x${r.effectiveHeight}`,
        effectiveSource: r.effectiveSource,
        meetsWcag22AA_24px: r.meetsWcag22AA,
        meetsWcag21AAA_44px: r.meetsWcag21AAA,
        nearestControlDistance: r.nearestControlDistance,
        spacingExceptionOk: r.spacingExceptionOk,
        region: r.region,
        userImpact: g?.userImpact ?? null,
        clipScreenshot: clips.get(`${r.selector}|${r.detail}`) ?? null,
        openTag: r.openTag,
      };
    });

  const by320Classification = {};
  for (const f of findings320) {
    by320Classification[f.classification] = (by320Classification[f.classification] ?? 0) + 1;
  }

  const report320 = {
    label: LABEL,
    generatedAt: new Date().toISOString(),
    phase: "Phase197",
    viewport: "320x568",
    note: "Phase191監査の「320x568の要対応件数」と同じ条件（tap-target-inline-link以外の全検出）。横スクロール・突出・文字切れ・table溢れ・重なり・オーバーレイ位置は0件のため、要対応候補はすべてタップ領域である。",
    total: findings320.length,
    byClassification: by320Classification,
    findings: findings320,
  };
  writeFileSync(join(OUT_DIR, `phase197-320px-classification${SUFFIX}.json`), JSON.stringify(report320, null, 2) + "\n", "utf8");

  // ---------- Markdown ----------
  writeFileSync(join(OUT_DIR, `phase197-tap-target-classification${SUFFIX}.md`), renderGroupMarkdown(report), "utf8");
  writeFileSync(join(OUT_DIR, `phase197-320px-classification${SUFFIX}.md`), render320Markdown(report320), "utf8");

  console.log("\n=== Phase197 タップ領域分類サマリ ===");
  console.log(`tap-target-small: ${report.summary.tapTargetSmall.occurrences}件 / ${smallGroups.length}グループ`);
  console.log(`320x568 要対応候補: ${findings320.length}件`);
  console.log(`分類（グループ数）: ${JSON.stringify(byClassification, null, 2)}`);
  console.log(`未分類グループ: ${report.summary.unclassifiedGroups}`);
  if (report.summary.unclassifiedGroups > 0) {
    for (const g of groupList.filter((x) => x.classification === "UNCLASSIFIED")) {
      console.log(`  [未分類] ${g.occurrences}件 ${g.selector}`);
      console.log(`           ${g.sampleOpenTag.slice(0, 240)}`);
    }
  }
  console.log(`分類対象グループ定義: ${CLASSIFICATIONS.length}件`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
