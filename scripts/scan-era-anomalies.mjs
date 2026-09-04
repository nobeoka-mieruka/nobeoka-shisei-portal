/**
 * プリレンダリング済み HTML の本文テキストから、UI が生成した「ありえない元号・年」表記を探す。
 *
 * 背景（Phase219）：西暦→令和の換算が元号で分岐しておらず、`/dashboard` に
 * 「令和-18年度」「令和0年度」が出ていた。同種の異常が他ページ・他データに無いかを確認する。
 *
 * 対象は「画面に描画されたテキスト」。歴史資料の引用そのものを書き換える目的ではないため、
 * 検出したら必ず前後の文脈を人が確認すること（このスクリプトは報告のみで修正はしない）。
 *
 * 使い方: node scripts/scan-era-anomalies.mjs
 * 終了コード: 異常表記が1件でもあれば 1
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const DIST = "dist";

if (!existsSync(DIST)) {
  console.error("[scan-era-anomalies] dist/ がありません。先に npm run build を実行してください。");
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry === "index.html" || entry === "404.html") files.push(p);
  }
})(DIST);

/** prerender済みHTMLから本文の表示テキストを取り出す。 */
function renderedText(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  let body = bodyMatch ? bodyMatch[1] : html;
  body = body
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    // React の SSR はテキストノード境界に <!-- --> を挿入する
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ");
  return body.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

const PATTERNS = [
  ["令和0年", /令和0年/g],
  ["令和マイナス年", /令和-\d+年/g],
  ["平成0年", /平成0年/g],
  ["平成マイナス年", /平成-\d+年/g],
  ["昭和0年", /昭和0年/g],
  ["昭和マイナス年", /昭和-\d+年/g],
  ["NaN年", /NaN\s*年/g],
  ["undefined年", /undefined\s*年/g],
  // 「1990年代」のような正当な表記を除くため、直後が「代」の場合は対象外
  ["0年（先頭が0）", /(?:^|[^0-9])0年(?!代)/g],
];

const hits = new Map();
for (const file of files) {
  const text = renderedText(readFileSync(file, "utf8"));
  const route = "/" + path.relative(DIST, file).replace(/\\/g, "/").replace(/\/?index\.html$/, "");
  for (const [name, re] of PATTERNS) {
    const found = text.match(re);
    if (!found) continue;
    if (!hits.has(name)) hits.set(name, []);
    hits.get(name).push({ route, count: found.length, sample: found[0] });
  }
}

console.log(`[scan-era-anomalies] 検査ページ数: ${files.length}`);
let total = 0;
for (const [name, list] of hits) {
  const n = list.reduce((sum, x) => sum + x.count, 0);
  total += n;
  console.log(`\n${name}: ${n}件 / ${list.length}ページ`);
  for (const x of list.slice(0, 5)) {
    console.log(`   ${x.route} (${x.count}件) 例: ${JSON.stringify(x.sample)}`);
  }
  if (list.length > 5) console.log(`   …ほか ${list.length - 5}ページ`);
}
console.log(`\n[scan-era-anomalies] 異常表記の合計: ${total}件`);
process.exit(total > 0 ? 1 : 0);
