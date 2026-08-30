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
