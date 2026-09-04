#!/usr/bin/env node
/**
 * 本番公開されるHTML（dist/配下、npm run buildのprerender成果物）を走査し、
 * 未確認・未実装等の曖昧表示ではなく、明確な表示バグのみを検出する。
 *
 * 対象：
 * - "undefined" / "null" / "NaN" が本文中にそのまま表示されている（コード内の変数名やJSON構造としての
 *   出現は誤検知になるため、prerender済みHTMLの<body>innerTextに限定して検査する）
 * - 内部リンク（相対パス）の遷移先ページが実際にdist配下に存在しない（リンク切れ）
 * - 空のhref（href=""）やhref="#"のまま放置されたリンク
 * - 実在しない元号年（「令和0年度」「令和-18年度」等）が表示されている（Phase219）
 *
 * 「確認中」「準備中」等の曖昧語そのものは対象外（scripts/validate-content-wording.mjsで別途扱う）。
 * これは自動生成データの構造的な不整合を検出する意図であり、文言の適切さは人が判断する。
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const DIST = path.resolve(process.cwd(), "dist");

if (!existsSync(DIST)) {
  console.error("[validate-content] dist/ が見つかりません。先に npm run build を実行してください。");
  process.exit(1);
}

function listHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listHtmlFiles(full));
    } else if (entry === "index.html" || entry === "404.html") {
      out.push(full);
    }
  }
  return out;
}

function routeFor(filePath) {
  const rel = path.relative(DIST, filePath).replace(/\\/g, "/");
  if (rel === "404.html") return "/404";
  return "/" + rel.replace(/\/index\.html$/, "").replace(/^index\.html$/, "");
}

function extractBodyText(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  const body = bodyMatch ? bodyMatch[1] : html;
  // script/styleタグの中身は対象外（JSON-LD等にnullやundefinedが正当に含まれ得るため）
  const withoutScripts = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  return withoutScripts;
}

const htmlFiles = listHtmlFiles(DIST);
const routeSet = new Set(htmlFiles.map(routeFor));
// 末尾スラッシュ違いを許容するため正規化版も用意
const normalizedRouteSet = new Set([...routeSet].map((r) => r.replace(/\/$/, "") || "/"));

let errors = 0;
let warnings = 0;
const findings = [];

// 誤検知が多いバナー文言（正規表現のwordboundaryだけでは英単語混入の"null"等を拾いすぎるため、
// 表示テキストとして単独または前後が非英数字の場合のみ検出する）
const BANNED_LITERAL_RE = /(^|[^\w."'])(undefined|NaN)([^\w."']|$)/g;
// "null"は自然文中の単語として出現しない前提だが、念のため同様に検出（JSON-LD内は既に除外済み）
const BANNED_NULL_RE = /(^|[^\w."'])(null)([^\w."']|$)/g;
// Phase219：元号は1年（元年）から始まるため、「令和0年」「令和-18年度」「平成0年」は実在しない。
// 西暦→和暦の換算で元号の境界を分岐し忘れると生成される（src/config/site.ts の toEraYearLabel 参照。
// 従来は /dashboard の一般質問年度別集計と /council-documents の年度見出しに計30箇所出力されていた）。
// 検出時は0へ丸めて隠すのではなく、正しい元号へ直すこと。
const INVALID_ERA_YEAR_RE = /(令和|平成|昭和)(-\s*\d+|0+)年/g;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const route = routeFor(file);
  const bodyText = extractBodyText(html);

  // 1. undefined / NaN の直接表示
  for (const re of [BANNED_LITERAL_RE, BANNED_NULL_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(bodyText))) {
      const context = bodyText.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, " ");
      // タグ属性値の内部（例：data-xxx="null"のようなReact内部属性）は無視する。
      // 表示テキストノード内かどうかを厳密に判定するのは困難なため、タグ直後（<...>の直後1文字目）に
      // 一致した場合は属性値の可能性が高いとみなしスキップする簡易ヒューリスティックを適用。
      const before = bodyText.slice(Math.max(0, m.index - 1), m.index);
      if (before === '"' || before === "'") continue;
      errors += 1;
      findings.push({
        level: "ERROR",
        route,
        rule: "banned-literal-display",
        detail: `本文中に "${m[2]}" がそのまま表示されています: …${context}…`,
      });
    }
  }

  // 2. 実在しない元号年（令和0年・令和-18年度 等）の表示
  const visibleText = bodyText.replace(/<[^>]*>/g, " ");
  INVALID_ERA_YEAR_RE.lastIndex = 0;
  let em;
  while ((em = INVALID_ERA_YEAR_RE.exec(visibleText))) {
    const context = visibleText.slice(Math.max(0, em.index - 40), em.index + 40).replace(/\s+/g, " ");
    errors += 1;
    findings.push({
      level: "ERROR",
      route,
      rule: "invalid-era-year",
      detail: `実在しない元号年が表示されています（"${em[0]}"）: …${context}…`,
    });
  }

  // 3. 空のhref・ダミーhrefの内部リンク
  const hrefEmptyRe = /<a\s[^>]*href=["'](#|javascript:void\(0\))?["'][^>]*>/g;
  let hm;
  while ((hm = hrefEmptyRe.exec(html))) {
    if (hm[1] === undefined || hm[1] === "" || hm[1] === "#") {
      // href="#"はページ内アンカー用途で正当に使われる場合があるため警告に留める
      warnings += 1;
      findings.push({
        level: "WARN",
        route,
        rule: "empty-or-anchor-href",
        detail: `href が空、または "#" のみのリンクがあります（意図的なページ内リンクでなければ確認してください）`,
      });
    }
  }

  // 4. 内部リンク（同一オリジンの絶対パス）のリンク切れ検出
  const hrefRe = /href="(\/[^"#?]*)(?:[?#][^"]*)?"/g;
  let lm;
  const seenInThisPage = new Set();
  while ((lm = hrefRe.exec(html))) {
    const linkPath = lm[1];
    if (seenInThisPage.has(linkPath)) continue;
    seenInThisPage.add(linkPath);
    // 静的アセット（拡張子付き）は対象外
    if (/\.[a-zA-Z0-9]{2,5}$/.test(linkPath)) continue;
    const normalized = linkPath.replace(/\/$/, "") || "/";
    if (!normalizedRouteSet.has(normalized)) {
      errors += 1;
      findings.push({
        level: "ERROR",
        route,
        rule: "broken-internal-link",
        detail: `内部リンク先が存在しません: ${linkPath}`,
      });
    }
  }
}

// 集計・出力
const errorFindings = findings.filter((f) => f.level === "ERROR");
const warnFindings = findings.filter((f) => f.level === "WARN");

// ルールごとの件数集計（大量出力を避けるため、上位のみ詳細表示し、残りは件数のみ）
function printGrouped(list, limit = 60) {
  const byRule = new Map();
  for (const f of list) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f);
  }
  for (const [rule, items] of byRule) {
    console.log(`\n--- ${rule}（${items.length}件） ---`);
    for (const item of items.slice(0, limit)) {
      console.log(`[${item.level}] ${item.route}: ${item.detail}`);
    }
    if (items.length > limit) {
      console.log(`  ...ほか${items.length - limit}件`);
    }
  }
}

printGrouped(errorFindings);
printGrouped(warnFindings);

console.log(
  `\n[validate-content] checked ${htmlFiles.length} page(s) — errors=${errorFindings.length} warnings=${warnFindings.length}`,
);

if (errorFindings.length > 0) {
  process.exit(1);
}
