#!/usr/bin/env node
/**
 * Phase219：和暦（元号）年・年度表記の回帰テスト。
 *
 * 背景：画面側（src/config/site.ts）の年度表記は「令和＝西暦−2018」という式だけを、元号の
 * 分岐なしにすべての年へ適用していた。そのため令和より前の年度に対して「令和-18年度」
 * （2000年度＝平成12年度）「令和0年度」（2018年度＝平成30年度）という実在しない表記を生成し、
 * /dashboard の一般質問年度別集計と /council-documents の年度見出しへ計30箇所出力していた。
 * スクリプト側（scripts/lib/council-shared.mjs の eraYearFor）はPhase163で同じ誤りを修正済みで、
 * 画面側だけが取り残されていた。
 *
 * このテストは、正規表現で文言を検査するだけでなく、実データ（councilSessions.json 全61会期、
 * councilSpeechSummaries.json の確認済み一般質問 全件、committeeActivityReports.json、
 * mayorPromises.json の最終確認日）を1件残らず実際の変換関数へ通し、生成される表記が
 * 実在する元号年度になっていることを確認する。
 *
 * 「令和0年度」を0へ丸めたり、負の年度を非表示にしたりして見た目を取り繕う変更を防ぐため、
 * 期待値は「元号が正しく切り替わること」であって「負の数が出ないこと」だけではない。
 *
 * 使い方: node --experimental-strip-types scripts/test-era-year-labels.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { eraYearFor } from "./lib/council-shared.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

const { toEraYearLabel, toEraFiscalYearLabel, toFiscalYearLabel, fiscalYearOfIsoDate } = await import(
  pathToFileURL(join(ROOT, "src/config/site.ts")).href
);

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

/** 実在しない元号年（令和0年・令和-3年度・平成0年 等）の形。表示のどこにも現れてはいけない。 */
const INVALID_ERA_RE = /(令和|平成|昭和)\s*(-\s*\d+|0+)\s*年/;

function assertValidEraLabel(label, context) {
  assert.ok(
    !INVALID_ERA_RE.test(label),
    `実在しない元号表記が生成されました: "${label}"（${context}）。0へ丸めるのではなく、元号の分岐で解消すること。`,
  );
  assert.ok(
    /^(令和|平成|昭和)(元|[1-9]\d*)年度?$|^西暦\d+年度?$/.test(label),
    `元号年の書式として不正です: "${label}"（${context}）`,
  );
}

console.log("\nPhase219：和暦（元号）年・年度表記");

check("元号の境界が正しい（令和元年=2019年 / 平成元年=1989年 / 昭和元年=1926年）。2018年以前を令和として表示しない", () => {
  assert.equal(toEraYearLabel(2019), "令和元年");
  assert.equal(toEraYearLabel(2020), "令和2年");
  assert.equal(toEraYearLabel(2026), "令和8年");
  assert.equal(toEraYearLabel(2018), "平成30年");
  assert.equal(toEraYearLabel(2000), "平成12年");
  assert.equal(toEraYearLabel(1989), "平成元年");
  assert.equal(toEraYearLabel(1988), "昭和63年");
  assert.equal(toEraYearLabel(1926), "昭和元年");
  // 大正以前は本サイトの対象外。推測で元号を割り当てず西暦のまま表示する。
  assert.equal(toEraYearLabel(1925), "西暦1925年");
});

check("年度表記も同じ境界で切り替わる（2019年度=令和元年度 / 2018年度=平成30年度 / 2000年度=平成12年度）", () => {
  assert.equal(toEraFiscalYearLabel(2019), "令和元年度");
  assert.equal(toEraFiscalYearLabel(2018), "平成30年度");
  assert.equal(toEraFiscalYearLabel(2000), "平成12年度");
  assert.equal(toEraFiscalYearLabel(2026), "令和8年度");
});

check("ISO日付からの年度表記は4月始まり（2019-03-31は平成30年度、2019-04-01は令和元年度）", () => {
  assert.equal(fiscalYearOfIsoDate("2019-03-31"), 2018);
  assert.equal(fiscalYearOfIsoDate("2019-04-01"), 2019);
  assert.equal(toFiscalYearLabel("2019-03-31"), "平成30年度");
  assert.equal(toFiscalYearLabel("2019-04-01"), "令和元年度");
  assert.equal(toFiscalYearLabel("2026-07-11"), "令和8年度");
});

check("画面側（src/config/site.ts）とスクリプト側（scripts/lib/council-shared.mjs の eraYearFor）の元号換算が、1900〜2100年の全年で一致する（換算式を二重管理しない）", () => {
  const mismatches = [];
  for (let year = 1900; year <= 2100; year += 1) {
    if (toEraYearLabel(year) !== eraYearFor(year)) {
      mismatches.push(`${year}: 画面="${toEraYearLabel(year)}" / スクリプト="${eraYearFor(year)}"`);
    }
  }
  assert.equal(mismatches.length, 0, `元号換算が一致しません:\n${mismatches.join("\n")}`);
});

check("1900〜2100年のどの年度にも、実在しない元号表記（令和0年度・令和-N年度 等）が生成されない", () => {
  for (let fiscalYear = 1900; fiscalYear <= 2100; fiscalYear += 1) {
    assertValidEraLabel(toEraFiscalYearLabel(fiscalYear), `fiscalYear=${fiscalYear}`);
  }
});

// --- ここから実データ全件を通した回帰テスト ---

const councilSessions = readJson("src/data/councilSessions.json");
const speechSummaries = readJson("src/data/councilSpeechSummaries.json");
const speechPeriod = readJson("src/config/councilSpeechPeriod.json");
const committeeActivityReports = readJson("src/data/committeeActivityReports.json");
const mayorPromises = readJson("src/data/mayorPromises.json").promises;
const questionLikeSpeechTypes = new Set(["一般質問", "代表質問", "関連質問", "総括質疑", "総括質疑・一般質問"]);

const isWithinPeriod = (date) =>
  !!date && date >= speechPeriod.from && (speechPeriod.to == null || date <= speechPeriod.to);

/** src/lib/councilSpeeches.ts の publicSpeeches / questionLikeSpeeches と同じ抽出条件。 */
const confirmedQuestions = speechSummaries.members.flatMap((record) =>
  record.speeches
    .filter(
      (speech) =>
        speech.isPublished &&
        (record.isFormerMember === true || speech.term === "previous" || isWithinPeriod(speech.date)),
    )
    .filter((speech) => questionLikeSpeechTypes.has(speech.speechType)),
);

check(`councilSessions.json の全${councilSessions.length}会期の年度が、実在する元号年度へ変換される`, () => {
  assert.ok(councilSessions.length > 0, "councilSessions.json が空です");
  for (const session of councilSessions) {
    assertValidEraLabel(toEraFiscalYearLabel(session.fiscalYear), `${session.id}（fiscalYear=${session.fiscalYear}）`);
  }
});

check("councilSessions.json の eraYear（データ側の実値）と、画面側の元号換算が一致する（改元年は日単位の判定が必要なため、その年に限り両方の元号を許容する）", () => {
  const CHANGE_YEARS = new Map([
    // 改元年は年の途中で元号が変わるため、年単位の換算では一方に決められない。
    // councilSessions.json は会期の開催月まで見た実データ（例：2019-03＝平成31年3月定例会）を持つ。
    [2019, ["令和元年", "平成31年"]],
    [1989, ["平成元年", "昭和64年"]],
  ]);
  for (const session of councilSessions) {
    const allowed = CHANGE_YEARS.get(session.year) ?? [toEraYearLabel(session.year)];
    assert.ok(
      allowed.includes(session.eraYear),
      `${session.id} の eraYear "${session.eraYear}" が元号換算（${allowed.join(" または ")}）と一致しません`,
    );
  }
});

check(`確認済み一般質問 全${confirmedQuestions.length}件の年度別集計ラベルが、すべて実在する元号年度になる（/dashboard の年度別集計）`, () => {
  assert.ok(confirmedQuestions.length > 0, "確認済み一般質問が0件です（抽出条件が壊れている可能性があります）");
  const fiscalYearBySessionId = new Map(councilSessions.map((s) => [s.id, s.fiscalYear]));
  const labels = new Set();
  for (const speech of confirmedQuestions) {
    const fiscalYear = fiscalYearBySessionId.get(speech.sessionId);
    if (fiscalYear === undefined) continue; // councilSessions.json に無い会期は集計対象外（推測しない）
    const label = toEraFiscalYearLabel(fiscalYear);
    assertValidEraLabel(label, `${speech.id}（sessionId=${speech.sessionId}）`);
    labels.add(label);
  }
  // 令和より前の会期の一般質問（平成12年度〜平成30年度）が実在することを固定する。
  // これらが「令和-18年度」「令和0年度」として表示されていたのが本Phaseの不具合。
  assert.ok(labels.has("平成12年度"), "平成12年度（2000年度）の一般質問が集計対象から消えています");
  assert.ok(labels.has("平成30年度"), "平成30年度（2018年度）の一般質問が集計対象から消えています");
  assert.ok(labels.has("令和元年度"), "令和元年度（2019年度）の一般質問が集計対象から消えています");
});

check(`committeeActivityReports.json 全${committeeActivityReports.length}件の年度表記が実在する元号年度になる`, () => {
  for (const report of committeeActivityReports) {
    assertValidEraLabel(toEraFiscalYearLabel(report.fiscalYear), `${report.id}（fiscalYear=${report.fiscalYear}）`);
  }
});

check(`mayorPromises.json 全${mayorPromises.length}件の最終確認日から作る年度絞り込みラベルが実在する元号年度になる`, () => {
  for (const promise of mayorPromises) {
    if (!promise.lastVerified) continue;
    assertValidEraLabel(toFiscalYearLabel(promise.lastVerified), `${promise.id}（lastVerified=${promise.lastVerified}）`);
  }
});

// --- 換算式の再導入を防ぐソースコード検査 ---

function listSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

check("src配下に、元号の分岐なしで年度を計算する式（`令和${year - 2018}年` 等）が再導入されていない", () => {
  const ERA_ARITHMETIC_RE = /(令和|平成|昭和)\s*[{$]\{?[^}\n]*(?:[-+]\s*(?:19\d\d|20\d\d)|(?:19\d\d|20\d\d)\s*[-+])/;
  const offenders = [];
  for (const file of listSourceFiles(join(ROOT, "src"))) {
    const source = readFileSync(file, "utf8");
    for (const [index, line] of source.split(/\r?\n/).entries()) {
      // src/config/site.ts のコメント（この式を書かないという説明）は対象外。
      if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) continue;
      if (ERA_ARITHMETIC_RE.test(line)) {
        offenders.push(`${file.slice(ROOT.length)}:${index + 1}: ${line.trim()}`);
      }
    }
  }
  assert.equal(
    offenders.length,
    0,
    `元号換算をページ側で直接計算しています（src/config/site.ts の toEraYearLabel / toEraFiscalYearLabel を使うこと）:\n${offenders.join("\n")}`,
  );
});

console.log(`\n[test-era-year-labels] ${passCount} check(s) passed.`);
