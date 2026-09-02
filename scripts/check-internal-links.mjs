/**
 * プリレンダリング済み dist/ の内部リンクが、すべて実在するページ／ファイルを
 * 指しているかを検査する。
 *
 * 背景：Phase196 で `/members`（ルート未定義＝404）への直リンクが1件残っていた。
 * ビルド時にこの種のリンク切れを検出できるようにする。
 *
 * 使い方: node scripts/check-internal-links.mjs
 * 終了コード: リンク切れが1件でもあれば 1
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";

if (!existsSync(dist)) {
  console.error("[check-internal-links] dist/ がありません。先に npm run build を実行してください。");
  process.exit(1);
}

const pages = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry === "index.html") pages.push(p);
  }
})(dist);

// href="/..." のうち、同一サイト内へのリンクだけを対象にする（# と ? は除去）
const hrefPattern = /href="(\/[^"#?]*)/g;
const targets = new Map();
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  for (const m of html.matchAll(hrefPattern)) {
    const href = m[1].replace(/\/$/, "") || "/";
    if (!targets.has(href)) targets.set(href, new Set());
    targets.get(href).add(page);
  }
}

const broken = [];
for (const [href, referrers] of targets) {
  const relative = href === "/" ? "" : href;
  const asPage = join(dist, relative, "index.html");
  const asFile = join(dist, relative);
  if (existsSync(asPage)) continue;
  if (existsSync(asFile) && statSync(asFile).isFile()) continue;
  broken.push({ href, referrerCount: referrers.size, sample: [...referrers][0] });
}

broken.sort((a, b) => b.referrerCount - a.referrerCount);
for (const b of broken) {
  console.error(`[check-internal-links] リンク切れ: ${b.href}（${b.referrerCount}ページから参照、例: ${b.sample}）`);
}

console.log(
  `[check-internal-links] ${pages.length}ページ / 内部リンク先${targets.size}種類を検査 — リンク切れ${broken.length}件`,
);
process.exit(broken.length > 0 ? 1 : 0);
