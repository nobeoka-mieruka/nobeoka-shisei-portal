/**
 * Phase228：出典欄で「報道」を一次資料と同列に見せないことを固定する回帰テスト。
 *
 * 背景：延岡市・延岡市議会の一次資料と、新聞記事・事典（Wikipedia・コトバンク）が、
 * `/mayors/:slug`・`/timeline`・`/history` 等の「出典・確認状況」欄に同じ見た目で
 * 並んでいた。当サイトの編集方針では報道は一次資料ではないため、根拠資料と同列に
 * 見えてはならない。
 *
 * このテストが固定すること：
 *   1. 実データに登録済みの報道出典が、すべて "news" に分類される（取りこぼさない）
 *   2. 延岡市・延岡市議会・総務省等の公的機関の出典は、報道・事典に分類されない（誤ラベルを付けない）
 *   3. Wikipedia・コトバンクは、記事内の参考文献に新聞名が書かれていても "reference" のままにする
 *   4. 表示ラベルは色に頼らず「一次資料ではありません」と文字で述べる
 *   5. 出典を描画するコンポーネント・ページが、この判定を実際に使っている
 *
 * `sourceMedium.ts` は他モジュールをimportしないため、複製せず直接読み込める。
 *
 * 使い方: node --experimental-strip-types scripts/test-source-medium-labeling.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), "utf8");

const { classifySourceMedium, sourceMediumLabel, SOURCE_MEDIUM_LABEL } = await import(
  pathToFileURL(join(ROOT, "src/lib/sourceMedium.ts")).href
);

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

/** src/data配下の全JSONから、画面の出典欄に並ぶレコード（sourceRefs / sources）を集める。 */
function collectSourceRecords() {
  const dataDir = join(ROOT, "src/data");
  const records = [];
  for (const file of readdirSync(dataDir).filter((f) => f.endsWith(".json"))) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(dataDir, file), "utf8"));
    } catch {
      continue;
    }
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      for (const key of ["sourceRefs", "sources"]) {
        if (!Array.isArray(node[key])) continue;
        for (const ref of node[key]) {
          if (!ref || typeof ref !== "object") continue;
          records.push({
            file,
            sourceOrganization: ref.sourceOrganization ?? null,
            sourceTitle: ref.sourceTitle ?? null,
            label: ref.label ?? null,
          });
        }
      }
      for (const value of Object.values(node)) walk(value);
    };
    walk(parsed);
  }
  return records;
}

const records = collectSourceRecords();
console.log(`\nPhase228：出典の媒体区分（報道・事典・公的資料）`);
console.log(`対象レコード数：${records.length}件（src/data配下のsourceRefs／sources）`);

check("実データに登録済みの報道出典が1件以上あり、すべて「報道」に分類される（報道が一次資料に混ざったまま公開されない）", () => {
  const newsWords = /宮崎日日新聞|夕刊デイリー|読売新聞|西日本新聞|Miyanichi/;
  const secondaryWords = /Wikipedia|コトバンク/;
  const expectedNews = records.filter((r) => {
    const text = [r.sourceOrganization, r.sourceTitle, r.label].filter(Boolean).join(" ");
    return newsWords.test(text) && !secondaryWords.test(text);
  });
  assert.ok(expectedNews.length > 0, "報道出典が1件も見つからない。検出条件かデータの前提が変わっている");
  const missed = expectedNews.filter((r) => classifySourceMedium(r) !== "news");
  assert.equal(
    missed.length,
    0,
    `報道として分類されなかった出典: ${missed.map((r) => `${r.file}:${r.sourceTitle ?? r.label}`).join("、")}`,
  );
});

check("公的機関（延岡市・延岡市議会・総務省・選挙管理委員会・宮崎県統計課等）の出典に、報道・事典のラベルを付けない（誤ラベルを出さない）", () => {
  const official = /^(延岡市|延岡市議会|延岡市選挙管理委員会|延岡市監査委員|総務省|宮崎県|全国市議会議長会|国立国会図書館)/;
  const mislabeled = records.filter(
    (r) => r.sourceOrganization && official.test(r.sourceOrganization) && classifySourceMedium(r) !== "unclassified",
  );
  assert.equal(
    mislabeled.length,
    0,
    `公的機関の出典に媒体ラベルが付いた: ${mislabeled.map((r) => `${r.file}:${r.sourceOrganization}`).join("、")}`,
  );
});

check("Wikipedia・コトバンクは、記事内の参考文献に新聞名が挙がっていても「報道」ではなく「事典・百科事典」に分類する", () => {
  assert.equal(
    classifySourceMedium({
      sourceOrganization: "Wikipedia（記事内に「全国歴代知事・市長総覧」（日外アソシエーツ、2022年）・西日本新聞等の出典が明記されている）",
      sourceTitle: "首藤正治 - Wikipedia",
    }),
    "reference",
  );
  assert.equal(classifySourceMedium({ sourceTitle: "仲田又次郎 - コトバンク" }), "reference");
});

check("媒体ラベルは、色ではなく文字で「一次資料ではありません」と述べる", () => {
  for (const [medium, label] of Object.entries(SOURCE_MEDIUM_LABEL)) {
    assert.ok(label.includes("一次資料ではありません"), `${medium} のラベルに「一次資料ではありません」が含まれない: ${label}`);
  }
  assert.equal(sourceMediumLabel({ sourceOrganization: "宮崎日日新聞社" }), SOURCE_MEDIUM_LABEL.news);
});

check("判定できない出典にはラベルを付けない（「一次資料である」と断定しない）", () => {
  assert.equal(classifySourceMedium({}), "unclassified");
  assert.equal(sourceMediumLabel({ sourceOrganization: "延岡市" }), null);
});

check("出典を描画するコンポーネント・ページが、この判定を実際に使っている（判定だけ作って未接続にしない）", () => {
  const consumers = [
    "src/components/SourceRefList.tsx",
    "src/components/compare/CompareSourceNotice.tsx",
    "src/pages/HistoryPage.tsx",
  ];
  const notWired = consumers.filter((f) => !/sourceMediumLabel/.test(readSrc(f)));
  assert.equal(notWired.length, 0, `sourceMediumLabelを使っていない出典表示: ${notWired.join("、")}`);
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
