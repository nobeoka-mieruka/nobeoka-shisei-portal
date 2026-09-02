/**
 * Phase193：初期ロードするJavaScript・CSSの大きさが、気付かないうちに増えていないかを検査する。
 *
 * 【なぜ必要か】
 * このサイトはスマートフォン閲覧を最優先しており、初期ロード量がそのまま表示・操作可能に
 * なるまでの時間へ影響する。ページ側で`import`を1行足すだけで、その先の巨大なJSONが
 * エントリチャンクの静的依存に入り込み、トップページを開いただけで数MBを読み込む状態に
 * 戻り得る（Phase193以前は共有チャンクが7.8MB／gzip 1.1MBまで肥大化していた）。
 * 数値の増減を機械的に見張ることで、その再発を検出する。
 *
 * 【何を測るか】
 * dist/index.html が読み込む「エントリチャンク＋そこから静的importで到達する全チャンク」
 * ＝ブラウザが初回表示のために必ず取得するJavaScriptの合計。
 * 遅延読み込み（dynamic import）されるページ単位のチャンクは含めない。
 *
 * 使い方：
 *   npm run check:bundle-size            … 予算（scripts/bundle-size-budget.json）と比較する
 *   npm run check:bundle-size -- --update … 現在値を新しい基準値として書き込む
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const budgetFile = path.join(projectRoot, "scripts", "bundle-size-budget.json");

/** 基準値に対して何%増えたら警告／失敗にするか。 */
const WARN_RATIO = 1.05;
const FAIL_RATIO = 1.2;

const shouldUpdate = process.argv.includes("--update");

if (!existsSync(distDir)) {
  console.error("[check-bundle-size] dist/ が見つかりません。先に npm run build を実行してください。");
  process.exit(1);
}

const indexHtml = readFileSync(path.join(distDir, "index.html"), "utf8");

/** index.htmlが直接参照するJS（エントリ）とCSS。 */
function assetsFromHtml(html) {
  const scripts = [...html.matchAll(/<script[^>]*\bsrc="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const styles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"/g)].map((m) => m[1]);
  return { scripts, preloads, styles };
}

/**
 * 1つのチャンクが静的importしている相対パスを取り出す。
 * ビルド後のESMでは `import"./x.js"` / `from"./x.js"` / `export*from"./x.js"` の形になる。
 * 動的import（`import("./x.js")`）は括弧が付くため、この正規表現には一致しない。
 */
function staticImportsOf(file) {
  const code = readFileSync(path.join(distDir, file.replace(/^\//, "")), "utf8");
  const found = new Set();
  for (const m of code.matchAll(/(?:^|[;\s}])(?:import|export\s*\*\s*from|from)\s*["'](\.\/[^"']+\.js)["']/g)) {
    found.add(`/assets/${path.posix.basename(m[1])}`);
  }
  for (const m of code.matchAll(/\bfrom["'](\.\/[^"']+\.js)["']/g)) {
    found.add(`/assets/${path.posix.basename(m[1])}`);
  }
  for (const m of code.matchAll(/\bimport["'](\.\/[^"']+\.js)["']/g)) {
    found.add(`/assets/${path.posix.basename(m[1])}`);
  }
  return [...found];
}

/** エントリから静的importだけで到達できるチャンクの集合（＝初回表示で必ず取得されるJS）。 */
function staticClosure(entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    if (!existsSync(path.join(distDir, file.replace(/^\//, "")))) continue;
    seen.add(file);
    for (const next of staticImportsOf(file)) queue.push(next);
  }
  return [...seen].sort();
}

function measure(file) {
  const buf = readFileSync(path.join(distDir, file.replace(/^\//, "")));
  return { file, bytes: buf.length, gzip: gzipSync(buf, { level: 9 }).length, brotli: brotliCompressSync(buf).length };
}

const { scripts, preloads, styles } = assetsFromHtml(indexHtml);
if (scripts.length === 0) {
  console.error("[check-bundle-size] index.htmlからエントリのJavaScriptを検出できませんでした。");
  process.exit(1);
}

const initialJsFiles = staticClosure([...scripts, ...preloads]);
const jsMeasures = initialJsFiles.map(measure);
const cssMeasures = styles.map(measure);

const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);

const current = {
  initialJsFileCount: jsMeasures.length,
  initialJsBytes: sum(jsMeasures, "bytes"),
  initialJsGzip: sum(jsMeasures, "gzip"),
  initialCssGzip: sum(cssMeasures, "gzip"),
  largestInitialChunkGzip: Math.max(0, ...jsMeasures.map((m) => m.gzip)),
};

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

console.log("[check-bundle-size] 初回表示で必ず取得されるJavaScript（静的importのみ、遅延読み込みは除く）");
for (const m of [...jsMeasures].sort((a, b) => b.gzip - a.gzip)) {
  console.log(`  ${m.file}  ${kb(m.bytes)}  gzip ${kb(m.gzip)}  br ${kb(m.brotli)}`);
}
for (const m of cssMeasures) {
  console.log(`  ${m.file}  ${kb(m.bytes)}  gzip ${kb(m.gzip)}`);
}
console.log(
  `  合計 JS ${kb(current.initialJsBytes)}（gzip ${kb(current.initialJsGzip)}）／CSS gzip ${kb(current.initialCssGzip)}`,
);

if (shouldUpdate || !existsSync(budgetFile)) {
  const budget = {
    _comment:
      "Phase193：初期ロード量の基準値（bytes）。npm run check:bundle-size -- --update で現在値へ更新する。意図的に増やす場合のみ更新し、理由をコミットメッセージへ残すこと。",
    updatedAt: new Date().toISOString().slice(0, 10),
    warnRatio: WARN_RATIO,
    failRatio: FAIL_RATIO,
    baseline: current,
  };
  writeFileSync(budgetFile, `${JSON.stringify(budget, null, 2)}\n`, "utf8");
  console.log(`[check-bundle-size] 基準値を更新しました：${path.relative(projectRoot, budgetFile)}`);
  process.exit(0);
}

const budget = JSON.parse(readFileSync(budgetFile, "utf8"));
const baseline = budget.baseline ?? {};
const warnRatio = budget.warnRatio ?? WARN_RATIO;
const failRatio = budget.failRatio ?? FAIL_RATIO;

const CHECKS = [
  ["initialJsBytes", "初期ロードJS（非圧縮）"],
  ["initialJsGzip", "初期ロードJS（gzip）"],
  ["initialCssGzip", "初期ロードCSS（gzip）"],
  ["largestInitialChunkGzip", "初期ロード中の最大チャンク（gzip）"],
];

let warnings = 0;
let failures = 0;
for (const [key, label] of CHECKS) {
  const base = baseline[key];
  const now = current[key];
  if (typeof base !== "number" || base <= 0) continue;
  const ratio = now / base;
  const delta = `${ratio >= 1 ? "+" : ""}${((ratio - 1) * 100).toFixed(1)}%`;
  const detail = `${label}：${kb(now)}（基準 ${kb(base)}／${delta}）`;
  if (ratio >= failRatio) {
    console.error(`[ERROR] ${detail} — 基準の${Math.round((failRatio - 1) * 100)}%増を超えました。`);
    failures++;
  } else if (ratio >= warnRatio) {
    console.warn(`[WARN] ${detail} — 基準の${Math.round((warnRatio - 1) * 100)}%増を超えました。`);
    warnings++;
  } else {
    console.log(`[OK] ${detail}`);
  }
}

// 参考情報：dist全体で大きいファイル上位（遅延読み込みされるページ単位のチャンクを含む）。
console.log("[check-bundle-size] 参考：dist/assets の大きいファイル上位10件（遅延読み込みを含む）");
const assetsDir = path.join(distDir, "assets");
const listed = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
const big = listed
  .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
  .map((name) => ({ name, bytes: statSync(path.join(assetsDir, name)).size }))
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 10);
for (const item of big) console.log(`  ${item.name}  ${kb(item.bytes)}`);

if (failures > 0) {
  console.error(`[check-bundle-size] ${failures}件が基準を大きく超えています。`);
  process.exit(1);
}
console.log(`[check-bundle-size] 判定：エラー0件／警告${warnings}件`);
