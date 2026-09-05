/**
 * Phase236：会派内の役職（団長・副団長・幹事長・副幹事長・顧問）を、一次資料の記載どおりに
 * 保つための回帰テスト。
 *
 * 背景：会派の役職は「誰が会派を代表しているか」という、市民が誤解しやすい情報である。
 * 延岡市議会「会派役員及び所属議員名簿」（LEVEL A / 一次資料）にだけ根拠があり、
 * 報道や検索結果から補ってはならない。また、名簿に役職の記載が無い議員を
 * 「役職なし」と断定してもいけない（名簿の様式上、記載が無いだけの議員が存在する）。
 *
 * このテストが固定すること：
 *   1. 会派役員の役職名が、型定義（FactionOfficerRole）の語と一致する
 *   2. 会派役員が members.json に実在し、氏名も会派もその議員本人と一致する
 *   3. 会派役員には必ず出典（officersSourceRefs）と基準日が付いている
 *   4. 出典が延岡市議会公式ドメインである（報道・SNSを根拠にしない）
 *   5. 役員0名（会派に所属しない議員）を「未確認」と混同しないよう、理由が文章で残っている
 *   6. 会派役員を表示するページが、名簿に記載が無い議員を「役職なし」と断定していない
 *   7. 会派の所属人数と、members.json の集計が一致する（名簿と現員の食い違いを検知する）
 *
 * 使い方: node scripts/test-faction-officers.mjs
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

const factions = readJson("src/data/factions.json");
const members = readJson("src/data/members.json");
const typeSource = readSrc("src/types/index.ts");

const memberById = new Map(members.map((m) => [m.id, m]));
const withOfficers = factions.filter((f) => Array.isArray(f.officers));

/** 型定義から FactionOfficerRole の語を取り出す（画面・データ・型の三者で語がずれないようにする）。 */
const roleMatch = typeSource.match(/export type FactionOfficerRole =([\s\S]*?);/);
assert.ok(roleMatch, "FactionOfficerRole の定義が見つかりません");
const ROLES = new Set([...roleMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));

check("会派役員の役職名が型定義（FactionOfficerRole）の語と一致する", () => {
  assert.ok(ROLES.size > 0, "FactionOfficerRole の語が取り出せない");
  for (const f of withOfficers) {
    for (const o of f.officers) {
      assert.ok(ROLES.has(o.role), `${f.id}: 型定義に無い役職 ${o.role}`);
    }
  }
});

check("会派役員が members.json に実在し、氏名も所属会派も本人と一致する", () => {
  for (const f of withOfficers) {
    for (const o of f.officers) {
      const member = memberById.get(o.memberId);
      assert.ok(member, `${f.id}: 存在しない議員ID ${o.memberId}`);
      assert.equal(o.memberName, member.name, `${f.id}: 氏名が members.json と異なる（${o.memberName}）`);
      assert.equal(member.factionId, f.id, `${f.id}: ${o.memberId} はこの会派の所属ではない`);
    }
  }
});

check("同じ議員が同じ会派の役員として重複せず、団長・副団長・幹事長・副幹事長は各1名以内", () => {
  for (const f of withOfficers) {
    const ids = f.officers.map((o) => o.memberId);
    assert.equal(new Set(ids).size, ids.length, `${f.id}: 会派役員に同じ議員が重複している`);
    for (const role of ["団長", "副団長", "幹事長", "副幹事長"]) {
      const count = f.officers.filter((o) => o.role === role).length;
      assert.ok(count <= 1, `${f.id}: ${role} が${count}名登録されている`);
    }
  }
});

check("会派役員には必ず出典と基準日が付いている（根拠のない役職を作らない）", () => {
  for (const f of withOfficers) {
    assert.ok(
      Array.isArray(f.officersSourceRefs) && f.officersSourceRefs.length > 0,
      `${f.id}: officersSourceRefs が無い`,
    );
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(f.officersAsOf ?? ""), `${f.id}: officersAsOf が無い、または形式が不正`);
    assert.ok(
      /^\d{4}-\d{2}-\d{2}$/.test(f.officersVerifiedAt ?? ""),
      `${f.id}: officersVerifiedAt が無い、または形式が不正`,
    );
    for (const s of f.officersSourceRefs) {
      assert.ok(typeof s.label === "string" && s.label.trim() !== "", `${f.id}: 出典のlabelが空`);
      assert.ok(/^https?:\/\//.test(s.url ?? ""), `${f.id}: 出典のurlが不正 ${s.url}`);
    }
  }
});

check("会派役員の出典が延岡市議会公式サイトである（報道・SNSを根拠にしない）", () => {
  // LEVEL B（報道）や LEVEL C（SNS・snippet）だけで人名・役職を確定しないという方針を、
  // ドメインの形で固定する（RELEASE_SNAPSHOT.md「情報源の信頼階層」）。
  const NEWS_HOSTS = ["the-miyanichi.co.jp", "yukan-daily.co.jp"];
  for (const f of withOfficers) {
    const hasOfficial = f.officersSourceRefs.some((s) => s.url.includes("city.nobeoka.miyazaki.jp"));
    assert.ok(hasOfficial, `${f.id}: 延岡市（市議会）公式サイトの出典が無い`);
    for (const s of f.officersSourceRefs) {
      for (const host of NEWS_HOSTS) {
        assert.ok(!s.url.includes(host), `${f.id}: 報道サイトを会派役員の出典にしている（${s.url}）`);
      }
    }
  }
});

check("役員0名の会派は、未確認と区別できる理由が文章で残っている", () => {
  for (const f of withOfficers) {
    if (f.officers.length > 0) continue;
    assert.ok(
      typeof f.officersNote === "string" && f.officersNote.trim() !== "",
      `${f.id}: 役員0名なのに理由（officersNote）が無い。「未確認」と読み分けられない`,
    );
  }
});

check("会派役員が未確認の会派に、基準日・出典・確認日だけが残っていない", () => {
  for (const f of factions) {
    if (Array.isArray(f.officers)) continue;
    for (const key of ["officersAsOf", "officersSourceRefs", "officersVerifiedAt", "officersNote"]) {
      assert.equal(f[key], undefined, `${f.id}: officers が未設定なのに ${key} が設定されている`);
    }
  }
});

check("表示側が、名簿に記載が無い議員を「役職なし」と断定していない", () => {
  const memberPage = readSrc("src/pages/MemberDetailPage.tsx");
  const dashboard = readSrc("src/pages/DashboardPage.tsx");
  assert.ok(
    /役職に就いていないという意味ではありません/.test(memberPage),
    "議員詳細ページに、名簿に記載が無いことの説明が無い",
  );
  assert.ok(
    /役職に就いていないという意味ではありません/.test(dashboard),
    "市政ダッシュボードに、名簿に記載が無いことの説明が無い",
  );
  // 役職の有無で議員を序列化しないことも、文章で明示しておく。
  assert.ok(/序列を示すものではありません/.test(dashboard), "会派役員の一覧に、序列ではない旨の説明が無い");
});

check("表示件数を直書きせず、データから算出している", () => {
  const dashboard = readSrc("src/pages/DashboardPage.tsx");
  const officerTotal = withOfficers.reduce((sum, f) => sum + f.officers.length, 0);
  assert.ok(officerTotal > 0, "会派役員が1件も登録されていない");
  // 「役員○名」「○会派」のような固定の件数を画面に書いていないこと。
  const officerSection = dashboard.slice(dashboard.indexOf('title="会派役員"'));
  assert.ok(
    !new RegExp(`${officerTotal}\\s*名`).test(officerSection) && !new RegExp(`${withOfficers.length}\\s*会派`).test(officerSection),
    "会派役員の件数が画面に直書きされている",
  );
});

check("会派ごとの所属人数が members.json の集計と一致する", () => {
  const counts = new Map();
  for (const m of members) counts.set(m.factionId, (counts.get(m.factionId) ?? 0) + 1);
  const known = new Set(factions.map((f) => f.id));
  for (const factionId of counts.keys()) {
    assert.ok(known.has(factionId), `members.json が factions.json に無い会派IDを参照している: ${factionId}`);
  }
  // 会派役員は、その会派の所属人数を超えて登録できない。
  for (const f of withOfficers) {
    const memberCount = counts.get(f.id) ?? 0;
    assert.ok(
      f.officers.length <= memberCount,
      `${f.id}: 役員数（${f.officers.length}）が所属人数（${memberCount}）を超えている`,
    );
  }
  console.log(
    `     （会派 ${factions.length}／会派役員を確認済み ${withOfficers.length}会派・${withOfficers.reduce(
      (s, f) => s + f.officers.length,
      0,
    )}名／現職議員 ${members.length}名）`,
  );
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
