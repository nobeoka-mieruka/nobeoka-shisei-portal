/**
 * Phase146：REVIEW（721件）の原因分解（reasonCode）・3段階分類（R1/R2/R3）、
 * およびHOLD（69件）の理由分類（holdReason）の回帰テスト。
 *
 * src/lib/billRiskClassification.tsはTypeScriptのためこのプレーンNodeスクリプトから直接
 * importできない。判定ロジックをミラーして検証する（値がズレた場合はlibファイル側の
 * コメントも合わせて更新すること）。既存のtest-bill-risk-classification.mjs同様の方針。
 *
 * REVIEW/HOLDの母集団は、Phase145開始時点の静的スナップショット
 * （reports/phase145-bill-risk-classification.json）を使う。Phase146はこのスナップショットを
 * 「今回のREVIEW/HOLDの対象母集団」として固定的に扱う方針（Phase145の処理でこの721件・69件が
 * 一切書き換えられていないことは別途確認済み）。ライブ再計算（classifyBillAutomationRisk）を
 * 直接使わない理由は、構造化カテゴリ・市長提出・確定年度だがtranscriptUrl未登録の20件が
 * ライブ再計算だとSAFEに寄ってしまう既知の分類境界のズレ（SOURCE_LINK_MISSING）があり、
 * スナップショットの方がPhase145完了時点の基準値と正確に一致するため。
 *
 * 使い方: node scripts/test-bill-review-reason-classification.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const billVotes = JSON.parse(readFileSync(join(ROOT, "src/data/billVotes.json"), "utf8"));
const risk = JSON.parse(readFileSync(join(ROOT, "reports/phase145-bill-risk-classification.json"), "utf8"));
const billById = new Map(billVotes.map((b) => [b.id, b]));

const STRUCTURED_CATEGORIES = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);

function primaryReasonCode(b) {
  if (b.category === "人事") return "PERSONNEL";
  if (STRUCTURED_CATEGORIES.has(b.category) && b.proposerType === "mayor") return "SOURCE_LINK_MISSING";
  if (b.category === "条例") return "ORDINANCE_COMPLEX";
  return "OTHER_NARRATIVE";
}

function titleStem(title) {
  return title.replace(/[（(].*$/, "").trim();
}

function buildBatchLikelihoodIndex(bills) {
  const sessionCategoryCount = new Map();
  const sessionTitleStemCount = new Map();
  for (const b of bills) {
    const k1 = `${b.session}|${b.category}`;
    sessionCategoryCount.set(k1, (sessionCategoryCount.get(k1) ?? 0) + 1);
    const k2 = `${b.session}|${titleStem(b.billTitle)}`;
    sessionTitleStemCount.set(k2, (sessionTitleStemCount.get(k2) ?? 0) + 1);
  }
  return (b) => {
    const c1 = sessionCategoryCount.get(`${b.session}|${b.category}`) ?? 0;
    const c2 = sessionTitleStemCount.get(`${b.session}|${titleStem(b.billTitle)}`) ?? 0;
    return c1 >= 4 || c2 >= 3;
  };
}
const isLikelyBatch = buildBatchLikelihoodIndex(billVotes);

function tierOf(b) {
  if (b.category === "人事") return "R3";
  if (b.proposerType === "committee") return "R3";
  if (isLikelyBatch(b)) return "R2";
  return "R1";
}

function holdReasonCode(b) {
  if (b.result === "撤回" || b.result === "廃案") return "WITHDRAWN_OR_ABANDONED";
  if (b.category === "請願" || b.category === "陳情") return "PETITION_STRUCTURE";
  if (b.category === "意見書" || b.category === "決議") return "STATEMENT_STRUCTURE";
  return "OTHER";
}

console.log("\nREVIEW原因分解・R1/R2/R3分類・HOLD理由分類の現況");

const reviewBills = risk.REVIEW.map((id) => billById.get(id));
const holdBills = risk.HOLD.map((id) => billById.get(id));

check("Phase145起点スナップショットのREVIEWが721件、HOLDが69件のままである（Phase146はこの母集団に対して分類のみを行い、母集団自体を変更していない）", () => {
  assert.equal(risk.REVIEW.length, 721, `REVIEWが721件ではありません（${risk.REVIEW.length}件）`);
  assert.equal(risk.HOLD.length, 69, `HOLDが69件ではありません（${risk.HOLD.length}件）`);
  assert.ok(reviewBills.every(Boolean), "REVIEWスナップショットのidにbillVotes.json上で見つからないものがあります");
  assert.ok(holdBills.every(Boolean), "HOLDスナップショットのidにbillVotes.json上で見つからないものがあります");
});

check("REVIEW 721件のprimaryReason（reasonCode）は必ず1つに決まり、4分類の合計が721件と一致する", () => {
  const counts = { PERSONNEL: 0, SOURCE_LINK_MISSING: 0, ORDINANCE_COMPLEX: 0, OTHER_NARRATIVE: 0 };
  for (const b of reviewBills) counts[primaryReasonCode(b)]++;
  const sum = Object.values(counts).reduce((a, c) => a + c, 0);
  assert.equal(sum, 721, `primaryReasonの合計が721件ではありません（${sum}件）: ${JSON.stringify(counts)}`);
  assert.equal(counts.PERSONNEL, 95, `PERSONNELが95件ではありません（${counts.PERSONNEL}件）`);
  assert.equal(counts.SOURCE_LINK_MISSING, 20, `SOURCE_LINK_MISSINGが20件ではありません（${counts.SOURCE_LINK_MISSING}件）`);
  assert.equal(counts.ORDINANCE_COMPLEX, 323, `ORDINANCE_COMPLEXが323件ではありません（${counts.ORDINANCE_COMPLEX}件）`);
  assert.equal(counts.OTHER_NARRATIVE, 283, `OTHER_NARRATIVEが283件ではありません（${counts.OTHER_NARRATIVE}件）`);
});

check("ORDINANCE_COMPLEXに分類される議案は、すべてcategory=条例である（他カテゴリの紛れ込みが無い）", () => {
  const wrong = reviewBills.filter((b) => primaryReasonCode(b) === "ORDINANCE_COMPLEX" && b.category !== "条例");
  assert.equal(wrong.length, 0, `ORDINANCE_COMPLEXなのにcategoryが条例でない議案があります: ${wrong.map((b) => b.id).join("、")}`);
});

check("REVIEW 721件のR1/R2/R3合計が721件と一致し、R1（NEAR_SAFE候補）は36件である", () => {
  const counts = { R1: 0, R2: 0, R3: 0 };
  for (const b of reviewBills) counts[tierOf(b)]++;
  const sum = counts.R1 + counts.R2 + counts.R3;
  assert.equal(sum, 721, `R1+R2+R3の合計が721件ではありません（${sum}件）: ${JSON.stringify(counts)}`);
  assert.equal(counts.R1, 36, `R1が36件ではありません（${counts.R1}件）`);
  assert.equal(counts.R2, 583, `R2が583件ではありません（${counts.R2}件）`);
  assert.equal(counts.R3, 102, `R3が102件ではありません（${counts.R3}件）`);
});

check("R3には、人事案件と委員会・議員提出議案のみが含まれる（それ以外のR3への混入が無い）", () => {
  const r3 = reviewBills.filter((b) => tierOf(b) === "R3");
  const wrong = r3.filter((b) => b.category !== "人事" && b.proposerType !== "committee");
  assert.equal(wrong.length, 0, `R3のはずが人事でも委員会提出でもない議案があります: ${wrong.map((b) => b.id).join("、")}`);
});

check("HOLD 69件のholdReasonは必ず1つに決まり、3分類（意見書決議/請願陳情/撤回廃案）の合計が69件と一致する（人事等のOTHERは0件）", () => {
  const counts = { WITHDRAWN_OR_ABANDONED: 0, PETITION_STRUCTURE: 0, STATEMENT_STRUCTURE: 0, OTHER: 0 };
  for (const b of holdBills) counts[holdReasonCode(b)]++;
  const sum = Object.values(counts).reduce((a, c) => a + c, 0);
  assert.equal(sum, 69, `holdReasonの合計が69件ではありません（${sum}件）: ${JSON.stringify(counts)}`);
  assert.equal(counts.STATEMENT_STRUCTURE, 36, `STATEMENT_STRUCTUREが36件ではありません（${counts.STATEMENT_STRUCTURE}件）`);
  assert.equal(counts.PETITION_STRUCTURE, 30, `PETITION_STRUCTUREが30件ではありません（${counts.PETITION_STRUCTURE}件）`);
  assert.equal(counts.WITHDRAWN_OR_ABANDONED, 3, `WITHDRAWN_OR_ABANDONEDが3件ではありません（${counts.WITHDRAWN_OR_ABANDONED}件）`);
});

check("HOLD（69件）は、今回データ抽出・要約・公開レベルの変更を一切受けていない（分類のみの方針が守られている）", () => {
  const touched = holdBills.filter((b) => b.sourceTextVerifiedAt === "2026-09-01");
  assert.equal(touched.length, 0, `HOLDの議案でsourceTextVerifiedAtがPhase146の日付になっているものがあります（分類のみのはずが本文確認済みになっている）: ${touched.map((b) => b.id).join("、")}`);
});

check("3軸（sourceRetrievalStatus／summaryQuality／riskClassification）は独立して定義されており、内部コードraw値（R1/R2/R3、SOURCE_LINK_MISSING等）がsrc配下の画面表示コードへ文字列リテラルとして直書きされていない（項目26：内部向けコードを市民向けUIにそのまま出さない）", () => {
  function walk(dir) {
    let files = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) files = files.concat(walk(full));
      else if (/\.(tsx|ts)$/.test(entry) && !entry.includes("billRiskClassification")) files.push(full);
    }
    return files;
  }
  const targets = walk(join(ROOT, "src/pages")).concat(walk(join(ROOT, "src/components")));
  const leaks = [];
  for (const f of targets) {
    const content = readFileSync(f, "utf8");
    if (/["'`](SOURCE_LINK_MISSING|ORDINANCE_COMPLEX|OTHER_NARRATIVE|R1|R2|R3)["'`]/.test(content)) {
      leaks.push(f.replace(ROOT, ""));
    }
  }
  assert.equal(leaks.length, 0, `内部リスク分類コードが画面表示コードに直書きされています: ${leaks.join("、")}`);
});

check("Phase146で新たにLevel2/Level3へ昇格した26件は、すべてR1（NEAR_SAFE候補36件）の部分集合である（R2/R3を一括処理していない）", () => {
  const r1Ids = new Set(reviewBills.filter((b) => tierOf(b) === "R1").map((b) => b.id));
  const promoted = billVotes.filter((b) => b.sourceTextVerifiedAt === "2026-09-01" && risk.REVIEW.includes(b.id));
  assert.equal(promoted.length, 26, `Phase146で本文確認済みになったREVIEW由来の議案が26件ではありません（${promoted.length}件）`);
  const outsideR1 = promoted.filter((b) => !r1Ids.has(b.id));
  assert.equal(outsideR1.length, 0, `R1以外（R2/R3）が処理されています: ${outsideR1.map((b) => b.id).join("、")}`);
});

check("議案境界の回帰：Phase146で新たに本文確認した隣接議案（議案第52号・第53号、令和7年9月定例会）は、reasonが互いの文言を含んでいない（文脈混入が無い）", () => {
  const b52 = billById.get("2025-09-gian-52");
  const b53 = billById.get("2025-09-gian-53");
  assert.ok(b52?.reason && b53?.reason, "議案第52号・第53号のreasonが未設定です");
  assert.ok(!b52.reason.includes("児童館"), "議案第52号のreasonに議案第53号（児童館設置条例）の内容が混入しています");
  assert.ok(!b53.reason.includes("災害弔慰金"), "議案第53号のreasonに議案第52号（災害弔慰金条例）の内容が混入しています");
});

check("元号境界の回帰：Phase146で発見・修正した「複数回登壇」バグの実例（令和元年6月定例会・議案第19号）が、実データでも正しくLevel3化されている", () => {
  const b19 = billById.get("2019-06-gian-19");
  assert.ok(b19?.reason, "議案第19号（指定管理者の指定）のreasonが未設定です（Phase146の降壇バグ修正が実データへ反映されていません）");
  assert.ok(b19.reason.includes("延岡市富美山地区コミュニティセンター"), "議案第19号のreasonの内容が期待と異なります");
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
