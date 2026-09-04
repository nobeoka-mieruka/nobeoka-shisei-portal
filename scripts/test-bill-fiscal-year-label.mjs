/**
 * Phase220 の回帰テスト：議案の「年度」が何を指すのかを固定する。
 *
 * 背景：
 * 議案詳細ページの見出しが「年度」とだけ書かれていたため、
 * 「令和8年度水道事業会計予算」（議案名）なのに「年度：令和7年度」と表示され、
 * 市民には矛盾して見えていた。調査の結果、`billVotes.fiscalYear` は
 * **会期年度**（議案を審議した定例会・臨時会が属する年度、4月始まり）であり、
 * 議案名の年度（予算・決算などの対象年度）とは別概念で、**データは正しい**と確認した。
 *
 * 固定したいこと：
 * 1. `billVotes.fiscalYear` は会期年度である（councilSessions の fiscalYear と全件一致し、
 *    議決日・提出日の属する年度とも一致する）。将来この意味が黙って変わらないようにする。
 * 2. 会期年度と議案名の年度が食い違う実データ（当初予算・決算など）が実在し続けること。
 *    fixture: scripts/fixtures/bill-fiscal-year-cases.json
 *    ＝「見かけ上一致させる」修正が入っていないことの検証。
 * 3. 画面ラベルが「年度」単独ではなく、実際の意味（会期年度）を示していること。
 * 4. 説明の判定ロジック（src/lib/billFiscalYear.ts）が fixture どおりに動くこと。
 *
 * 使い方: node --experimental-strip-types scripts/test-bill-fiscal-year-label.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const readText = (p) => readFileSync(join(ROOT, p), "utf8");

const {
  BILL_SESSION_FISCAL_YEAR_LABEL,
  BILL_SESSION_FISCAL_YEAR_HINT,
  BILL_SESSION_FISCAL_YEAR_DESCRIPTION,
  parseJapaneseFiscalYearLabel,
  findFiscalYearLabelInBillTitle,
  billTitleFiscalYearNote,
} = await import("../src/lib/billFiscalYear.ts");

const bills = readJson("src/data/billVotes.json");
const sessions = readJson("src/data/councilSessions.json");
const fixture = readJson("scripts/fixtures/bill-fiscal-year-cases.json");

const billById = new Map(bills.map((b) => [b.id, b]));
const sessionFiscalYearById = new Map(sessions.map((s) => [s.id, s.fiscalYear]));

/** ISO日付が属する年度（4月始まり）の開始年を返す。 */
function fiscalYearOfIsoDate(iso) {
  const [y, m] = iso.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

console.log("\nPhase220：議案の年度（会期年度／対象年度）");

check("和暦年度ラベルを西暦の年度へ変換できる（元年・平成・不正値を含む）", () => {
  assert.equal(parseJapaneseFiscalYearLabel("令和7年度"), 2025);
  assert.equal(parseJapaneseFiscalYearLabel("令和元年度"), 2019);
  assert.equal(parseJapaneseFiscalYearLabel("平成31年度"), 2019);
  assert.equal(parseJapaneseFiscalYearLabel("令和7年"), null, "「年度」でない表記を年度として解釈してはいけない");
  assert.equal(parseJapaneseFiscalYearLabel("2025年度"), null, "西暦表記は和暦ラベルとして解釈しない");
});

check("billVotes.fiscalYear は会期年度である（councilSessions の fiscalYear と全件一致）", () => {
  const mismatches = [];
  for (const b of bills) {
    const sessionFiscalYear = sessionFiscalYearById.get(b.sessionId);
    assert.notEqual(sessionFiscalYear, undefined, `${b.id}: sessionId ${b.sessionId} が councilSessions に無い`);
    const parsed = parseJapaneseFiscalYearLabel(b.fiscalYear);
    assert.notEqual(parsed, null, `${b.id}: fiscalYear「${b.fiscalYear}」を年度として解釈できない`);
    if (parsed !== sessionFiscalYear) mismatches.push(`${b.id}（${b.fiscalYear} / 会期 ${sessionFiscalYear}）`);
  }
  assert.equal(mismatches.length, 0, `会期年度と一致しない議案があります: ${mismatches.slice(0, 5).join(", ")}`);
});

check("会期年度は議決日・提出日が属する年度とも一致する（＝対象年度ではないことの裏づけ）", () => {
  const voteMismatch = [];
  const submitMismatch = [];
  let withVotingDate = 0;
  let withSubmittedDate = 0;
  for (const b of bills) {
    const parsed = parseJapaneseFiscalYearLabel(b.fiscalYear);
    if (b.votingDate) {
      withVotingDate += 1;
      if (fiscalYearOfIsoDate(b.votingDate) !== parsed) voteMismatch.push(`${b.id}（${b.votingDate}）`);
    }
    if (b.submittedDate) {
      withSubmittedDate += 1;
      if (fiscalYearOfIsoDate(b.submittedDate) !== parsed) submitMismatch.push(`${b.id}（${b.submittedDate}）`);
    }
  }
  assert.ok(withVotingDate > 1000, `議決日を持つ議案が少なすぎます（${withVotingDate}件）`);
  assert.ok(withSubmittedDate > 300, `提出日を持つ議案が少なすぎます（${withSubmittedDate}件）`);
  assert.equal(voteMismatch.length, 0, `議決日の年度と会期年度が食い違う議案: ${voteMismatch.slice(0, 5).join(", ")}`);
  assert.equal(
    submitMismatch.length,
    0,
    `提出日の年度と会期年度が食い違う議案: ${submitMismatch.slice(0, 5).join(", ")}`,
  );
});

check("議案名からの年度抽出は、書かれている表記をそのまま取り出す（無い場合は補わない）", () => {
  assert.deepEqual(findFiscalYearLabelInBillTitle("令和8年度水道事業会計予算"), { label: "令和8年度", year: 2026 });
  assert.deepEqual(findFiscalYearLabelInBillTitle("財産の取得（追認：令和2年度小学校教師用指導書（前期分））"), {
    label: "令和2年度",
    year: 2020,
  });
  assert.equal(findFiscalYearLabelInBillTitle("延岡市印鑑の登録及び証明に関する条例の一部を改正する条例の制定"), null);
  assert.equal(findFiscalYearLabelInBillTitle("工事請負契約の締結（延岡市庁舎)"), null);
});

check("fixture の議案がすべて実データに存在し、会期年度・議案名・議決日が変わっていない", () => {
  assert.ok(fixture.cases.length >= 12, `fixture の件数が少なすぎます（${fixture.cases.length}件）`);
  for (const c of fixture.cases) {
    const b = billById.get(c.id);
    assert.ok(b, `fixture の議案 ${c.id} が billVotes.json にありません`);
    assert.equal(b.fiscalYear, c.sessionFiscalYear, `${c.id}: 会期年度が変わっています`);
    assert.equal(b.billTitle, c.billTitle, `${c.id}: 議案名が変わっています`);
    assert.equal(b.session, c.session, `${c.id}: 会期名が変わっています`);
    assert.equal(b.category, c.category, `${c.id}: 分類が変わっています`);
    assert.equal(b.votingDate ?? null, c.votingDate, `${c.id}: 議決日が変わっています`);
  }
});

check("会期年度と議案名の対象年度が異なる議案が、一致させられずに残っている", () => {
  const differing = fixture.cases.filter((c) => c.expectExplanation);
  assert.ok(differing.length >= 9, `食い違い事例の fixture が少なすぎます（${differing.length}件）`);
  for (const c of differing) {
    const b = billById.get(c.id);
    const inTitle = findFiscalYearLabelInBillTitle(b.billTitle);
    assert.ok(inTitle, `${c.id}: 議案名から年度を取り出せません`);
    assert.equal(inTitle.label, c.titleFiscalYear, `${c.id}: 議案名の年度が変わっています`);
    assert.notEqual(
      inTitle.year,
      parseJapaneseFiscalYearLabel(b.fiscalYear),
      `${c.id}: 会期年度と対象年度が一致してしまいました。` +
        `見かけ上そろえるためにデータを書き換えていないか確認してください（両方とも公式資料どおりの正しい値です）。`,
    );
  }
  // 予算（3月定例会で翌年度）と決算（9月定例会で前年度）の両方向を必ず含めておく。
  const categories = new Set(differing.map((c) => c.category));
  assert.ok(categories.has("予算"), "翌年度を対象とする予算議案の事例が fixture にありません");
  assert.ok(categories.has("決算"), "前年度を対象とする決算議案の事例が fixture にありません");
  assert.ok(categories.size >= 4, "予算・決算以外の分類でも食い違うことを示す事例が不足しています");
});

check("billTitleFiscalYearNote() が fixture の期待どおりに説明の有無を判定する", () => {
  for (const c of fixture.cases) {
    const b = billById.get(c.id);
    const note = billTitleFiscalYearNote(b);
    if (c.expectExplanation) {
      assert.ok(note, `${c.id}: 年度の違いの説明が出るべきなのに出ません`);
      assert.equal(note.sessionFiscalYearLabel, c.sessionFiscalYear);
      assert.equal(note.titleFiscalYearLabel, c.titleFiscalYear);
    } else {
      assert.equal(note, null, `${c.id}: 年度が食い違わないのに説明が出ています`);
    }
  }
});

check("実データ全体でも、説明が出る議案は必ず2つの年度が実際に異なる", () => {
  let explained = 0;
  for (const b of bills) {
    const note = billTitleFiscalYearNote(b);
    if (!note) continue;
    explained += 1;
    assert.notEqual(
      parseJapaneseFiscalYearLabel(note.sessionFiscalYearLabel),
      parseJapaneseFiscalYearLabel(note.titleFiscalYearLabel),
      `${b.id}: 同じ年度なのに違いの説明が出ています`,
    );
  }
  assert.ok(explained >= 100, `説明対象の議案が想定より少なすぎます（${explained}件）`);
  console.log(`     （議案名の年度と会期年度が異なる議案：${explained}件 / 全${bills.length}件）`);
});

check("画面ラベルが「年度」単独ではなく、実際の意味を示している", () => {
  assert.equal(BILL_SESSION_FISCAL_YEAR_LABEL, "会期年度");
  assert.notEqual(BILL_SESSION_FISCAL_YEAR_LABEL, "年度", "「年度」単独のラベルへ戻してはいけない");
  assert.ok(BILL_SESSION_FISCAL_YEAR_HINT.includes("年度"));
  assert.ok(
    BILL_SESSION_FISCAL_YEAR_DESCRIPTION.includes("4月") && BILL_SESSION_FISCAL_YEAR_DESCRIPTION.includes("議案名"),
    "用語解説に、年度の区切りと議案名の年度との違いが書かれていません",
  );
  for (const text of [BILL_SESSION_FISCAL_YEAR_LABEL, BILL_SESSION_FISCAL_YEAR_HINT, BILL_SESSION_FISCAL_YEAR_DESCRIPTION]) {
    assert.ok(!/fiscalYear|billTitle|sessionId/.test(text), `市民向けの文に内部コードが混入しています: ${text}`);
  }
});

check("議案の画面が fiscalYear を「年度」というラベルのまま表示していない", () => {
  const detail = readText("src/pages/BillVoteDetailPage.tsx");
  assert.ok(
    detail.includes("BILL_SESSION_FISCAL_YEAR_LABEL"),
    "議案詳細ページが billFiscalYear.ts のラベルを使っていません",
  );
  assert.ok(
    !/>年度<\/dt>/.test(detail),
    "議案詳細ページに「年度」単独の見出しが残っています（会期年度と書くこと）",
  );
  const list = readText("src/pages/BillVotesPage.tsx");
  assert.ok(
    !/FilterSelect label="年度"/.test(list),
    "議案一覧の絞り込みに「年度」単独のラベルが残っています",
  );
  assert.ok(
    !/{ header: "年度"/.test(list),
    "議案一覧のCSV見出しに「年度」単独が残っています",
  );
});

console.log(`\n${passCount} checks passed（Phase220：議案の年度ラベル）\n`);
