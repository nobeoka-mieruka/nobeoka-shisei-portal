/**
 * スクリーンリーダー相当の意味構造 監査（Phase218）
 *
 * 【この監査で分かること・分からないこと】
 * 本スクリプトは Chromium の Accessibility Tree（CDP `Accessibility.getFullAXTree`）を取得し、
 * ブラウザが支援技術へ公開する role / accessible name / 公開順序を機械的に検査する。
 * これは「スクリーンリーダーが受け取る情報」の検査であり、
 * **実際のスクリーンリーダー（NVDA / VoiceOver / TalkBack）での読み上げ確認ではない**。
 * 読み上げの語調・日本語としての自然さ・音声の間・ブラウズモードとフォームモードの
 * 切り替わり・点字出力などは本スクリプトでは検証できない（実機確認が必要）。
 *
 * 【前提】playwright-core（devDependency）と、ローカルの Chromium のみを使用する。
 *   npm run build
 *   node scripts/audit-screenreader-semantics.mjs
 *
 * 【重要】URLは必ず末尾スラッシュ付きで開く。スラッシュ無しだと vite preview の SPA
 * フォールバックが別ページのHTMLを返し、hydration がずれて誤検知になる。
 *
 * 出力： reports/phase218-screenreader-semantics.json
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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
const PORT = Number(args.get("port") ?? 4193);
const EXTERNAL_BASE_URL = args.get("base-url");
const OUT = join(root, "reports", "phase218-screenreader-semantics.json");

/** 監査対象。必ず末尾スラッシュを付ける（SPAフォールバック誤検知の回避）。 */
const ROUTES = [
  { path: "/", label: "トップ" },
  { path: "/dashboard/", label: "ダッシュボード" },
  { path: "/finance/", label: "財政" },
  { path: "/finance/funds/", label: "基金" },
  { path: "/bills/", label: "議案アーカイブ" },
  { path: "/bills/bill-auditor-appointment-2026-06/", label: "議案詳細1（人事）" },
  { path: "/bills/bill-bridge-repair-contract-2026-06/", label: "議案詳細2（契約）" },
  { path: "/bills/bill-fy2026-general-account-supplementary-budget-2/", label: "議案詳細3（補正予算）" },
  { path: "/mayor/", label: "市長" },
  { path: "/mayor/policy-progress/", label: "市長公約進捗" },
  { path: "/data-status/", label: "データ整備状況" },
  { path: "/timeline/", label: "市政年表" },
];

/** accessible name が曖昧で、単独では行き先が分からないリンク文言。 */
const VAGUE_LINK_NAMES = [
  "こちら", "詳細", "詳しく", "詳しくはこちら", "もっと見る", "続き", "リンク",
  "here", "click here", "more", "read more", "link", "→", ">",
];

async function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return true;
    } catch {
      /* まだ起動していない */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/** CDP の AXTree をたどり、ignored でないノードを公開順に並べる。 */
function flattenAxTree(nodes) {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));
  const out = [];
  const walk = (node, depth) => {
    if (!node) return;
    const role = node.role?.value ?? "";
    const name = node.name?.value ?? "";
    if (!node.ignored) {
      out.push({
        nodeId: node.nodeId,
        backendDOMNodeId: node.backendDOMNodeId,
        role,
        name,
        depth,
        properties: Object.fromEntries((node.properties ?? []).map((p) => [p.name, p.value?.value])),
        childCount: (node.childIds ?? []).length,
      });
    }
    for (const id of node.childIds ?? []) walk(byId.get(id), node.ignored ? depth : depth + 1);
  };
  for (const r of roots) walk(r, 0);
  return out;
}

async function auditPage(page, cdp, route, baseUrl) {
  const result = { ...route, url: `${baseUrl}${route.path}`, issues: [], info: {} };
  const addIssue = (category, severity, detail) => result.issues.push({ category, severity, detail });

  await page.goto(result.url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(300);

  // ---- 1. ページタイトル ----
  const title = await page.title();
  result.info.title = title;
  if (!title.trim()) addIssue("title", "serious", "document.title が空");

  // ---- 2. Accessibility Tree ----
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const ax = flattenAxTree(nodes);
  result.info.axNodeCount = ax.length;

  const mains = ax.filter((n) => n.role === "main");
  result.info.mainCount = mains.length;
  if (mains.length !== 1) addIssue("landmark", "serious", `main ランドマークが ${mains.length} 個`);

  const navs = ax.filter((n) => n.role === "navigation");
  result.info.navNames = navs.map((n) => n.name);
  for (const n of navs) if (!n.name.trim()) addIssue("landmark", "serious", "accessible name の無い navigation ランドマーク");
  const dupNav = result.info.navNames.filter((n, i, a) => n && a.indexOf(n) !== i);
  if (dupNav.length) addIssue("landmark", "moderate", `同名の navigation ランドマーク: ${[...new Set(dupNav)].join(" / ")}`);

  // 見出し階層（AXツリー上の heading と level）
  const headings = ax
    .filter((n) => n.role === "heading")
    .map((n) => ({ level: Number(n.properties.level ?? 0), name: n.name.trim().slice(0, 60) }));
  result.info.headings = headings;
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length !== 1) addIssue("heading", "serious", `h1 が ${h1s.length} 個`);
  let prev = 0;
  for (const h of headings) {
    if (!h.name) addIssue("heading", "serious", `空の見出し（h${h.level}）`);
    if (prev && h.level > prev + 1) addIssue("heading", "moderate", `見出しレベルの飛び h${prev} → h${h.level}「${h.name}」`);
    prev = h.level;
  }

  // リンク
  const links = ax.filter((n) => n.role === "link");
  result.info.linkCount = links.length;
  for (const l of links) {
    if (!l.name.trim()) addIssue("link-name", "serious", `accessible name の無いリンク（AX nodeId ${l.nodeId}）`);
    else if (VAGUE_LINK_NAMES.includes(l.name.trim().toLowerCase())) addIssue("link-name", "moderate", `文脈依存のリンク名「${l.name.trim()}」`);
  }

  // ボタン
  const buttons = ax.filter((n) => n.role === "button");
  result.info.buttonCount = buttons.length;
  for (const b of buttons) if (!b.name.trim()) addIssue("button-name", "serious", `accessible name の無いボタン（AX nodeId ${b.nodeId}）`);

  // フォーム系（combobox / textbox / checkbox / radio / listbox / slider）
  const formRoles = new Set(["combobox", "textbox", "searchbox", "checkbox", "radio", "listbox", "slider", "spinbutton"]);
  const formControls = ax.filter((n) => formRoles.has(n.role));
  result.info.formControlCount = formControls.length;
  for (const c of formControls) if (!c.name.trim()) addIssue("form-label", "serious", `ラベルの無いフォーム部品（role=${c.role}）`);

  // 現在地表示（aria-current）は CDP の AXTree の properties に現れないため DOM 側で数える（下の dom.info.ariaCurrent）。

  // role="img" のうち name が無いもの
  for (const n of ax.filter((x) => x.role === "img" || x.role === "image" || x.role === "graphics-document"))
    if (!n.name.trim()) addIssue("img-name", "serious", `accessible name の無い role=img（AX nodeId ${n.nodeId}）`);

  // ---- 3. DOM 側の検査（AXツリーだけでは分からないもの） ----
  const dom = await page.evaluate((vagueNames) => {
    const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
    const issues = [];
    const info = {};

    // --- チャートの代替情報 ---
    // 「グラフ」と見なす要素：svg / canvas / role=img のブロック / 幅高さのあるバー描画コンテナ
    const chartRoots = new Set();
    for (const el of document.querySelectorAll("svg, canvas, [role='img']")) {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 24) continue; // アイコンサイズは除外
      chartRoots.add(el);
    }
    const charts = [];
    for (const el of chartRoots) {
      const role = el.getAttribute("role");
      const label = el.getAttribute("aria-label") || "";
      const labelledby = el.getAttribute("aria-labelledby");
      const hidden = el.getAttribute("aria-hidden") === "true" || !!el.closest("[aria-hidden='true']");
      // グラフの周辺（同じ節・親コンテナ）に数値テキストがあるか
      const container = el.closest("section, figure, div") || el.parentElement;
      const scope = container?.parentElement || container;
      const nearbyTable = !!scope?.querySelector("table");
      // グラフ要素の外側にある数値テキスト（li/td/p 等）
      let outsideText = "";
      if (scope) {
        const clone = scope.cloneNode(true);
        // グラフ本体を除いた残りのテキスト
        for (const c of clone.querySelectorAll("svg, canvas")) c.remove();
        outsideText = (clone.textContent || "").replace(/\s+/g, " ").trim();
      }
      const hasNumbers = /[0-9０-９]/.test(outsideText) && outsideText.length > 20;
      charts.push({
        tag: el.tagName.toLowerCase(),
        role,
        ariaLabel: label,
        ariaLabelledby: labelledby,
        ariaHidden: hidden,
        nearbyTable,
        hasAdjacentValues: hasNumbers,
        // role=img は子孫を presentational にするため、内部にテキストがあると読み上げから消える
        swallowedTextLength: role === "img" ? text(el).length : 0,
        className: (el.getAttribute("class") || "").slice(0, 60),
      });
    }
    info.charts = charts;
    for (const c of charts) {
      if (!c.ariaHidden && !c.ariaLabel && !c.ariaLabelledby && c.role !== null)
        issues.push({ category: "chart-alt", severity: "serious", detail: `${c.tag}[role=${c.role}] にテキスト代替が無い` });
      if (c.role === "img" && c.swallowedTextLength > 30)
        issues.push({
          category: "chart-alt",
          severity: "serious",
          detail: `role="img" が ${c.swallowedTextLength} 文字のテキストを内包しており、内部の数値が読み上げから除外される（${c.className}）`,
        });
      if (!c.ariaHidden && !c.hasAdjacentValues && !c.nearbyTable && (c.role === "img" || c.tag === "svg"))
        issues.push({ category: "chart-alt", severity: "moderate", detail: `${c.tag}（${c.className}）の近傍に数値の代替表現が見当たらない` });
    }

    // --- 表のヘッダー ---
    const tables = [...document.querySelectorAll("table")];
    info.tableCount = tables.length;
    info.tables = tables.map((t) => {
      const ths = [...t.querySelectorAll("th")];
      const rec = {
        caption: !!t.querySelector("caption"),
        ariaLabel: t.getAttribute("aria-label") || t.getAttribute("aria-labelledby") || "",
        thCount: ths.length,
        thWithoutScope: ths.filter((th) => !th.getAttribute("scope")).length,
        rowCount: t.querySelectorAll("tr").length,
        emptyTh: ths.filter((th) => !text(th)).length,
      };
      if (rec.thCount === 0 && rec.rowCount > 1)
        issues.push({ category: "table-header", severity: "serious", detail: "th の無い表（データ表なら見出しセルが必要）" });
      if (!rec.caption && !rec.ariaLabel)
        issues.push({ category: "table-header", severity: "moderate", detail: `caption / aria-label の無い表（先頭列: ${text(t.querySelector("th, td") || t).slice(0, 24)}）` });
      if (rec.thCount > 0 && rec.thWithoutScope > 0)
        issues.push({ category: "table-header", severity: "moderate", detail: `scope の無い th が ${rec.thWithoutScope} 件` });
      return rec;
    });

    // --- フォーム・絞り込みのラベル（DOM側の裏取り） ---
    const controls = [...document.querySelectorAll("input, select, textarea")].filter((el) => el.type !== "hidden");
    info.controlCount = controls.length;
    for (const el of controls) {
      const hasLabel =
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.getAttribute("title") ||
        (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) ||
        el.closest("label");
      if (!hasLabel) issues.push({ category: "form-label", severity: "serious", detail: `ラベルの無い ${el.tagName.toLowerCase()}（${el.outerHTML.slice(0, 70)}）` });
    }

    // --- 現在地（aria-current） ---
    const currents = [...document.querySelectorAll("[aria-current]")];
    info.ariaCurrent = currents.map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute("aria-current")}]「${text(el).slice(0, 24)}」`);
    // ナビゲーション内に現在地の目印が1つも無ければ、読み上げでは現在位置が分からない
    const navCurrents = currents.filter((el) => el.closest("nav"));
    if (navCurrents.length === 0)
      issues.push({ category: "aria-current", severity: "moderate", detail: "ナビゲーション内に aria-current が無く、読み上げで現在地が分からない" });

    // --- 出典リンク ---
    const externals = [...document.querySelectorAll('a[href^="http"]')].filter((a) => !a.href.startsWith(location.origin));
    info.externalLinkCount = externals.length;
    const newWindowNoNotice = externals.filter((a) => {
      if (a.getAttribute("target") !== "_blank") return false;
      const name = (a.getAttribute("aria-label") || text(a) || "").toLowerCase();
      const hasNotice = /別ウィンドウ|新しいタブ|新規ウィンドウ|外部サイト|new window|new tab/.test(name);
      const srOnly = a.querySelector(".sr-only");
      return !hasNotice && !srOnly;
    });
    info.newWindowWithoutNotice = newWindowNoNotice.slice(0, 8).map((a) => `${text(a).slice(0, 40)} → ${a.href.slice(0, 60)}`);
    info.newWindowWithoutNoticeCount = newWindowNoNotice.length;
    const emptyExternal = externals.filter((a) => !text(a) && !a.getAttribute("aria-label"));
    if (emptyExternal.length) issues.push({ category: "source-link", severity: "serious", detail: `テキストの無い外部リンク ${emptyExternal.length} 件` });
    // 同名で行き先が違う出典リンク（読み上げ時に区別できない）
    const byName = new Map();
    for (const a of document.querySelectorAll("a[href]")) {
      const n = (a.getAttribute("aria-label") || text(a)).trim();
      if (!n) continue;
      if (!byName.has(n)) byName.set(n, new Set());
      byName.get(n).add(a.getAttribute("href"));
    }
    const ambiguous = [...byName.entries()].filter(([n, hrefs]) => hrefs.size > 1 && n.length <= 12);
    info.ambiguousLinkNames = ambiguous.slice(0, 10).map(([n, h]) => `「${n}」が ${h.size} 種類の行き先`);
    for (const [n, hrefs] of ambiguous) {
      if (vagueNames.includes(n.toLowerCase()))
        issues.push({ category: "link-name", severity: "moderate", detail: `同一文言「${n}」で ${hrefs.size} 種類の行き先` });
    }

    // --- 装飾記号がそのまま読み上げられる箇所 ---
    const decorative = [...document.querySelectorAll("span, i, em")].filter((el) => {
      const t = text(el);
      return t.length > 0 && t.length <= 2 && /^[▼▲▶◀→←↑↓●○■□◆◇★☆※･・…]+$/.test(t) && el.getAttribute("aria-hidden") !== "true" && !el.closest("[aria-hidden='true']");
    });
    info.exposedDecorativeSymbols = decorative.slice(0, 8).map((el) => `${el.tagName.toLowerCase()}「${text(el)}」`);
    info.exposedDecorativeSymbolCount = decorative.length;

    return { issues, info };
  }, VAGUE_LINK_NAMES);

  result.issues.push(...dom.issues);
  Object.assign(result.info, dom.info);

  // ---- 4. フォーカス順序（Tab 実送信 → DOM 順・視覚順との整合） ----
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  const stops = [];
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const s = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const all = [...document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")].filter(
        (n) => !n.hasAttribute("disabled") && n.getAttribute("tabindex") !== "-1",
      );
      // accessible name の近似。<label>で包まれたinput等は自身のtextContentが空になるため、
      // aria-label / aria-labelledby / 関連label / title / value まで見る。
      const accName = () => {
        const byId = el.getAttribute("aria-labelledby");
        const parts = [
          el.getAttribute("aria-label"),
          byId && byId.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" "),
          el.textContent,
          el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : "",
          el.closest("label")?.textContent,
          el.getAttribute("title"),
          el.getAttribute("placeholder"),
          el.tagName === "INPUT" && el.type !== "text" ? el.getAttribute("value") : "",
        ];
        return parts.find((p) => p && p.trim()) ?? "";
      };
      return {
        key: `${el.tagName}#${el.id}|${(el.textContent || "").trim().slice(0, 25)}|${el.getAttribute("href") ?? ""}`,
        tag: el.tagName.toLowerCase(),
        name: accName().replace(/\s+/g, " ").trim().slice(0, 30),
        domIndex: all.indexOf(el),
        top: Math.round(r.top + window.scrollY),
      };
    });
    if (!s) break;
    if (seen.has(s.key)) break;
    seen.add(s.key);
    stops.push(s);
  }
  result.info.tabStopCount = stops.length;
  const domOrderBreaks = [];
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].domIndex >= 0 && stops[i - 1].domIndex >= 0 && stops[i].domIndex < stops[i - 1].domIndex)
      domOrderBreaks.push(`${stops[i - 1].tag}「${stops[i - 1].name}」→ ${stops[i].tag}「${stops[i].name}」`);
  }
  result.info.focusOrderDomBreaks = domOrderBreaks;
  if (domOrderBreaks.length) addIssue("focus-order", "moderate", `フォーカス順がDOM順と逆行: ${domOrderBreaks.length} 箇所`);
  const unnamedStops = stops.filter((s) => !s.name);
  if (unnamedStops.length) addIssue("focus-order", "serious", `名前の無いフォーカス可能要素 ${unnamedStops.length} 件`);

  return result;
}

async function main() {
  let server = null;
  let baseUrl = EXTERNAL_BASE_URL;
  if (!baseUrl) {
    baseUrl = `http://localhost:${PORT}`;
    server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
      cwd: root,
      shell: process.platform === "win32",
      stdio: "ignore",
    });
    if (!(await waitForServer(`${baseUrl}/`))) throw new Error("vite preview が起動しませんでした");
  }
  baseUrl = baseUrl.replace(/\/$/, "");

  const browser = await chromium.launch({ headless: true });
  const report = { generatedAt: new Date().toISOString(), baseUrl, note: "Accessibility Tree ベースの代替検証。実スクリーンリーダー確認ではない。", pages: [] };
  try {
    for (const route of ROUTES) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Accessibility.enable");
      try {
        report.pages.push(await auditPage(page, cdp, route, baseUrl));
      } catch (e) {
        report.pages.push({ ...route, fatal: String(e?.message ?? e), issues: [] });
      }
      await context.close();
      process.stdout.write(`. ${route.path}\n`);
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  const all = report.pages.flatMap((p) => (p.issues ?? []).map((i) => ({ ...i, path: p.path })));
  const byCategory = {};
  for (const i of all) byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
  report.summary = {
    pagesAudited: report.pages.length,
    totalIssues: all.length,
    bySeverity: all.reduce((a, i) => ({ ...a, [i.severity]: (a[i.severity] ?? 0) + 1 }), {}),
    byCategory,
    issues: all,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log("\n=== screen reader semantics audit ===");
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nreport: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
