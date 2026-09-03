/**
 * Phase135：サイト内の「件数」表示が実データとずれていないかを検証する軽量な回帰テスト。
 *
 * このプロジェクトには専用のテストランナー（vitest/jest等）が導入されていないため、
 * scripts/test-activity-radar.mjs と同じ「プレーンなNodeスクリプト＋assert」方式を踏襲する。
 *
 * ここでは2種類のチェックを行う。
 * 1. 過去に発見・修正した「固定文言のハードコード件数」が該当ファイルへ再度紛れ込んでいないかの
 *    退行防止チェック（該当ページのソースを直接grepし、修正前の文字列が存在しないことを確認する）。
 *    修正内容の一覧は scripts/generate-quality-summary.mjs の countConsistencyChecks を参照。
 * 2. 別々のJSONデータファイル間で「同じはずの件数」が一致しているかのクロスチェック
 *    （例：公約数と、公約進捗レコードが参照する公約IDの種類数）。
 *
 * 新しい不整合を見つけて修正した場合は、このファイルにもチェックを追記すること。
 *
 * 使い方: node scripts/test-count-consistency.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), "utf8");
const readJson = (relPath) => JSON.parse(readSrc(relPath));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

console.log("\n退行防止チェック（過去に修正した固定件数の再ハードコード検知）");

check("CouncilLeadershipHistoryPage.tsxのバナーに「議長6件・副議長11件」の固定文言が戻っていない", () => {
  const src = readSrc("src/pages/CouncilLeadershipHistoryPage.tsx");
  assert.ok(!/議長6件・副議長11件/.test(src), "固定文言「議長6件・副議長11件」が再び直書きされています");
  assert.ok(/\{chairs\.length\}/.test(src) && /\{viceChairs\.length\}/.test(src), "chairs.length／viceChairs.lengthを使った動的表示が見当たりません");
});

check("src/lib/seo.tsの/committees/leadership-history説明文に固定件数が戻っていない", () => {
  const src = readSrc("src/lib/seo.ts");
  assert.ok(!/議長6件・副議長11件/.test(src), "固定文言「議長6件・副議長11件」が再びseo.tsに直書きされています");
});

check("MayorsPage.tsxの空白期間注記に「13件」「2026年8月時点で」の固定文言が戻っていない", () => {
  const src = readSrc("src/pages/MayorsPage.tsx");
  assert.ok(!/2026年8月時点で\d+件の空白期間/.test(src), "固定文言「2026年8月時点で13件の空白期間」が再び直書きされています");
  assert.ok(/現時点で\{termGapCount\}件の空白期間/.test(src), "termGapCountを使った動的表示が見当たりません");
  assert.ok(/findMayorTermGaps/.test(src), "共通関数findMayorTermGapsの利用が見当たりません");
});

check("HistoryPage.tsxの「大きな転換点」注記に「152件」の固定文言が戻っていない", () => {
  const src = readSrc("src/pages/HistoryPage.tsx");
  assert.ok(!/152件の記録/.test(src), "固定文言「152件の記録」が再び直書きされています");
  assert.ok(/\{allEvents\.length\}件の記録/.test(src), "allEvents.lengthを使った動的表示が見当たりません");
});

console.log("\nクロスファイル件数整合性チェック");

check("市長公約（mayorPromises.json）の件数と、公約進捗（mayorPromiseMeasures.json）が参照する公約IDの種類数が一致する", () => {
  const promises = readJson("src/data/mayorPromises.json").promises;
  const measures = readJson("src/data/mayorPromiseMeasures.json");
  const referencedPromiseIds = new Set(measures.map((m) => m.promiseId));
  const promiseIds = new Set(promises.map((p) => p.id));
  assert.equal(promises.length, promiseIds.size, "mayorPromises.jsonにID重複があります");
  for (const id of referencedPromiseIds) {
    assert.ok(promiseIds.has(id), `mayorPromiseMeasures.jsonが未定義の公約ID「${id}」を参照しています`);
  }
  assert.equal(
    referencedPromiseIds.size,
    promiseIds.size,
    `公約数（${promiseIds.size}件）と、進捗レコードが参照する公約の種類数（${referencedPromiseIds.size}件）が一致しません（進捗が1件も登録されていない公約がある可能性）`,
  );
});

/**
 * Phase202：市長公約の「政策分野／個別公約／個別施策」の3階層について、
 * (1) データ側の件数がファイルをまたいで一致すること
 * (2) 表示側が単一情報源（src/lib/mayorPromiseTerms.ts）だけを参照し、
 *     件数・呼称をページごとに直書きしていないこと
 * を検証する。1つでも崩れると、ページごとに違う数字が「市長公約◯件」として並ぶ。
 */
const MAYOR_PROMISE_TERMS_FILE = "src/lib/mayorPromiseTerms.ts";
/** 市長公約の3階層を表示するページ・モジュール。すべて単一情報源を参照していること。 */
const MAYOR_PROMISE_DISPLAY_FILES = [
  "src/pages/HomePage.tsx",
  "src/pages/DashboardPage.tsx",
  "src/pages/MayorPage.tsx",
  "src/pages/MayorPolicyProgressPage.tsx",
  "src/pages/DataStatusPage.tsx",
  "src/lib/seo.ts",
];

check("市長公約の政策分野数が、mayorPromises.json（categories）・mayorPolicyProgress.json（policies）・mayor.json（pledges）の3ファイルで一致する", () => {
  const categories = readJson("src/data/mayorPromises.json").categories;
  const policies = readJson("src/data/mayorPolicyProgress.json").policies;
  const pledges = readJson("src/data/mayor.json").pledges;
  const categoryIds = categories.map((c) => c.id).sort();
  assert.equal(new Set(categoryIds).size, categories.length, "mayorPromises.jsonのcategoriesにID重複があります");
  assert.deepEqual(
    policies.map((p) => p.id).sort(),
    categoryIds,
    `政策分野のIDがmayorPolicyProgress.json（${policies.length}件）とmayorPromises.json（${categories.length}件）で一致しません`,
  );
  assert.deepEqual(
    pledges.map((p) => p.id).sort(),
    categoryIds,
    `政策分野のIDがmayor.jsonのpledges（${pledges.length}件）とmayorPromises.json（${categories.length}件）で一致しません`,
  );
});

check("全ての個別公約が実在する政策分野に属し、categoryTitleが政策分野のtitleと一致する（表示上だけ別名になるのを防ぐ）", () => {
  const { categories, promises } = readJson("src/data/mayorPromises.json");
  const titleById = new Map(categories.map((c) => [c.id, c.title]));
  for (const p of promises) {
    assert.ok(titleById.has(p.categoryId), `個別公約「${p.id}」が未定義の政策分野「${p.categoryId}」を参照しています`);
    assert.equal(
      p.categoryTitle,
      titleById.get(p.categoryId),
      `個別公約「${p.id}」のcategoryTitleが政策分野「${p.categoryId}」のtitleと一致しません`,
    );
  }
});

check("全ての個別施策のcategoryIdが、紐づく個別公約のcategoryIdと一致する（政策分野別に数えたとき合計がずれるのを防ぐ）", () => {
  const promises = readJson("src/data/mayorPromises.json").promises;
  const measures = readJson("src/data/mayorPromiseMeasures.json");
  const categoryByPromiseId = new Map(promises.map((p) => [p.id, p.categoryId]));
  for (const m of measures) {
    assert.ok(
      categoryByPromiseId.has(m.promiseId),
      `個別施策「${m.measureId}」が未定義の個別公約「${m.promiseId}」を参照しています`,
    );
    assert.equal(
      m.categoryId,
      categoryByPromiseId.get(m.promiseId),
      `個別施策「${m.measureId}」のcategoryIdが、個別公約「${m.promiseId}」の政策分野と一致しません`,
    );
  }
  const perCategoryTotal = new Set(measures.map((m) => m.categoryId)).size;
  assert.ok(perCategoryTotal > 0, "個別施策のcategoryIdが1件も設定されていません");
});

check(`${MAYOR_PROMISE_TERMS_FILE} が3階層の件数をすべてデータから算出しており、固定値を持たない`, () => {
  const src = readSrc(MAYOR_PROMISE_TERMS_FILE);
  for (const expr of ["promisesData.categories.length", "promisesData.promises.length", "promiseMeasures.length"]) {
    assert.ok(src.includes(expr), `${MAYOR_PROMISE_TERMS_FILE} に ${expr} による自動算出が見当たりません`);
  }
  const countsBlock = src.slice(src.indexOf("export const mayorPromiseCounts"));
  assert.ok(
    !/:\s*\d+\s*,/.test(countsBlock.slice(0, countsBlock.indexOf("} as const"))),
    "mayorPromiseCountsに件数の固定値が直書きされています",
  );
  for (const level of ["policyArea", "promise", "measure"]) {
    assert.ok(src.includes(`${level}: {`), `MAYOR_PROMISE_LEVELS に「${level}」の定義が見当たりません`);
  }
});

check("市長公約の3階層を表示する全ページが、単一情報源（mayorPromiseTerms）を参照している", () => {
  for (const file of MAYOR_PROMISE_DISPLAY_FILES) {
    const src = readSrc(file);
    assert.ok(
      /from "\.\.?\/lib\/mayorPromiseTerms"|from "\.\/mayorPromiseTerms"/.test(src),
      `${file} が src/lib/mayorPromiseTerms.ts を参照していません（ページ独自に件数を数えている可能性があります）`,
    );
  }
});

check("市長公約の件数（政策分野・個別公約・個別施策）が、どのページにも固定値で直書きされていない", () => {
  const { categories, promises } = readJson("src/data/mayorPromises.json");
  const measures = readJson("src/data/mayorPromiseMeasures.json");
  const counts = [categories.length, promises.length, measures.length];
  for (const file of [...MAYOR_PROMISE_DISPLAY_FILES, "src/pages/MayorPromiseDetailPage.tsx"]) {
    const src = readSrc(file);
    for (const n of counts) {
      for (const pattern of [`公約${n}件`, `${n}件の公約`, `公約は${n}件`, `${n}つの公約`, `施策${n}件`, `${n}件の施策`]) {
        assert.ok(!src.includes(pattern), `${file} に固定文言「${pattern}」が直書きされています`);
      }
    }
  }
});

check("市長公約の旧ラベル（ページごとに別名だった表記）が復活していない", () => {
  // Phase202以前は同じ「市長公約」という言葉のまま、ページごとに数えている対象が違った。
  const OBSOLETE_LABELS = [
    "登録済み市長公約数",
    "市長公約の登録数",
    "進捗を確認できる公約項目数",
    "マニフェストの大項目",
    "マニフェスト上の大項目数",
    'label="公約分野"',
    'label="全公約数"',
    'label="個別公約数"',
    'label="個別施策数"',
  ];
  for (const file of MAYOR_PROMISE_DISPLAY_FILES) {
    const src = readSrc(file);
    for (const label of OBSOLETE_LABELS) {
      assert.ok(!src.includes(label), `${file} に統一前のラベル「${label}」が再び現れています`);
    }
  }
});

check("歴代議長・副議長（archiveCouncilLeadership.json）の議長件数＋副議長件数が総件数と一致する（role列挙の抜け漏れ検知）", () => {
  const rows = readJson("src/data/archiveCouncilLeadership.json");
  const chairs = rows.filter((r) => r.role === "議長").length;
  const viceChairs = rows.filter((r) => r.role === "副議長").length;
  assert.equal(chairs + viceChairs, rows.length, "role値が「議長」「副議長」以外のレコードが混入しています");
});

check("歴代市長（archiveMayors.json）の全レコードに、任期（archiveMayorTerms.json）が最低1件は存在する、または『確認中』相当のstatusである", () => {
  const mayors = readJson("src/data/archiveMayors.json");
  const terms = readJson("src/data/archiveMayorTerms.json");
  const mayorIdsWithTerms = new Set(terms.map((t) => t.mayorId));
  const orphanMayors = mayors.filter((m) => !mayorIdsWithTerms.has(m.id) && m.status !== "unknown");
  assert.equal(
    orphanMayors.length,
    0,
    `任期が1件も登録されておらずstatusも「unknown」でない市長があります：${orphanMayors.map((m) => m.name).join("、")}`,
  );
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
