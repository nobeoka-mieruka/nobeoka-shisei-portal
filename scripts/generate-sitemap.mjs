import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const SITE_URL = "https://nobeoka-shisei-portal.pages.dev";

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

const members = readJson("src/data/members.json");
const billVotes = readJson("src/data/billVotes.json");
const mayorPromises = readJson("src/data/mayorPromises.json");
const generalQuestions = readJson("src/data/generalQuestions.json");

/** 実在する公開ページのみ。下書き・存在しないURLは含めない。 */
const staticPages = [
  "/",
  "/mayor",
  "/mayor/policy-progress",
  "/mayor/entertainment-expenses",
  "/finance",
  "/dashboard",
  "/compensation",
  "/city-guide",
  "/bills/votes",
  "/questions",
  "/search",
  "/about",
  "/editorial-policy",
  "/contact",
  "/terms",
  "/updates",
  // 市長定例記者会見の詳細ページ。データは src/data/mayorPressConferences.ts で管理しているため、
  // 新しい記者会見を追加した際は、このリストにもURLを追加する。
  "/mayor/press-conferences/2026-07-16",
];
// 注：/bills は /bills/votes と内容が重複するためnoindex設定にしており、sitemapには含めない。

/** @type {{ loc: string, lastmod?: string }[]} */
const urls = [];

for (const path of staticPages) {
  urls.push({ loc: `${SITE_URL}${path}` });
}

for (const m of members) {
  // 個人の更新日（updatedAt）が登録されている場合だけlastmodを出力する。サイト全体のビルド日時は使わない。
  urls.push({ loc: `${SITE_URL}/members/${m.id}`, lastmod: m.updatedAt || undefined });
}

for (const b of billVotes) {
  urls.push({ loc: `${SITE_URL}/bills/votes/${b.id}`, lastmod: b.lastVerified || undefined });
}

for (const p of mayorPromises.promises ?? []) {
  urls.push({ loc: `${SITE_URL}/mayor/policy-progress/${p.id}`, lastmod: p.lastVerified || undefined });
}

for (const q of generalQuestions) {
  urls.push({ loc: `${SITE_URL}/questions/${q.id}`, lastmod: q.lastVerified || undefined });
}

const body = urls
  .map((u) => {
    const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : "";
    return `  <url>\n    <loc>${u.loc}</loc>${lastmod}\n  </url>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(join(root, "public", "sitemap.xml"), xml, "utf8");
console.log(`[generate-sitemap] wrote ${urls.length} URLs to public/sitemap.xml`);
