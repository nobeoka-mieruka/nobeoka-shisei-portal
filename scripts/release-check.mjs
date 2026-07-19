import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const failures = [];
const warnings = [];
function fail(msg) {
  failures.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function read(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

// --- dist/index.html ---
const distIndexPath = join(root, "dist", "index.html");
if (!existsSync(distIndexPath)) {
  fail("dist/index.html が見つかりません。先に npm run build を実行してください。");
} else {
  const html = readFileSync(distIndexPath, "utf8");
  const verificationCount = (html.match(/name="google-site-verification"/g) || []).length;
  if (verificationCount === 0) fail("Search Console確認タグがdist/index.htmlに見つかりません。");
  if (verificationCount > 1) fail(`Search Console確認タグが${verificationCount}個あります（重複）。`);

  if (/name="robots"\s+content="[^"]*noindex[^"]*"/.test(html)) {
    fail("index.html のrobotsメタタグがnoindexになっています。サイト全体が検索対象外になります。");
  }
  const canonicalCount = (html.match(/rel="canonical"/g) || []).length;
  if (canonicalCount === 0) warn("index.html にcanonicalタグが見つかりません。");
  if (!html.includes('property="og:image"')) warn("index.html にog:imageが見つかりません。");
  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  if (!titleMatch || titleMatch[1].trim().length === 0) fail("index.html のtitleが空です。");
}

// --- robots.txt / sitemap.xml / _redirects / og-image ---
const robotsPath = join(root, "public", "robots.txt");
if (!existsSync(robotsPath)) {
  fail("public/robots.txt が見つかりません。");
} else {
  const robots = read("public/robots.txt");
  if (/^Disallow:\s*\/\s*$/m.test(robots) && !/Allow:\s*\//.test(robots)) {
    fail("robots.txt がサイト全体をDisallowしています。");
  }
  if (!robots.includes("Sitemap:")) warn("robots.txt にSitemapの記載がありません。");
}

if (!existsSync(join(root, "public", "sitemap.xml"))) {
  fail("public/sitemap.xml が見つかりません。npm run generate:sitemap を実行してください。");
} else {
  const sitemap = read("public/sitemap.xml");
  const urlCount = (sitemap.match(/<loc>/g) || []).length;
  if (urlCount === 0) fail("sitemap.xml にURLが1件も含まれていません。");
}

if (!existsSync(join(root, "public", "_redirects"))) {
  warn("public/_redirects が見つかりません（Cloudflare Pages以外のデプロイ方式の場合は不要な場合があります）。");
}

if (!existsSync(join(root, "public", "og-image.png"))) {
  fail("public/og-image.png（共通OGP画像）が見つかりません。");
}

// --- GA（測定IDはanalytics.tsに直接記載する方式。ビルド環境変数の設定漏れで
//     測定が止まる事故を防ぐため、Cloudflare Pagesの環境変数には依存しない） ---
if (!existsSync(join(root, "src", "lib", "analytics.ts"))) {
  fail("src/lib/analytics.ts が見つかりません。GA4実装が失われている可能性があります。");
} else if (!/GA_MEASUREMENT_ID\s*=\s*"G-[A-Z0-9]+"/.test(read("src/lib/analytics.ts"))) {
  fail("src/lib/analytics.ts にGA測定ID（G-XXXXXXXXXX）のハードコードが見つかりません。");
}

// --- β版表記の残存チェック（更新履歴などの過去記録は除外） ---
const BETA_WORDS = ["β版", "ベータ版", "試験公開", "仮公開", "テスト運用"];
const EXCLUDE_DIRS = new Set(["node_modules", "dist", ".git", "backups"]);
const EXCLUDE_FILES = new Set(["updateHistory.json", "release-check.mjs"]);

function walk(dir, files) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?|html)$/.test(entry) && !EXCLUDE_FILES.has(entry)) files.push(full);
  }
}
const sourceFiles = [];
walk(join(root, "src"), sourceFiles);
sourceFiles.push(join(root, "index.html"));

for (const file of sourceFiles) {
  const content = readFileSync(file, "utf8");
  for (const word of BETA_WORDS) {
    if (content.includes(word)) {
      warn(`${file.replace(root + "\\", "").replace(root + "/", "")} に「${word}」の表記が残っています。`);
    }
  }
}

// --- report ---
console.log(`[release-check] failures=${failures.length} warnings=${warnings.length}`);
for (const w of warnings) console.warn(`[WARN] ${w}`);
for (const f of failures) console.error(`[FAIL] ${f}`);

if (failures.length > 0) {
  console.error("\n公開前チェックで問題が見つかりました。上記のFAIL項目を修正してください。");
  process.exit(1);
}
console.log("\n公開前チェック：致命的な問題は見つかりませんでした。WARN項目は手動確認をおすすめします。");
