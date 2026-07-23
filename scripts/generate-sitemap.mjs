import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const SITE_URL = "https://nobeoka-shisei-portal.pages.dev";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

/** 日付形式（YYYY-MM-DD）のときだけlastmodとして採用する。ビルド日時や当日日付での代用はしない。 */
function asLastmod(value) {
  return typeof value === "string" && DATE_RE.test(value) ? value : undefined;
}

/**
 * mayorPressConferences.tsはTypeScriptモジュールのため、このスクリプト（.mjs）からは
 * 直接importできない（validate-data.mjsと同じ制約）。ビルド専用のTSコンパイラ等を新たに
 * 追加せず、ソースの配列リテラル部分だけを抽出して安全に評価する。
 * 対象ファイルの側で書式が変わった場合は、抽出できた件数が0件になり警告を出すのみで、
 * ビルド全体は止めない。
 */
function readMayorPressConferences() {
  const filePath = join(root, "src", "data", "mayorPressConferences.ts");
  let src;
  try {
    src = readFileSync(filePath, "utf8");
  } catch {
    console.warn("[generate-sitemap] src/data/mayorPressConferences.ts が読み込めませんでした。記者会見詳細ページはサイトマップに含めません。");
    return [];
  }

  const pdfBaseMatch = src.match(/const PDF_BASE\s*=\s*("(?:[^"\\]|\\.)*");/);
  const pdfBase = pdfBaseMatch ? JSON.parse(pdfBaseMatch[1]) : "";

  const arrayMatch = src.match(/export const mayorPressConferences:[^=]*=\s*(\[[\s\S]*?\n\]);/);
  if (!arrayMatch) {
    console.warn("[generate-sitemap] mayorPressConferences配列を抽出できませんでした。記者会見詳細ページはサイトマップに含めません。");
    return [];
  }

  try {
    // eslint-disable-next-line no-new-func
    const build = new Function("PDF_BASE", `"use strict"; return (${arrayMatch[1]});`);
    return build(pdfBase);
  } catch (err) {
    console.warn(`[generate-sitemap] mayorPressConferencesの解析に失敗しました: ${err.message}`);
    return [];
  }
}

const members = readJson("src/data/members.json");
const billVotes = readJson("src/data/billVotes.json");
const mayorPromises = readJson("src/data/mayorPromises.json");
const generalQuestions = readJson("src/data/generalQuestions.json");
const mayorPressConferences = readMayorPressConferences();

/**
 * 実在する公開ページのみ。下書き・存在しないURL・リダイレクト専用URL（/bills）・
 * 検索条件によって内容が変わるURL（/search）は含めない。
 */
const staticPages = [
  "/",
  "/mayor",
  "/mayor/policy-progress",
  "/mayor/entertainment-expenses",
  "/mayor/press-conferences",
  "/finance",
  "/dashboard",
  "/compensation",
  "/city-guide",
  "/bills/votes",
  "/questions",
  "/about",
  "/editorial-policy",
  "/contact",
  "/terms",
  "/updates",
];

/** @type {{ loc: string, lastmod?: string }[]} */
const urls = [];

for (const path of staticPages) {
  urls.push({ loc: `${SITE_URL}${path}` });
}

for (const m of members) {
  // 個人の更新日（updatedAt）が登録されている場合だけlastmodを出力する。サイト全体のビルド日時は使わない。
  urls.push({ loc: `${SITE_URL}/members/${m.id}`, lastmod: asLastmod(m.updatedAt) });
}

for (const b of billVotes) {
  urls.push({ loc: `${SITE_URL}/bills/votes/${b.id}`, lastmod: asLastmod(b.lastVerified) });
}

for (const p of mayorPromises.promises ?? []) {
  urls.push({ loc: `${SITE_URL}/mayor/policy-progress/${p.id}`, lastmod: asLastmod(p.lastVerified) });
}

for (const q of generalQuestions) {
  urls.push({ loc: `${SITE_URL}/questions/${q.id}`, lastmod: asLastmod(q.lastVerified) });
}

for (const c of mayorPressConferences) {
  urls.push({ loc: `${SITE_URL}/mayor/press-conferences/${c.date}`, lastmod: asLastmod(c.verifiedAt) });
}

// --- 重複除外・安定した並び順 ---
const dedupedByLoc = new Map();
for (const u of urls) {
  if (!dedupedByLoc.has(u.loc)) dedupedByLoc.set(u.loc, u);
}
const sortedUrls = [...dedupedByLoc.values()].sort((a, b) => a.loc.localeCompare(b.loc));

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const body = sortedUrls
  .map((u) => {
    const lastmod = u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : "";
    return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${lastmod}\n  </url>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(join(root, "public", "sitemap.xml"), xml, "utf8");
console.log(
  `[generate-sitemap] wrote ${sortedUrls.length} URLs to public/sitemap.xml ` +
    `(static=${staticPages.length}, members=${members.length}, billVotes=${billVotes.length}, ` +
    `promises=${(mayorPromises.promises ?? []).length}, questions=${generalQuestions.length}, ` +
    `pressConferences=${mayorPressConferences.length})`,
);
