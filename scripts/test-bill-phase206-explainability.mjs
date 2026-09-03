/**
 * Phase206・Phase207 の回帰テスト。
 *
 * 固定したいこと：
 * 1. 詳細説明がまだ無い議案は、必ずいずれか1つの説明可能性コードに分類され、合計が一致すること
 *    （「分類できないもの」を黙って落とさない）。
 * 2. 説明文（reason / mainChanges / citizenImpact）または共通説明（sharedProposalStatement）を
 *    掲載している議案は、**必ず根拠URL（sourceRef）を持つ**こと。
 *    ＝出典の無い説明を1件も作らないことの自動検証。
 * 3. sharedProposalStatement は原文引用であり、その引用が複数議案の一括説明であること
 *    （個別の提案理由を共通説明で代用していないこと）。
 * 4. Phase207 が登録した提出理由（reason）は、verificationNote に既に転記済みの原文引用と
 *    **完全一致**すること（＝要約・言い換え・推測が混入していないこと）。
 * 5. 市民向けの表示文に内部コードが混入していないこと。
 * 6. 議案総数は 1,177 件のまま変わらないこと。
 *
 * 使い方: node --experimental-strip-types scripts/test-bill-phase206-explainability.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const { getBillExplanationLevel, hasCitizenSummary } = await import("../src/lib/billSummaryQuality.ts");
const {
  classifyBillExplainability,
  extractQuotedStatement,
  isSharedStatement,
  BILL_EXPLAINABILITY_CITIZEN_LABEL,
  BILL_EXPLAINABILITY_CITIZEN_DESCRIPTION,
} = await import("../src/lib/billExplainability.ts");

const CODES = [
  "EXPLAINABLE_FROM_PRIMARY",
  "NO_INDIVIDUAL_REASON_CONFIRMED",
  "SHARED_REASON",
  "SOURCE_NEEDS_STRUCTURING",
  "SOURCE_INSUFFICIENT",
  "HUMAN_REVIEW",
];

const bills = readJson("src/data/billVotes.json");

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

console.log("\nPhase206・207：議案説明の説明可能性と出典");

check("議案総数は1,177件のまま", () => {
  assert.equal(bills.length, 1177, `議案総数が1177件ではありません（${bills.length}件）`);
});

check("詳細説明が無い議案は、必ず既知の説明可能性コードのいずれかに分類される（合計が一致する）", () => {
  const targets = bills.filter((b) => getBillExplanationLevel(b) !== 3);
  const counts = Object.fromEntries(CODES.map((c) => [c, 0]));
  let unclassified = 0;
  for (const b of targets) {
    const r = classifyBillExplainability(b, getBillExplanationLevel(b));
    if (!r || !CODES.includes(r.code)) unclassified += 1;
    else counts[r.code] += 1;
  }
  assert.equal(unclassified, 0, `分類できない議案が${unclassified}件あります`);
  const sum = CODES.reduce((n, c) => n + counts[c], 0);
  assert.equal(sum, targets.length, `分類合計（${sum}）が対象件数（${targets.length}）と一致しません`);
});

check("Level3（一次資料に基づく説明あり）の議案は、必ず根拠URL（会議録リンク）を持つ", () => {
  const missing = bills
    .filter((b) => hasCitizenSummary(b))
    .filter((b) => !b.transcriptUrl && !(b.relatedDocumentUrls ?? []).some((d) => d.sourceType === "会議録"))
    .map((b) => b.id);
  assert.deepEqual(missing, [], `出典の無い説明があります: ${missing.join(", ")}`);
});

check("sharedProposalStatement を持つ議案は、必ず引用元URL・ファイル名・確認日を持ち、根拠URLが登録されている", () => {
  const withShared = bills.filter((b) => b.sharedProposalStatement);
  assert.ok(withShared.length > 0, "sharedProposalStatement を持つ議案が1件もありません");
  for (const b of withShared) {
    const s = b.sharedProposalStatement;
    assert.ok(s.quote && s.quote.length > 0, `${b.id}: 引用が空です`);
    assert.match(s.sourceFileName, /^R\d{6}[A-Z]$/, `${b.id}: 会議録ファイル名の形式が不正です（${s.sourceFileName}）`);
    assert.ok(s.sourceUrl.includes(s.sourceFileName), `${b.id}: 引用元URLにファイル名が含まれていません`);
    assert.match(s.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${b.id}: 確認日の形式が不正です`);
    assert.ok(s.generatedFrom && s.generatedFrom.length > 0, `${b.id}: 引用の取得元が記録されていません`);
    const hasRef = (b.relatedDocumentUrls ?? []).some((d) => d.url === s.sourceUrl);
    assert.ok(hasRef, `${b.id}: 共通説明の出典が relatedDocumentUrls に登録されていません`);
  }
});

check("sharedProposalStatement の引用は、必ず複数議案の一括説明である（個別理由の代用にしていない）", () => {
  const bad = bills
    .filter((b) => b.sharedProposalStatement)
    .filter((b) => !isSharedStatement(b.sharedProposalStatement.quote))
    .map((b) => b.id);
  assert.deepEqual(bad, [], `一括説明でない引用が共通説明として登録されています: ${bad.join(", ")}`);
});

check("共通説明のみが確認できた議案には、個別の提出理由（reason）を書いていない", () => {
  const bad = bills.filter((b) => b.sharedProposalStatement && b.reason).map((b) => b.id);
  assert.deepEqual(bad, [], `共通説明しか無いのに個別の提出理由が入っています: ${bad.join(", ")}`);
});

check("Phase207 が登録した提出理由は、verificationNote の原文引用と完全一致する（要約・推測の混入なし）", () => {
  const targets = bills.filter((b) => (b.verificationNote ?? "").includes("Phase206-207追記") && b.reason);
  assert.ok(targets.length > 0, "Phase207 が提出理由を登録した議案が1件もありません");
  for (const b of targets) {
    const quote = extractQuotedStatement(b.verificationNote);
    assert.ok(quote, `${b.id}: verificationNote から原文引用を取り出せません`);
    assert.equal(b.reason, quote, `${b.id}: 提出理由が原文引用と一致しません（加筆・要約の疑い）`);
    assert.ok(
      b.summary.startsWith(quote),
      `${b.id}: 概要が原文引用から始まっていません（機械生成文が混ざっている疑い）`,
    );
    assert.equal(b.summarySource, "manual", `${b.id}: summarySource が manual ではありません`);
  }
});

check("市民向けの表示文に内部コードが混入していない", () => {
  for (const code of CODES) {
    const label = BILL_EXPLAINABILITY_CITIZEN_LABEL[code];
    const description = BILL_EXPLAINABILITY_CITIZEN_DESCRIPTION[code];
    assert.ok(label && label.length > 0, `${code}: 市民向けラベルがありません`);
    assert.ok(description && description.length > 0, `${code}: 市民向け説明がありません`);
    for (const text of [label, description]) {
      assert.ok(!/[A-Z]{3,}_[A-Z]/.test(text), `${code}: 市民向け文言に内部コードが含まれています（${text}）`);
      assert.ok(!text.includes("Level"), `${code}: 市民向け文言に内部の段階名が含まれています`);
    }
  }
});

check("議案詳細ページは内部コードをそのまま表示していない", () => {
  const source = readFileSync(join(ROOT, "src/pages/BillVoteDetailPage.tsx"), "utf8");
  assert.ok(source.includes("citizenLabel"), "BillVoteDetailPage.tsx が市民向けラベルを使っていません");
  for (const code of CODES) {
    assert.ok(!source.includes(`"${code}"`), `BillVoteDetailPage.tsx に内部コード ${code} が直書きされています`);
  }
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
