// アクセシビリティ（WCAG 2.1 AA）実動作監査スクリプト
//
// 目的：
//   axe-core による自動監査だけでは検出できない「実際のキーボード操作」「フォーカス表示」
//   「200%拡大時の横スクロール」「prefers-reduced-motion の実効」までを、実ブラウザで検証する。
//
// 前提（Cloudflare Pages のビルドを重くしないため package.json の依存には含めない）：
//   npm i --no-save playwright @axe-core/playwright
//   npx playwright install chromium
//
// 使い方：
//   npm run build
//   npx vite preview --port 4173
//   node scripts/audit-accessibility.mjs --base http://localhost:4173 --out reports/accessibility/phase194.json
//
// 注意：
//   自動監査の violation が 0 件でも「WCAG 完全準拠」ではない。本スクリプトの keyboard /
//   contrast / zoom / reduced-motion の結果と、人手による確認を合わせて判断すること。

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = (getArg("base", process.env.AUDIT_BASE_URL || "http://localhost:4173")).replace(/\/$/, "");
const OUT = getArg("out", "reports/accessibility/accessibility-audit.json");

/** 監査対象ページ（App.tsxの全ページコンポーネントを1URLずつ網羅する） */
const ROUTES = [
  { path: "/", label: "トップ（議員一覧）" },
  { path: "/search", label: "サイト内検索" },
  { path: "/search?q=%E8%AD%B0%E6%A1%88", label: "検索結果" },
  { path: "/koho-search", label: "広報のべおか検索" },
  { path: "/dashboard", label: "ダッシュボード" },
  { path: "/people", label: "人物から探す" },
  { path: "/people/former-member-fm01", label: "人物詳細" },
  { path: "/members/m01", label: "議員詳細" },
  { path: "/members/former", label: "元議員一覧" },
  { path: "/members/former/fm01", label: "元議員詳細" },
  { path: "/members/history", label: "議員の変遷" },
  { path: "/members/fm01/questions/fm01-2019-12-ippan-shitsumon", label: "議員質問詳細" },
  { path: "/mayor", label: "市長ページ" },
  { path: "/mayor/policy-progress", label: "市長公約進捗" },
  { path: "/mayor/policy-progress/1-1", label: "公約詳細" },
  { path: "/mayor/entertainment-expenses", label: "市長交際費" },
  { path: "/mayor/press-conferences", label: "市長記者会見一覧" },
  { path: "/mayors", label: "歴代市長" },
  { path: "/mayors/miura-hisatomo", label: "歴代市長詳細" },
  { path: "/city-officials", label: "副市長・教育長等" },
  { path: "/city-organization", label: "市の組織" },
  { path: "/political-funds", label: "政治資金" },
  { path: "/political-funds/pf-org-001", label: "政治団体詳細" },
  { path: "/committees", label: "委員会一覧" },
  { path: "/committees/leadership-history", label: "歴代議長・副議長" },
  { path: "/committees/committee-gikai-unei", label: "委員会詳細" },
  { path: "/elections", label: "選挙一覧" },
  { path: "/elections/election-council-2023", label: "選挙詳細" },
  { path: "/finance", label: "財政" },
  { path: "/finance/budget", label: "予算" },
  { path: "/finance/debt", label: "市債" },
  { path: "/finance/funds", label: "基金" },
  { path: "/compare", label: "比較トップ" },
  { path: "/compare/mayors", label: "市長比較" },
  { path: "/compare/members", label: "議員比較" },
  { path: "/compare/finance", label: "財政比較" },
  { path: "/compare/population", label: "人口比較" },
  { path: "/compare/budget", label: "予算比較" },
  { path: "/compare/debt", label: "市債比較" },
  { path: "/compare/funds", label: "基金比較" },
  { path: "/compare/municipalities", label: "自治体比較" },
  { path: "/compare/similar-municipalities", label: "類似団体比較" },
  { path: "/compare/policies", label: "政策比較" },
  { path: "/timeline", label: "市政年表" },
  { path: "/timeline/1963", label: "年表（年別）" },
  { path: "/history", label: "沿革" },
  { path: "/policies", label: "政策・公約" },
  { path: "/policies/mayor-miura-children", label: "政策詳細" },
  { path: "/compensation", label: "報酬比較" },
  { path: "/city-guide", label: "市役所案内診断" },
  { path: "/about", label: "このサイトについて" },
  { path: "/terms", label: "利用規約" },
  { path: "/editorial-policy", label: "編集方針" },
  { path: "/contact", label: "お問い合わせ" },
  { path: "/bills", label: "議案アーカイブ" },
  { path: "/bills/votes", label: "議案賛否一覧" },
  { path: "/bills/compare", label: "議案比較" },
  { path: "/bills/bill-auditor-appointment-2026-06", label: "議案詳細" },
  { path: "/ordinances", label: "条例一覧" },
  { path: "/ordinances/ordinance-special-use-district-2023", label: "条例詳細" },
  { path: "/petitions", label: "請願一覧" },
  { path: "/petitions/petition-covid-vaccine-concern-2024", label: "請願詳細" },
  { path: "/requests", label: "陳情一覧" },
  { path: "/requests/request-council-reform-2023-12", label: "陳情詳細" },
  { path: "/council-documents", label: "議会資料一覧" },
  { path: "/council-documents/2004-06", label: "定例会詳細" },
  { path: "/questions", label: "一般質問一覧" },
  { path: "/questions/gq2026-06-m01", label: "一般質問詳細" },
  { path: "/themes", label: "テーマ一覧" },
  { path: "/themes/digital", label: "テーマ詳細" },
  { path: "/executive-answers", label: "執行部答弁" },
  { path: "/updates", label: "更新履歴" },
  { path: "/data-status", label: "データ整備状況" },
  { path: "/methodology/activity-radar", label: "活動レーダー算定方法" },
  { path: "/council-activity", label: "議会活動" },
  { path: "/council-activity/history", label: "議会活動の推移" },
  { path: "/council-activity/m01", label: "議員別議会活動" },
  { path: "/this-route-does-not-exist", label: "404ページ" },
];

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function main() {
  const { chromium } = await import("playwright");
  const { default: AxeBuilder } = await import("@axe-core/playwright");

  const browser = await chromium.launch();
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    axeTags: AXE_TAGS,
    pages: [],
    summary: {},
  };

  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const pageResult = { ...route, axe: null, keyboard: null, structure: null, zoom: null, reducedMotion: null, darkColorContrast: null, errors: [] };

    try {
      await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(300);

      // ---- 1. 自動監査（axe-core） ----
      const axeResults = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      pageResult.axe = {
        violations: axeResults.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          tags: v.tags,
          nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target, summary: n.failureSummary })),
          nodeCount: v.nodes.length,
        })),
        incompleteIds: axeResults.incomplete.map((v) => `${v.id}(${v.nodes.length})`),
        passCount: axeResults.passes.length,
      };

      // ---- 2. 構造・属性 ----
      pageResult.structure = await page.evaluate(() => {
        const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({
          level: Number(h.tagName[1]),
          text: (h.textContent || "").trim().slice(0, 40),
        }));
        const skips = [];
        let prev = 0;
        for (const h of headings) {
          if (prev && h.level > prev + 1) skips.push(`h${prev} → h${h.level}（${h.text}）`);
          prev = h.level;
        }
        const navs = [...document.querySelectorAll("nav")].map((n) => n.getAttribute("aria-label") || n.getAttribute("aria-labelledby") || "(ラベルなし)");
        const imgsNoAlt = [...document.querySelectorAll("img")].filter((i) => i.getAttribute("alt") === null).map((i) => i.getAttribute("src"));
        const controls = [...document.querySelectorAll("input,select,textarea")].filter((el) => {
          if (el.type === "hidden") return false;
          if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title")) return false;
          if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
          return !el.closest("label");
        }).map((el) => el.outerHTML.slice(0, 80));
        const danglingAriaControls = [...document.querySelectorAll("[aria-controls]")]
          .filter((el) => !el.getAttribute("aria-controls").split(/\s+/).every((id) => id && document.getElementById(id)))
          .map((el) => `${el.tagName.toLowerCase()}[aria-controls="${el.getAttribute("aria-controls")}"]`);
        return {
          h1Count: headings.filter((h) => h.level === 1).length,
          headingSkips: skips,
          navLabels: navs,
          unlabeledNavCount: navs.filter((n) => n === "(ラベルなし)").length,
          landmarks: {
            main: document.querySelectorAll("main, [role=main]").length,
            header: document.querySelectorAll("body > div > header, header").length,
            footer: document.querySelectorAll("footer").length,
          },
          imgsMissingAltAttr: imgsNoAlt,
          unlabeledFormControls: controls,
          danglingAriaControls,
          ariaCurrentCount: document.querySelectorAll("[aria-current]").length,
        };
      });

      // ---- 3. キーボード実動作 ----
      const kb = { tabStops: [], invisibleFocus: [], trap: null, skipLink: null, focusOrderMismatch: [] };

      // skip link：最初の Tab で「本文へ移動」が出て、Enter で main へ移動するか
      await page.keyboard.press("Tab");
      const firstFocus = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().slice(0, 30),
          href: el.getAttribute("href"),
          visible: rect.width > 1 && rect.height > 1 && cs.visibility !== "hidden" && cs.clipPath !== "inset(50%)",
          outlineWidth: cs.outlineWidth,
          outlineStyle: cs.outlineStyle,
        };
      });
      if (firstFocus && firstFocus.href === "#main-content") {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(150);
        kb.skipLink = {
          present: true,
          visibleOnFocus: firstFocus.visible,
          focusStyleApplied: firstFocus.outlineStyle !== "none" && parseFloat(firstFocus.outlineWidth) > 0,
          movedFocusToMain: await page.evaluate(() => {
            const target = document.getElementById("main-content");
            return !!target && (document.activeElement === target || target.contains(document.activeElement) || location.hash === "#main-content");
          }),
        };
      } else {
        kb.skipLink = { present: false, firstFocus };
      }

      // Tab 巡回：フォーカス可視性・DOM 順との一致・トラップ検出
      await page.evaluate(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
      });
      const seen = new Set();
      let repeats = 0;
      const MAX_TAB = 90;
      for (let i = 0; i < MAX_TAB; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const all = [...document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")].filter(
            (n) => !n.hasAttribute("disabled") && n.getAttribute("tabindex") !== "-1",
          );
          return {
            key: `${el.tagName}#${el.id}.${(el.className || "").toString().slice(0, 40)}|${(el.textContent || "").trim().slice(0, 25)}`,
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || "").trim().slice(0, 30),
            domIndex: all.indexOf(el),
            top: Math.round(rect.top + window.scrollY),
            left: Math.round(rect.left),
            outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
            // フォーカス表示は、要素自身のoutlineだけでなく、
            // ラップしている<label>等のfocus-within:outlineでも成立するため祖先も確認する。
            hasVisibleFocusStyle: (() => {
              let node = el;
              for (let d = 0; d < 4 && node && node !== document.body; d++) {
                const s = getComputedStyle(node);
                if (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) return true;
                if (s.boxShadow && s.boxShadow !== "none" && d === 0) return true;
                node = node.parentElement;
              }
              return false;
            })(),
            offscreen: rect.width === 0 && rect.height === 0,
          };
        });
        if (!info) break;
        if (seen.has(info.key)) {
          repeats += 1;
          if (repeats > 3) break;
        } else {
          repeats = 0;
        }
        seen.add(info.key);
        kb.tabStops.push(info);
        if (!info.hasVisibleFocusStyle && !info.offscreen) kb.invisibleFocus.push(`${info.tag}「${info.text}」outline=${info.outline}`);
      }
      // トラップ判定：Tab で到達した要素数が 3 未満、または同一要素から抜けられない
      const uniqueKeys = new Set(kb.tabStops.map((t) => t.key));
      kb.trap = { uniqueStops: uniqueKeys.size, totalPresses: kb.tabStops.length, suspected: uniqueKeys.size > 0 && uniqueKeys.size < 3 };

      // Shift+Tab で戻れるか
      const beforeBack = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 25) || "");
      await page.keyboard.press("Shift+Tab");
      const afterBack = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 25) || "");
      kb.shiftTabWorks = beforeBack !== afterBack;

      // フォーカス順序（視覚順との整合）：上下方向の大きな逆行を検出
      for (let i = 1; i < kb.tabStops.length; i++) {
        const a = kb.tabStops[i - 1];
        const b = kb.tabStops[i];
        if (b.top < a.top - 200) kb.focusOrderMismatch.push(`${a.tag}「${a.text}」(y=${a.top}) → ${b.tag}「${b.text}」(y=${b.top})`);
      }

      // 開閉 UI（aria-expanded を持つボタン）を Enter / Space / Escape で操作
      kb.disclosures = await (async () => {
        const results = [];
        const handles = await page.$$("button[aria-expanded]");
        for (const h of handles.slice(0, 4)) {
          const before = await h.getAttribute("aria-expanded");
          await h.focus();
          await page.keyboard.press("Enter");
          await page.waitForTimeout(120);
          const afterEnter = await h.getAttribute("aria-expanded").catch(() => null);
          await page.keyboard.press("Space").catch(() => {});
          await page.waitForTimeout(120);
          const afterSpace = await h.getAttribute("aria-expanded").catch(() => null);
          results.push({
            label: ((await h.textContent().catch(() => "")) || "").trim().slice(0, 30),
            before,
            afterEnter,
            afterSpace,
            enterToggles: before !== afterEnter,
            spaceToggles: afterEnter !== afterSpace,
          });
        }
        return results;
      })();

      // details/summary の Enter 操作
      kb.details = await page.evaluate(() => document.querySelectorAll("details").length);

      pageResult.keyboard = kb;

      // ---- 4. 200% 拡大相当（幅を半分にした 1280px 相当 = 640px）＋ 375px ----
      const zoomChecks = [];
      for (const w of [320, 375, 640]) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(200);
        const r = await page.evaluate(() => {
          const de = document.documentElement;
          const overflowing = [...document.querySelectorAll("body *")]
            .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 2 && getComputedStyle(el).position !== "fixed")
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 40)}`);
          return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, overflowing };
        });
        zoomChecks.push({ width: w, ...r, horizontalScroll: r.scrollWidth > r.clientWidth + 1 });
      }
      pageResult.zoom = zoomChecks;
      await page.setViewportSize({ width: 390, height: 844 });

      // ---- 5. prefers-reduced-motion の実効確認 ----
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(150);
      pageResult.reducedMotion = await page.evaluate(() => {
        const targets = [...document.querySelectorAll("*")].filter((el) => {
          const cs = getComputedStyle(el);
          return cs.transitionDuration !== "0s" || cs.animationName !== "none";
        });
        const notReduced = targets
          .filter((el) => {
            const cs = getComputedStyle(el);
            const t = parseFloat(cs.transitionDuration) || 0;
            const a = parseFloat(cs.animationDuration) || 0;
            return t > 0.05 || (cs.animationName !== "none" && a > 0.05);
          })
          .slice(0, 5)
          .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 40)}`);
        return { mediaMatches: matchMedia("(prefers-reduced-motion: reduce)").matches, animatedElements: targets.length, notReduced };
      });
      await page.emulateMedia({ reducedMotion: "no-preference" });

      // ---- 6. ダークテーマ（prefers-color-scheme: dark）でのコントラスト ----
      await page.emulateMedia({ colorScheme: "dark" });
      await page.waitForTimeout(250);
      const darkResults = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      pageResult.darkColorContrast = {
        violations: darkResults.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodeCount: v.nodes.length,
          nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      };
      await page.emulateMedia({ colorScheme: "light" });
    } catch (e) {
      pageResult.errors.push(String(e && e.message ? e.message : e));
    }

    report.pages.push(pageResult);
    await context.close();
    process.stdout.write(`. ${route.path}\n`);
  }

  await browser.close();

  // ---- 集計 ----
  const impacts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const byRule = {};
  for (const p of report.pages) {
    for (const v of p.axe?.violations ?? []) {
      impacts[v.impact] = (impacts[v.impact] ?? 0) + v.nodeCount;
      byRule[v.id] = byRule[v.id] || { impact: v.impact, help: v.help, nodes: 0, pages: [] };
      byRule[v.id].nodes += v.nodeCount;
      byRule[v.id].pages.push(p.path);
    }
  }
  report.summary = {
    pagesAudited: report.pages.length,
    violationsByImpact: impacts,
    violationsByRule: byRule,
    keyboardTrapsSuspected: report.pages.filter((p) => p.keyboard?.trap?.suspected).map((p) => p.path),
    invisibleFocusPages: report.pages.filter((p) => (p.keyboard?.invisibleFocus?.length ?? 0) > 0).map((p) => p.path),
    skipLinkFailures: report.pages.filter((p) => !p.keyboard?.skipLink?.present || !p.keyboard?.skipLink?.movedFocusToMain).map((p) => p.path),
    horizontalScrollPages: report.pages
      .filter((p) => (p.zoom ?? []).some((z) => z.horizontalScroll))
      .map((p) => ({ path: p.path, widths: (p.zoom ?? []).filter((z) => z.horizontalScroll).map((z) => z.width) })),
    reducedMotionFailures: report.pages.filter((p) => (p.reducedMotion?.notReduced?.length ?? 0) > 0).map((p) => p.path),
    headingSkipPages: report.pages.filter((p) => (p.structure?.headingSkips?.length ?? 0) > 0).map((p) => p.path),
    multipleH1Pages: report.pages.filter((p) => (p.structure?.h1Count ?? 0) !== 1).map((p) => ({ path: p.path, h1: p.structure?.h1Count })),
    unlabeledNavPages: report.pages.filter((p) => (p.structure?.unlabeledNavCount ?? 0) > 0).map((p) => ({ path: p.path, count: p.structure.unlabeledNavCount })),
    danglingAriaControlsPages: report.pages.filter((p) => (p.structure?.danglingAriaControls?.length ?? 0) > 0).map((p) => p.path),
    pagesWithErrors: report.pages.filter((p) => p.errors.length > 0).map((p) => ({ path: p.path, errors: p.errors })),
    darkContrastViolations: report.pages
      .filter((p) => (p.darkColorContrast?.violations?.length ?? 0) > 0)
      .map((p) => ({ path: p.path, nodes: p.darkColorContrast.violations.reduce((n, v) => n + v.nodeCount, 0) })),
    // axeが自動判定しきれなかった項目（要人手確認）。0件でも「完全準拠」とは判断しない。
    incompleteByRule: (() => {
      const acc = {};
      for (const p of report.pages) for (const s of p.axe?.incompleteIds ?? []) {
        const id = s.replace(/\(\d+\)$/, "");
        acc[id] = (acc[id] ?? 0) + 1;
      }
      return acc;
    })(),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log(`\n=== accessibility audit summary ===`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nreport: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
