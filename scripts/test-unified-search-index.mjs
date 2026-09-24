/**
 * サイト内検索（/search）の分割索引（public/search-index/）の検査。
 *
 * 1. 検索索引のID重複 = 0
 * 2. 検索結果の遷移先（route）が、プリレンダリングされる実在ページに無いもの = 0
 * 3. 一次資料リンク（sourceRefs）が http(s) でない、または元データに存在しないURL（孤立） = 0
 * 4. 更新履歴（サイトの作業記録）が公開用索引に混ざっていない
 * 5. トップページ・共通部品が検索索引（searchIndex.json／public/search-index）を静的importしていない = 0
 * 6. 検索順位に新しさ・種類・人物・重要度による加点が入っていない（src/lib/search.ts のソース検査）
 *
 * 使い方: node scripts/test-unified-search-index.mjs
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import assert from "node:assert/strict";
import { getPrerenderRoutes, root as ROOT } from "./lib/public-routes.mjs";

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const readJson = (p) => JSON.parse(read(p));

if (!existsSync(join(ROOT, "public/search-index/manifest.json"))) {
  execFileSync(process.execPath, [join(ROOT, "scripts/generate-search-index.mjs")], { stdio: "inherit" });
}

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const manifest = readJson("public/search-index/manifest.json");
const entries = manifest.files.flatMap((f) => readJson(`public/search-index/${f.file}`));
const bodyIds = new Set(
  manifest.files.filter((f) => f.bodyFile).flatMap((f) => Object.keys(readJson(`public/search-index/${f.bodyFile}`))),
);

check("manifest の件数と実ファイルの件数が一致する", () => {
  assert.equal(entries.length, manifest.entryCount);
  for (const f of manifest.files) {
    const n = readJson(`public/search-index/${f.file}`).length;
    assert.equal(n, f.count, `${f.file} の件数が manifest と一致しません`);
  }
});

check("検索索引のID重複が0件", () => {
  const seen = new Map();
  const dups = [];
  for (const e of entries) {
    if (seen.has(e.id)) dups.push(e.id);
    seen.set(e.id, true);
  }
  assert.equal(dups.length, 0, `重複ID: ${dups.slice(0, 10).join(", ")}`);
});

check("本文ファイルのIDがすべて索引に存在する（孤立した本文が0件）", () => {
  const ids = new Set(entries.map((e) => e.id));
  const orphan = [...bodyIds].filter((id) => !ids.has(id));
  assert.equal(orphan.length, 0, `孤立した本文: ${orphan.slice(0, 10).join(", ")}`);
});

check("検索結果の遷移先がすべて実在ページ（プリレンダリング対象）", () => {
  const routes = new Set(getPrerenderRoutes().map((r) => r.path));
  const missing = [];
  for (const e of entries) {
    const path = e.url.split(/[?#]/)[0];
    if (!routes.has(path)) missing.push(`${e.id} → ${e.url}`);
  }
  assert.equal(missing.length, 0, `存在しない遷移先 ${missing.length}件: ${missing.slice(0, 10).join(" / ")}`);
});

check("一次資料リンクが http(s) で、元データに記録されたURLである（孤立0件）", () => {
  const dataDir = join(ROOT, "src/data");
  const corpus = readdirSync(dataDir)
    .filter((n) => n.endsWith(".json") && n !== "searchIndex.json")
    .map((n) => readFileSync(join(dataDir, n), "utf8"))
    .join("\n");
  const bad = [];
  let total = 0;
  for (const e of entries) {
    for (const ref of e.sourceRefs ?? []) {
      total += 1;
      if (!/^https?:\/\//.test(ref.url)) bad.push(`${e.id}: ${ref.url}`);
      else if (!corpus.includes(ref.url)) bad.push(`${e.id}: ${ref.url}（元データに無い）`);
      if (!ref.label) bad.push(`${e.id}: ラベルなし`);
    }
  }
  assert.ok(total > 0, "一次資料リンクが1件もありません");
  assert.equal(bad.length, 0, bad.slice(0, 10).join(" / "));
});

check("更新履歴（サイトの作業記録）は公開用索引に含めない", () => {
  assert.equal(entries.filter((e) => e.type === "update").length, 0);
});

check("トップページ・共通部品が検索索引を静的importしていない", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${name.name}`;
      if (name.isDirectory()) walk(rel);
      else if (/\.(tsx?|mjs)$/.test(name.name)) {
        const src = read(rel);
        if (/from\s+["'][^"']*data\/searchIndex\.json["']/.test(src) || /from\s+["'][^"']*search-index\//.test(src)) {
          offenders.push(rel);
        }
      }
    }
  };
  walk("src");
  assert.equal(offenders.length, 0, `searchIndex.json を静的importしているファイル: ${offenders.join(", ")}`);
});

check("検索順位に新しさ・種類・人物・重要度による補正が入っていない", () => {
  const src = read("src/lib/search.ts");
  assert.ok(!/recencyBoost\s*\(/.test(src), "新しさによる加点（recencyBoost）が残っています");
  assert.ok(!/TYPE_SCORE_WEIGHT/.test(src), "種類ごとの倍率（TYPE_SCORE_WEIGHT）が残っています");
  assert.ok(/a\.tier - b\.tier/.test(src), "一致段階（tier）を第1基準にした並び替えがありません");
});

console.log(`\n✅ test-unified-search-index: ${passCount} checks passed（索引 ${entries.length}件）`);
