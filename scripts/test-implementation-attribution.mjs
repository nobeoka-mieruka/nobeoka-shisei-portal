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
 * Phase233でこのファイルへ追加した固定事項（A〜G。詳細は各ブロックの見出しを参照）：
 *   A. 宮崎県の予算が、延岡市の一般会計・補正予算・基金・市債・財政ダッシュボードへ入らない
 *   B. 宮崎県議会の議案・一般質問・議員が、延岡市議会のデータへ入らない
 *   C. 開催地が延岡市であることを理由に、県の事業を市の事業として分類しない
 *   D. 一次資料に根拠が無い案件を共同実施（cityPrefectureJoint）へ格上げしない
 *   E. 実施主体が未設定（未確認）でも既存ページが壊れない（任意フィールドとしての後方互換）
 *   F. 報道（LEVEL B）だけを根拠に実施主体を確定しない
 *   G. 県関連の出来事を全件監査し、市と県の取り違えが双方向とも0件である
 *      （実レンダリングによる確認は scripts/audit-prefecture-attribution-rendering.mjs）
 *
 * Phase232 で追加した固定事項：
 *   8. 歴代市長ページ（在任中の出来事）でも実施主体を表示している
 *      （市長個人の実績と読まれやすい場所であるため）
 *   9. 絞り込みUIの値に内部コードをそのまま使わず、選択肢の文字はすべて日本語である
 *  10. 絞り込みに「確認中」の区分があり、そのラベルが延岡市の事業を意味しない
 *
 * 使い方: node --experimental-strip-types scripts/test-implementation-attribution.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
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
  // Phase232：歴代市長ページの「市政上の主な出来事（在任中）」は、県立学校・県立病院の
  // 整備などが市長個人の実績として読まれやすい。ここでも実施主体を表示し続けることを固定する。
  const consumers = [
    "src/pages/HistoryPage.tsx",
    "src/pages/TimelineYearPage.tsx",
    "src/pages/MayorDetailPage.tsx",
  ];
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

check("実施主体の絞り込みが、内部コードを画面へ出さず日本語の選択肢だけを並べる（Phase232）", () => {
  // 絞り込みの値（selectのvalue）は、内部コードをそのまま使わない。
  const filterBlock = labelSource.slice(labelSource.indexOf("IMPLEMENTING_BODY_FILTER_VALUE"));
  const filterValues = [...filterBlock.matchAll(/^ {2}([A-Za-z]+): "([a-z]+)",$/gm)];
  assert.equal(filterValues.length, BODIES.size, "実施主体の区分と絞り込みの値が1対1で対応していない");
  for (const [, body, value] of filterValues) {
    assert.ok(BODIES.has(body), `${body} は型定義に無い区分`);
    assert.notEqual(value, body, `${body}: 内部コードをそのまま絞り込みの値にしている`);
    // ラベル表に日本語の文字ラベルがあること（色や記号だけで区別しない）。
    const labelMatch = labelSource.match(new RegExp(`\\n  ${value}: "([^"]+)"`));
    assert.ok(labelMatch, `${value} の日本語ラベルが無い`);
    assert.ok(/[ぁ-んァ-ン一-龥]/.test(labelMatch[1]), `${value} のラベルが日本語になっていない`);
  }
  // 絞り込みの選択肢は、すべて並び順の定義に含まれる（画面から漏れる区分を作らない）。
  const orderBlock = labelSource.slice(labelSource.indexOf("IMPLEMENTATION_FILTER_ORDER"));
  for (const [, , value] of filterValues) {
    assert.ok(orderBlock.includes(`"${value}"`), `${value} が絞り込みの並び順に含まれていない`);
  }
});

check("絞り込みの「確認中」が、延岡市の事業を意味する表示になっていない（Phase232）", () => {
  const unconfirmedLabel = labelSource.match(/\[UNCONFIRMED_IMPLEMENTATION_FILTER\]: "([^"]+)"/);
  assert.ok(unconfirmedLabel, "「確認中」の選択肢ラベルが無い");
  assert.ok(unconfirmedLabel[1].includes("確認中"), "「確認中」であることが文字で分からない");
  assert.ok(!unconfirmedLabel[1].includes("延岡市の事業"), "未確認を延岡市の事業として表示している");
  // 未設定の出来事は「確認中」に分類し、実施主体が延岡市の区分へ寄せない。
  assert.ok(
    /return attribution\s*\?[\s\S]*?: UNCONFIRMED_IMPLEMENTATION_FILTER;/.test(labelSource),
    "未設定の出来事が「確認中」以外へ分類されている",
  );
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

/* ============================================================================
 * Phase233：「宮崎県のもの」が「延岡市のもの」として公開されないことを、
 * データ・コード・実レンダリングの三方向から機械的に固定する再発防止テスト。
 *
 * Phase226〜231で個別に判断してきた内容（県予算を市財政へ入れない／県議会を市議会へ
 * 入れない／開催地で主体を決めない／推測でjointにしない／報道単独で確定しない）は、
 * これまで人の目視と個別コミットに依存していた。将来の自動更新・一括取り込みで
 * 再発しうるため、ここで恒久的な回帰テストへ落とす。
 *
 * 検査の設計方針：
 * ・自由文の単純な語句禁止だけに頼らない（「宮崎県立図書館所蔵の延岡市議会会議録」
 *   「県議会議員選挙ポスター掲示場設置事業費（市の予算）」のような正当な記述を誤検出するため）。
 *   構造化フィールド（sourceOrganization・proposer・session・URLのホスト）を主に見る。
 * ・データを緩めてテストを通さない。テストが落ちたらデータかコードが誤っている。
 * ・実レンダリングによる確認は scripts/audit-prefecture-attribution-rendering.mjs で行う
 *   （dist/ のビルドとブラウザ起動が必要なため、npm test からは分離している）。
 * ========================================================================= */

const financeDashboard = readJson("src/data/financeDashboard.json");
const fiscalYears = readJson("src/data/archiveFiscalYears.json");
const councilSessions = readJson("src/data/councilSessions.json");
const billVotes = readJson("src/data/billVotes.json");
const generalQuestions = readJson("src/data/generalQuestions.json");

/**
 * URLのホスト名。web.archive.org 経由の保存URLは、保存された元資料のホストを返す
 * （公式PDFのアーカイブを「アーカイブサイトの資料」と誤判定しないため）。
 */
function primaryHost(url) {
  if (typeof url !== "string") return "";
  const archived = url.match(/^https?:\/\/web\.archive\.org\/web\/[^/]+\/(https?:\/\/.+)$/);
  const target = archived ? archived[1] : url;
  try {
    return new URL(target).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 文字列値をパス付きで再帰的に集める（URL・機関名の全件走査用）。 */
function collectStrings(value, path, out) {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectStrings(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

/** 数値をパス付きで再帰的に集める。 */
function collectNumbers(value, path, out) {
  if (typeof value === "number") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => collectNumbers(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectNumbers(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

/**
 * 報道機関のドメイン（LEVEL B / SECONDARY）。
 * RELEASE_SNAPSHOT.md「情報源の信頼階層」で、単独では事実を確定しないと決めている。
 */
const NEWS_HOSTS = [
  "the-miyanichi.co.jp",
  "yukan-daily.co.jp",
  "asahi.com",
  "yomiuri.co.jp",
  "mainichi.jp",
  "nikkei.com",
  "sankei.com",
  "nishinippon.co.jp",
  "kyodo.co.jp",
  "jiji.com",
  "news.yahoo.co.jp",
  "umk.co.jp",
  "mrt.jp",
  "nhk.or.jp",
];
const isNewsHost = (host) => NEWS_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
/** 報道であることが資料名から分かる場合（出典refにドメインが無い・短縮されている場合の補助）。 */
const NEWS_NAME_RE =
  /宮崎日日新聞|Miyanichi|夕刊デイリー|読売新聞|朝日新聞|毎日新聞|日本経済新聞|西日本新聞|産経新聞|共同通信|時事通信|Yahoo!ニュース|テレビ宮崎|NHK/i;

/**
 * 一次資料（LEVEL A / PRIMARY）として実施主体の確定に使えるホスト。
 * 延岡市・宮崎県・国・国会図書館・議会会議録検索システムに限る。
 */
const PRIMARY_HOSTS = [
  "city.nobeoka.miyazaki.jp",
  "pref.miyazaki.lg.jp",
  "dl.ndl.go.jp",
  "ndlsearch.ndl.go.jp",
  "kensakusystem.jp",
];
const isPrimaryHost = (host) => PRIMARY_HOSTS.includes(host) || host.endsWith(".go.jp") || host.endsWith(".lg.jp");

/** 延岡市議会のデータで出典として認めるホスト（県公式サイトは含めない）。 */
const COUNCIL_SOURCE_HOSTS = new Set(["city.nobeoka.miyazaki.jp", "kensakusystem.jp", "ndlsearch.ndl.go.jp"]);

/* --- A. 宮崎県の予算が、延岡市の財政データへ混入していないこと --------------- */

check("A1 延岡市の財政データの出典に、宮崎県自身の予算資料が使われていない", () => {
  // financeDashboard の出典は「資料を公表した機関」。宮崎県が自らの予算を公表した資料を
  // 市の一般会計・補正予算・基金・市債の根拠にしてはならない。
  for (const s of financeDashboard.sources ?? []) {
    assert.ok(
      !/^宮崎県/.test(s.organization ?? ""),
      `financeDashboard.json: 宮崎県が公表機関の資料を市の財政の出典にしている（${s.section}／${s.title}）`,
    );
    assert.notEqual(
      primaryHost(s.url),
      "pref.miyazaki.lg.jp",
      `financeDashboard.json: 県公式サイトのURLを出典にしている（${s.title}）`,
    );
  }
  // archiveFiscalYears では、県サイトに置かれた資料の引用自体は許す（総務省「財政状況資料集
  // 宮崎県延岡市」等が県サイトに掲載されている）。ただし資料名で「延岡市／市町村」の
  // データであることが分かるものに限り、県自身の財政資料を市の数値の根拠にしない。
  const refs = [];
  const walkRefs = (node) => {
    if (Array.isArray(node)) return node.forEach(walkRefs);
    if (node && typeof node === "object") {
      if (typeof node.sourceUrl === "string") refs.push(node);
      Object.values(node).forEach(walkRefs);
    }
  };
  walkRefs(fiscalYears);
  const prefectureRefs = refs.filter((r) => primaryHost(r.sourceUrl) === "pref.miyazaki.lg.jp");
  assert.ok(prefectureRefs.length > 0, "検査対象（県サイト掲載資料）が0件。抽出条件が壊れていないか確認すること");
  for (const r of prefectureRefs) {
    assert.ok(
      /延岡市|市町村/.test(r.sourceTitle ?? ""),
      `archiveFiscalYears.json: 県サイトの資料だが延岡市・市町村のデータと確認できない（${r.sourceTitle}）`,
    );
  }
});

check("A2 延岡市の財政データに、宮崎県の予算であることを示す記述が入っていない", () => {
  // 「宮崎県の9月補正予算」等をそのまま市の財政データへ書き写す事故を検出する。
  // 既存チェック（宮崎県…補正予算／延岡港海岸）と重複しない表現を対象にする。
  const PREFECTURAL_BUDGET_RE = [
    /宮崎県.{0,8}当初予算/,
    /宮崎県.{0,8}一般会計/,
    /県の.{0,4}(当初|補正)予算/,
    /県予算/,
    /宮崎県議会.{0,10}(可決|議決|提案)/,
    /知事査定/,
  ];
  for (const file of ["src/data/financeDashboard.json", "src/data/archiveFiscalYears.json"]) {
    const text = readSrc(file);
    for (const re of PREFECTURAL_BUDGET_RE) {
      assert.ok(!re.test(text), `${file} に宮崎県の予算を示す記述がある（${re}）`);
    }
  }
});

check("A3 延岡市の予算・基金・市債の金額が、市の規模を超えていない（県の金額の取り違え検出）", () => {
  // 宮崎県の一般会計はおおむね6,000億円台、延岡市は700億円前後。
  // 取り違えれば桁が一つ変わるため、3,000億円を超える市の金額は誤りとして検出する
  // （実データの最大は約710億円で4倍以上の余裕がある。実データに合わせて緩めた値ではない）。
  const YEN_CEILING = 300_000_000_000;
  const violations = [];
  for (const [path, value] of collectNumbers(fiscalYears, "archiveFiscalYears", [])) {
    if (!/Yen$/.test(path)) continue;
    if (Math.abs(value) > YEN_CEILING) violations.push(`${path}=${value}`);
  }
  for (const [path, value] of collectNumbers(financeDashboard, "financeDashboard", [])) {
    // 千円単位のフィールドは円へ換算して比較する（単位の取り違えもここで検出できる）。
    if (!/ThousandYen$|amountThousands$|Funds$|total$/.test(path)) continue;
    if (Math.abs(value) * 1000 > YEN_CEILING) violations.push(`${path}=${value}千円`);
  }
  assert.equal(violations.length, 0, `市の規模を超える金額がある（県の金額の混入を疑うこと）: ${violations.join("、")}`);
});

/* --- B. 宮崎県議会のデータが、延岡市議会のデータへ混入していないこと --------- */

check("B1 延岡市議会データの出典URLが、市・市議会・国会図書館のものに限られる", () => {
  const violations = [];
  const files = {
    "councilSessions.json": councilSessions,
    "billVotes.json": billVotes,
    "generalQuestions.json": generalQuestions,
  };
  let checkedUrls = 0;
  for (const [name, data] of Object.entries(files)) {
    for (const [path, value] of collectStrings(data, "", [])) {
      if (!/^https?:\/\//.test(value)) continue;
      checkedUrls += 1;
      const host = primaryHost(value);
      if (host === "") continue;
      if (!COUNCIL_SOURCE_HOSTS.has(host)) violations.push(`${name} ${path}: ${host}`);
    }
  }
  assert.ok(checkedUrls > 0, "検査対象URLが0件。抽出条件が壊れていないか確認すること");
  assert.equal(
    violations.length,
    0,
    `延岡市議会データに市・市議会以外のURLがある（県公式サイト等の混入を疑うこと）: ${violations.slice(0, 5).join("、")}`,
  );
});

check("B2 会議名・提出者・出典機関が、すべて延岡市議会のものである", () => {
  const PREFECTURAL_ORGAN_RE = /県議会|宮崎県定例会|知事/;
  for (const s of councilSessions) {
    assert.ok(!PREFECTURAL_ORGAN_RE.test(s.title ?? ""), `councilSessions.json (${s.id}): 会議名が県議会のもの: ${s.title}`);
    assert.ok(/^(昭和|平成|令和)/.test(s.title ?? ""), `councilSessions.json (${s.id}): 会議名の形式が想定外: ${s.title}`);
  }
  for (const b of billVotes) {
    assert.ok(!PREFECTURAL_ORGAN_RE.test(b.session ?? ""), `billVotes.json (${b.id}): 会期が県議会のもの: ${b.session}`);
    // 提出者は市長・市議会の委員会・市議会議員のいずれか。知事・県の機関は市議会へ議案を出さない。
    assert.ok(!/知事|宮崎県/.test(b.proposer ?? ""), `billVotes.json (${b.id}): 提出者が県の機関になっている: ${b.proposer}`);
  }
  for (const q of generalQuestions) {
    assert.equal(
      q.sourceOrganization,
      "延岡市議会",
      `generalQuestions.json (${q.id}): 出典機関が延岡市議会ではない: ${q.sourceOrganization}`,
    );
    assert.ok(
      !PREFECTURAL_ORGAN_RE.test(q.sessionName ?? ""),
      `generalQuestions.json (${q.id}): 会期が県議会のもの: ${q.sessionName}`,
    );
  }
});

check("B3 一般質問の質問者・議決の投票者が、延岡市議会の議員として登録されている", () => {
  const members = readJson("src/data/members.json");
  const formerMembers = readJson("src/data/formerMembers.json");
  const councilMemberIds = new Set([...members.map((m) => m.id), ...formerMembers.map((m) => m.id)]);
  const unknown = generalQuestions.filter((q) => !councilMemberIds.has(q.memberId));
  assert.equal(
    unknown.length,
    0,
    `延岡市議会の議員として登録されていない質問者がいる: ${unknown.map((q) => `${q.id}(${q.memberId})`).join("、")}`,
  );
  const unknownVoters = new Set();
  for (const b of billVotes) {
    for (const v of b.memberVotes ?? []) {
      if (v.memberId && !councilMemberIds.has(v.memberId)) unknownVoters.add(v.memberId);
    }
  }
  assert.equal(unknownVoters.size, 0, `市議会議員として登録されていない投票者がいる: ${[...unknownVoters].join("、")}`);
});

/* --- C. 開催地と実施主体を混同しないこと ------------------------------------ */

/**
 * 出来事の名称（title）に現れる、宮崎県のものであることを示す表現。
 * 名称は出来事そのものの識別なので、ここに県の語があれば県の案件とみなす。
 */
const PREFECTURAL_TITLE_RE = /県立|県営|宮崎県|県主催/;
/**
 * 本文（summary）から「宮崎県が実施した」と読み取れる表現。
 * 本文には、市の施策の背景として県の施設名が出てくることがある
 * （例：civic-148「県立延岡病院の医師退職問題を背景に、延岡市が条例を制定」）。
 * 背景の言及を県の事業と誤判定しないよう、県を主語とする表現だけを対象にする。
 */
const PREFECTURAL_SUBJECT_RE = /宮崎県(（[^）]*）)?[がは]|宮崎県主催|県主催/;
/** その出来事が宮崎県のものらしいか（名称または本文の主語で判定する）。 */
const looksPrefectural = (ev) => PREFECTURAL_TITLE_RE.test(ev.title) || PREFECTURAL_SUBJECT_RE.test(ev.summary ?? "");
/** 「延岡市で行われた」だけを示す表現（実施主体の根拠にならない）。 */
const VENUE_ONLY_RE = /延岡市で(実施|開催)|延岡市役所で(開催|実施)|延岡市内で(開催|実施)|会場[はが][^。]*延岡/;

check("C1 開催地が延岡市であることを理由に、宮崎県の事業を延岡市の事業として分類していない", () => {
  const misattributed = [];
  for (const ev of withAttribution) {
    const text = `${ev.title} ${ev.summary ?? ""} ${ev.implementation.attributionNote ?? ""}`;
    if (looksPrefectural(ev) && ev.implementation.implementingBody === "nobeokaCity") {
      misattributed.push(`${ev.id}（名称・本文は県が主体）`);
    }
    // 開催地だけが延岡市である出来事を「延岡市の事業」にしない。
    if (VENUE_ONLY_RE.test(text) && ev.implementation.nobeokaRelation === "cityProject") {
      misattributed.push(`${ev.id}（開催地のみを根拠に市の事業としている疑い）`);
    }
  }
  assert.equal(misattributed.length, 0, `開催地と実施主体を混同している: ${misattributed.join("、")}`);
  // 「延岡市で開催された県の事業」が実際に分類済みであること（この検査が空振りしていないこと）。
  const venueCases = withAttribution.filter((ev) =>
    VENUE_ONLY_RE.test(`${ev.title} ${ev.summary ?? ""} ${ev.implementation.attributionNote ?? ""}`),
  );
  assert.ok(venueCases.length > 0, "開催地が延岡市の県事業が1件も分類されていない（検査が空振りしている）");
  for (const ev of venueCases) {
    assert.notEqual(
      ev.implementation.implementingBody,
      "nobeokaCity",
      `${ev.id}: 開催地が延岡市であることを理由に市の事業にしている`,
    );
  }
});

/* --- D. 共同実施（joint）の誤判定防止 --------------------------------------- */

check("D1 共同実施は、県と市の双方が当事者であることが記録に現れる案件だけに限られる", () => {
  const joints = withAttribution.filter((ev) => ev.implementation.implementingBody === "cityPrefectureJoint");
  for (const ev of joints) {
    const text = `${ev.title} ${ev.summary ?? ""} ${ev.implementation.attributionNote ?? ""}`;
    assert.ok(/宮崎県|県[・と]/.test(text), `${ev.id}: 共同実施だが宮崎県が当事者である記述が無い`);
    assert.ok(/延岡市/.test(text), `${ev.id}: 共同実施だが延岡市が当事者である記述が無い`);
    // 何をもって共同と判断したかを、必ず資料の記載として残す。
    assert.ok(
      typeof ev.implementation.attributionNote === "string" && ev.implementation.attributionNote.length > 0,
      `${ev.id}: 共同実施の根拠（attributionNote）が空`,
    );
  }
  // 「延岡市も関わったらしい」程度の案件を共同実施へ格上げしない。
  // 参加・受益にとどまる関係は joint と両立しない。
  for (const ev of withAttribution) {
    const { implementingBody, nobeokaRelation } = ev.implementation;
    if (nobeokaRelation === "nobeokaParticipant" || nobeokaRelation === "nobeokaBeneficiary") {
      assert.notEqual(implementingBody, "cityPrefectureJoint", `${ev.id}: 参加・受益にとどまる案件を共同実施へ格上げしている`);
    }
  }
});

check("D2 実施主体を自動付与・自動格上げするコードが存在しない（jointへの機械的な格上げ経路が無い）", () => {
  // 生成スクリプトが implementation を書き込むと、一次資料の確認を経ずに区分が増える。
  // 実施主体は人が一次資料で確認した結果だけを記録する。
  const generatorFiles = readdirSync(join(ROOT, "scripts")).filter(
    (f) => /^(generate|extract|import|suggest|update|fetch)-/.test(f) && f.endsWith(".mjs"),
  );
  const writers = generatorFiles.filter((f) =>
    /implementingBody|nobeokaRelation|attributionSourceUrl/.test(readSrc(join("scripts", f))),
  );
  assert.equal(writers.length, 0, `実施主体を自動生成しているスクリプトがある: ${writers.join("、")}`);
  // 自動更新（scripts/auto-update）側にも書き込み経路が無いこと。
  const autoUpdateFiles = [];
  const walkDir = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full);
      else if (entry.name.endsWith(".mjs")) autoUpdateFiles.push(full);
    }
  };
  walkDir(join(ROOT, "scripts", "auto-update"));
  assert.ok(autoUpdateFiles.length > 0, "自動更新スクリプトが0件（抽出条件が壊れている）");
  const autoWriters = autoUpdateFiles.filter((f) => /implementingBody|cityPrefectureJoint/.test(readFileSync(f, "utf8")));
  assert.equal(autoWriters.length, 0, `自動更新が実施主体を書き込んでいる: ${autoWriters.join("、")}`);
});

/* --- E. 未分類（implementation 未設定）の安全性・後方互換 -------------------- */

check("E1 実施主体は任意フィールドであり、未設定のレコードが正常に存在できる（後方互換）", () => {
  // 型：省略可能として宣言されていること。必須化すると既存の未確認レコードが一斉に不正になる。
  assert.ok(
    /implementation\?\s*:/.test(readSrc("src/types/index.ts")),
    "CivicTimelineEvent.implementation が任意フィールドとして宣言されていない",
  );
  assert.ok(
    /attribution\?\s*:\s*ImplementationAttribution/.test(readSrc("src/components/ImplementationAttributionNote.tsx")),
    "注記コンポーネントの attribution が任意プロパティになっていない",
  );
  // バリデータ：未設定を欠落エラーにしない（推測での一括付与を促さない）。
  const validator = readSrc("scripts/validate-data.mjs");
  assert.ok(
    /if \(ev\.implementation !== undefined\)/.test(validator),
    "validate-data が implementation 未設定を通常の状態として扱っていない",
  );
  assert.ok(
    !/implementationが(空|ありません|必要)/.test(validator),
    "validate-data が implementation の欠落をエラーにしている（未確認を誤って必須化している）",
  );
  // 実データ：未設定のレコードが実際に多数存在し、それが正常であること。
  assert.ok(events.length - withAttribution.length > 0, "未設定のレコードが1件も無い（後方互換の検査が空振りしている）");
});

check("E2 未設定の実施主体を参照するコードが、すべて省略可能として扱われている（未分類でページが壊れない）", () => {
  const consumerFiles = [
    "src/pages/HistoryPage.tsx",
    "src/pages/TimelineYearPage.tsx",
    "src/components/ImplementationAttributionNote.tsx",
  ];
  const unguarded = [];
  for (const file of consumerFiles) {
    const src = readSrc(file);
    assert.ok(!/implementation!/.test(src), `${file}: implementation に非nullアサーション（!）を使っている`);
    src.split("\n").forEach((line, i) => {
      if (!/\.implementation\./.test(line)) return;
      // 直接のプロパティ参照は、同じ行での存在確認（三項演算子または ?.）を伴うこと。
      if (/\.implementation \?/.test(line) || /\.implementation\?\./.test(line)) return;
      unguarded.push(`${file}:${i + 1}`);
    });
  }
  assert.equal(unguarded.length, 0, `未設定のとき実行時エラーになる参照がある: ${unguarded.join("、")}`);
});

/* --- F. 情報源の信頼階層（LEVEL B 単独で実施主体を確定しない） --------------- */

check("F1 報道（LEVEL B）だけを根拠に実施主体を確定していない", () => {
  // (a) 出典が報道しかない出来事は、実施主体を確定できない（未設定のままにする）。
  //     ドメインだけでなく資料名でも報道を判定し、アーカイブ経由の記事も対象に入れる。
  const newsOnly = events.filter((ev) => {
    const refs = ev.sourceRefs ?? [];
    if (refs.length === 0) return false;
    return refs.every((r) => isNewsHost(primaryHost(r.url)) || NEWS_NAME_RE.test(r.label ?? ""));
  });
  assert.ok(newsOnly.length > 0, "報道のみを出典とする出来事が0件（検査が空振りしている）");
  const wronglyAttributed = newsOnly.filter((ev) => ev.implementation);
  assert.equal(
    wronglyAttributed.length,
    0,
    `報道のみを出典とする出来事に実施主体を付けている: ${wronglyAttributed.map((e) => e.id).join("、")}`,
  );
  // (b) 実施主体の根拠として指定したURLそのものが報道サイトでないこと。
  const violations = [];
  for (const ev of withAttribution) {
    const host = primaryHost(ev.implementation.attributionSourceUrl);
    if (isNewsHost(host)) violations.push(`${ev.id}: ${host}`);
  }
  assert.equal(violations.length, 0, `報道サイトを根拠に実施主体を確定している: ${violations.join("、")}`);
  // 判定関数そのものが機能していること（空振りする検査にしない）。
  assert.ok(isNewsHost("the-miyanichi.co.jp") && isNewsHost("yukan-daily.co.jp"), "新聞ドメインの判定が機能していない");
  assert.ok(!isNewsHost("city.nobeoka.miyazaki.jp"), "延岡市公式サイトを報道と誤判定している");
});

check("F2 実施主体の根拠が、一次資料（LEVEL A）のドメインである", () => {
  // 報道以外にも、個人ブログ・まとめサイト（LEVEL C）を根拠にしないことを固定する。
  for (const ev of withAttribution) {
    const host = primaryHost(ev.implementation.attributionSourceUrl);
    assert.ok(
      isPrimaryHost(host),
      `${ev.id}: 実施主体の根拠が一次資料のドメインではない: ${host || ev.implementation.attributionSourceUrl}`,
    );
  }
  assert.ok(isPrimaryHost("city.nobeoka.miyazaki.jp") && isPrimaryHost("pref.miyazaki.lg.jp"), "一次資料の判定が機能していない");
  assert.ok(!isPrimaryHost("example.com"), "一次資料でないドメインを一次資料と誤判定している");
});

/* --- G. 県関連候補の全件監査 ------------------------------------------------ */

check("G1 県関連の出来事を全件監査し、市と県の取り違えが双方向とも0件である", () => {
  /** 延岡市が主体であることが本文から読み取れる表現。 */
  const CITY_SUBJECT_RE = /延岡市が|延岡市は|延岡市立|市制施行|延岡市.{0,6}(制定|設置|開設|開館|策定)/;
  const prefectureRelated = events.filter(looksPrefectural);
  assert.ok(prefectureRelated.length > 0, "県関連の出来事が0件（抽出条件が壊れている）");

  // (1) 宮崎県のものなのに「延岡市の事業」として公開されているもの
  const shownAsCity = prefectureRelated.filter((ev) => ev.implementation?.nobeokaRelation === "cityProject");
  // (2) 延岡市のものなのに「宮崎県の事業」として公開されているもの
  const shownAsPrefecture = withAttribution.filter(
    (ev) =>
      ev.implementation.implementingBody === "miyazakiPrefecture" &&
      !looksPrefectural(ev) &&
      CITY_SUBJECT_RE.test(`${ev.title} ${ev.summary ?? ""}`),
  );

  assert.equal(shownAsCity.length, 0, `宮崎県のものが延岡市の事業として公開されている: ${shownAsCity.map((e) => e.id).join("、")}`);
  assert.equal(
    shownAsPrefecture.length,
    0,
    `延岡市のものが宮崎県の事業として公開されている: ${shownAsPrefecture.map((e) => e.id).join("、")}`,
  );

  // 未分類の県関連案件を「延岡市の事業」と読ませないための説明が、表示側にあること。
  assert.ok(
    /延岡市内で行われたことと、延岡市が実施したことは別です/.test(readSrc("src/pages/HistoryPage.tsx")),
    "市政年表に、開催地と実施主体が別であることの説明が無い",
  );
  console.log(
    `     （県関連の出来事 ${prefectureRelated.length}件：実施主体を確認済み ${
      prefectureRelated.filter((e) => e.implementation).length
    }件／未確認 ${prefectureRelated.filter((e) => !e.implementation).length}件）`,
  );
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
