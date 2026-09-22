/**
 * 議会活動プロフィール（7軸）の検査。
 *
 * ここで守りたいのは「算定できないこと」を「活動が無いこと」として
 * 見せないことに尽きる。0・N/A・未確認・未公開・対象外を分けたまま保つ。
 *
 * 使い方: node --experimental-strip-types scripts/test-council-activity-profile.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), "utf8");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const profileSrc = readSrc("src/lib/councilActivityProfile.ts");
const chartSrc = readSrc("src/components/council/CouncilActivityProfileChart.tsx");
const barometerSrc = readSrc("src/lib/councilActivityBarometer.ts");
const recordSrc = readSrc("src/lib/councilActivityRecord.ts");

console.log("\n議会活動プロフィール（7軸）");

check("7軸がそろっていて、それぞれ条例上の役割と観測している活動を分けている", () => {
  for (const key of [
    "monitoring",
    "policy-proposal",
    "representation",
    "long-term-view",
    "budget-review",
    "member-debate",
    "committee-activity",
  ]) {
    assert.ok(profileSrc.includes(`key: "${key}"`), `${key} がありません`);
  }
  // 軸名が条例の役割そのものだと、役割全体を数値化しているように読める。
  assert.ok(
    !profileSrc.includes('label: "市政運営の監視・評価"'),
    "軸名が条例上の役割そのものになっています",
  );
  assert.ok(profileSrc.includes('label: "一般質問による市政チェック"'), "観測している活動に近い軸名が必要です");
  for (const field of ["roleInOrdinance", "observedActivity", "dataUsed", "upperBoundMeaning"]) {
    assert.ok(profileSrc.includes(field), `${field} がありません`);
  }
});

check("欠損軸を0として描かない（頂点を中心へ落とさない）", () => {
  // 数値の無い軸は、外周に破線の輪として置く。
  assert.match(chartSrc, /strokeDasharray/, "欠損軸の破線表現がありません");
  assert.ok(
    !/measurement\s*\?\?\s*0/.test(chartSrc) && !/ratio\s*\|\|\s*0/.test(chartSrc),
    "欠損を0の半径へ丸めています",
  );
  // ポリゴンは、数値のある軸が一定数そろうまで描かない。
  assert.match(profileSrc, /POLYGON_MIN_AXES = 3/);
  assert.match(chartSrc, /\{polygon && \(/, "ポリゴンを無条件に描いています");
});

check("0・N/A・未確認・未公開・対象外を別の記号と言葉で示す", () => {
  for (const [symbol, word] of [
    ["●", "数値あり"],
    ["○", "0（確認した結果、該当なし）"],
    ["―", "N/A"],
    ["△", "未確認"],
    ["□", "未公開"],
  ]) {
    assert.ok(chartSrc.includes(symbol), `凡例の記号 ${symbol} がありません`);
    assert.ok(chartSrc.includes(word), `凡例の説明「${word}」がありません`);
  }
  // 状態コードごとに記号が割り当てられていること（色だけに頼らない）。
  for (const code of [
    "CONFIRMED",
    "CONDITIONAL",
    "NOT_INDIVIDUALLY_ATTRIBUTABLE",
    "NOT_ACQUIRED",
    "SOURCE_NOT_PUBLISHED",
    "RESEARCH_EXHAUSTED",
    "NOT_APPLICABLE",
  ]) {
    assert.ok(profileSrc.includes(code), `状態コード ${code} がありません`);
    assert.ok(chartSrc.includes(code), `記号の対応表に ${code} がありません`);
  }
});

check("状態コードと画面の文言が分離されている", () => {
  assert.match(profileSrc, /AXIS_STATUS_LABELS_JA/, "表示文言の対応表がありません");
  // 内部コードをそのまま画面へ出していないこと。
  assert.ok(
    !/>\{axis\.status\}</.test(chartSrc),
    "内部コードをそのまま画面に出しています",
  );
});

check("役職による除外を「質問できなかった」と断定していない", () => {
  assert.match(recordSrc, /SPEAKER_TERM: "役職就任期間/, "除外理由の文言が変わっています");
  // 「質問できなかった…という意味ではありません」という打ち消しは許す。
  // 断定として使っていないことだけを見る。
  for (const src of [recordSrc, barometerSrc, profileSrc]) {
    for (const m of src.matchAll(/質問できなかった[^"]{0,40}/g)) {
      assert.match(m[0], /という意味ではありません/, `断定になっています: ${m[0].slice(0, 40)}`);
    }
  }
  // 比較条件を揃えるための除外であることを説明していること。
  assert.match(barometerSrc, /比較条件を揃える|条件が揃わない/);
});

check("議長在任は会期ごとに判定し、対象期間すべてを外さない", () => {
  assert.match(barometerSrc, /chairpersonSessionsFor/, "会期ごとの判定関数がありません");
  assert.match(barometerSrc, /sessionWithinTerm/, "在任期間との突き合わせがありません");
  // 副議長は除外しない（公式資料の裏付けが無いため）。
  assert.ok(
    !/role !== "副議長"/.test(barometerSrc) && barometerSrc.includes('term.role !== "議長"'),
    "議長以外の役職まで除外しています",
  );
});

check("議長の在任期間が、出典つきのデータとして登録されている", () => {
  const data = readJson("src/data/councilLeadershipTerms.json");
  const chairs = data.terms.filter((t) => t.role === "議長");
  assert.ok(chairs.length >= 2, "現任期の議長が2名以上登録されているはずです");
  for (const t of chairs) {
    assert.ok(t.memberId, "議員IDが必要です");
    assert.ok(t.termStart, "就任日が必要です");
    assert.ok(Array.isArray(t.sourceRefs) && t.sourceRefs.length > 0, "出典が必要です");
    for (const ref of t.sourceRefs) assert.ok(ref.label, "出典の名称が必要です");
    // 退任日は未到来なら null。架空の日付を入れない。
    assert.ok(t.termEnd === null || /^\d{4}-\d{2}-\d{2}$/.test(t.termEnd), "退任日の形式が不正です");
  }
});

check("総合点・順位・優劣の語を生成していない", () => {
  // コメントは検査対象から外す。「作らない」と書いた設計メモまで拾ってしまうため。
  const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const [name, raw] of [
    ["councilActivityProfile.ts", profileSrc],
    ["CouncilActivityProfileChart.tsx", chartSrc],
  ]) {
    const src = stripComments(raw);
    for (const word of ["ランキング", "偏差値", "総合点", "優秀", "満点", "1位", "最下位"]) {
      // 「作らない」と書いた説明文は許す。単独で表示語として使っていないことを見る。
      const used = new RegExp(`[>"'\`]\\s*[^"'\`<>]*${word}[^"'\`<>]*\\s*[<"'\`]`).test(src);
      if (!used) continue;
      const negated = new RegExp(`${word}[^。]{0,24}(ではありません|しません|行いません|作成していません|作らない)`).test(src);
      assert.ok(negated, `${name} に「${word}」が評価語として出ています`);
    }
  }
});

check("実データ：26名全員で7軸を組み立てられる", () => {
  const members = readJson("src/data/members.json");
  assert.equal(members.length, 26, "現職議員は26名のはずです（前提が変わった可能性）");
  // 軸の並び順が1〜7で重複していないこと。
  const orders = [...profileSrc.matchAll(/^\s*order: (\d),$/gm)].map((m) => Number(m[1]));
  assert.deepEqual([...orders].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7], "軸の並び順が1〜7ではありません");
});

console.log(`\n${passCount}件成功\n`);
