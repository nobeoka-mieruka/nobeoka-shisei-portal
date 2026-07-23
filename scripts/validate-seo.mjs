/**
 * プリレンダリング済みdist/配下のHTMLを検証する。
 * ここで問題が見つかった場合は npm run build を失敗させる（プリレンダリングのバグを
 * 検知せずデプロイしてしまうことを防ぐ）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getIndexableRoutes, getPrerenderRoutes, root } from "./lib/public-routes.mjs";

const SITE_URL = "https://nobeoka-shisei-portal.pages.dev";
const distDir = join(root, "dist");

const failures = [];
const warnings = [];
function fail(msg) {
  failures.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function htmlPathFor(routePath) {
  if (routePath === "/") return join(distDir, "index.html");
  return join(distDir, routePath.replace(/^\//, ""), "index.html");
}

function count(html, re) {
  const m = html.match(re);
  return m ? m.length : 0;
}

function checkPage(routePath, { expectIndexable }) {
  const filePath = htmlPathFor(routePath);
  const label = routePath;

  if (!existsSync(filePath)) {
    fail(`[${label}] サイトマップ対象URLに対応するHTMLが存在しません: ${filePath}`);
    return;
  }
  const html = readFileSync(filePath, "utf8");

  const titleCount = count(html, /<title>[^<]*<\/title>/g);
  if (titleCount !== 1) fail(`[${label}] titleが${titleCount}個です（1個である必要があります）`);

  const descCount = count(html, /<meta name="description" content="[^"]*"\s*\/>/g);
  if (descCount !== 1) fail(`[${label}] meta descriptionが${descCount}個です（1個である必要があります）`);

  const canonicalMatches = [...html.matchAll(/<link rel="canonical" href="([^"]*)"\s*\/>/g)];
  if (canonicalMatches.length > 1) fail(`[${label}] canonicalが${canonicalMatches.length}個あります（重複）`);

  const ogUrlMatches = [...html.matchAll(/<meta property="og:url" content="([^"]*)"\s*\/>/g)];
  if (ogUrlMatches.length > 1) fail(`[${label}] og:urlが${ogUrlMatches.length}個あります（重複）`);

  const robotsMatch = html.match(/<meta name="robots" content="([^"]*)"\s*\/>/);
  if (!robotsMatch) fail(`[${label}] robotsメタタグが存在しません`);

  const h1Count = count(html, /<h1[ >]/g);
  if (h1Count === 0) fail(`[${label}] h1が存在しません`);

  // div#rootはbody直下の唯一の要素のため、bodyを開いた直後から</body>直前までの
  // 最後の</div>が、必ずdiv#root自身の閉じタグになる。
  const rootMatch = html.match(/<div id="root">([\s\S]*)<\/div>\s*<\/body>/);
  const rootHtml = rootMatch ? rootMatch[1] : "";
  const rootText = rootHtml
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  if (rootText.length < 20) {
    fail(`[${label}] 初期HTMLの本文がほぼ空です（プリレンダリングされていない可能性）`);
  }

  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch {
      fail(`[${label}] JSON-LDが有効なJSONではありません`);
    }
  }

  if (expectIndexable) {
    const canonical = canonicalMatches[0]?.[1];
    const expectedCanonical = `${SITE_URL}${routePath}`;
    if (canonical !== expectedCanonical) {
      fail(`[${label}] canonicalが現在のURLと一致しません（期待値: ${expectedCanonical} / 実際: ${canonical ?? "なし"}）`);
    }
    if (routePath !== "/" && canonical === `${SITE_URL}/`) {
      fail(`[${label}] トップページ用canonicalが個別ページに残っています`);
    }
    const ogUrl = ogUrlMatches[0]?.[1];
    if (ogUrl !== expectedCanonical) {
      fail(`[${label}] og:urlが現在のURLと一致しません（期待値: ${expectedCanonical} / 実際: ${ogUrl ?? "なし"}）`);
    }
    if (robotsMatch && robotsMatch[1].includes("noindex")) {
      fail(`[${label}] サイトマップ対象ページなのにrobotsがnoindexです`);
    }
  }
}

// --- サイトマップ対象（索引対象）ページ ---
for (const route of getIndexableRoutes()) {
  checkPage(route.path, { expectIndexable: true });
}

// --- 実在するがnoindexのページ（/search, /bills） ---
const prerenderRoutes = getPrerenderRoutes();
const noindexRoutes = prerenderRoutes.filter((r) => !getIndexableRoutes().some((i) => i.path === r.path));
for (const route of noindexRoutes) {
  checkPage(route.path, { expectIndexable: false });
}

// --- /search は常に noindex, follow ---
{
  const filePath = htmlPathFor("/search");
  if (existsSync(filePath)) {
    const html = readFileSync(filePath, "utf8");
    const robotsMatch = html.match(/<meta name="robots" content="([^"]*)"\s*\/>/);
    if (!robotsMatch || robotsMatch[1] !== "noindex, follow") {
      fail(`[/search] robotsが"noindex, follow"ではありません（実際: ${robotsMatch?.[1] ?? "なし"}）`);
    }
  }
}

// --- 404.html ---
{
  const filePath = join(distDir, "404.html");
  if (!existsSync(filePath)) {
    fail("dist/404.html が見つかりません。");
  } else {
    const html = readFileSync(filePath, "utf8");
    const robotsMatch = html.match(/<meta name="robots" content="([^"]*)"\s*\/>/);
    if (!robotsMatch || robotsMatch[1] !== "noindex, nofollow") {
      fail(`[404.html] robotsが"noindex, nofollow"ではありません（実際: ${robotsMatch?.[1] ?? "なし"}）`);
    }
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    if (!titleMatch || !titleMatch[1].includes("見つかりません")) {
      warn("[404.html] titleに「見つかりません」という文言が含まれていません。");
    }
    const h1Count = count(html, /<h1[ >]/g);
    if (h1Count === 0) fail("[404.html] h1が存在しません");
  }
}

// --- サイトマップにnoindexページが含まれていないか ---
{
  const sitemapPath = join(root, "public", "sitemap.xml");
  if (existsSync(sitemapPath)) {
    const sitemap = readFileSync(sitemapPath, "utf8");
    for (const p of ["/search", "/bills"]) {
      if (sitemap.includes(`<loc>${SITE_URL}${p}</loc>`)) {
        fail(`sitemap.xml に noindexページ ${p} が含まれています。`);
      }
    }
  }
}

// --- report ---
console.log(`[validate-seo] checked ${getIndexableRoutes().length + noindexRoutes.length + 1} page(s). failures=${failures.length} warnings=${warnings.length}`);
for (const w of warnings) console.warn(`[WARN] ${w}`);
for (const f of failures) console.error(`[FAIL] ${f}`);

if (failures.length > 0) {
  console.error("\nSEO検証で問題が見つかりました。上記のFAIL項目を修正してください。");
  process.exit(1);
}
console.log("\nSEO検証：問題は見つかりませんでした。");
