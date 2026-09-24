/**
 * テーマページ（/themes, /themes/:slug）の検査。
 *
 * 1. 「確認できる関連資料」と「同じキーワードを含む資料」の混同 = 0
 *    - 確認できる関連資料の欄が、キーワード一致のデータ（kw・candidateEntries・matches）を使っていない
 *    - 同じキーワードを含む資料の欄に、指定の注記（関連性を断定しない）がある
 *    - キーワード一致として載せた資料の題名（または本文）に、一致した語が実際に含まれる
 * 2. テーマページから張るリンク先がすべて実在ページ（themeリンク切れ0）
 * 3. 対応表（themeCrossLinks.json）のテーマ・委員会・款の名称が実在する
 * 4. 「AI候補」という表示を使っていない（AIや人の確認を経ていない分類を AI と呼ばない）
 * 5. 政策ラボ側のデータ（P01〜P20）が混入していない
 *
 * 使い方: node scripts/test-theme-cross-links.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { getPrerenderRoutes, root as ROOT } from "./lib/public-routes.mjs";

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const readJson = (p) => JSON.parse(read(p));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const themes = readJson("src/data/themes.json");
const matches = readJson("src/data/themeKeywordMatches.json");
const crossLinks = readJson("src/data/themeCrossLinks.json").themes;
const page = read("src/pages/ThemeDetailPage.tsx");

check("確認できる関連資料の欄が、キーワード一致のデータを使っていない", () => {
  const start = page.indexOf("【確認できる関連資料】");
  const end = page.indexOf("参考：所管の委員会・予算の区分");
  assert.ok(start > 0 && end > start, "見出しが見つかりません");
  const block = page.slice(start, end);
  for (const token of ["kw.", "candidateEntries", "matches", "archiveAiCategoryCandidates"]) {
    assert.ok(!block.includes(token), `確認できる関連資料の欄で ${token} を使っています`);
  }
});

check("同じキーワードを含む資料の欄に、関連性を断定しない注記がある", () => {
  const component = read("src/components/themes/ThemeKeywordMatches.tsx");
  assert.ok(
    component.includes("キーワードの一致を示すものであり、このテーマとの実質的な関連性を断定するものではありません。"),
    "注記の文言がありません",
  );
  assert.ok(page.includes("【同じキーワードを含む資料】") && page.includes("{KEYWORD_MATCH_DISCLAIMER}"), "注記が表示されていません");
});

check("キーワード一致として載せた資料に、一致した語が実際に含まれる", () => {
  const bills = new Map(readJson("src/data/billVotes.json").map((b) => [b.id, b]));
  const gqs = new Map(readJson("src/data/generalQuestions.json").map((q) => [q.id, q]));
  const bad = [];
  for (const [slug, set] of Object.entries(matches)) {
    const theme = themes.find((t) => t.slug === slug);
    assert.ok(theme, `themes.json に無いテーマ: ${slug}`);
    for (const b of set.bills) {
      const src = bills.get(b.id);
      if (!src || !src.billTitle.includes(b.matched) || !theme.keywords.includes(b.matched)) bad.push(`${slug}/${b.id}`);
      if (src && ["人事", "予算", "決算"].includes(src.category)) bad.push(`${slug}/${b.id}（除外対象の区分）`);
    }
    for (const q of set.generalQuestions) {
      const src = gqs.get(q.id);
      const text = src ? [src.title, (src.topics ?? []).join(" "), src.summary].join(" ") : "";
      if (!text.includes(q.matched)) bad.push(`${slug}/${q.id}`);
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 10).join(" / "));
});

check("テーマページから張るリンク先がすべて実在ページ（リンク切れ0）", () => {
  const routes = new Set(getPrerenderRoutes().map((r) => r.path));
  const missing = [];
  for (const t of themes) {
    if (!routes.has(`/themes/${t.slug}`)) missing.push(`/themes/${t.slug}`);
  }
  for (const [slug, set] of Object.entries(matches)) {
    const links = [
      ...set.generalQuestions.map((q) => `/questions/${q.id}`),
      ...set.bills.map((b) => `/bills/votes/${b.id}`),
      ...set.promises.map((p) => `/mayor/policy-progress/${p.id}`),
      ...set.committeeReports.map((r) => `/committees/${r.committeeId}`),
      ...set.budgetProjects.map(() => "/finance"),
    ];
    for (const l of links) if (!routes.has(l)) missing.push(`${slug} → ${l}`);
  }
  for (const [slug, c] of Object.entries(crossLinks)) {
    for (const cm of c.committees) if (!routes.has(`/committees/${cm.id}`)) missing.push(`${slug} → /committees/${cm.id}`);
  }
  assert.equal(missing.length, 0, missing.slice(0, 10).join(" / "));
});

check("対応表のテーマ・委員会・款の名称が実在する", () => {
  const committees = new Map(readJson("src/data/committees.json").map((c) => [c.id, c]));
  const purposes = new Set(readJson("src/data/financeDashboard.json").expenditureByPurpose.map((r) => r.label));
  for (const [slug, c] of Object.entries(crossLinks)) {
    assert.ok(themes.some((t) => t.slug === slug), `themes.json に無いテーマ: ${slug}`);
    for (const cm of c.committees) {
      const src = committees.get(cm.id);
      assert.ok(src, `存在しない委員会: ${cm.id}`);
      assert.equal(src.name, cm.name, `委員会名が一致しません: ${cm.id}`);
      for (const part of cm.basis.split("、")) {
        assert.ok(String(src.jurisdiction).includes(part), `${cm.id} の所管事項に「${part}」がありません`);
      }
    }
    for (const label of c.expenditurePurposeLabels) assert.ok(purposes.has(label), `目的別歳出に無い款: ${label}`);
  }
});

check("テーマ関連の画面で「AI候補」という表示を使っていない", () => {
  for (const f of ["src/pages/ThemeDetailPage.tsx", "src/pages/ThemesPage.tsx", "src/components/themes/ThemeKeywordMatches.tsx"]) {
    const src = read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!src.includes("AI候補"), `${f} に「AI候補」の表示があります`);
  }
});

check("政策ラボ側のデータ（P01〜P20）が混入していない", () => {
  for (const f of ["src/data/themes.json", "src/data/themeKeywordMatches.json", "src/data/themeCrossLinks.json"]) {
    assert.ok(!/"P(0[1-9]|1\d|20)"/.test(read(f)), `${f} に P01〜P20 のIDがあります`);
  }
});

const total = Object.values(matches).reduce((n, s) => n + Object.values(s).reduce((m, l) => m + l.length, 0), 0);
console.log(`\n✅ test-theme-cross-links: ${passCount} checks passed（テーマ${themes.length}件、キーワード一致${total}件）`);
