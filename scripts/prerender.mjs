/**
 * ビルド後の dist/ に対して、React Router の各URLごとに静的HTML（プリレンダリング済み）を書き出す。
 *
 * 手順：
 * 1. src/entry-server.tsx を Vite の SSR ビルドで dist-ssr/ にビルドする（vite build --ssr）。
 * 2. ビルド済みSSRバンドルから renderApp（本文HTML）・getSeoForPath（head情報）を読み込む。
 * 3. scripts/lib/public-routes.mjs のURL一覧ごとに、dist/index.html をテンプレートとして
 *    ページ固有のhead（title・description・canonical・OGP・Twitter Card・robots・JSON-LD）と
 *    本文HTMLを書き出す。
 * 4. 一致するURLがない場合に返す dist/404.html も生成する（noindex, nofollow）。
 *
 * 外部の有料サービスやSSR専用フレームワークは使わず、Node.js標準機能とVite本体のSSRビルドのみで完結させる。
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getPrerenderRoutes, root } from "./lib/public-routes.mjs";
import { DEFAULT_OG_IMAGE, SITE_NAME } from "./lib/site-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
void __dirname;

const NOT_FOUND_SENTINEL_PATH = "/__prerender_not_found__";

const distDir = join(root, "dist");
const ssrOutDir = join(root, "dist-ssr");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- 1. SSRバンドルをビルド ---
if (existsSync(ssrOutDir)) rmSync(ssrOutDir, { recursive: true, force: true });

console.log("[prerender] building SSR bundle (vite build --ssr)...");
// Windowsの.cmdラッパー（npx.cmd等）はspawn系APIでshell:trueが必要になりやすいため、
// OS標準シェル経由で実行されるexecSyncを使う（Windows/POSIX双方で安定して動く）。
execSync("npx vite build --ssr src/entry-server.tsx --outDir dist-ssr", { cwd: root, stdio: "inherit" });

const ssrEntryFile = readdirSync(ssrOutDir).find((f) => /^entry-server\.(m?js)$/.test(f));
if (!ssrEntryFile) {
  throw new Error(`[prerender] dist-ssr/entry-server.(m)js が見つかりません（ビルド出力: ${readdirSync(ssrOutDir).join(", ")}）`);
}

const { renderApp, getSeoForPath } = await import(pathToFileURL(join(ssrOutDir, ssrEntryFile)).href);

// --- 2. dist/index.html をテンプレートとして、ページ固有ではない部分だけを残す ---
const indexHtmlPath = join(distDir, "index.html");
if (!existsSync(indexHtmlPath)) {
  throw new Error("[prerender] dist/index.html が見つかりません。先に vite build を実行してください。");
}

const rawTemplate = readFileSync(indexHtmlPath, "utf8");
const baseTemplate = rawTemplate
  .replace(/\s*<title>[^<]*<\/title>/, "")
  .replace(/\s*<meta name="description" content="[^"]*"\s*\/>/, "")
  .replace(/\s*<meta name="robots" content="[^"]*"\s*\/>/, "")
  .replace(/\s*<link rel="canonical" href="[^"]*"\s*\/>/, "")
  .replace(/\s*<meta property="og:[a-zA-Z_]+" content="[^"]*"\s*\/>/g, "")
  .replace(/\s*<meta name="twitter:[a-zA-Z]+" content="[^"]*"\s*\/>/g, "")
  .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, "");

if (!baseTemplate.includes('<div id="root"></div>')) {
  throw new Error('[prerender] dist/index.html に <div id="root"></div> が見つかりません。');
}

function buildHeadBlock(seo) {
  const lines = [];
  lines.push(`<title>${escapeHtml(seo.fullTitle)}</title>`);
  lines.push(`<meta name="description" content="${escapeHtml(seo.description)}" />`);
  lines.push(`<meta name="robots" content="${escapeHtml(seo.robots)}" />`);
  if (seo.canonical) lines.push(`<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`);
  lines.push(`<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`);
  lines.push(`<meta property="og:locale" content="ja_JP" />`);
  lines.push(`<meta property="og:type" content="${escapeHtml(seo.ogType)}" />`);
  lines.push(`<meta property="og:title" content="${escapeHtml(seo.fullTitle)}" />`);
  lines.push(`<meta property="og:description" content="${escapeHtml(seo.description)}" />`);
  if (seo.canonical) lines.push(`<meta property="og:url" content="${escapeHtml(seo.canonical)}" />`);
  lines.push(`<meta property="og:image" content="${escapeHtml(seo.image)}" />`);
  lines.push(`<meta name="twitter:card" content="summary_large_image" />`);
  lines.push(`<meta name="twitter:title" content="${escapeHtml(seo.fullTitle)}" />`);
  lines.push(`<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`);
  lines.push(`<meta name="twitter:image" content="${escapeHtml(seo.image)}" />`);
  for (const entry of seo.jsonLd ?? []) {
    lines.push(`<script type="application/ld+json" id="${escapeHtml(entry.id)}">${JSON.stringify(entry.data)}</script>`);
  }
  return lines.join("\n    ");
}

function buildHtml(seo, appHtml, extraHeadHtml = "") {
  const headBlock = buildHeadBlock(seo);
  return baseTemplate
    .replace("</head>", `    ${headBlock}${extraHeadHtml}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
}

function outputPathFor(routePath) {
  if (routePath === "/") return join(distDir, "index.html");
  const dir = join(distDir, routePath.replace(/^\//, ""));
  return join(dir, "index.html");
}

// --- 3. 各URLをレンダリング ---
const routes = getPrerenderRoutes();
let ok = 0;
const failures = [];

for (const route of routes) {
  try {
    const seo = getSeoForPath(route.path, { lastmod: route.lastmod });
    const appHtml = await renderApp(route.path);
    const html = buildHtml(seo, appHtml);
    const outPath = outputPathFor(route.path);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, "utf8");
    ok++;
  } catch (err) {
    failures.push({ path: route.path, message: err instanceof Error ? err.message : String(err) });
  }
}

// --- 3.5. /people?type=X のクエリバリアント ---
// 静的ホスティング（Cloudflare Pages）はクエリ文字列を無視して同一ファイルを配信するため、
// 通常のprerender対象（/people、クエリなし）だけでは/people/?type=member等へアクセスした際も
// サーバー生成HTMLは常に絞り込みなし版になり、検索エンジン・OGPプレビュー等JavaScriptを
// 実行しない閲覧者に絞り込み後の内容が伝わらない。既知のtype値（src/pages/PeoplePage.tsxの
// PERSON_TYPE_OPTIONSと同じ集合）ごとに、通常のルート一覧・サイトマップとは別に
// dist/_people-variants/ 配下へ専用HTMLを生成し、functions/people/index.tsが
// リクエストのtypeパラメータに応じてこちらへ差し替えて配信する。
// canonical・title等のSEO情報は/people本体と同一のものを使う（クエリ付きURLを別ページとして
// 索引させない、という既存のSEO方針を維持するため）。
const PEOPLE_TYPE_VARIANTS = ["member", "former-member", "mayor"];
try {
  const peopleSeo = getSeoForPath("/people");
  for (const type of PEOPLE_TYPE_VARIANTS) {
    const appHtml = await renderApp(`/people?type=${type}`);
    const html = buildHtml(peopleSeo, appHtml);
    const outPath = join(distDir, "_people-variants", `type-${type}.html`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, "utf8");
  }
  console.log(`[prerender] generated ${PEOPLE_TYPE_VARIANTS.length} /people type variant(s)`);
} catch (err) {
  failures.push({ path: "/people (type variants)", message: err instanceof Error ? err.message : String(err) });
}

// --- 4. 404.html ---
try {
  const appHtml = await renderApp(NOT_FOUND_SENTINEL_PATH);
  const notFoundSeo = {
    fullTitle: `ページが見つかりません｜${SITE_NAME}`,
    description: "お探しのページは、URLが変更されたか、削除された可能性があります。",
    canonical: null,
    robots: "noindex, nofollow",
    image: DEFAULT_OG_IMAGE,
    ogType: "website",
    jsonLd: [],
  };
  const html = buildHtml(notFoundSeo, appHtml);
  writeFileSync(join(distDir, "404.html"), html, "utf8");
} catch (err) {
  failures.push({ path: "404.html", message: err instanceof Error ? err.message : String(err) });
}

// SSRビルドの中間成果物はデプロイ対象ではないため削除する。
rmSync(ssrOutDir, { recursive: true, force: true });

console.log(`[prerender] generated ${ok}/${routes.length} route(s) + 404.html`);
if (failures.length > 0) {
  console.error(`[prerender] ${failures.length} route(s) failed:`);
  for (const f of failures) console.error(`  - ${f.path}: ${f.message}`);
  process.exit(1);
}
