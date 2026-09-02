/**
 * 本番（Cloudflare Pages）で実際に配信されている内容とキャッシュ設定を実測する監査スクリプト。
 *
 * HTTP 200 だけでは合格としない。次を実測して突き合わせる。
 * 1. ローカル `dist/` の生成物と本番レスポンスの本文（sha256・主要マーカー）が一致するか
 *    ＝古いHTML・古い件数がCDNに残っていないか
 * 2. リソース種別ごとの Cache-Control / ETag / Age / CF-Cache-Status の実測値
 * 3. 同一URLへ2回連続アクセスしたときのキャッシュ状態の変化
 * 4. ETagを使った条件付きリクエスト（If-None-Match）で304が返るか＝再検証が効くか
 *
 * 出力：reports/phase198-production-cache-audit.json
 *
 * 使い方：node scripts/audit-production-cache.mjs [--base https://example.pages.dev]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const distDir = join(root, "dist");

const baseArgIndex = process.argv.indexOf("--base");
const BASE = baseArgIndex >= 0 ? process.argv[baseArgIndex + 1] : "https://nobeoka-shisei-portal.pages.dev";

/** プリレンダリング済みHTMLとして検証するURL。 */
const HTML_PATHS = [
  "/", "/dashboard", "/data-status", "/people", "/questions", "/bills/votes",
  "/committees", "/finance", "/history", "/mayor", "/mayor/policy-progress",
  "/updates", "/search", "/compare",
];

/** HTML以外の静的ファイル。 */
const STATIC_PATHS = ["/sitemap.xml", "/robots.txt", "/favicon.svg", "/og-image.png"];

/** Pages Functions（動的レスポンス）。dist/ には対応ファイルが無い。 */
const FUNCTION_PATHS = ["/api/site-stats"];

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Cloudflare Pagesは `dist/<path>/index.html` を `/<path>/` で配信し、
 * `/<path>`（末尾スラッシュなし）へのアクセスは308で `/<path>/` へ転送する。
 * 本文の比較は転送先（末尾スラッシュあり）で行い、転送自体も別途記録する。
 */
function contentUrlFor(urlPath) {
  return urlPath === "/" || urlPath.includes(".") ? urlPath : `${urlPath}/`;
}

/** URLパスに対応するローカル dist ファイルのパスを解決する。 */
function localFileFor(urlPath) {
  const clean = urlPath.split("?")[0];
  const candidates =
    clean === "/"
      ? ["index.html"]
      : [`${clean.slice(1)}/index.html`, `${clean.slice(1)}.html`, clean.slice(1)];
  for (const rel of candidates) {
    const abs = join(distDir, rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}

async function fetchOnce(url) {
  const res = await fetch(url, { redirect: "manual" });
  const buf = Buffer.from(await res.arrayBuffer());
  const pick = (name) => res.headers.get(name);
  return {
    status: res.status,
    bytes: buf.length,
    sha256: sha256(buf),
    body: buf,
    headers: {
      "content-type": pick("content-type"),
      "cache-control": pick("cache-control"),
      etag: pick("etag"),
      age: pick("age"),
      "cf-cache-status": pick("cf-cache-status"),
      "last-modified": pick("last-modified"),
      vary: pick("vary"),
    },
  };
}

async function fetchTwice(urlPath) {
  const url = `${BASE}${urlPath}`;
  const first = await fetchOnce(url);
  const second = await fetchOnce(url);
  let revalidation = null;
  if (first.headers.etag) {
    const res = await fetch(url, { headers: { "If-None-Match": first.headers.etag }, redirect: "manual" });
    revalidation = { status: res.status, cfCacheStatus: res.headers.get("cf-cache-status") };
    // 304以外の場合も本文を読み切っておく（接続の解放）。
    if (res.status !== 304) await res.arrayBuffer();
  }
  return { url, first, second, revalidation };
}

/** HTMLから比較に使う主要マーカーを取り出す。 */
function htmlMarkers(html) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? null;
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null;
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? null;
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    m[1].trim(),
  );
  const dateModified = html.match(/"dateModified":"([^"]*)"/)?.[1] ?? null;
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  const lastUpdated = html.match(/最終更新[^<]{0,40}?(\d{4}年\d{1,2}月\d{1,2}日\s*\d{2}:\d{2})/)?.[1] ?? null;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const numbers = [...text.matchAll(/([\d,]{2,})\s*件/g)].map((m) => `${m[1]}件`);
  return {
    title,
    canonical,
    description,
    jsonLdCount: jsonLd.length,
    jsonLdSha: jsonLd.map((j) => sha256(j).slice(0, 16)),
    dateModified,
    assets: [...new Set(assets)].sort(),
    lastUpdated,
    textLength: text.length,
    countPhrases: [...new Set(numbers)].sort(),
  };
}

function diffMarkers(local, remote) {
  const diffs = [];
  for (const key of ["title", "canonical", "description", "jsonLdCount", "lastUpdated", "dateModified"]) {
    if (JSON.stringify(local[key]) !== JSON.stringify(remote[key])) {
      diffs.push({ key, local: local[key], remote: remote[key] });
    }
  }
  if (JSON.stringify(local.jsonLdSha) !== JSON.stringify(remote.jsonLdSha)) {
    diffs.push({ key: "jsonLd", local: local.jsonLdSha, remote: remote.jsonLdSha });
  }
  if (JSON.stringify(local.assets) !== JSON.stringify(remote.assets)) {
    diffs.push({ key: "assets", local: local.assets, remote: remote.assets });
  }
  if (JSON.stringify(local.countPhrases) !== JSON.stringify(remote.countPhrases)) {
    diffs.push({
      key: "countPhrases",
      onlyLocal: local.countPhrases.filter((v) => !remote.countPhrases.includes(v)),
      onlyRemote: remote.countPhrases.filter((v) => !local.countPhrases.includes(v)),
    });
  }
  if (local.textLength !== remote.textLength) {
    diffs.push({ key: "textLength", local: local.textLength, remote: remote.textLength });
  }
  return diffs;
}

const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  localDistPresent: existsSync(distDir),
  html: [],
  static: [],
  assets: [],
  peopleVariants: [],
  functions: [],
  sitemap: null,
  summary: {},
};

console.log(`[audit-production-cache] base = ${BASE}`);

/**
 * Cloudflare Pagesのダッシュボード設定（Web Analytics）が本番のHTMLへ自動注入するbeaconは、
 * ビルド成果物には含まれない。内容比較の対象からは外し、注入の有無だけ別途記録する。
 */
function stripEdgeInjection(html) {
  // コメントブロック本体と直後の改行だけを取り除く（前後のインデントは本文側の内容として残す）。
  return html.replace(/<!-- Cloudflare Pages Analytics -->[\s\S]*?<!-- Cloudflare Pages Analytics -->\n?/g, "");
}

/**
 * 内容の同一性だけを見るための正規化。
 * - 改行コード：Windowsのチェックアウト（CRLF）と本番ビルド（Linux・LF）の差を吸収する。
 *   Windowsではテンプレート由来のCRが二重になる箇所があるため、CRはすべて取り除く。
 * - ハッシュ付きアセット名：ビルドごとに変わり得るため、内容比較の対象外とする
 *   （ファイル名の差自体は markerDiffs の "assets" として別に検出する）。
 */
function normalizeForCompare(html) {
  return stripEdgeInjection(html)
    .replace(/\r/g, "")
    .replace(/-[A-Za-z0-9_-]{8}\.(js|css)/g, "-HASH.$1");
}

// --- 1. HTML ---
for (const path of HTML_PATHS) {
  const contentPath = contentUrlFor(path);
  let trailingSlashRedirect = null;
  if (contentPath !== path) {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    await res.arrayBuffer();
    trailingSlashRedirect = { status: res.status, location: res.headers.get("location") };
  }
  const { first, second, revalidation } = await fetchTwice(contentPath);
  const localPath = localFileFor(path);
  const localHtml = localPath ? readFileSync(localPath, "utf8") : null;
  const remoteHtmlRaw = first.body.toString("utf8");
  const remoteHtml = stripEdgeInjection(remoteHtmlRaw);
  const edgeInjected = remoteHtml !== remoteHtmlRaw;
  const localSha = localHtml ? sha256(Buffer.from(normalizeForCompare(localHtml), "utf8")) : null;
  const remoteShaNormalized = sha256(Buffer.from(normalizeForCompare(remoteHtmlRaw), "utf8"));
  const entry = {
    path,
    contentPath,
    trailingSlashRedirect,
    edgeInjectedAnalyticsBeacon: edgeInjected,
    sha256RemoteNormalized: remoteShaNormalized,
    status: first.status,
    bytes: first.bytes,
    sha256Remote: first.sha256,
    sha256Local: localSha,
    localFile: localPath ? localPath.slice(root.length).replace(/\\/g, "/") : null,
    // 正規化（beacon除去・改行コード・アセットのハッシュ名）後の本文が一致するか。
    identical: localHtml ? localSha === remoteShaNormalized : null,
    headers: first.headers,
    headersSecond: { age: second.headers.age, "cf-cache-status": second.headers["cf-cache-status"] },
    revalidation,
    markerDiffs: localHtml ? diffMarkers(htmlMarkers(localHtml), htmlMarkers(remoteHtml)) : null,
    remoteMarkers: htmlMarkers(remoteHtml),
  };
  report.html.push(entry);
  console.log(
    `  HTML ${contentPath} status=${entry.status} identical=${entry.identical} markerDiffs=${entry.markerDiffs ? JSON.stringify(entry.markerDiffs.map((d) => d.key)) : "n/a"} redirect=${trailingSlashRedirect ? trailingSlashRedirect.status : "-"} cc=${entry.headers["cache-control"]} cf=${entry.headers["cf-cache-status"]}/${entry.headersSecond["cf-cache-status"]} revalidate=${revalidation ? revalidation.status : "no-etag"}`,
  );
}

// --- 2. 静的ファイル ---
for (const path of STATIC_PATHS) {
  const { first, second, revalidation } = await fetchTwice(path);
  const localPath = localFileFor(path);
  const localBuf = localPath ? readFileSync(localPath) : null;
  // テキスト系（sitemap.xml・robots.txt）は改行コードの差だけを吸収して比較する。
  const isText = /\.(xml|txt)$/.test(path);
  const normalize = (buf) => (isText ? Buffer.from(buf.toString("utf8").replace(/\r/g, ""), "utf8") : buf);
  const localSha = localBuf ? sha256(normalize(localBuf)) : null;
  const remoteSha = sha256(normalize(first.body));
  const entry = {
    path,
    status: first.status,
    bytes: first.bytes,
    sha256Remote: remoteSha,
    sha256Local: localSha,
    identical: localBuf ? localSha === remoteSha : null,
    headers: first.headers,
    headersSecond: { age: second.headers.age, "cf-cache-status": second.headers["cf-cache-status"] },
    revalidation,
  };
  report.static.push(entry);
  console.log(
    `  STATIC ${path} status=${entry.status} identical=${entry.identical} cc=${entry.headers["cache-control"]} cf=${entry.headers["cf-cache-status"]}/${entry.headersSecond["cf-cache-status"]} revalidate=${revalidation ? revalidation.status : "no-etag"}`,
  );
}

// --- 2-2. sitemap.xml のURL・lastmod突き合わせ ---
{
  const res = await fetch(`${BASE}/sitemap.xml`);
  const remoteXml = await res.text();
  const localXml = existsSync(join(distDir, "sitemap.xml")) ? readFileSync(join(distDir, "sitemap.xml"), "utf8") : "";
  const parse = (xml) =>
    new Map(
      [...xml.matchAll(/<loc>([^<]*)<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/g)].map((m) => [m[1], m[2]]),
    );
  const remoteMap = parse(remoteXml);
  const localMap = parse(localXml);
  const lastmodDiffs = [...localMap.keys()]
    .filter((loc) => remoteMap.has(loc) && remoteMap.get(loc) !== localMap.get(loc))
    .map((loc) => ({ loc, remote: remoteMap.get(loc), local: localMap.get(loc) }));
  const buildDate = new Date().toISOString().slice(0, 10);
  report.sitemap = {
    remoteUrlCount: remoteMap.size,
    localUrlCount: localMap.size,
    onlyInRemote: [...remoteMap.keys()].filter((loc) => !localMap.has(loc)),
    onlyInLocal: [...localMap.keys()].filter((loc) => !remoteMap.has(loc)),
    lastmodDiffCount: lastmodDiffs.length,
    lastmodDiffSamples: lastmodDiffs.slice(0, 20),
    remoteLastmodEqualToAuditDate: [...remoteMap.values()].filter((v) => v === buildDate).length,
    localLastmodEqualToAuditDate: [...localMap.values()].filter((v) => v === buildDate).length,
    auditDate: buildDate,
  };
  console.log(
    `  SITEMAP URL数 remote=${remoteMap.size} local=${localMap.size} / lastmod差分=${lastmodDiffs.length}件 / 監査日と同じ日付 remote=${report.sitemap.remoteLastmodEqualToAuditDate}件 local=${report.sitemap.localLastmodEqualToAuditDate}件`,
  );
}

// --- 3. ハッシュ付きアセット（本番HTMLが実際に参照しているもの） ---
const remoteAssetPaths = [...new Set(report.html.flatMap((h) => h.remoteMarkers.assets))];
for (const path of remoteAssetPaths.slice(0, 12)) {
  const { first, second, revalidation } = await fetchTwice(path);
  const localPath = localFileFor(path);
  const localBuf = localPath ? readFileSync(localPath) : null;
  const entry = {
    path,
    status: first.status,
    bytes: first.bytes,
    existsLocally: Boolean(localBuf),
    identical: localBuf ? sha256(localBuf) === first.sha256 : null,
    headers: first.headers,
    headersSecond: { age: second.headers.age, "cf-cache-status": second.headers["cf-cache-status"] },
    revalidation,
  };
  report.assets.push(entry);
  console.log(
    `  ASSET ${path} status=${entry.status} local=${entry.existsLocally} identical=${entry.identical} cc=${entry.headers["cache-control"]} cf=${entry.headers["cf-cache-status"]}/${entry.headersSecond["cf-cache-status"]}`,
  );
}

// --- 3-2. /people?type= のバリアントHTML（Pages Functionが差し替えて返す） ---
for (const type of ["member", "former-member", "mayor"]) {
  const path = `/people/?type=${type}`;
  const { first, second, revalidation } = await fetchTwice(path);
  const localPath = join(distDir, "_people-variants", `type-${type}.html`);
  const localHtml = existsSync(localPath) ? readFileSync(localPath, "utf8") : null;
  const remoteHtml = first.body.toString("utf8");
  const localSha = localHtml ? sha256(Buffer.from(normalizeForCompare(localHtml), "utf8")) : null;
  const remoteSha = sha256(Buffer.from(normalizeForCompare(remoteHtml), "utf8"));
  const entry = {
    path,
    status: first.status,
    bytes: first.bytes,
    identical: localHtml ? localSha === remoteSha : null,
    headers: first.headers,
    headersSecond: { age: second.headers.age, "cf-cache-status": second.headers["cf-cache-status"] },
    revalidation,
    markerDiffs: localHtml ? diffMarkers(htmlMarkers(localHtml), htmlMarkers(remoteHtml)) : null,
  };
  report.peopleVariants.push(entry);
  console.log(
    `  VARIANT ${path} status=${entry.status} identical=${entry.identical} markerDiffs=${entry.markerDiffs ? JSON.stringify(entry.markerDiffs.map((d) => d.key)) : "n/a"} cc=${entry.headers["cache-control"]}`,
  );
}

// --- 4. Pages Functions ---
for (const path of FUNCTION_PATHS) {
  const { first, second, revalidation } = await fetchTwice(path);
  const entry = {
    path,
    status: first.status,
    bytes: first.bytes,
    bodyPreview: first.body.toString("utf8").slice(0, 300),
    headers: first.headers,
    headersSecond: { age: second.headers.age, "cf-cache-status": second.headers["cf-cache-status"] },
    revalidation,
  };
  report.functions.push(entry);
  console.log(
    `  FUNC ${path} status=${entry.status} cc=${entry.headers["cache-control"]} cf=${entry.headers["cf-cache-status"]}`,
  );
}

// --- 5. 集計 ---
/**
 * 「古いHTMLが残っている」判定は、アセットのファイル名（＝ビルドごとに変わり得るハッシュ）
 * 以外のマーカー差分があるかどうかで行う。ハッシュ名だけの差分は別枠で集計する。
 */
const staleHtml = report.html.filter(
  (h) => h.markerDiffs && h.markerDiffs.some((d) => d.key !== "assets"),
);
const assetNameOnlyDiffHtml = report.html.filter(
  (h) => h.markerDiffs && h.markerDiffs.length > 0 && h.markerDiffs.every((d) => d.key === "assets"),
);
const dateModifiedDiffHtml = report.html.filter(
  (h) => h.markerDiffs && h.markerDiffs.some((d) => d.key === "dateModified"),
);
const trailingSlashRedirects = report.html.filter((h) => h.trailingSlashRedirect);
const staleAssets = report.assets.filter((a) => a.existsLocally && a.identical === false);
const staleStatic = report.static.filter((s) => s.identical === false);
const htmlNoRevalidate = report.html.filter((h) => !h.revalidation || h.revalidation.status !== 304);
const assetsNotImmutable = report.assets.filter((a) => !(a.headers["cache-control"] || "").includes("immutable"));

report.summary = {
  htmlChecked: report.html.length,
  staleHtmlCount: staleHtml.length,
  staleHtmlPaths: staleHtml.map((h) => h.path),
  assetNameOnlyDiffCount: assetNameOnlyDiffHtml.length,
  assetNameOnlyDiffPaths: assetNameOnlyDiffHtml.map((h) => h.path),
  dateModifiedDiffCount: dateModifiedDiffHtml.length,
  dateModifiedDiffs: dateModifiedDiffHtml.map((h) => ({
    path: h.path,
    ...h.markerDiffs.find((d) => d.key === "dateModified"),
  })),
  trailingSlashRedirectCount: trailingSlashRedirects.length,
  trailingSlashRedirectStatuses: [
    ...new Set(trailingSlashRedirects.map((h) => String(h.trailingSlashRedirect.status))),
  ],
  staticChecked: report.static.length,
  staleStaticCount: staleStatic.length,
  staleStaticPaths: staleStatic.map((s) => s.path),
  assetsChecked: report.assets.length,
  staleAssetCount: staleAssets.length,
  staleAssetPaths: staleAssets.map((a) => a.path),
  htmlWithoutRevalidation: htmlNoRevalidate.map((h) => h.path),
  assetsWithoutImmutable: assetsNotImmutable.map((a) => a.path),
  cacheControlByKind: {
    html: [...new Set(report.html.map((h) => h.headers["cache-control"]))],
    static: Object.fromEntries(report.static.map((s) => [s.path, s.headers["cache-control"]])),
    asset: [...new Set(report.assets.map((a) => a.headers["cache-control"]))],
    function: Object.fromEntries(report.functions.map((f) => [f.path, f.headers["cache-control"]])),
  },
};

// 本文（Buffer）はレポートへ出力しない。
for (const list of [report.html, report.static, report.assets, report.peopleVariants, report.functions]) {
  for (const entry of list) delete entry.body;
}

const outPath = join(root, "reports", "phase198-production-cache-audit.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("\n[audit-production-cache] 集計");
console.log(`  stale HTML: ${report.summary.staleHtmlCount}件 ${JSON.stringify(report.summary.staleHtmlPaths)}`);
console.log(`  stale 静的ファイル: ${report.summary.staleStaticCount}件 ${JSON.stringify(report.summary.staleStaticPaths)}`);
console.log(`  stale アセット: ${report.summary.staleAssetCount}件 ${JSON.stringify(report.summary.staleAssetPaths)}`);
console.log(`  HTMLで304再検証が効かないURL: ${report.summary.htmlWithoutRevalidation.length}件`);
console.log(`  immutableでないアセット: ${report.summary.assetsWithoutImmutable.length}件`);
console.log("  出力: reports/phase198-production-cache-audit.json");
