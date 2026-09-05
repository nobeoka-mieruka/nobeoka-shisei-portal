/**
 * Phase230-231：「宮崎県の事業」を「延岡市の事業」と誤読させないことを固定する回帰テスト。
 *
 * 背景：市政年表には、県立学校・県立病院の整備や、宮崎県が主催し延岡市が参加した催しなど、
 * 延岡市の事業ではない出来事が含まれる。区別が無いまま同じ体裁で並べると、市民に
 * 「延岡市がやったこと」と誤読される（Phase226・228の指摘）。
 *
 * このテストが固定すること：
 *   1. implementation の区分値が、型定義（src/types/implementationAttribution.ts）の値と一致する
 *   2. attributionSourceUrl が、必ずそのレコードの sourceRefs に含まれる（根拠のない区分を作らない）
 *   3. 「延岡市の事業」は implementingBody=nobeokaCity のときだけ表示される
 *   4. 共同実施（joint）は、実施主体と延岡市との関係の双方が共同のときだけ成立する
 *   5. 未設定（＝未確認）を「延岡市の事業」として扱わない。全件への一括付与も行っていない
 *   6. 実施主体を表示するページが、この注記コンポーネントを実際に使っている
 *   7. 宮崎県の予算額・県議会の議決結果が、延岡市の財政・議案データへ混入していない
 *
 * 使い方: node --experimental-strip-types scripts/test-implementation-attribution.mjs
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

const events = readJson("src/data/civicTimelineEvents.json");
const withAttribution = events.filter((e) => e.implementation);
const typeSource = readSrc("src/types/implementationAttribution.ts");
const labelSource = readSrc("src/lib/implementationAttribution.ts");

/** 型定義から区分値（"..." で列挙されたユニオン）を取り出す。 */
function unionValues(typeName) {
  const match = typeSource.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`));
  assert.ok(match, `${typeName} の定義が見つかりません`);
  return new Set([...match[1].matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]));
}

const BODIES = unionValues("ImplementingBody");
const SCOPES = unionValues("ImplementationScope");
const RELATIONS = unionValues("NobeokaRelation");

check("実施主体の区分値が型定義と一致する（未定義の区分をデータへ書かない）", () => {
  assert.ok(BODIES.has("miyazakiPrefecture") && BODIES.has("nobeokaCity"), "主要な区分が型定義に無い");
  for (const ev of withAttribution) {
    const impl = ev.implementation;
    assert.ok(BODIES.has(impl.implementingBody), `${ev.id}: 未定義のimplementingBody ${impl.implementingBody}`);
    assert.ok(RELATIONS.has(impl.nobeokaRelation), `${ev.id}: 未定義のnobeokaRelation ${impl.nobeokaRelation}`);
    if (impl.implementationScope !== undefined) {
      assert.ok(SCOPES.has(impl.implementationScope), `${ev.id}: 未定義のimplementationScope ${impl.implementationScope}`);
    }
  }
});

check("実施主体の根拠URLが、必ずその出来事の出典に含まれる（根拠のない区分を作らない）", () => {
  for (const ev of withAttribution) {
    const urls = (ev.sourceRefs ?? []).map((s) => s.url);
    assert.ok(
      urls.includes(ev.implementation.attributionSourceUrl),
      `${ev.id}: attributionSourceUrl が sourceRefs に含まれない`,
    );
  }
});

check("「延岡市の事業」は実施主体が延岡市のときだけ（開催地が延岡市でも県の事業を市の事業にしない）", () => {
  for (const ev of withAttribution) {
    const { implementingBody, nobeokaRelation } = ev.implementation;
    if (nobeokaRelation === "cityProject") {
      assert.equal(implementingBody, "nobeokaCity", `${ev.id}: cityProject なのに実施主体が延岡市ではない`);
    }
    if (implementingBody === "nobeokaCity") {
      assert.equal(nobeokaRelation, "cityProject", `${ev.id}: 実施主体が延岡市なのに関係が cityProject ではない`);
    }
  }
  // 宮崎県が主体の出来事は、延岡市で開催されていても「延岡市の事業」にならない。
  const prefectural = withAttribution.filter((e) => e.implementation.implementingBody === "miyazakiPrefecture");
  assert.ok(prefectural.length > 0, "県が主体の出来事が1件も分類されていない");
  for (const ev of prefectural) {
    assert.notEqual(ev.implementation.nobeokaRelation, "cityProject", `${ev.id}: 県の事業が市の事業になっている`);
  }
});

check("共同実施は、実施主体と延岡市との関係の双方が共同のときだけ成立する（推測でjointにしない）", () => {
  for (const ev of withAttribution) {
    const { implementingBody, nobeokaRelation } = ev.implementation;
    assert.equal(
      implementingBody === "cityPrefectureJoint",
      nobeokaRelation === "cityPrefectureJoint",
      `${ev.id}: 共同実施の指定が片方だけになっている`,
    );
  }
});

check("未確認（未設定）を「延岡市の事業」として扱わず、全件への一括付与も行っていない", () => {
  assert.ok(withAttribution.length > 0, "実施主体を確認できた出来事が1件も無い");
  assert.ok(
    withAttribution.length < events.length,
    "全件へ実施主体が付与されている（一次資料で確認できない出来事まで機械的に分類していないか確認すること）",
  );
  // 表示側は未設定のとき何も描画せず、「延岡市」を既定値にしない。
  assert.ok(/if \(!attribution\) return null;/.test(readSrc("src/components/ImplementationAttributionNote.tsx")));
  assert.ok(
    !/implementation\s*\?\?\s*\{/.test(readSrc("src/pages/HistoryPage.tsx")),
    "未設定の実施主体へ既定値を補完している",
  );
  // CSVでも未確認は「確認中」と書き、空欄や「延岡市」で埋めない。
  assert.ok(/"確認中"/.test(readSrc("src/pages/HistoryPage.tsx")), "CSVの未確認表記が「確認中」になっていない");
});

check("実施主体を表示するページが、この注記を実際に使っている（データだけ作って未接続にしない）", () => {
  const consumers = ["src/pages/HistoryPage.tsx", "src/pages/TimelineYearPage.tsx"];
  const notWired = consumers.filter((f) => !/ImplementationAttributionNote/.test(readSrc(f)));
  assert.equal(notWired.length, 0, `実施主体の注記を使っていないページ: ${notWired.join("、")}`);
  // 画面には内部コードを出さず、市民向けの日本語へ変換する。
  for (const body of BODIES) {
    assert.ok(new RegExp(`${body}:`).test(labelSource), `${body} の日本語ラベルが無い`);
  }
  for (const relation of RELATIONS) {
    assert.ok(new RegExp(`${relation}:`).test(labelSource), `${relation} の日本語ラベルが無い`);
  }
});

check("宮崎県の予算・県議会の議決結果が、延岡市の財政・議案データへ混入していない", () => {
  // 県の予算額を市の財政データへ入れない（Phase226の判断を維持する）。
  for (const file of ["src/data/financeDashboard.json", "src/data/archiveFiscalYears.json"]) {
    const text = readSrc(file);
    assert.ok(!/宮崎県.{0,10}補正予算/.test(text), `${file} に宮崎県の補正予算が混入している`);
    assert.ok(!/延岡港海岸/.test(text), `${file} に県の港湾事業費が混入している`);
  }
  // 県議会を市議会のデータへ入れない。
  for (const file of ["src/data/councilSessions.json", "src/data/billVotes.json", "src/data/generalQuestions.json"]) {
    const text = readSrc(file);
    assert.ok(!/宮崎県議会/.test(text), `${file} に宮崎県議会のデータが混入している`);
  }
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
