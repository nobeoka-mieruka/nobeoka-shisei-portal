/**
 * Phase222：到達できない外部URLが「市民がクリックできるリンク」として公開画面に
 * 出ていないかを、プリレンダリング済み dist/ の実HTMLで検査する。
 *
 * 背景と区別（Phase209 の非リンク化を、主張ではなく実測で裏づけるための監査）：
 *   1. 公開画面のリンク切れ      … 市民が押せる <a href> が 404/5xx を指している状態。0 でなければならない。
 *   2. 内部データに残る参照URL   … src/data/*.json の出典レコードに保持している到達不能URL。
 *                                  「いつ・何を根拠にしたか」の記録なので削除しない（0 にはしない）。
 * 従来 /data-status はこの2つをまとめて「リンク切れ1件」と表示していたため、
 * 公開画面に押せるリンク切れが1件あるかのように読めていた。本スクリプトは 1 を実測し、
 * 結果を reports/broken-link-exposure.json へ書き出す（`reports/` はビルド対象外の内部監査結果）。
 *
 * 判定対象：src/data/dataQualitySummary.json の linkHealth.broken（外部リンク監査で
 * not_found_404 / server_error と確認済みのURL）。新しい到達性判定はここでは行わない
 * （ネットワークアクセスなし。既存の外部リンク監査キャッシュの結果のみを使う）。
 *
 * 使い方: node scripts/check-broken-link-exposure.mjs
 * 終了コード: 公開画面にクリック可能なリンク切れが1件でもあれば 1
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");

if (!existsSync(dist)) {
  console.error("[check-broken-link-exposure] dist/ がありません。先に npm run build を実行してください。");
  process.exit(1);
}

const summary = JSON.parse(readFileSync(join(root, "src", "data", "dataQualitySummary.json"), "utf8"));
const brokenUrls = new Set((summary.linkHealth?.broken ?? []).map((b) => b.url));

const pages = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry.endsWith(".html")) pages.push(p);
  }
})(dist);

/**
 * HTML内の href 属性値を列挙する。プリレンダリング結果の href はHTMLエスケープ済みなので、
 * 実データのURL（日本語を含む）と突き合わせる前に最小限のデコードを行う。
 */
const hrefPattern = /href="([^"]*)"/g;
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const exposures = new Map();
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  for (const m of html.matchAll(hrefPattern)) {
    const href = decode(m[1]);
    // データ側は生のURL、HTML側は encodeURI 済みで出力される場合があるため両方の形で照合する。
    let decodedHref = href;
    try {
      decodedHref = decodeURI(href);
    } catch {
      /* 不正なエスケープはそのまま比較する */
    }
    if (!brokenUrls.has(href) && !brokenUrls.has(decodedHref)) continue;
    const url = brokenUrls.has(href) ? href : decodedHref;
    if (!exposures.has(url)) exposures.set(url, new Set());
    exposures.get(url).add(page.slice(root.length + 1).replace(/\\/g, "/"));
  }
}

const found = [...exposures].map(([url, refs]) => ({
  url,
  pageCount: refs.size,
  samplePages: [...refs].slice(0, 5),
}));

for (const f of found) {
  console.error(
    `[check-broken-link-exposure] 公開画面にクリック可能なリンク切れ: ${f.url}（${f.pageCount}ページ、例: ${f.samplePages[0]}）`,
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  checkedPages: pages.length,
  knownBrokenUrls: brokenUrls.size,
  clickableBrokenLinks: found.length,
  exposures: found,
  note: "dist/（プリレンダリング済みの公開HTML）に対する実測。knownBrokenUrls＝外部リンク監査で到達不能と確認済みのURL数（内部データ上の参照。出典記録として保持する）。clickableBrokenLinks＝そのうち市民がクリックできる<a href>として公開画面に出ている件数（0でなければビルドを失敗させる）。",
};

const reportsDir = join(root, "reports");
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
writeFileSync(join(reportsDir, "broken-link-exposure.json"), JSON.stringify(report, null, 2) + "\n");

console.log(
  `[check-broken-link-exposure] ${pages.length}ページを検査 — 内部データ上の到達不能URL${brokenUrls.size}件 / 公開画面でクリック可能なリンク切れ${found.length}件`,
);
process.exit(found.length > 0 ? 1 : 0);
