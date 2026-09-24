/**
 * トップページ・ヘッダー・画面下部メニュー・共通メニューの導線と、市民向けの状態表示の検査。
 *
 * 1. 導線のリンク先がすべて実在ページ（プリレンダリング対象）
 * 2. 改修前のトップページにあった主要導線を1つも失っていない
 * 3. トップページ・ヘッダー・メニューが検索索引や大きなデータを静的importしていない（初期表示を重くしない）
 * 4. 「市政を調べる」の入口（検索・テーマ・市政の流れ・議会・お金）がある
 * 5. 市民向けの状態表示ヘルパーが、内部コードを日本語へ変換し、未知のコードも内部コードのまま出さない
 *
 * 使い方: node --experimental-strip-types scripts/test-home-navigation.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { getPrerenderRoutes, root as ROOT } from "./lib/public-routes.mjs";

const read = (p) => readFileSync(join(ROOT, p), "utf8");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const FILES = [
  "src/pages/HomePage.tsx",
  "src/components/SiteHeader.tsx",
  "src/components/BottomNav.tsx",
  "src/components/Footer.tsx",
  "src/config/siteNavigation.ts",
];
const linksOf = (src) =>
  [...src.matchAll(/\bto(?::\s*|=)\{?\s*"(\/[^"]*)"/g)].map((m) => m[1]).filter((p) => !p.includes("${"));

check("トップページ・メニューのリンク先がすべて実在ページ", () => {
  const routes = new Set(getPrerenderRoutes().map((r) => r.path));
  const missing = [];
  for (const f of FILES) {
    for (const to of linksOf(read(f))) {
      const path = to.split(/[?#]/)[0];
      if (!routes.has(path)) missing.push(`${f}: ${to}`);
    }
  }
  assert.equal(missing.length, 0, missing.join(" / "));
});

check("改修前のトップページにあった主要導線を失っていない", () => {
  const BEFORE = [
    "/about", "/bills/votes", "/city-guide", "/city-officials", "/city-organization", "/committees", "/compare",
    "/compensation", "/contact", "/council-documents", "/dashboard", "/data-status", "/editorial-policy", "/elections",
    "/finance", "/history", "/mayor", "/mayor/policy-progress", "/mayors", "/members/former", "/ordinances",
    "/people?type=member", "/petitions", "/political-funds", "/public-comments", "/questions", "/search", "/themes", "/updates",
  ];
  const home = new Set(linksOf(read("src/pages/HomePage.tsx")));
  const lost = BEFORE.filter((l) => !home.has(l));
  assert.equal(lost.length, 0, `トップページから消えた導線: ${lost.join(", ")}`);
});

check("トップページ・ヘッダー・メニューが検索索引や大きなデータを静的importしていない", () => {
  const HEAVY = ["searchIndex.json", "search-index/", "billVotes.json", "councilSpeechSummaries.json", "civicEventTimeline.json", "themeKeywordMatches.json", "archiveFiscalYears.json"];
  const bad = [];
  for (const f of FILES) {
    for (const m of read(f).matchAll(/^import[^;]*from\s+["']([^"']+)["']/gm)) {
      if (HEAVY.some((h) => m[1].includes(h))) bad.push(`${f}: ${m[1]}`);
    }
  }
  assert.equal(bad.length, 0, bad.join(" / "));
});

check("トップページに「市政を調べる」の5つの入口がある", () => {
  const home = read("src/pages/HomePage.tsx");
  for (const to of ["/search", "/themes", "/timeline", "/council-documents", "/finance"]) {
    assert.ok(new RegExp(`to: "${to}"`).test(home), `入口 ${to} がありません`);
  }
  assert.ok(home.includes("市政を調べる"));
  assert.ok(home.includes("議会データを絞り込む"), "議員の絞り込み（折りたたみ）が無くなっています");
});

const { citizenStatusLabel, memberTermStatusLabel, INTERNAL_STATUS_CODES, UNCONFIRMED_IS_NOT_ERROR_NOTE } = await import(
  "../src/lib/citizenStatusLabels.ts"
);

check("内部の状態コードを市民向けの日本語へ変換する（未知のコードもそのまま出さない）", () => {
  const expected = {
    CONFIRMED: "確認済み",
    verified: "確認済み",
    UNCONFIRMED: "確認中",
    needsReview: "確認中",
    SOURCE_NOT_PUBLISHED: "資料未公開",
    WAITING_OFFICIAL_SOURCE: "一次資料待ち",
    NOT_INDIVIDUALLY_ATTRIBUTABLE: "個人単位で確認不可",
    RESEARCH_EXHAUSTED: "公開資料で確認できず",
    "something-unknown": "確認中",
  };
  for (const [code, label] of Object.entries(expected)) assert.equal(citizenStatusLabel(code), label, code);
  for (const code of INTERNAL_STATUS_CODES) {
    const label = citizenStatusLabel(code);
    assert.ok(!/[A-Za-z_]/.test(label), `${code} が英字のまま表示されます: ${label}`);
  }
  assert.equal(memberTermStatusLabel("elected"), "当選");
  assert.equal(memberTermStatusLabel("termCompleted"), "任期満了");
  assert.ok(UNCONFIRMED_IS_NOT_ERROR_NOTE.includes("誤っているという意味ではありません"));
});

console.log(`\n✅ test-home-navigation: ${passCount} checks passed`);
