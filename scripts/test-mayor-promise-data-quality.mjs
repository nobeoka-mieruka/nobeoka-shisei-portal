/**
 * Phase266：市長公約データの「整備状況」集計（src/lib/mayorPromiseDataQuality.ts）の退行防止テスト。
 *
 * このプロジェクトには専用のテストランナー（vitest/jest等）が無いため、既存の
 * scripts/test-mayor-promise-tracking.mjs と同じ「プレーンなNodeスクリプト＋assert」方式に従う。
 *
 * ■ このテストで守ること
 * 1. 集計値が固定値になっていないこと。
 *    根拠資料を1件消す・進捗履歴を消す・個別施策を消す・確認状態を変える、といった
 *    故障注入を行い、集計値がその分だけ正しく変化することを確認する
 *    （「100%」と書いてあるだけの画面にならないようにするための検証）。
 * 2. 「データ整備状況」と「公約の達成度」を混同する表現が入り込まないこと。
 *    集計モジュールと /data-status の表示に「達成率」「公約達成」「市長評価」等の語を使わない。
 * 3. 掲載率が画面の実体と一致すること。
 *    生成済みの sitemap.xml がある場合は、全個別公約の詳細ページURLが実際に含まれることを確認する
 *    （データ側だけ増えて詳細ページが公開されていない、という食い違いの検出）。
 *
 * 実行方法の都合：
 * src/lib/mayorPromiseDataQuality.ts はJSON importを持たないが、拡張子なしの相対import
 * （"./completeness" 等）をNode ESM単体では解決できない。既存の
 * scripts/test-timeline-source-inheritance.mjs と同じ方式で、一時ディレクトリへ依存モジュールごと
 * 複製し、相対importへ .ts を補ってから読み込む（src配下の元ファイルは書き換えない）。
 *
 * 使い方: node --experimental-strip-types scripts/test-mayor-promise-data-quality.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
const readText = (relPath) => readFileSync(join(ROOT, relPath), "utf8");

// mayorPromiseDataQuality.ts と、それが値としてimportする依存モジュール（いずれもJSON importを持たない）。
const MODULE_FILES = [
  "src/lib/completeness.ts",
  "src/lib/mayorPromiseLinkage.ts",
  "src/lib/mayorPromiseDataQuality.ts",
];
const tmpDir = mkdtempSync(join(tmpdir(), "promise-data-quality-test-"));
for (const relPath of MODULE_FILES) {
  // Windowsのcore.autocrlf対策でLFへ正規化してから加工する（元ファイルは変更しない）。
  const source = readText(relPath).replace(/\r\n/g, "\n");
  const patched = source.replace(/from "(\.\.?\/[^".]*)"/g, 'from "$1.ts"');
  const dest = join(tmpDir, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, patched);
}
const { computeMayorPromiseDataQuality, countBrokenPromiseSourceUrls } = await import(
  pathToFileURL(join(tmpDir, "src/lib/mayorPromiseDataQuality.ts")),
);

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const promisesData = readJson("src/data/mayorPromises.json");
const measures = readJson("src/data/mayorPromiseMeasures.json");
const measuresIndex = readJson("src/data/mayorPromiseMeasuresIndex.json");

/** 実データから集計する（引数はすべて実データ。テスト内で件数を直書きしない）。 */
function compute(overrides = {}) {
  return computeMayorPromiseDataQuality({
    promises: promisesData.promises,
    categories: promisesData.categories,
    documents: promisesData.documents,
    measures,
    referenceDate: promisesData.referenceDate,
    ...overrides,
  });
}

/** 故障注入用。元データを壊さないよう毎回ディープコピーしてから書き換える。 */
const clone = (value) => JSON.parse(JSON.stringify(value));

const base = compute();

console.log("\n市長公約データの整備状況（実データからの再計算、固定値は使わない）");
console.log(`  政策分野：${base.totals.policyArea}件／個別公約：${base.totals.promise}件／個別施策：${base.totals.measure}件`);
for (const [key, m] of Object.entries(base.metrics)) {
  console.log(`  ${m.label}（${key}）：${m.metric.collected}／${m.metric.totalKnown}件`);
}
for (const m of base.optionalFields) {
  console.log(`  ${m.label}：${m.metric.collected}／${m.metric.totalKnown}件`);
}
console.log(`  変更履歴の総記録数：${base.changeHistoryEntryTotal}件`);
console.log(`  追加の公式資料確認が必要な個別公約：${base.verification.pendingPromiseCount}件`);

console.log("\n項目1：集計の前提（件数・参照整合）");

check("集計対象の件数は、公約データ・個別施策データの実件数と一致する", () => {
  assert.equal(base.totals.policyArea, promisesData.categories.length);
  assert.equal(base.totals.promise, promisesData.promises.length);
  assert.equal(base.totals.measure, measures.length);
  // 軽量インデックス（seo.ts等が使う）と元データの件数が食い違っていないことも併せて確認する。
  assert.equal(measuresIndex.length, measures.length, "mayorPromiseMeasuresIndex.jsonの件数が元データと一致しません");
});

check("すべての指標で、分母は個別公約の総数であり、分子が分母を超えない", () => {
  for (const m of [...Object.values(base.metrics), ...base.optionalFields]) {
    assert.equal(m.metric.totalKnown, promisesData.promises.length, `${m.label}の分母が個別公約総数と異なります`);
    assert.ok(m.metric.collected <= m.metric.totalKnown, `${m.label}の分子が分母を超えています`);
    assert.equal(m.metric.collected + m.missingPromiseIds.length, m.metric.totalKnown, `${m.label}の内訳が合いません`);
    assert.ok(m.metric.coverageRate >= 0 && m.metric.coverageRate <= 100, `${m.label}の率が0〜100の範囲外です`);
  }
});

check("存在しない根拠資料キーを参照している公約は無い（validate:dataと同じ参照整合をここでも確認）", () => {
  assert.deepEqual(base.sourceDocuments.unresolvedKeys, []);
});

console.log("\n項目2：掲載率（詳細ページが実際に公開されているか）");

check("詳細ページに必要な項目が全個別公約で揃っている（掲載率の分子＝個別公約総数）", () => {
  assert.equal(base.metrics.publication.metric.collected, promisesData.promises.length);
  assert.deepEqual(base.metrics.publication.missingPromiseIds, []);
});

check("sitemap.xmlに全個別公約の詳細ページURLが含まれる（生成済みの場合のみ検証）", () => {
  const sitemapPath = join(ROOT, "public", "sitemap.xml");
  if (!existsSync(sitemapPath)) {
    console.log("    （public/sitemap.xml が未生成のためスキップ：npm run generate:sitemap 後に検証されます）");
    return;
  }
  const sitemap = readFileSync(sitemapPath, "utf8");
  const missing = promisesData.promises
    .map((p) => `/mayor/policy-progress/${p.id}`)
    .filter((path) => !sitemap.includes(`${path}<`));
  assert.deepEqual(missing, [], `sitemapに詳細ページURLが無い個別公約があります: ${missing.join("、")}`);
});

console.log("\n項目3：各指標が実データと一致する（別の数え方で再計算して突き合わせる）");

check("根拠資料（延岡市の公表資料）付与率は、資料一覧のsourceTypeから独立に数えた件数と一致する", () => {
  const cityKeys = new Set(
    promisesData.documents.filter((d) => (d.sourceType ?? "").startsWith("延岡市公式資料")).map((d) => d.key),
  );
  const expected = promisesData.promises.filter((p) =>
    (p.evidenceItems ?? []).some((e) => cityKeys.has(e.documentKey)),
  ).length;
  assert.equal(base.metrics.cityOfficialSource.metric.collected, expected);
});

check("変更履歴付与率は、最終確認日ではなく進捗履歴（日付＋出典URL）の有無で数えている", () => {
  const expected = promisesData.promises.filter((p) =>
    (p.progressHistory ?? []).some((h) => h.date && h.sourceUrl),
  ).length;
  assert.equal(base.metrics.changeHistory.metric.collected, expected);
  // lastVerified は全公約にあるため、それを基準に数えていたら件数は総数と一致してしまう。
  const withLastVerified = promisesData.promises.filter((p) => p.lastVerified).length;
  assert.ok(
    base.metrics.changeHistory.metric.collected <= withLastVerified,
    "変更履歴の件数が最終確認日ベースの件数を超えています",
  );
});

check("対象年度の付与率は、個別施策のfiscalYearから数えている", () => {
  const promiseIdsWithFy = new Set(measures.filter((m) => m.fiscalYear).map((m) => m.promiseId));
  const expected = promisesData.promises.filter((p) => promiseIdsWithFy.has(p.id)).length;
  assert.equal(base.metrics.fiscalYear.metric.collected, expected);
});

check("追加の公式資料確認が必要な個別公約の件数・IDは、確認待ちの資料別内訳と整合する", () => {
  const groupTotal = base.verification.awaitingBudgetSourceGroups.reduce((sum, g) => sum + g.promiseIds.length, 0);
  assert.equal(groupTotal, base.verification.budget.awaitingSource, "資料別内訳の合計が予算側の資料待ち件数と一致しません");
  const pendingIds = new Set(base.verification.pending.map((item) => item.promiseId));
  assert.equal(base.verification.pendingPromiseCount, pendingIds.size);
  for (const g of base.verification.awaitingBudgetSourceGroups) {
    for (const id of g.promiseIds) {
      assert.ok(pendingIds.has(id), `資料待ちの公約${id}が確認待ち一覧に含まれていません`);
    }
  }
});

check("基準日・最終確認日・対象年度をそれぞれ別の値として保持している", () => {
  assert.equal(base.asOf.referenceDate, promisesData.referenceDate);
  assert.match(base.asOf.latestPromiseVerified, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(base.asOf.latestMeasureSnapshot, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(base.asOf.fiscalYears.length > 0, "個別施策の対象年度が1件も取得できていません");
});

console.log("\n項目4：故障注入（集計が固定値になっていないことの確認）");

check("根拠資料の紐付けを1件の公約から取り除くと、根拠資料付与率の分子が1件減る", () => {
  const promises = clone(promisesData.promises);
  const target = promises.find((p) => (p.evidenceItems ?? []).length > 0);
  target.evidenceItems = [];
  const injected = compute({ promises });
  assert.equal(injected.metrics.cityOfficialSource.metric.collected, base.metrics.cityOfficialSource.metric.collected - 1);
  assert.ok(injected.metrics.cityOfficialSource.missingPromiseIds.includes(target.id));
  assert.ok(
    injected.metrics.cityOfficialSource.metric.coverageRate < base.metrics.cityOfficialSource.metric.coverageRate,
    "根拠資料を消しても付与率が下がっていません（固定値の疑い）",
  );
});

check("存在しない根拠資料キーへ書き換えると、未解決キーとして検出され付与率も下がる", () => {
  const promises = clone(promisesData.promises);
  const target = promises.find((p) => (p.evidenceItems ?? []).length > 0);
  target.evidenceItems = [{ documentKey: "not_existing_document_key" }];
  const injected = compute({ promises });
  assert.deepEqual(injected.sourceDocuments.unresolvedKeys, ["not_existing_document_key"]);
  assert.equal(injected.metrics.cityOfficialSource.metric.collected, base.metrics.cityOfficialSource.metric.collected - 1);
});

check("進捗履歴を1件の公約から取り除くと、変更履歴付与率の分子と総記録数が減る", () => {
  const promises = clone(promisesData.promises);
  const target = promises.find((p) => (p.progressHistory ?? []).length > 0);
  const removedEntries = target.progressHistory.length;
  target.progressHistory = [];
  const injected = compute({ promises });
  assert.equal(injected.metrics.changeHistory.metric.collected, base.metrics.changeHistory.metric.collected - 1);
  assert.equal(injected.changeHistoryEntryTotal, base.changeHistoryEntryTotal - removedEntries);
});

check("進捗履歴から出典URLだけを消すと「変更履歴あり」に数えない（日付だけでは確認済みにしない）", () => {
  const promises = clone(promisesData.promises);
  const target = promises.find((p) => (p.progressHistory ?? []).length > 0);
  for (const h of target.progressHistory) delete h.sourceUrl;
  const injected = compute({ promises });
  assert.equal(injected.metrics.changeHistory.metric.collected, base.metrics.changeHistory.metric.collected - 1);
});

check("個別施策を1件の公約から取り除くと、対象年度の付与率と個別施策の一次資料付与率が下がる", () => {
  const targetId = measures[0].promiseId;
  const injected = compute({ measures: measures.filter((m) => m.promiseId !== targetId) });
  assert.equal(injected.metrics.fiscalYear.metric.collected, base.metrics.fiscalYear.metric.collected - 1);
  assert.equal(
    injected.metrics.measurePrimarySource.metric.collected,
    base.metrics.measurePrimarySource.metric.collected - 1,
  );
  assert.ok(injected.metrics.fiscalYear.missingPromiseIds.includes(targetId));
});

check("個別施策の一次資料（trustLevel）を下げると、個別施策の一次資料付与率が下がる", () => {
  const injected = compute({
    measures: measures.map((m, i) => (i === 0 ? { ...m, trustLevel: "SECONDARY" } : m)),
  });
  assert.equal(
    injected.metrics.measurePrimarySource.metric.collected,
    base.metrics.measurePrimarySource.metric.collected - 1,
  );
});

check("予算の確認状態を「確認中」へ戻すと、追加確認が必要な公約数が増える", () => {
  const promises = clone(promisesData.promises);
  const target = promises.find((p) => !p.relatedBudget.startsWith("確認中"));
  target.relatedBudget = "確認中";
  const injected = compute({ promises });
  assert.ok(
    injected.verification.pendingPromiseCount >= base.verification.pendingPromiseCount,
    "確認状態を未確認へ戻しても、追加確認が必要な件数が増えていません",
  );
  assert.ok(
    injected.verification.budget.confirmedAmount + injected.verification.budget.amountInRelatedBills <
      base.verification.budget.confirmedAmount + base.verification.budget.amountInRelatedBills,
    "確認状態を未確認へ戻しても、確認済み件数が減っていません",
  );
});

check("政策分野の参照が切れた公約は、掲載率の分子から外れる", () => {
  const promises = clone(promisesData.promises);
  promises[0].categoryId = "not_existing_category";
  const injected = compute({ promises });
  assert.equal(injected.metrics.publication.metric.collected, base.metrics.publication.metric.collected - 1);
});

check("リンク切れ資料の件数は、外部リンク監査の結果から数える（該当なしなら0件）", () => {
  assert.equal(countBrokenPromiseSourceUrls(promisesData.documents, []), 0);
  const firstUrl = promisesData.documents[0].url;
  assert.equal(countBrokenPromiseSourceUrls(promisesData.documents, [firstUrl]), 1);
});

console.log("\n項目5：データ整備状況と公約の達成度を混同する表現を作らない");

const FORBIDDEN_TERMS = ["達成率", "公約達成", "市長評価", "信頼度スコア", "品質スコア", "品質点"];

check("集計モジュールに、達成度と誤解される語・独自の総合スコアが含まれない", () => {
  const source = readText("src/lib/mayorPromiseDataQuality.ts");
  for (const term of FORBIDDEN_TERMS) {
    // コメント中の「〜という意味ではない」という否定形の説明は許容するため、
    // 否定文脈（「ではない」「使わない」「混同」）を含む行は除外して判定する。
    const offending = source
      .split("\n")
      .filter((line) => line.includes(term))
      .filter((line) => !/ではない|使わない|混同|禁止/.test(line));
    assert.deepEqual(offending, [], `集計モジュールに「${term}」が使われています`);
  }
  assert.ok(!/score|Score/.test(source), "集計モジュールに総合スコア（score）が導入されています");
});

check("/data-status の公約整備状況セクションが、達成度ではないことを明示している", () => {
  const page = readText("src/pages/DataStatusPage.tsx");
  assert.ok(
    page.includes("mayorPromiseDataQuality") || page.includes("computeMayorPromiseDataQuality"),
    "/data-status が公約データの整備状況集計を使っていません",
  );
  assert.ok(
    page.includes("市長が公約をどこまで達成したか"),
    "/data-status に「達成度ではない」旨の説明がありません",
  );
});

console.log(`\n${passCount}件のチェックがすべて成功しました。`);
