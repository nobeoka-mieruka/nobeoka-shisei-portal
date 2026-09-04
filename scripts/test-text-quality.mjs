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

/**
 * Phase209・レイヤー3：市民向けページに内部用語（データのフィールド名・列挙値・
 * ファイル名・整理番号・リポジトリ内パス）がそのまま出ていないかを検査する。
 * 表示側の言い換えは `src/lib/citizenTermLabels.ts` の `humanizeDataNote()` が担当する。
 * 検出されたら、対応表へ日本語ラベルを足すか、表示箇所を `humanizeDataNote()` で包む。
 */
const INTERNAL_TERM_PATTERNS = [
  { label: "内部データファイル名", re: /(^|[^/A-Za-z0-9._-])[a-z][A-Za-z0-9]*\.json(?![A-Za-z0-9])/ },
  { label: "内部の金額フィールド名", re: /(^|[^A-Za-z0-9_])[a-z][A-Za-z0-9]*Yen(?![A-Za-z0-9_])/ },
  {
    label: "出典・確認状況の内部フィールド名／列挙値",
    re: /(^|[^A-Za-z0-9_])(?:verificationStatus|verificationNote|sourceRefs?|reasonCode|partiallyVerified|needsReview|sourceUnavailable|not_researched|unconfirmed)(?![A-Za-z0-9_])/,
  },
  { label: "内部の整理番号", re: /(?<!未確認項目)UNR-\d+|(?<!照会事項)INQ-\d+|(?<!要再確認項目)disputed-\d+/ },
  { label: "議案説明の内部段階区分", re: /(^|[^A-Za-z0-9_])Level[123](?![A-Za-z0-9_])/ },
  {
    label: "人手対応の内部ステータス",
    re: /(^|[^A-Za-z0-9_])(?:HUMAN_ACTION_REQUIRED|MANUAL_REVIEW|RESEARCH_EXHAUSTED|WAITING_EXTERNAL)(?![A-Za-z0-9_])/,
  },
  {
    label: "リポジトリ内のパス",
    re: /(^|[^A-Za-z0-9])(?:src\/data|reports|scripts)\/[A-Za-z0-9._/-]+\.(?:json|md|mjs|ts|ps1)(?![A-Za-z0-9])/,
  },
  /* --- Phase212 で追加した層 --- */
  {
    // 開発フェーズ番号・作業ブロック番号は、市民が辿れる資料ではないため本文から消す。
    label: "開発フェーズ番号・作業ブロック番号",
    re: /(^|[^A-Za-z0-9_])(?:Phase|Block)\s?\d+(?![A-Za-z0-9_])/,
  },
  {
    // レコードIDは消さずに残すが、必ず「整理番号」「調査タスク」と前置きして出す
    // （前置きの無い裸のIDは、市民には何の番号か分からない）。凡例は /data-status。
    label: "前置きの無いレコードID",
    re: /(?<!整理番号)(?:civic-\d+|pf-org-\d+|mayor-\d+-term-\d+)|(?<!整理番号)(?<![A-Za-z0-9_/-])(?:fm\d+|m\d{2,3})(?![A-Za-z0-9_-])|(?<!調査タスク)TASK-\d+|acl-vice-?chair-\d+/,
  },
  {
    label: "調査に使った道具の名前",
    re: /(^|[^A-Za-z0-9_])(?:pdftotext|pdfjs-dist|WinRT)(?![A-Za-z0-9_])|GetText3\.exe(?:テキスト|ページ)/,
  },
];

/**
 * 監査・専門ページ。内部の状態名を「意味の説明付きで」提示すること自体が目的の画面のため、
 * レイヤー3の対象外にする（一般市民向けページでの露出のみを回帰対象にする）。
 */
const AUDIT_ROUTES = ["/data-status", "/methodology"];

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

/**
 * dist/ が src/ より古いと、このレイヤーは実際のコードではなく前回ビルドの遺物を検査してしまう。
 * 修正済みなのに失敗したり（古い dist にバグが残っている）、未修正なのに合格したり（古い dist が
 * たまたま綺麗）するため、鮮度を確認できないときは判定せずスキップする。
 * ビルド直後の状態は `npm run build` の末尾でこのスクリプトが実行されて担保される。
 */
function distIsStale() {
  const newestSource = listFiles(path.join(ROOT, "src"), (name) => /\.(tsx?|json)$/.test(name)).reduce(
    (max, f) => Math.max(max, statSync(f).mtimeMs),
    0,
  );
  const distIndex = path.join(DIST, "index.html");
  if (!existsSync(distIndex)) return true;
  return statSync(distIndex).mtimeMs < newestSource;
}

if (!existsSync(DIST)) {
  console.log("  -- skip - prerender済みHTMLの検査（dist/ が無いためスキップ。npm run build 後に再実行してください）");
} else if (distIsStale()) {
  console.log("  -- skip - prerender済みHTMLの検査（dist/ が src/ より古いためスキップ。npm run build 後に再実行してください）");
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

  /* ---------------------------------------------------------------- *
   * レイヤー3：prerender済みHTML（内部用語の露出）
   * ---------------------------------------------------------------- */

  const internalFound = [];
  for (const file of htmlFiles) {
    const route = "/" + path.relative(DIST, file).replace(/\\/g, "/").replace(/\/?index\.html$/, "");
    if (AUDIT_ROUTES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) continue;
    const text = extractRenderedText(readFileSync(file, "utf8"));
    for (const { label, re } of INTERNAL_TERM_PATTERNS) {
      const scanner = new RegExp(re.source, "g");
      let m;
      while ((m = scanner.exec(text))) {
        const context = text.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, " ").trim();
        internalFound.push(`${route}: ${label}「${m[0].trim()}」…${context}…`);
      }
    }
  }

  check("prerender済みHTMLの本文に、市民向けページ用の日本語へ言い換えていない内部用語が無い", () => {
    assert.equal(
      internalFound.length,
      0,
      `内部用語の露出（src/lib/citizenTermLabels.ts の対応表へ追加し、表示箇所を humanizeDataNote() で包む）:\n    ` +
        `${internalFound.slice(0, 40).join("\n    ")}\n    （合計${internalFound.length}件）`,
    );
  });

  /* ---------------------------------------------------------------- *
   * レイヤー3-2（Phase212）：対応表に載っている語が、そもそも変換されずに出ていないか
   *
   * レイヤー3は「対応表へ追加すべき語」を探す。こちらは逆に、**対応表には既にあるのに
   * 画面へそのまま出ている**語を探す。これは対応表の不足ではなく、その表示箇所が
   * `humanizeDataNote()` を通っていないことを意味する（Phase212 では市政年表の日付表記
   * `dateLabel` と市長公約の候補理由 `candidateReason` がこれで見つかった）。
   * 対応表は単一情報源のままにしたいので、キーはソースから読み出して常に同期させる。
   * ---------------------------------------------------------------- */

  const labelSource = readFileSync(path.join(SRC, "lib/citizenTermLabels.ts"), "utf8");
  function tableKeys(startMarker, endMarker) {
    const block = labelSource.slice(labelSource.indexOf(startMarker), labelSource.indexOf(endMarker));
    return [...block.matchAll(/^ {2}"?([A-Za-z0-9_.]+)"?:/gm)].map((m) => m[1]);
  }
  // 短い語は英文の出典名などに紛れて誤検出しうるため、5文字以上のキーだけを対象にする。
  const mappedTerms = [
    ...tableKeys("const DATA_FILE_LABELS", "const INTERNAL_TERM_LABELS"),
    ...tableKeys("const INTERNAL_TERM_LABELS", "/** 置換対象にしない語"),
  ].filter((key) => key.length >= 5);
  const mappedTermPattern = new RegExp(
    `(^|[^A-Za-z0-9_/.-])(${mappedTerms
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .sort((a, b) => b.length - a.length)
      .join("|")})(?![A-Za-z0-9_-])`,
    "g",
  );

  const unwrapped = [];
  for (const file of htmlFiles) {
    const route = "/" + path.relative(DIST, file).replace(/\\/g, "/").replace(/\/?index\.html$/, "");
    if (AUDIT_ROUTES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) continue;
    const text = extractRenderedText(readFileSync(file, "utf8"));
    const scanner = new RegExp(mappedTermPattern.source, "g");
    let m;
    while ((m = scanner.exec(text))) {
      const context = text.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, " ").trim();
      unwrapped.push(`${route}: 「${m[2]}」…${context}…`);
    }
  }

  console.log(`\n対応表の現況：言い換え対象${mappedTerms.length}語（5文字以上のキーを src/lib/citizenTermLabels.ts から再抽出）`);

  check("対応表に載っている内部用語が、言い換えられないまま市民向けページに出ていない", () => {
    assert.equal(
      unwrapped.length,
      0,
      `対応表にあるのに変換されていない語（その表示箇所が humanizeDataNote() を通っていない）:\n    ` +
        `${unwrapped.slice(0, 40).join("\n    ")}\n    （合計${unwrapped.length}件）`,
    );
  });
}

console.log(`\n[test-text-quality] ${passCount} check(s) passed.`);
