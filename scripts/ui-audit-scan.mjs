#!/usr/bin/env node
/**
 * Phase31 UI総点検：validate-content.mjs（undefined/null/NaN・内部リンク切れ）が対象外にしている
 * 項目を、同じくdist/配下の全prerender済みHTMLを対象に機械的に走査する補助スクリプト。
 *
 * 対象：
 * - "[object Object]" の直接表示
 * - 画像src切れ（相対パスがdist配下に実在しない／src=""の<img>）
 * - 仮データ・デバッグ文字列（lorem ipsum、TODO、FIXME、xxx等の作業中マーカー）
 * - ルートをページ種別（pageType）ごとに集計し、reports/ui-audit-route-inventory.json へ出力
 *
 * 表の文字折り返し（日本語1文字ずつの縦並び）等、CSSレンダリング結果に依存する見た目の不具合は
 * 静的HTMLの文字列走査だけでは検出できないため対象外（実ブラウザでの目視確認で別途対応する）。
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const DIST = path.resolve(process.cwd(), "dist");

if (!existsSync(DIST)) {
  console.error("[ui-audit-scan] dist/ が見つかりません。先に npm run build を実行してください。");
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

/** Phase31：URLパターンからページ種別を推定する（ユーザー指示のページ種別一覧に対応）。 */
function pageTypeFor(route) {
  const r = route === "" ? "/" : route;
  const rules = [
    [/^\/$/, "top"],
    [/^\/dashboard/, "dashboard"],
    [/^\/data-status/, "data-status"],
    [/^\/updates/, "updates"],
    [/^\/mayor$/, "mayor"],
    [/^\/mayor\//, "mayor-sub"],
    [/^\/mayors$/, "mayors-list"],
    [/^\/mayors\//, "mayor-detail"],
    [/^\/members\/former$/, "former-members-list"],
    [/^\/members\/former\//, "former-member-detail"],
    [/^\/members\/[^/]+\/questions\//, "member-speech-detail"],
    [/^\/members\//, "member-detail"],
    [/^\/questions\//, "question-detail"],
    [/^\/questions$/, "questions-list"],
    [/^\/bills\/votes\//, "bill-vote-detail"],
    [/^\/bills\/votes$/, "bill-votes-list"],
    [/^\/bills\/compare/, "bill-compare"],
    [/^\/bills\//, "bill-archive-detail"],
    [/^\/bills$/, "bills-archive"],
    [/^\/ordinances\//, "ordinance-detail"],
    [/^\/ordinances$/, "ordinances-list"],
    [/^\/petitions\//, "petition-detail"],
    [/^\/petitions$/, "petitions-list"],
    [/^\/requests\//, "request-detail"],
    [/^\/requests$/, "requests-list"],
    [/^\/committees\//, "committee-detail"],
    [/^\/committees$/, "committees-list"],
    [/^\/elections\//, "election-detail"],
    [/^\/elections$/, "elections-list"],
    [/^\/finance\//, "finance-sub"],
    [/^\/finance$/, "finance-top"],
    [/^\/compare\//, "compare-sub"],
    [/^\/compare$/, "compare-top"],
    [/^\/timeline\/[0-9]/, "timeline-year"],
    [/^\/timeline$/, "timeline"],
    [/^\/history/, "history"],
    [/^\/policies\//, "policy-detail"],
    [/^\/policies$/, "policies-list"],
    [/^\/people\//, "person-detail"],
    [/^\/people$/, "people-list"],
    [/^\/council-documents\//, "council-session-detail"],
    [/^\/council-documents$/, "council-documents"],
    [/^\/themes\//, "theme-detail"],
    [/^\/themes$/, "themes-list"],
    [/^\/council-activity\//, "council-activity-member"],
    [/^\/council-activity$/, "council-activity"],
    [/^\/political-funds\//, "political-fund-detail"],
    [/^\/political-funds$/, "political-funds-list"],
    [/^\/city-guide/, "city-guide"],
    [/^\/city-officials/, "city-officials"],
    [/^\/city-organization/, "city-organization"],
    [/^\/compensation/, "compensation"],
    [/^\/search/, "search"],
    [/^\/koho-search/, "koho-search"],
    [/^\/about/, "about"],
    [/^\/terms/, "terms"],
    [/^\/editorial-policy/, "editorial-policy"],
    [/^\/contact/, "contact"],
    [/^\/methodology\//, "methodology"],
    [/^\/executive-answers/, "executive-answers"],
    [/^\/404/, "not-found"],
  ];
  for (const [re, type] of rules) {
    if (re.test(r)) return type;
  }
  return "other";
}

const htmlFiles = listHtmlFiles(DIST);
const distFileSet = new Set();
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else distFileSet.add(path.relative(DIST, full).replace(/\\/g, "/"));
  }
})(DIST);

let errors = 0;
let warnings = 0;
const findings = [];
const routeInventory = {};

const OBJECT_OBJECT_RE = /\[object Object\]/g;
const DEBUG_MARKERS_RE = /(lorem ipsum|TODO:|FIXME|XXX_|dummy[-_ ]?data|placeholder[-_ ]?text)/gi;

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const route = routeFor(file);
  const type = pageTypeFor(route);
  routeInventory[type] = (routeInventory[type] ?? 0) + 1;

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  const body = bodyMatch ? bodyMatch[1] : html;
  const bodyText = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

  // 1. [object Object]の直接表示
  if (OBJECT_OBJECT_RE.test(bodyText)) {
    errors += 1;
    findings.push({ level: "ERROR", route, rule: "object-object-display", detail: "本文中に [object Object] が表示されています" });
  }

  // 2. 仮データ・デバッグ文字列
  DEBUG_MARKERS_RE.lastIndex = 0;
  let dm;
  while ((dm = DEBUG_MARKERS_RE.exec(bodyText))) {
    warnings += 1;
    findings.push({ level: "WARN", route, rule: "debug-marker-text", detail: `仮データ・デバッグ文字列の可能性: "${dm[1]}"` });
  }

  // 3. 画像切れ（相対パスの<img src>がdist配下に実在しない、またはsrcが空）
  const imgRe = /<img\s[^>]*src=["']([^"']*)["'][^>]*>/g;
  let im;
  while ((im = imgRe.exec(html))) {
    const src = im[1];
    if (!src) {
      errors += 1;
      findings.push({ level: "ERROR", route, rule: "empty-image-src", detail: "<img>のsrcが空です" });
      continue;
    }
    if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) continue;
    const rel = src.startsWith("/") ? src.slice(1) : src;
    const relNoQuery = rel.split(/[?#]/)[0];
    if (relNoQuery && !distFileSet.has(relNoQuery)) {
      errors += 1;
      findings.push({ level: "ERROR", route, rule: "broken-image-src", detail: `画像ファイルがdist配下に存在しません: ${src}` });
    }
  }
}

const errorFindings = findings.filter((f) => f.level === "ERROR");
const warnFindings = findings.filter((f) => f.level === "WARN");

function printGrouped(list, limit = 40) {
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
    if (items.length > limit) console.log(`  ...ほか${items.length - limit}件`);
  }
}

printGrouped(errorFindings);
printGrouped(warnFindings);

console.log(`\n[ui-audit-scan] checked ${htmlFiles.length} page(s) — errors=${errorFindings.length} warnings=${warnFindings.length}`);
console.log(`\n[ui-audit-scan] ページ種別ごとのルート件数：`);
for (const [type, count] of Object.entries(routeInventory).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}

import { writeFileSync } from "node:fs";
writeFileSync(
  path.resolve(process.cwd(), "reports/ui-audit-route-inventory.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalRoutes: htmlFiles.length,
      byPageType: routeInventory,
      errors: errorFindings.length,
      warnings: warnFindings.length,
      findings,
    },
    null,
    1,
  ) + "\n",
  "utf8",
);
