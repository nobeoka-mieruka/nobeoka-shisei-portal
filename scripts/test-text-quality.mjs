/**
 * Phase201：表示文章の「二重語」回帰テスト。
 *
 * 背景：`/finance` の要約文が「一般会計は約約699.9億円です」と表示されていた。
 * 原因はデータではなく表示ロジックで、`formatOku()` が既に「約」を含む文字列を返すのに、
 * JSX 側で literal の「約」を重ねて書いていたため。
 *
 * このテストは同種の再発を2層で検出する。
 *   レイヤー1（常に実行）：src/ のソースを走査し、「約」等の接頭辞・「円」等の単位を
 *     すでに付与するフォーマッタ関数の呼び出しに、literal の接頭辞・単位を重ねている箇所を検出する。
 *   レイヤー2（dist/ がある場合のみ）：prerender 済み HTML の本文テキストを走査し、
 *     「約約」「円円」等の明確な二重語を検出する。dist/ が無い場合はスキップする
 *     （`npm test` は build を前提にしないため。build 後に実行すればこの層も走る）。
 *
 * 「「」「」」（かぎ括弧の連続）は、題名そのものがかぎ括弧で始まる／終わる請願・陳情・
 * 一般質問テーマの入れ子引用として正当に出現するため、失敗にはせず件数のみ表示する。
 *
 * 使い方: node scripts/test-text-quality.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

function listFiles(dir, accept) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, accept));
    else if (accept(entry)) out.push(full);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * レイヤー1：ソース側（接頭辞・単位の二重付与）
 * ------------------------------------------------------------------ */

/** 値の前に付く接頭辞。フォーマッタが返す文字列の先頭にあるもの。 */
const PREFIXES = ["約"];
/** 値の後ろに付く単位。フォーマッタが返す文字列の末尾にあるもの。長い順に並べる。 */
const SUFFIXES = ["億円", "万円", "千円", "年度", "円", "％", "人", "件"];

const sourceFiles = listFiles(SRC, (name) => name.endsWith(".ts") || name.endsWith(".tsx"));

/** `function name(...) { ... }` を粗く切り出す（ネストした波括弧は追わず、次の行頭 `}` までを本体とみなす）。 */
function collectFunctions(code) {
  const out = [];
  const re = /(?:export\s+)?function\s+([A-Za-z0-9_$]+)\s*\([\s\S]*?\)[^{]*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(code))) out.push({ name: m[1], body: m[2] });
  return out;
}

/** 戻り値のテンプレートリテラルが接頭辞で始まる／単位で終わるフォーマッタ名を集める。 */
const prefixFormatters = new Map(); // name -> prefix
const suffixFormatters = new Map(); // name -> suffix
for (const file of sourceFiles) {
  for (const fn of collectFunctions(readFileSync(file, "utf8"))) {
    const returns = [...fn.body.matchAll(/return\s+`([^`]*)`/g)].map((r) => r[1]);
    if (returns.length === 0) continue;
    for (const prefix of PREFIXES) {
      if (returns.every((r) => r.startsWith(prefix))) prefixFormatters.set(fn.name, prefix);
    }
    for (const suffix of SUFFIXES) {
      if (returns.every((r) => r.endsWith(suffix))) {
        // 長い単位を優先（「億円」を「円」で上書きしない）
        if (!suffixFormatters.has(fn.name)) suffixFormatters.set(fn.name, suffix);
      }
    }
  }
}

console.log(
  `\n表示ロジックの現況：ソース${sourceFiles.length}ファイル／` +
    `接頭辞付きフォーマッタ${prefixFormatters.size}件・単位付きフォーマッタ${suffixFormatters.size}件（ソースから再抽出）`,
);

check("接頭辞（約 等）を付けるフォーマッタの呼び出し直前に、同じ接頭辞をliteralで重ねていない", () => {
  const bad = [];
  for (const file of sourceFiles) {
    const code = readFileSync(file, "utf8");
    for (const [name, prefix] of prefixFormatters) {
      // JSX: 約{fn(...)}  ／ テンプレートリテラル: 約${fn(...)}
      // JSX では「約」と `{` の間の改行・インデントは描画時に除去されるため \s* を許容する。
      const re = new RegExp(`${prefix}\\s*\\$?\\{\\s*${name}\\s*[(}]`, "g");
      let m;
      while ((m = re.exec(code))) {
        const line = code.slice(0, m.index).split("\n").length;
        bad.push(`${path.relative(ROOT, file)}:${line} 「${prefix}」+${name}()（${name}()の戻り値は既に「${prefix}」で始まる）`);
      }
    }
  }
  assert.equal(bad.length, 0, `接頭辞の二重付与:\n    ${bad.join("\n    ")}`);
});

check("単位（円・％ 等）を付けるフォーマッタの呼び出し直後に、同じ単位をliteralで重ねていない", () => {
  const bad = [];
  for (const file of sourceFiles) {
    const code = readFileSync(file, "utf8");
    for (const [name, suffix] of suffixFormatters) {
      const re = new RegExp(`\\$?\\{\\s*${name}\\s*\\([^{}]*\\)\\s*\\}${suffix}`, "g");
      let m;
      while ((m = re.exec(code))) {
        const line = code.slice(0, m.index).split("\n").length;
        bad.push(`${path.relative(ROOT, file)}:${line} ${name}()+「${suffix}」（${name}()の戻り値は既に「${suffix}」で終わる）`);
      }
    }
  }
  assert.equal(bad.length, 0, `単位の二重付与:\n    ${bad.join("\n    ")}`);
});

/* ------------------------------------------------------------------ *
 * レイヤー2：prerender済みHTML（本文テキストの二重語）
 * ------------------------------------------------------------------ */

/** 明確な表示バグとみなす二重語。現状の dist はいずれも0件で、これを baseline とする。 */
const BANNED_DUPLICATES = ["約約", "円円", "％％", "年年度", "月月", "件件", "人人", "。。", "、、"];
/** 入れ子引用として正当に出現しうるため、件数の表示のみ行う。 */
const INFO_DUPLICATES = ["「「", "」」"];

/** prerender済みHTMLから本文の表示テキストを取り出す。 */
function extractRenderedText(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  let body = bodyMatch ? bodyMatch[1] : html;
  body = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  // React の SSR はテキストノードの境界に <!-- --> を挿入する。
  // これを除去しないと「約<!-- -->約699.9億円」のような二重語を取りこぼす。
  body = body.replace(/<!--[\s\S]*?-->/g, "");
  body = body.replace(/<[^>]+>/g, " ");
  return body
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

if (!existsSync(DIST)) {
  console.log("  -- skip - prerender済みHTMLの検査（dist/ が無いためスキップ。npm run build 後に再実行してください）");
} else {
  const htmlFiles = listFiles(DIST, (name) => name === "index.html" || name === "404.html");
  const infoCounts = new Map(INFO_DUPLICATES.map((p) => [p, 0]));
  const found = [];

  for (const file of htmlFiles) {
    const text = extractRenderedText(readFileSync(file, "utf8"));
    const route = "/" + path.relative(DIST, file).replace(/\\/g, "/").replace(/\/?index\.html$/, "");
    for (const pattern of BANNED_DUPLICATES) {
      let i = -1;
      while ((i = text.indexOf(pattern, i + 1)) !== -1) {
        const context = text.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, " ").trim();
        found.push(`${route}: 「${pattern}」…${context}…`);
      }
    }
    for (const pattern of INFO_DUPLICATES) {
      let i = -1;
      let n = 0;
      while ((i = text.indexOf(pattern, i + 1)) !== -1) n += 1;
      infoCounts.set(pattern, infoCounts.get(pattern) + n);
    }
  }

  console.log(
    `\nprerender済みHTMLの現況：${htmlFiles.length}ページ（実ファイルから再計算）／` +
      `入れ子引用 ${[...infoCounts].map(([p, n]) => `${p}=${n}件`).join("・")}（題名自体がかぎ括弧で始まる／終わるため正当）`,
  );

  check(`prerender済みHTMLの本文に明確な二重語（${BANNED_DUPLICATES.join("・")}）が無い`, () => {
    assert.equal(found.length, 0, `二重語:\n    ${found.slice(0, 40).join("\n    ")}`);
  });
}

console.log(`\n[test-text-quality] ${passCount} check(s) passed.`);
