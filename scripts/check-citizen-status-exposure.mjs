/**
 * 公開ページ（ビルド後の dist/ のHTML）に、内部の状態コードがそのまま表示されていないかを検査する。
 * 例：CONFIRMED／UNCONFIRMED／SOURCE_NOT_PUBLISHED／WAITING_OFFICIAL_SOURCE／
 *     NOT_INDIVIDUALLY_ATTRIBUTABLE／RESEARCH_EXHAUSTED／needsReview／状態：elected
 * 表示テキストだけを対象にする（script・style・属性値は除く）。1件でもあれば失敗する。
 *
 * 使い方: node scripts/check-citizen-status-exposure.mjs （npm run build の後）
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const dist = join(root, "dist");
if (!existsSync(dist)) {
  console.error("[check-citizen-status-exposure] dist/ がありません。先に npm run build を実行してください。");
  process.exit(1);
}

const CODES = /\b(CONFIRMED|UNCONFIRMED|SOURCE_NOT_PUBLISHED|WAITING_OFFICIAL_SOURCE|NOT_INDIVIDUALLY_ATTRIBUTABLE|RESEARCH_EXHAUSTED|NEEDS_REVIEW|needsReview|termCompleted)\b|状態：(elected|resigned|unknown)/g;

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (name.endsWith(".html")) yield p;
  }
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ");
}

let pages = 0;
const hits = [];
for (const file of htmlFiles(dist)) {
  pages += 1;
  const text = visibleText(readFileSync(file, "utf8"));
  for (const m of text.matchAll(CODES)) {
    hits.push(`${relative(dist, file)}: 「${text.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).replace(/\s+/g, " ").trim()}」`);
  }
}

console.log(`[check-citizen-status-exposure] ${pages}ページを検査 — 内部の状態コードの表示 ${hits.length}件`);
if (hits.length > 0) {
  for (const h of hits.slice(0, 30)) console.error(`  ${h}`);
  process.exit(1);
}
