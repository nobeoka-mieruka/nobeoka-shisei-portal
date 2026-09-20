/**
 * Phase272：選挙資料アーカイブ（electionResults.json の出典）の回帰テスト。
 *
 * ■ このテストで守ること
 * 1. 「誰が発行した資料か」と「どこから取得したか」が混ざらないこと。
 *    延岡市選挙管理委員会が発行した資料でも、第三者ミラーからしか参照できない場合が
 *    あり、それを「市公式サイトの資料」として表示すると出典の性格を偽ることになる。
 * 2. 第三者ミラーの資料に最上位の信頼区分（PRIMARY）を付けないこと。
 * 3. 公式サイトの資料として登録したものが、実際に延岡市の公式ドメインであること。
 * 4. 公表された数値が資料内で整合すること（得票合計・無効票・投票者総数・投票率）。
 *    固定値の暗記ではなく、データ同士の突合で検証する。
 * 5. 出典IDが重複しないこと（将来の照合用の安定キーとして使うため）。
 * 6. 選挙公報の掲載位置メタデータが、実在する候補者（届出番号）を指すこと。
 * 7. 選挙公報の内容を公約データベースへ取り込んでいないこと（今回は照合未実施）。
 *
 * 使い方: node scripts/test-election-archive-sources.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
const readText = (relPath) => readFileSync(join(ROOT, relPath), "utf8");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const elections = readJson("src/data/electionResults.json");
const NOBEOKA_OFFICIAL_HOST = "www.city.nobeoka.miyazaki.jp";
const allRefs = elections.flatMap((e) => (e.sourceRefs ?? []).map((ref) => ({ election: e, ref })));

const mayor2025 = elections.find((e) => e.id === "election-mayor-2025");

console.log("\n選挙資料アーカイブの現況（実データから再計算）");
console.log(`  登録選挙：${elections.length}件／出典：${allRefs.length}件`);
if (mayor2025) {
  console.log(`  2025年市長選挙：候補者${mayor2025.candidates.length}名／資料${mayor2025.sourceRefs.length}件`);
  console.log(
    `  資料種別：${mayor2025.sourceRefs.map((r) => `${r.documentType ?? "種別未設定"}（${r.hostType ?? "取得元種別未設定"}）`).join("、")}`,
  );
}

console.log("\n項目1：発行主体と取得元の分離");

check("2025年延岡市長選挙が登録されている", () => {
  assert.ok(mayor2025, "election-mayor-2025 が見つかりません");
  assert.equal(mayor2025.electionDate, "2025-07-20");
  assert.equal(mayor2025.announcementDate, "2025-07-13");
});

check("延岡市選挙管理委員会の発行資料をofficial_siteとするのは、延岡市公式ドメインのURLだけ", () => {
  for (const { election, ref } of allRefs) {
    if (ref.publisher !== "延岡市選挙管理委員会" || ref.hostType !== "official_site") continue;
    assert.ok(
      ref.sourceUrl.includes(NOBEOKA_OFFICIAL_HOST),
      `${election.id} の ${ref.sourceId ?? ref.sourceUrl} が公式サイト扱いですが、URLが延岡市公式ドメインではありません`,
    );
  }
});

check("第三者ミラーの資料にtrustLevel=PRIMARYを付けていない", () => {
  for (const { election, ref } of allRefs) {
    if (ref.hostType !== "third_party_mirror") continue;
    assert.notEqual(ref.trustLevel, "PRIMARY", `${election.id} の ${ref.sourceId} が第三者ミラーなのにPRIMARYです`);
    assert.ok(ref.retrievedFrom, `${election.id} の ${ref.sourceId} にretrievedFrom（取得元の説明）がありません`);
    assert.ok(ref.publisher, `${election.id} の ${ref.sourceId} にpublisher（発行主体）がありません`);
  }
});

check("選挙公報は、発行主体が延岡市選挙管理委員会・取得元が第三者ミラーとして登録されている", () => {
  const koho = mayor2025.sourceRefs.find((r) => r.sourceId === "election-mayor-2025-koho");
  assert.ok(koho, "選挙公報の出典が登録されていません");
  assert.equal(koho.documentType, "選挙公報");
  assert.equal(koho.publisher, "延岡市選挙管理委員会");
  assert.equal(koho.hostType, "third_party_mirror");
  assert.ok(!koho.sourceUrl.includes(NOBEOKA_OFFICIAL_HOST), "選挙公報のURLを延岡市公式サイトとして登録しています");
});

check("公式の投票結果・開票結果が延岡市公式サイトの資料として登録されている", () => {
  for (const sourceId of ["election-mayor-2025-vote-result", "election-mayor-2025-count-result"]) {
    const ref = mayor2025.sourceRefs.find((r) => r.sourceId === sourceId);
    assert.ok(ref, `${sourceId} が登録されていません`);
    assert.equal(ref.publisher, "延岡市選挙管理委員会");
    assert.equal(ref.hostType, "official_site");
    assert.ok(ref.sourceUrl.includes(NOBEOKA_OFFICIAL_HOST), `${sourceId} のURLが延岡市公式ドメインではありません`);
  }
});

console.log("\n項目2：出典IDと掲載位置メタデータ");

check("出典ID（sourceId）はデータ全体で重複しない", () => {
  const seen = new Map();
  for (const { election, ref } of allRefs) {
    if (!ref.sourceId) continue;
    assert.ok(!seen.has(ref.sourceId), `sourceIdが重複しています: ${ref.sourceId}（${seen.get(ref.sourceId)} と ${election.id}）`);
    seen.set(ref.sourceId, election.id);
  }
});

check("選挙公報の掲載位置は、実在する届出番号を指している", () => {
  const koho = mayor2025.sourceRefs.find((r) => r.sourceId === "election-mayor-2025-koho");
  const numbers = new Set(mayor2025.candidates.map((c) => c.registrationNumber).filter((n) => n != null));
  assert.ok(koho.candidatePlacements?.length > 0, "候補者ごとの掲載位置が登録されていません");
  assert.equal(koho.candidatePlacements.length, mayor2025.candidates.length, "掲載位置の件数が候補者数と一致しません");
  for (const p of koho.candidatePlacements) {
    assert.ok(numbers.has(p.registrationNumber), `掲載位置の届出番号が候補者一覧にありません: ${p.registrationNumber}`);
    assert.ok(p.placement && p.placement.length > 0, `${p.candidateName} の掲載位置が空です`);
  }
});

check("届出番号は候補者間で重複しない", () => {
  for (const e of elections) {
    const numbers = e.candidates.map((c) => c.registrationNumber).filter((n) => n != null);
    assert.equal(new Set(numbers).size, numbers.length, `${e.id} で届出番号が重複しています`);
  }
});

console.log("\n項目3：公表数値の整合（資料同士の突合。固定値の暗記はしない）");

check("候補者別得票の合計・無効票・投票者総数が互いに整合する", () => {
  const votes = mayor2025.candidates.reduce((sum, c) => sum + (c.votes ?? 0), 0);
  // 確定開票結果の構成：得票総数 ＋ 無効投票数 ＝ 投票総数、＋その他（持帰り等）＝ 投票者総数。
  // 「その他」は当サイトに項目が無いため、差分が0以上の小さな値であることだけを確認する。
  const others = mayor2025.votersCount - (votes + mayor2025.invalidVotes);
  assert.ok(
    others >= 0 && others < 100,
    `投票者総数（${mayor2025.votersCount}）と得票合計（${votes}）＋無効票（${mayor2025.invalidVotes}）の差が説明できません: ${others}`,
  );
});

check("投票率が有権者数と投票者数から再計算した値と一致する（小数第2位まで）", () => {
  const recalculated = Math.round((mayor2025.votersCount / mayor2025.eligibleVoters) * 10000) / 100;
  assert.equal(
    recalculated,
    mayor2025.turnoutPercent,
    `再計算した投票率（${recalculated}%）が登録値（${mayor2025.turnoutPercent}%）と一致しません`,
  );
});

check("当選者は1名で、最多得票の候補者と一致する", () => {
  const elected = mayor2025.candidates.filter((c) => c.elected);
  assert.equal(elected.length, 1);
  const top = [...mayor2025.candidates].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))[0];
  assert.equal(elected[0].name, top.name);
});

console.log("\n項目4：公約データベースへ取り込んでいないこと");

check("選挙公報の出典が市長公約データへ持ち込まれていない", () => {
  for (const relPath of ["src/data/mayorPromises.json", "src/data/mayorPromiseMeasures.json"]) {
    const text = readText(relPath);
    assert.ok(!text.includes("senkyo_koho"), `${relPath} に選挙公報のミラーURLが混入しています`);
    assert.ok(!text.includes("election-mayor-2025-koho"), `${relPath} に選挙公報の出典IDが混入しています`);
  }
});

check("選挙公報の注記に、公約データベースへ未反映であることが明記されている", () => {
  const koho = mayor2025.sourceRefs.find((r) => r.sourceId === "election-mayor-2025-koho");
  assert.match(koho.notes, /公約データベースへは取り込んでいない/);
});

check("市長詳細ページから選挙結果ページへ移動できる", () => {
  const page = readText("src/pages/MayorDetailPage.tsx");
  assert.ok(page.includes("/elections/${e.id}"), "市長詳細ページに選挙結果ページへのリンクがありません");
});

console.log(`\n${passCount}件のチェックがすべて成功しました。`);
