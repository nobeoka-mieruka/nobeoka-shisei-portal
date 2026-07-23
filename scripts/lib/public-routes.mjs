/**
 * サイトマップ・プリレンダリング・公開前チェックが対象とする実在URLの単一情報源。
 * ここで定義したURLだけが、ビルド時に静的HTMLとして生成され、サイトマップへ載る。
 *
 * - 存在しない詳細ID、下書き、リダイレクト専用URL（/bills）の索引対象化、
 *   検索結果ページ（/search）の索引対象化はしない。
 * - /bills, /search は「実在するが索引対象ではないページ」として、
 *   サイトマップには含めず、プリレンダリング対象には含める（直接アクセスで404にしないため）。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = join(__dirname, "..", "..");

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
 * 直接importできない。ビルド専用のTSコンパイラ等を新たに追加せず、ソースの配列リテラル
 * 部分だけを抽出して安全に評価する。対象ファイルの書式が変わった場合は、抽出できた件数が
 * 0件になり警告を出すのみで、ビルド全体は止めない。
 */
function readMayorPressConferences() {
  const filePath = join(root, "src", "data", "mayorPressConferences.ts");
  let src;
  try {
    src = readFileSync(filePath, "utf8");
  } catch {
    console.warn(
      "[public-routes] src/data/mayorPressConferences.ts が読み込めませんでした。記者会見詳細ページは対象に含めません。",
    );
    return [];
  }

  const pdfBaseMatch = src.match(/const PDF_BASE\s*=\s*("(?:[^"\\]|\\.)*");/);
  const pdfBase = pdfBaseMatch ? JSON.parse(pdfBaseMatch[1]) : "";

  const arrayMatch = src.match(/export const mayorPressConferences:[^=]*=\s*(\[[\s\S]*?\n\]);/);
  if (!arrayMatch) {
    console.warn("[public-routes] mayorPressConferences配列を抽出できませんでした。記者会見詳細ページは対象に含めません。");
    return [];
  }

  try {
    // eslint-disable-next-line no-new-func
    const build = new Function("PDF_BASE", `"use strict"; return (${arrayMatch[1]});`);
    return build(pdfBase);
  } catch (err) {
    console.warn(`[public-routes] mayorPressConferencesの解析に失敗しました: ${err.message}`);
    return [];
  }
}

/** 実在する公開ページのみ。下書き・存在しないURL・リダイレクト専用URL（/bills）・検索結果（/search）は含めない。 */
export const STATIC_INDEXABLE_PAGES = [
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

/**
 * 実在し直接アクセス可能だが、索引対象（サイトマップ・robots index）には含めないページ。
 * /bills … /bills/votes へのリダイレクト専用URL。
 * /search … 入力内容によって表示が変わり続けるため常にnoindex。
 */
export const STATIC_NOINDEX_PAGES = ["/bills", "/search"];

function loadData() {
  const members = readJson("src/data/members.json");
  const billVotes = readJson("src/data/billVotes.json");
  const mayorPromises = readJson("src/data/mayorPromises.json");
  const generalQuestions = readJson("src/data/generalQuestions.json");
  const mayorPressConferences = readMayorPressConferences();
  return { members, billVotes, mayorPromises, generalQuestions, mayorPressConferences };
}

/** サイトマップに載せる索引対象URL（{path, lastmod}[]）。現在69件。 */
export function getIndexableRoutes() {
  const { members, billVotes, mayorPromises, generalQuestions, mayorPressConferences } = loadData();
  const urls = [];

  for (const path of STATIC_INDEXABLE_PAGES) {
    urls.push({ path });
  }
  for (const m of members) {
    urls.push({ path: `/members/${m.id}`, lastmod: asLastmod(m.updatedAt) });
  }
  for (const b of billVotes) {
    urls.push({ path: `/bills/votes/${b.id}`, lastmod: asLastmod(b.lastVerified) });
  }
  for (const p of mayorPromises.promises ?? []) {
    urls.push({ path: `/mayor/policy-progress/${p.id}`, lastmod: asLastmod(p.lastVerified) });
  }
  for (const q of generalQuestions) {
    urls.push({ path: `/questions/${q.id}`, lastmod: asLastmod(q.lastVerified) });
  }
  for (const c of mayorPressConferences) {
    urls.push({ path: `/mayor/press-conferences/${c.date}`, lastmod: asLastmod(c.verifiedAt) });
  }

  const dedupedByPath = new Map();
  for (const u of urls) {
    if (!dedupedByPath.has(u.path)) dedupedByPath.set(u.path, u);
  }
  return [...dedupedByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * プリレンダリング対象URL（索引対象URL ＋ 実在するがnoindexのページ）。
 * これらすべてに対して静的HTMLを生成し、直接アクセスが404にならないようにする。
 */
export function getPrerenderRoutes() {
  const indexable = getIndexableRoutes();
  const noindex = STATIC_NOINDEX_PAGES.map((path) => ({ path }));
  return [...indexable, ...noindex].sort((a, b) => a.path.localeCompare(b.path));
}

/** 公開前チェック（release-check）が確認すべきURL一覧。プリレンダリング対象と同じ。 */
export function getReleaseCheckRoutes() {
  return getPrerenderRoutes();
}
