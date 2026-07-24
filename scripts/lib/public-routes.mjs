/**
 * サイトマップ・プリレンダリング・公開前チェックが対象とする実在URLの単一情報源。
 * ここで定義したURLだけが、ビルド時に静的HTMLとして生成され、サイトマップへ載る。
 *
 * - 存在しない詳細ID、下書き、リダイレクト専用URL（/bills）の索引対象化、
 *   検索結果ページ（/search）の索引対象化はしない。
 * - /bills, /search は「実在するが索引対象ではないページ」として、
 *   サイトマップには含めず、プリレンダリング対象には含める（直接アクセスで404にしないため）。
 * - lastmodは scripts/lib/lastmod.mjs の優先順位（データ内の日付→更新履歴→
 *   データファイルのGit更新日→サイト全体の最終更新日）に従って解決する。
 *   ビルドした日を無条件に設定することはしない。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { maxValidDate, resolveLastmod } from "./lastmod.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = join(__dirname, "..", "..");

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
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
  const mayor = readJson("src/data/mayor.json");
  const financeDashboard = readJson("src/data/financeDashboard.json");
  const mayorEntertainmentExpenses = readJson("src/data/mayorEntertainmentExpenses.json");
  const compensationComparison = readJson("src/data/compensationComparison.json");
  const cityGuideEntries = readJson("src/data/cityGuideEntries.json");
  const mayorPolicyProgress = readJson("src/data/mayorPolicyProgress.json");
  const updateHistory = readJson("src/data/updateHistory.json");
  return {
    members,
    billVotes,
    mayorPromises,
    generalQuestions,
    mayorPressConferences,
    mayor,
    financeDashboard,
    mayorEntertainmentExpenses,
    compensationComparison,
    cityGuideEntries,
    mayorPolicyProgress,
    updateHistory,
  };
}

/** 固定ページごとのlastmod解決ルール。 */
function staticPageLastmod(path, data) {
  switch (path) {
    case "/":
      return resolveLastmod(path, [], [
        "src/data/members.json",
        "src/data/mayor.json",
        "src/data/billVotes.json",
        "src/data/generalQuestions.json",
        "src/data/mayorPromises.json",
      ]);
    case "/mayor":
      return resolveLastmod(path, [data.mayor.verifiedAt, data.mayor.updatedAt], ["src/data/mayor.json"]);
    case "/mayor/policy-progress":
      return resolveLastmod(
        path,
        [data.mayorPolicyProgress.referenceDate, maxValidDate((data.mayorPromises.promises ?? []).map((p) => p.lastVerified))],
        ["src/data/mayorPolicyProgress.json", "src/data/mayorPromises.json"],
      );
    case "/mayor/entertainment-expenses":
      return resolveLastmod(path, [data.mayorEntertainmentExpenses.lastVerified], ["src/data/mayorEntertainmentExpenses.json"]);
    case "/mayor/press-conferences":
      return resolveLastmod(
        path,
        [maxValidDate(data.mayorPressConferences.map((c) => c.verifiedAt))],
        ["src/data/mayorPressConferences.ts"],
      );
    case "/finance":
      return resolveLastmod(path, [data.financeDashboard.lastVerified], ["src/data/financeDashboard.json"]);
    case "/dashboard":
      return resolveLastmod(path, [], ["src/data/members.json", "src/data/billVotes.json", "src/data/mayorPromises.json"]);
    case "/compensation":
      return resolveLastmod(
        path,
        [maxValidDate(data.compensationComparison.map((c) => c.confirmedAt))],
        ["src/data/compensationComparison.json"],
      );
    case "/city-guide":
      return resolveLastmod(
        path,
        [maxValidDate(data.cityGuideEntries.map((e) => e.lastChecked))],
        ["src/data/cityGuideEntries.json"],
      );
    case "/bills/votes":
      return resolveLastmod(path, [maxValidDate(data.billVotes.map((b) => b.lastVerified))], ["src/data/billVotes.json"]);
    case "/questions":
      return resolveLastmod(
        path,
        [maxValidDate(data.generalQuestions.map((q) => q.lastVerified))],
        ["src/data/generalQuestions.json"],
      );
    case "/about":
      return resolveLastmod(path, [], ["src/pages/AboutPage.tsx", "src/config/operator.ts"]);
    case "/editorial-policy":
      return resolveLastmod(path, [], ["src/pages/EditorialPolicyPage.tsx"]);
    case "/contact":
      return resolveLastmod(path, [], ["src/pages/ContactPage.tsx"]);
    case "/terms":
      return resolveLastmod(path, [], ["src/pages/TermsPage.tsx"]);
    case "/updates":
      return resolveLastmod(path, [maxValidDate(data.updateHistory.map((u) => u.date))], ["src/data/updateHistory.json"]);
    default:
      return undefined;
  }
}

/** サイトマップに載せる索引対象URL（{path, lastmod}[]）。 */
export function getIndexableRoutes() {
  const data = loadData();
  const { members, billVotes, mayorPromises, generalQuestions, mayorPressConferences } = data;
  const urls = [];

  for (const path of STATIC_INDEXABLE_PAGES) {
    urls.push({ path, lastmod: staticPageLastmod(path, data) });
  }
  for (const m of members) {
    urls.push({ path: `/members/${m.id}`, lastmod: resolveLastmod(`/members/${m.id}`, [m.updatedAt, m.verifiedAt], ["src/data/members.json"]) });
  }
  for (const b of billVotes) {
    urls.push({ path: `/bills/votes/${b.id}`, lastmod: resolveLastmod(`/bills/votes/${b.id}`, [b.lastVerified], ["src/data/billVotes.json"]) });
  }
  for (const p of mayorPromises.promises ?? []) {
    urls.push({
      path: `/mayor/policy-progress/${p.id}`,
      lastmod: resolveLastmod(`/mayor/policy-progress/${p.id}`, [p.lastVerified], ["src/data/mayorPromises.json"]),
    });
  }
  for (const q of generalQuestions) {
    urls.push({
      path: `/questions/${q.id}`,
      lastmod: resolveLastmod(`/questions/${q.id}`, [q.lastVerified, q.questionDate], ["src/data/generalQuestions.json"]),
    });
  }
  for (const c of mayorPressConferences) {
    urls.push({
      path: `/mayor/press-conferences/${c.date}`,
      lastmod: resolveLastmod(`/mayor/press-conferences/${c.date}`, [c.verifiedAt, c.date], ["src/data/mayorPressConferences.ts"]),
    });
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
