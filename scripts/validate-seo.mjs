/**
 * プリレンダリング済みdist/配下のHTMLを検証する。
 * ここで問題が見つかった場合は npm run build を失敗させる（プリレンダリングのバグを
 * 検知せずデプロイしてしまうことを防ぐ）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getIndexableRoutes, getPrerenderRoutes, root } from "./lib/public-routes.mjs";
import { SITE_URL } from "./lib/site-config.mjs";

const distDir = join(root, "dist");

/** Dataset構造化データを出力しているページ（src/lib/seo.tsのdatasetJsonLd呼び出しと対応）。 */
const DATASET_PAGES = new Set([
  "/",
  "/bills/votes",
  "/questions",
  "/finance",
  "/compensation",
  "/dashboard",
  "/mayor/policy-progress",
  "/mayor/entertainment-expenses",
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const failures = [];
const warnings = [];
function fail(msg) {
  failures.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function isFutureDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // ビルド実行時のタイムゾーン差による1日程度のずれは許容する。
  return d.getTime() > todayUtc + 2 * 24 * 60 * 60 * 1000;
}

function htmlPathFor(routePath) {
  if (routePath === "/") return join(distDir, "index.html");
  return join(distDir, routePath.replace(/^\//, ""), "index.html");
}

function count(html, re) {
  const m = html.match(re);
  return m ? m.length : 0;
}

/** dist HTML内のすべてのJSON-LD <script>を、id・パース結果つきで取り出す。 */
function extractJsonLd(html, label) {
  const entries = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"(?:\s+id="([^"]*)")?[^>]*>([\s\S]*?)<\/script>/g)) {
    const [, id, raw] = m;
    try {
      entries.push({ id, data: JSON.parse(raw) });
    } catch {
      fail(`[${label}] JSON-LDが有効なJSONではありません（id: ${id ?? "なし"}）`);
    }
  }
  return entries;
}

/** JSON-LDオブジェクトから@typeを配列で取得する（単一文字列・配列どちらの表現にも対応）。 */
function typesOf(data) {
  if (!data || typeof data !== "object") return [];
  const t = data["@type"];
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
}

function checkDateModifiedFields(obj, label, path, seen = new Set()) {
  if (!obj || typeof obj !== "object" || seen.has(obj)) return;
  seen.add(obj);
  for (const [key, value] of Object.entries(obj)) {
    if ((key === "dateModified" || key === "datePublished") && typeof value === "string") {
      if (!DATE_RE.test(value)) {
        fail(`[${label}] ${path}.${key}がYYYY-MM-DD形式ではありません（実際: ${value}）`);
      } else if (isFutureDate(value)) {
        fail(`[${label}] ${path}.${key}が未来の日付になっています（実際: ${value}）`);
      }
    } else if (value && typeof value === "object") {
      checkDateModifiedFields(value, label, `${path}.${key}`, seen);
    }
  }
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
  const canonical = canonicalMatches[0]?.[1];
  if (canonical && !/^https:\/\//.test(canonical)) {
    fail(`[${label}] canonicalが絶対URLではありません（実際: ${canonical}）`);
  }

  const ogUrlMatches = [...html.matchAll(/<meta property="og:url" content="([^"]*)"\s*\/>/g)];
  if (ogUrlMatches.length > 1) fail(`[${label}] og:urlが${ogUrlMatches.length}個あります（重複）`);

  const ogImageMatch = html.match(/<meta property="og:image" content="([^"]*)"\s*\/>/);
  if (ogImageMatch && !/^https:\/\//.test(ogImageMatch[1])) {
    fail(`[${label}] OGP画像URL（og:image）が絶対URLではありません（実際: ${ogImageMatch[1]}）`);
  }

  const robotsMatch = html.match(/<meta name="robots" content="([^"]*)"\s*\/>/);
  if (!robotsMatch) fail(`[${label}] robotsメタタグが存在しません`);

  const h1Count = count(html, /<h1[ >]/g);
  if (h1Count === 0) fail(`[${label}] h1が存在しません`);
  if (h1Count > 1) fail(`[${label}] h1が${h1Count}個あります（1個である必要があります）`);

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

  const jsonLdEntries = extractJsonLd(html, label);

  // --- 同じidのJSON-LDが重複していないか ---
  const idCounts = new Map();
  for (const entry of jsonLdEntries) {
    if (!entry.id) continue;
    idCounts.set(entry.id, (idCounts.get(entry.id) ?? 0) + 1);
  }
  for (const [id, n] of idCounts) {
    if (n > 1) fail(`[${label}] JSON-LDのid "${id}" が${n}回出力されています（重複）`);
  }

  // --- dateModified / datePublished の形式・未来日チェック ---
  for (const entry of jsonLdEntries) {
    checkDateModifiedFields(entry.data, label, entry.id ?? "(no id)");
  }

  if (expectIndexable) {
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

    // --- WebPage JSON-LDの存在とurl整合性 ---
    const webPage = jsonLdEntries.find((e) => typesOf(e.data).includes("WebPage"));
    if (!webPage) {
      fail(`[${label}] WebPage構造化データが見つかりません`);
    } else if (webPage.data.url !== expectedCanonical) {
      fail(`[${label}] WebPage構造化データのurlがcanonicalと一致しません（期待値: ${expectedCanonical} / 実際: ${webPage.data.url}）`);
    }

    // --- Dataset対象ページの存在確認 ---
    if (DATASET_PAGES.has(routePath)) {
      const dataset = jsonLdEntries.find((e) => typesOf(e.data).includes("Dataset"));
      if (!dataset) {
        fail(`[${label}] Dataset構造化データが見つかりません（対象ページのはずです）`);
      } else if (dataset.data.url !== expectedCanonical) {
        fail(`[${label}] Dataset構造化データのurlがcanonicalと一致しません（期待値: ${expectedCanonical} / 実際: ${dataset.data.url}）`);
      }
    }

    // --- url/canonicalを持つ他のJSON-LD（Person/Article）もcanonicalと一致するか ---
    for (const entry of jsonLdEntries) {
      const types = typesOf(entry.data);
      if ((types.includes("Person") || types.includes("Article")) && typeof entry.data.url === "string") {
        if (entry.data.url !== expectedCanonical) {
          fail(
            `[${label}] ${types.join("/")}構造化データのurlがcanonicalと一致しません（期待値: ${expectedCanonical} / 実際: ${entry.data.url}）`,
          );
        }
      }
    }
  }
}

// --- サイトマップ対象（索引対象）ページ ---
const indexableRoutes = getIndexableRoutes();
for (const route of indexableRoutes) {
  checkPage(route.path, { expectIndexable: true });
}

// --- 実在するがnoindexのページ（/search, /bills） ---
const prerenderRoutes = getPrerenderRoutes();
const noindexRoutes = prerenderRoutes.filter((r) => !indexableRoutes.some((i) => i.path === r.path));
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
    const canonicalCount = count(html, /<link rel="canonical"/g);
    if (canonicalCount > 0) fail(`[404.html] canonicalが出力されています（404ページには不要です）`);
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    if (!titleMatch || !titleMatch[1].includes("見つかりません")) {
      warn("[404.html] titleに「見つかりません」という文言が含まれていません。");
    }
    const h1Count = count(html, /<h1[ >]/g);
    if (h1Count === 0) fail("[404.html] h1が存在しません");
    if (h1Count > 1) fail(`[404.html] h1が${h1Count}個あります（1個である必要があります）`);
  }
}

// --- サイトマップの検証（lastmod形式・未来日・noindexページ不在） ---
{
  const sitemapPath = join(root, "public", "sitemap.xml");
  if (existsSync(sitemapPath)) {
    const sitemap = readFileSync(sitemapPath, "utf8");
    for (const p of ["/search", "/bills"]) {
      if (sitemap.includes(`<loc>${SITE_URL}${p}</loc>`)) {
        fail(`sitemap.xml に noindexページ ${p} が含まれています。`);
      }
    }
    const lastmodValues = [...sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((m) => m[1]);
    if (lastmodValues.length === 0) {
      fail("sitemap.xml にlastmodが1件も出力されていません。");
    }
    for (const v of lastmodValues) {
      if (!DATE_RE.test(v)) {
        fail(`sitemap.xml のlastmodがYYYY-MM-DD形式ではありません（実際: ${v}）`);
      } else if (isFutureDate(v)) {
        fail(`sitemap.xml のlastmodが未来の日付になっています（実際: ${v}）`);
      }
    }
    const urlCount = (sitemap.match(/<loc>/g) || []).length;
    if (urlCount !== indexableRoutes.length) {
      fail(`sitemap.xmlのURL数（${urlCount}）が索引対象ページ数（${indexableRoutes.length}）と一致しません。`);
    }
  } else {
    fail("public/sitemap.xml が見つかりません。");
  }
}

// --- report ---
console.log(
  `[validate-seo] checked ${indexableRoutes.length + noindexRoutes.length + 1} page(s). failures=${failures.length} warnings=${warnings.length}`,
);
for (const w of warnings) console.warn(`[WARN] ${w}`);
for (const f of failures) console.error(`[FAIL] ${f}`);

if (failures.length > 0) {
  console.error("\nSEO検証で問題が見つかりました。上記のFAIL項目を修正してください。");
  process.exit(1);
}
console.log("\nSEO検証：問題は見つかりませんでした。");
