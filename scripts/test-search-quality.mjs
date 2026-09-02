/**
 * Phase195：サイト内検索（/search）の日本語検索品質テスト。
 * 既存のscripts/test-*.mjsと同じ「プレーンなNodeスクリプト＋assert」方式。
 *
 * 検証すること：
 * 1. 市民がよく使う検索語（48語）が0件にならず、期待する種類の結果が上位に出ること
 * 2. 表記ゆれ（障害／障がい／障碍、子ども／子供／こども 等）で同じ結果集合が返ること
 * 3. 全角/半角・大文字/小文字・カタカナ/ひらがな・空白の違いを正規化していること
 * 4. 検索順位（完全一致 ＞ タイトル一致 ＞ 人物名一致 ＞ テーマ一致 ＞ 本文一致）が妥当なこと
 * 5. 0件のときに「実際に結果が出る別の言い方」を案内できること
 * 6. 表記ゆれ辞書（src/data/searchSynonyms.json）自体の整合性
 *
 * Phase199で追加：
 * 7. 役職名（議員・市議・市議会議員）での検索が、市民が期待する入口を上位に出すこと
 *    （元議員は結果から消さず、順位だけを是正していること）
 * 8. 同じURL（同じ遷移先ページ）を指す結果を1行にまとめられること
 *
 * 使い方: node --experimental-strip-types scripts/test-search-quality.mjs
 * （src/lib/search.tsを直接importするため、Node 24のTS直接実行を使う）
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

const { searchEntries, getAlternativeQueries, groupResultsByUrl, normalize, compact, expandVariants } = await import(
  "../src/lib/search.ts"
);

const searchIndex = readJson("src/data/searchIndex.json");
const dictionary = readJson("src/data/searchSynonyms.json");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const search = (query) => searchEntries(searchIndex, query);
const topTypes = (results, n) => results.slice(0, n).map((r) => r.entry.type);
const topUrls = (results, n) => results.slice(0, n).map((r) => r.entry.url);
/** 検索結果を、SearchPageの表示と同じく「同じURLは1行」にまとめたもの。 */
const grouped = (query) => groupResultsByUrl(search(query));
const groupedTop = (query, n) => grouped(query).slice(0, n).map((g) => g.result);

// --- 1. 検索語テストセット -------------------------------------------------
// expectTypes：上位5件のいずれかがこの種類であること（市民が探しているであろう情報の種類）
// expectUrl：上位3件にこのURLが含まれること（「〇〇のページを開きたい」という検索）
// minResults：最低件数（0件になっていないかの確認。実データ件数より十分小さい値を指定する）
const SEARCH_TEST_CASES = [
  { query: "福祉", expectTypes: ["theme", "bill", "question", "speech", "page"], expectUrl: "/themes/welfare", minResults: 20 },
  { query: "障がい", expectTypes: ["question", "bill", "page", "speech"], minResults: 20 },
  { query: "障害", expectTypes: ["question", "bill", "page", "speech"], minResults: 20 },
  { query: "介護", expectTypes: ["theme", "bill", "question", "speech"], expectUrl: "/themes/welfare", minResults: 20 },
  { query: "高齢者", expectTypes: ["question", "bill", "speech", "theme"], minResults: 20 },
  { query: "子育て", expectTypes: ["theme", "question", "promise", "bill"], expectUrl: "/themes/education", minResults: 20 },
  { query: "子ども", expectTypes: ["promise", "question", "bill", "policy", "theme"], minResults: 20 },
  { query: "保育", expectTypes: ["bill", "page", "speech", "question"], minResults: 10 },
  { query: "学校", expectTypes: ["page", "bill", "question", "speech", "committee"], minResults: 20 },
  { query: "教育", expectTypes: ["theme", "page", "committee", "bill"], minResults: 20 },
  { query: "防災", expectTypes: ["theme", "question", "page", "bill"], expectUrl: "/themes/disaster", minResults: 20 },
  { query: "津波", expectTypes: ["council-document", "bill", "promise", "speech"], minResults: 5 },
  { query: "南海トラフ", expectTypes: ["question", "speech", "bill"], minResults: 3 },
  { query: "消防", expectTypes: ["theme", "page", "bill"], minResults: 10 },
  { query: "道路", expectTypes: ["theme", "page", "question", "bill"], expectUrl: "/themes/transportation", minResults: 20 },
  { query: "延岡駅", expectTypes: ["page", "question", "speech"], minResults: 5 },
  { query: "旭化成", expectTypes: ["page", "speech", "update", "bill"], minResults: 5 },
  { query: "人口減少", expectTypes: ["theme", "question", "speech", "page"], expectUrl: "/themes/population", minResults: 5 },
  { query: "移住", expectTypes: ["theme", "question", "speech"], minResults: 5 },
  { query: "ふるさと納税", expectTypes: ["question", "speech"], minResults: 5 },
  { query: "市債", expectTypes: ["page", "bill", "finance", "update"], minResults: 5 },
  { query: "基金", expectTypes: ["page", "bill", "finance", "update"], minResults: 10 },
  { query: "予算", expectTypes: ["page", "bill", "question"], minResults: 50 },
  { query: "決算", expectTypes: ["page", "bill"], minResults: 20 },
  { query: "財政", expectTypes: ["finance", "page", "theme"], expectUrl: "/finance", minResults: 20 },
  { query: "報酬", expectTypes: ["compensation", "update", "page"], expectUrl: "/compensation", minResults: 5 },
  { query: "市長", expectTypes: ["mayor", "page"], expectUrl: "/mayor", minResults: 100 },
  { query: "公約", expectTypes: ["page", "promise", "policy", "question"], expectUrl: "/mayor/policy-progress", minResults: 10 },
  { query: "議案", expectTypes: ["page", "bill", "speech"], minResults: 100 },
  { query: "一般質問", expectTypes: ["page", "speech"], expectUrl: "/questions", minResults: 100 },
  { query: "議員", expectTypes: ["page", "former-member", "member", "speech"], minResults: 100 },
  { query: "委員会", expectTypes: ["page", "committee", "bill"], minResults: 50 },
  { query: "選挙", expectTypes: ["page", "election"], expectUrl: "/elections", minResults: 20 },
  { query: "会議録", expectTypes: ["page", "update", "speech", "bill"], minResults: 50 },
  { query: "市役所案内", expectTypes: ["guide", "theme", "update"], expectUrl: "/city-guide", minResults: 1 },
  { query: "政治資金", expectTypes: ["page", "political-fund"], expectUrl: "/political-funds", minResults: 5 },
  { query: "更新履歴", expectTypes: ["page", "update"], expectUrl: "/updates", minResults: 1 },
  { query: "水道", expectTypes: ["page", "bill", "speech"], minResults: 20 },
  { query: "環境", expectTypes: ["theme", "promise", "bill", "council-document"], minResults: 20 },
  { query: "観光", expectTypes: ["theme", "promise", "speech"], minResults: 20 },
  { query: "農業", expectTypes: ["page", "bill", "speech"], minResults: 20 },
  { query: "医療", expectTypes: ["theme", "page", "promise", "bill"], minResults: 20 },
  { query: "空き家", expectTypes: ["bill", "question", "speech"], minResults: 5 },
  { query: "国スポ", expectTypes: ["speech", "question", "committee"], minResults: 5 },
  { query: "DX", expectTypes: ["question", "speech", "theme"], minResults: 3 },
  { query: "給食", expectTypes: ["council-document", "bill", "speech"], minResults: 5 },
  { query: "図書館", expectTypes: ["page", "bill", "speech"], minResults: 5 },
  { query: "病院", expectTypes: ["page", "theme", "speech"], minResults: 5 },
];

console.log(`\nPhase195-1：市民がよく使う検索語${SEARCH_TEST_CASES.length}語の検索結果`);

let expectationPassCount = 0;
let emptyResultCount = 0;

check(`テストセットは30語以上（実際は${SEARCH_TEST_CASES.length}語）`, () => {
  assert.ok(SEARCH_TEST_CASES.length >= 30, `テスト語数が不足しています（${SEARCH_TEST_CASES.length}語）`);
  const queries = SEARCH_TEST_CASES.map((c) => c.query);
  assert.equal(new Set(queries).size, queries.length, "テスト語が重複しています");
});

check("全テスト語で1件以上ヒットし、期待する種類の結果が上位5件に含まれる", () => {
  const failures = [];
  for (const testCase of SEARCH_TEST_CASES) {
    const results = search(testCase.query);
    if (results.length === 0) {
      emptyResultCount += 1;
      failures.push(`「${testCase.query}」が0件`);
      continue;
    }
    if (results.length < testCase.minResults) {
      failures.push(`「${testCase.query}」が${results.length}件（期待：${testCase.minResults}件以上）`);
      continue;
    }
    const types = topTypes(results, 5);
    if (!types.some((t) => testCase.expectTypes.includes(t))) {
      failures.push(`「${testCase.query}」の上位5件が${types.join("/")}（期待：${testCase.expectTypes.join("/")}）`);
      continue;
    }
    if (testCase.expectUrl && !topUrls(results, 3).includes(testCase.expectUrl)) {
      failures.push(`「${testCase.query}」の上位3件に${testCase.expectUrl}が無い（${topUrls(results, 3).join(" / ")}）`);
      continue;
    }
    expectationPassCount += 1;
  }
  assert.equal(failures.length, 0, `期待どおりでない検索語:\n    - ${failures.join("\n    - ")}`);
});

// --- 2. 表記ゆれ -----------------------------------------------------------
console.log("\nPhase195-2：表記ゆれ（同じ語の書き分け）で同じ結果になること");

let variantCheckCount = 0;

check("辞書の各グループは、どの表記で検索しても同じ結果集合を返す", () => {
  const failures = [];
  for (const group of dictionary.orthographicVariants) {
    const resultSets = group.terms.map((term) => ({
      term,
      ids: new Set(search(term).map((r) => r.entry.id)),
    }));
    const base = resultSets[0];
    for (const other of resultSets.slice(1)) {
      variantCheckCount += 1;
      if (base.ids.size !== other.ids.size || [...base.ids].some((id) => !other.ids.has(id))) {
        failures.push(
          `${group.id}：「${base.term}」${base.ids.size}件と「${other.term}」${other.ids.size}件の結果が一致しない`,
        );
      }
    }
  }
  assert.equal(failures.length, 0, failures.join(" / "));
});

check("「障害」「障がい」「障碍」は同じ結果（実データに存在する表記を両方拾う）", () => {
  const ids = search("障害").map((r) => r.entry.id);
  assert.ok(ids.length >= 20, `「障害」の結果が少なすぎます（${ids.length}件）`);
  const titles = search("障害").map((r) => r.entry.title);
  assert.ok(
    titles.some((t) => t.includes("障害")),
    "「障害」表記のエントリが結果に含まれていません",
  );
  assert.ok(
    titles.some((t) => t.includes("障がい")),
    "「障がい」表記のエントリが結果に含まれていません",
  );
});

check("「子ども」「子供」「こども」は同じ結果（3表記すべてのエントリを拾う）", () => {
  const titles = search("子供").map((r) => `${r.entry.title} ${r.entry.description}`);
  for (const notation of ["子ども", "こども"]) {
    assert.ok(
      titles.some((t) => t.includes(notation)),
      `「${notation}」表記のエントリが「子供」の検索結果に含まれていません`,
    );
  }
});

check("意味の異なる語は同一視しない（DXとデジタルは別の結果集合）", () => {
  const dx = new Set(search("DX").map((r) => r.entry.id));
  const digital = new Set(search("デジタル").map((r) => r.entry.id));
  assert.notEqual(dx.size, digital.size, "「DX」と「デジタル」が同一視されています（辞書に入れてはいけません）");
  const dictionaryTerms = dictionary.orthographicVariants.flatMap((g) => g.terms.map(normalize));
  assert.ok(!dictionaryTerms.includes(normalize("デジタル")), "「デジタル」が表記ゆれ辞書に登録されています");
});

// --- 3. 日本語正規化 -------------------------------------------------------
console.log("\nPhase195-3：全角/半角・大文字/小文字・カタカナ/ひらがな・空白の正規化");

const NORMALIZATION_CASES = [
  { label: "全角英字と半角英字", a: "DX", b: "ＤＸ" },
  { label: "大文字と小文字", a: "DX", b: "dx" },
  { label: "カタカナとひらがな", a: "ごみ", b: "ゴミ" },
  { label: "全角数字と半角数字", a: "令和8年", b: "令和８年" },
  { label: "全角スペースと半角スペース", a: "延岡 市長", b: "延岡　市長" },
  { label: "前後の空白", a: "防災", b: "  防災  " },
];

check("表記の違いだけでは結果が変わらない（全角/半角・大小文字・カナ・空白）", () => {
  const failures = [];
  for (const c of NORMALIZATION_CASES) {
    const a = search(c.a).map((r) => r.entry.id);
    const b = search(c.b).map((r) => r.entry.id);
    if (a.length !== b.length || a.some((id, i) => id !== b[i])) {
      failures.push(`${c.label}：「${c.a}」${a.length}件と「${c.b}」${b.length}件が一致しない`);
    }
  }
  assert.equal(failures.length, 0, failures.join(" / "));
});

check("姓名の間の空白の有無で結果が変わらない（「小野 正二」「小野正二」）", () => {
  const withSpace = search("小野 正二");
  const withoutSpace = search("小野正二");
  assert.ok(withSpace.length > 0 && withoutSpace.length > 0, "議員名で検索できていません");
  assert.equal(withSpace[0].entry.url, withoutSpace[0].entry.url, "空白の有無で1位が変わっています");
});

check("過剰な正規化をしていない（別語が混ざらない）", () => {
  // 「市債」と「市政」、「議案」と「議員」のように、1文字違いの別語は別の結果になること。
  const pairs = [
    ["市債", "市政"],
    ["議案", "議員"],
    ["予算", "決算"],
  ];
  for (const [a, b] of pairs) {
    const idsA = new Set(search(a).map((r) => r.entry.id));
    const idsB = new Set(search(b).map((r) => r.entry.id));
    assert.notEqual(idsA.size, 0, `「${a}」が0件です`);
    assert.notEqual(idsB.size, 0, `「${b}」が0件です`);
    const identical = idsA.size === idsB.size && [...idsA].every((id) => idsB.has(id));
    assert.ok(!identical, `「${a}」と「${b}」が同じ結果になっています（正規化が過剰です）`);
  }
});

check("normalize()・compact()・expandVariants()の基本動作", () => {
  assert.equal(normalize("ＤＸ　推進"), "dx 推進");
  assert.equal(normalize("ゴミ"), "ごみ");
  assert.equal(compact("小野 正二"), "小野正二");
  assert.equal(compact("福祉・介護"), "福祉介護");
  const shogai = expandVariants(normalize("障害者"));
  assert.ok(shogai.includes("障がい者"), `「障害者」から「障がい者」を展開できていません（${shogai.join("/")}）`);
  // 「取組み」から「取り組みみ」のような二重置換が起きないこと
  const torikumi = expandVariants(normalize("取組み"));
  assert.ok(torikumi.includes("取り組み"), `「取組み」から「取り組み」を展開できていません（${torikumi.join("/")}）`);
  assert.ok(!torikumi.some((f) => f.includes("取り組みみ")), `二重置換が発生しています（${torikumi.join("/")}）`);
  // 辞書に無い語はそのまま
  assert.deepEqual(expandVariants("延岡駅"), ["延岡駅"]);
});

// --- 4. 検索順位 -----------------------------------------------------------
console.log("\nPhase195-4：検索順位（完全一致 ＞ タイトル一致 ＞ 人物名一致 ＞ テーマ一致 ＞ 本文一致）");

let rankingCheckCount = 0;
const rankingCheck = (label, fn) => {
  rankingCheckCount += 1;
  check(label, fn);
};

rankingCheck("議員名で検索すると、その議員本人のページが1位になる", () => {
  const cases = ["小野正二", "稲田雅之"];
  for (const name of cases) {
    const results = search(name);
    assert.ok(results.length > 0, `「${name}」が0件です`);
    assert.equal(
      results[0].entry.type,
      "member",
      `「${name}」の1位が議員ページではありません（${results[0].entry.type}：${results[0].entry.title}）`,
    );
    assert.equal(compact(results[0].entry.title), compact(name));
  }
});

rankingCheck("市長名で検索すると、市長ページが1位になる", () => {
  const results = search("三浦久知");
  assert.ok(results.length > 0, "「三浦久知」が0件です");
  assert.equal(results[0].entry.url, "/mayor", `1位が/mayorではありません（${results[0].entry.url}）`);
});

rankingCheck("役職名だけの検索では、人物名一致の加点が働かない（「議員」で元議員が独占しない）", () => {
  // 「議員」は氏名ではないため、人物ページだけが上位を占めないこと（上位10件に人物以外が含まれる）。
  const results = search("議員");
  const personTypes = new Set(["member", "former-member", "mayor"]);
  const top10 = results.slice(0, 10);
  assert.ok(
    top10.some((r) => !personTypes.has(r.entry.type)),
    "「議員」の上位10件がすべて人物ページになっています",
  );
});

rankingCheck("更新履歴（サイトの作業記録）が、市政情報より上位を独占しない", () => {
  for (const query of ["市長", "議案", "一般質問", "公約", "報酬"]) {
    const results = search(query);
    assert.notEqual(
      results[0].entry.type,
      "update",
      `「${query}」の1位が更新履歴です（${results[0].entry.title}）`,
    );
    // 更新履歴のタイトルにも「市長公約」「議案」等の語は入るため、完全に排除はしない。
    // 改善前は「市長」の上位10件すべてが更新履歴で、市長ページは11位だった。
    // 上位5件の大半を占めないこと（＝市政情報が先に並ぶこと）を固定する。
    const updatesInTop5 = results.slice(0, 5).filter((r) => r.entry.type === "update").length;
    assert.ok(
      updatesInTop5 <= 3,
      `「${query}」の上位5件のうち${updatesInTop5}件が更新履歴です（${results
        .slice(0, 5)
        .map((r) => r.entry.title)
        .join(" / ")}）`,
    );
  }
});

rankingCheck("会議録本文だけの一致が、タイトル・キーワード一致より上位に来ない", () => {
  for (const query of ["一般質問", "防災", "子育て", "介護", "財政"]) {
    const results = search(query);
    assert.ok(results.length > 0, `「${query}」が0件です`);
    const first = results[0];
    const inTitleOrKeywords =
      normalize(first.entry.title).includes(normalize(query)) ||
      first.entry.keywords.some((k) => normalize(k).includes(normalize(query))) ||
      first.matchedKeywords.length > 0;
    assert.ok(
      inTitleOrKeywords,
      `「${query}」の1位が本文一致だけのエントリです（${first.entry.type}：${first.entry.title}）`,
    );
  }
});

rankingCheck("タイトル完全一致が、同じ語を含む長いタイトルより上位になる", () => {
  const results = search("観光");
  assert.ok(results.length > 0, "「観光」が0件です");
  assert.equal(results[0].entry.title, "観光", `1位がタイトル完全一致ではありません（${results[0].entry.title}）`);
});

rankingCheck("主要な一覧ページが、それを指す検索語で上位3件に入る", () => {
  const navigational = [
    ["一般質問", "/questions"],
    ["市長公約", "/mayor/policy-progress"],
    ["更新履歴", "/updates"],
    ["政治資金", "/political-funds"],
    ["選挙結果", "/elections"],
  ];
  for (const [query, url] of navigational) {
    const urls = topUrls(search(query), 3);
    assert.ok(urls.includes(url), `「${query}」の上位3件に${url}がありません（${urls.join(" / ")}）`);
  }
});

// --- 5. 0件のときの案内 ----------------------------------------------------
console.log("\nPhase195-5：0件のときに、実際に結果が出る別の言い方を案内する");

check("市民がよく使う言い換え語（0件になる語）から、結果が出る検索語を案内できる", () => {
  const cases = ["議事録", "お年寄り"];
  for (const query of cases) {
    assert.equal(search(query).length, 0, `「${query}」が0件ではなくなっています（テストの前提を見直してください）`);
    const alternatives = getAlternativeQueries(searchIndex, query);
    assert.ok(alternatives.length > 0, `「${query}」の代替検索語が案内されません`);
    for (const a of alternatives) {
      assert.ok(a.count > 0, `「${a.term}」は0件なのに案内されています`);
    }
  }
});

check("検索語に含まれる語（例：「延岡駅前の再開発について」→「延岡駅」）を案内できる", () => {
  const query = "存在しないはずの語ZZZ";
  assert.equal(search(query).length, 0, "テスト用の語が0件ではありません");
  const longQuery = "延岡駅前の再開発と南海トラフ地震への備えについて";
  const alternatives = getAlternativeQueries(searchIndex, longQuery);
  assert.ok(alternatives.length > 0, "長い文での検索に対する候補が案内されません");
  assert.ok(
    alternatives.every((a) => a.count > 0),
    "0件になる候補が案内されています",
  );
});

check("案内する候補は、必ず1件以上ヒットする語だけ（辞書のqueryHintsも検証）", () => {
  const failures = [];
  for (const hint of dictionary.queryHints) {
    for (const suggestion of hint.suggestions) {
      const count = search(suggestion).length;
      if (count === 0) failures.push(`${hint.id}：「${suggestion}」が0件`);
    }
  }
  assert.equal(failures.length, 0, failures.join(" / "));
});

// --- 6. 辞書の整合性 -------------------------------------------------------
console.log("\nPhase195-6：表記ゆれ辞書（src/data/searchSynonyms.json）の整合性");

check("orthographicVariants：IDが一意、語が2件以上、語の重複なし、根拠note付き", () => {
  const ids = new Set();
  const allTerms = new Map();
  for (const group of dictionary.orthographicVariants) {
    assert.ok(!ids.has(group.id), `IDが重複しています: ${group.id}`);
    ids.add(group.id);
    assert.ok(group.terms.length >= 2, `${group.id}の語が2件未満です`);
    assert.ok(typeof group.note === "string" && group.note.trim().length > 0, `${group.id}のnoteが空です`);
    for (const term of group.terms) {
      assert.ok(term.trim().length > 0, `${group.id}に空の語があります`);
      const normalized = normalize(term);
      assert.ok(
        !allTerms.has(normalized),
        `「${term}」が${allTerms.get(normalized)}と${group.id}の両方に登録されています`,
      );
      allTerms.set(normalized, group.id);
    }
  }
});

check("queryHints：IDが一意、提案語が1件以上、説明note付き、自分自身を提案していない", () => {
  const ids = new Set();
  for (const hint of dictionary.queryHints) {
    assert.ok(!ids.has(hint.id), `IDが重複しています: ${hint.id}`);
    ids.add(hint.id);
    assert.ok(hint.query.trim().length > 0, `${hint.id}のqueryが空です`);
    assert.ok(hint.suggestions.length >= 1, `${hint.id}のsuggestionsが空です`);
    assert.ok(typeof hint.note === "string" && hint.note.trim().length > 0, `${hint.id}のnoteが空です`);
    assert.ok(
      !hint.suggestions.some((s) => normalize(s) === normalize(hint.query)),
      `${hint.id}が自分自身を提案しています`,
    );
  }
});

check("表記ゆれ辞書とqueryHintsの役割が混ざっていない（言い換え語を同一語として展開しない）", () => {
  const variantTerms = new Set(dictionary.orthographicVariants.flatMap((g) => g.terms.map(normalize)));
  for (const hint of dictionary.queryHints) {
    for (const suggestion of hint.suggestions) {
      const both = variantTerms.has(normalize(hint.query)) && variantTerms.has(normalize(suggestion));
      assert.ok(!both, `${hint.id}：「${hint.query}」と「${suggestion}」が表記ゆれ辞書にも登録されています`);
    }
  }
});

// --- 7. 役職名での検索（Phase199） -----------------------------------------
console.log("\nPhase199-7：役職名（議員・市議・市議会議員）での検索が、市民の入口を上位に出す");

/** 議員を探している人にとっての入口とみなすURL（現職議員一覧・議員比較・元議員一覧・議員在籍履歴）。 */
const MEMBER_ENTRY_URLS = new Set(["/people", "/compare/members", "/members/former", "/members/history"]);
/** 個々の現職議員ページ（/members/m01 等）。 */
const isCurrentMemberResult = (r) => r.entry.type === "member";

let roleRankingCheckCount = 0;
const roleRankingCheck = (label, fn) => {
  roleRankingCheckCount += 1;
  rankingCheckCount += 1;
  check(label, fn);
};

roleRankingCheck("「議員」「市議」「市議会議員」の上位20行に、議員を探す入口が2件以上出る", () => {
  const failures = [];
  for (const query of ["議員", "市議", "市議会議員"]) {
    const top = groupedTop(query, 20);
    const hits = top.filter((r) => MEMBER_ENTRY_URLS.has(r.entry.url) || isCurrentMemberResult(r));
    if (hits.length < 2) {
      failures.push(`「${query}」の上位20行の入口が${hits.length}件（${top.slice(0, 5).map((r) => r.entry.title).join(" / ")}）`);
    }
  }
  assert.equal(failures.length, 0, failures.join(" / "));
});

roleRankingCheck("「議員」の上位10行を元議員ページが占めない（Phase195の残課題）", () => {
  // 改善前は、タイトルに「（元議員）」を含むだけの元議員ページ58件が2〜10位を独占していた。
  const top10 = groupedTop("議員", 10);
  const formerInTop10 = top10.filter((r) => r.entry.type === "former-member");
  assert.equal(
    formerInTop10.length,
    0,
    `「議員」の上位10行に元議員ページが${formerInTop10.length}件あります（${formerInTop10.map((r) => r.entry.title).join(" / ")}）`,
  );
  // 現職議員は元議員より上位に出ること（「議員」は通常、今の議員を指す）。
  const rows = grouped("議員");
  const firstMember = rows.findIndex((g) => g.result.entry.type === "member");
  const firstFormer = rows.findIndex((g) => g.result.entry.type === "former-member");
  assert.ok(firstMember >= 0, "「議員」の結果に現職議員ページがありません");
  assert.ok(
    firstFormer === -1 || firstMember < firstFormer,
    `「議員」で元議員（${firstFormer + 1}行目）が現職議員（${firstMember + 1}行目）より上位です`,
  );
});

roleRankingCheck("元議員は検索結果から消えていない（順位だけの調整であること）", () => {
  const former = search("議員").filter((r) => r.entry.type === "former-member");
  assert.ok(former.length >= 50, `「議員」の結果に元議員が${former.length}件しかありません`);
  // 「元議員」で探せば上位に出ること
  const formerTop10 = groupedTop("元議員", 10);
  assert.ok(
    formerTop10.some((r) => r.entry.type === "former-member"),
    `「元議員」の上位10行に元議員ページがありません（${formerTop10.map((r) => r.entry.title).join(" / ")}）`,
  );
  // 元議員の氏名で検索すれば、その本人のページが1位であること
  const byName = search("福良 博");
  assert.ok(byName.length > 0, "元議員名「福良 博」が0件です");
  assert.equal(
    byName[0].entry.url,
    "/members/former/fm15",
    `元議員名の1位が本人ページではありません（${byName[0].entry.title}）`,
  );
});

roleRankingCheck("生成タイトルの肩書き（（元議員）（元市長））はタイトル一致として数えない", () => {
  // 「議員」で、肩書きを括弧書きで持つだけの人物ページが、その語を見出し語に持つページより上位に来ないこと。
  const rows = search("議員");
  const bestFormer = rows.find((r) => r.entry.type === "former-member");
  const bestMember = rows.find((r) => r.entry.type === "member");
  assert.ok(bestFormer && bestMember, "「議員」に現職議員・元議員の結果がありません");
  assert.ok(
    bestMember.score > bestFormer.score,
    `現職議員（${bestMember.score.toFixed(1)}点）が元議員（${bestFormer.score.toFixed(1)}点）以下です`,
  );
  // 一方で、氏名での検索は肩書きの有無に関わらず本人のページが1位であること（現市長は主ページ/mayorが1位）。
  assert.equal(search("三浦久知")[0].entry.url, "/mayor");
});

// --- 8. 同じURLを指す結果のまとめ（Phase199） ------------------------------
console.log("\nPhase199-8：同じページ（同じURL）を指す結果を1行にまとめる");

let duplicateFixCount = 0;

check("groupResultsByUrl：件数・並び順を保ったまま、同じURLを1行にまとめる", () => {
  const results = search("市議会議員");
  const groups = groupResultsByUrl(results);
  const total = groups.reduce((sum, g) => sum + 1 + g.others.length, 0);
  assert.equal(total, results.length, "まとめる前後で一致件数が変わっています（結果を捨てていないこと）");
  const urls = groups.map((g) => g.result.entry.url);
  assert.equal(new Set(urls).size, urls.length, "まとめた後もURLが重複しています");
  // 代表は、そのURLの中で最も上位（元の並び順で最初）の結果であること
  for (const g of groups) {
    for (const other of g.others) {
      assert.equal(other.entry.url, g.result.entry.url, "別のURLの結果がまとめられています");
      assert.ok(
        results.indexOf(g.result) < results.indexOf(other),
        `代表（${g.result.entry.title}）より上位の結果がまとめられています`,
      );
    }
  }
});

check("1ページ内の個別項目を索引化しているページは、検索結果で1行にまとまる", () => {
  // /history（市政年表の出来事）、/updates（更新履歴の各項目）、/compare/municipalities（自治体ごとの行）は、
  // ページ内に項目ごとのアンカーが無く、どの結果を押しても同じページの先頭へ遷移するため、
  // 複数行に分けても遷移先は増えない。まとめて1行にし、他の一致は行の中に残す。
  const cases = [
    { query: "台風", url: "/history" },
    { query: "更新履歴", url: "/updates" },
    { query: "比較データ", url: "/compare/municipalities" },
  ];
  for (const c of cases) {
    const results = search(c.query);
    const sameUrl = results.filter((r) => r.entry.url === c.url);
    assert.ok(sameUrl.length >= 2, `「${c.query}」で${c.url}を指す結果が${sameUrl.length}件しかありません（テストの前提）`);
    const groups = groupResultsByUrl(results).filter((g) => g.result.entry.url === c.url);
    assert.equal(groups.length, 1, `「${c.query}」で${c.url}が${groups.length}行に分かれています`);
    assert.equal(
      groups[0].others.length,
      sameUrl.length - 1,
      `${c.url}にまとめられた他の一致の件数が合いません`,
    );
    duplicateFixCount += sameUrl.length - 1;
  }
});

check("代表的な検索語で、まとめた後の上位20行に同じURLが二重に出ない", () => {
  const failures = [];
  for (const testCase of SEARCH_TEST_CASES) {
    const urls = groupedTop(testCase.query, 20).map((r) => r.entry.url);
    if (new Set(urls).size !== urls.length) failures.push(testCase.query);
  }
  assert.equal(failures.length, 0, `同じURLが重複している検索語: ${failures.join(" / ")}`);
});

check("まとめても0件になる検索語が無い（全テスト語で1行以上残る）", () => {
  const empty = SEARCH_TEST_CASES.filter((c) => grouped(c.query).length === 0).map((c) => c.query);
  assert.equal(empty.length, 0, `まとめた結果が0行になった検索語: ${empty.join(" / ")}`);
});

// --- 集計 ------------------------------------------------------------------
console.log("\nPhase195 検索品質サマリー");
console.log(`  検索テスト語数: ${SEARCH_TEST_CASES.length}`);
console.log(`  期待結果を満たした語数: ${expectationPassCount}`);
console.log(`  0件になった語数: ${emptyResultCount}`);
console.log(`  表記ゆれグループ数: ${dictionary.orthographicVariants.length}（表記対比検証 ${variantCheckCount}件）`);
console.log(`  言い換え案内（queryHints）数: ${dictionary.queryHints.length}`);
console.log(`  検索順位テスト数: ${rankingCheckCount}（うちPhase199の役職名検索 ${roleRankingCheckCount}件）`);
console.log(`  同じURLへまとめた重複結果の件数（テスト対象3ページの合計）: ${duplicateFixCount}`);

console.log(`\n✅ test-search-quality: ${passCount} checks passed\n`);
