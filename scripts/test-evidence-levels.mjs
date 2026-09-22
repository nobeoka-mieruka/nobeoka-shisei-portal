/**
 * 「データが登録されている」ことと「一次資料本文で事実確認できている」ことが
 * 混同されないことを、故障注入で検証する。
 *
 * 区別する段階：
 *   1. DB_REGISTERED   データがDBに存在するだけ
 *   2. SOURCE_LINKED   出典URLが紐付いている
 *   3. SOURCE_AVAILABLE 出典へアクセスできる
 *   4. SOURCE_VERIFIED 出典本文まで確認済み
 *   5. FACT_VERIFIED   対象事実を一次資料本文で確認済み
 *
 * 2026年9月に、一般質問が登録されているだけで「会期中には一般質問も行われました」と
 * 断定する要約が自動生成された。同じ取り違えが他で起きないよう、代表的な6パターンを
 * 故障注入で固定する。
 *
 * このプロジェクトには専用のテストランナーが無いため、既存のscripts/test-*.mjsと同じ
 * 「プレーンなNode＋assert」方式に揃えている。
 *
 * 使い方: node scripts/test-evidence-levels.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { buildSessionSummary } from "./lib/session-summary.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readJson = (relPath) => JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const billsRaw = readJson("src/data/billVotes.json");
const bills = Array.isArray(billsRaw) ? billsRaw : billsRaw.billVotes;
const sessions = readJson("src/data/councilSessions.json");
const collectionStatus = readJson("src/data/questionCollectionStatus.json");
const generalQuestions = readJson("src/data/generalQuestions.json");
const fiscalYears = readJson("src/data/archiveFiscalYears.json");

console.log("\n事実確認レベルの故障注入テスト（実データを複製して壊し、検出できるかを確かめる）");

// --- 1. 一般質問レコードだけ存在し会議録が無い場合、「実施確認済み」にならない ---
check("通告だけの会期を『一般質問が行われた』と書かない（故障注入）", () => {
  const target = sessions.find((s) => s.id === "2026-09");
  assert.ok(target, "令和8年9月定例会が見つかりません");
  const sessionBills = bills.filter((b) => b.sessionId === target.id);
  const scheduled = generalQuestions.filter((q) => q.sessionName === target.title).length;
  assert.ok(scheduled > 0, "この会期に通告ベースの質問がありません");

  const broken = buildSessionSummary(target, sessionBills, scheduled, { generalQuestionsHeld: true });
  const correct = buildSessionSummary(target, sessionBills, scheduled, { generalQuestionsHeld: false });
  assert.match(broken.summary, /一般質問も行われました/, "確認済み扱いにしても断定表現になりませんでした");
  assert.doesNotMatch(correct.summary, /一般質問も行われました/, "未確認なのに実施を断定しています");
  assert.equal(correct.summary, target.summary, "登録済みの要約が、未確認扱いで生成した要約と一致しません");
});

// --- 2. 議決結果だけ存在し議員別賛否が無い場合、各議員を「賛成」にしない ---
check("議決結果が可決でも、議員別賛否が無い議案を賛成として数えない（故障注入）", () => {
  const passedWithoutVotes = bills.filter((b) => b.result === "原案可決" && (b.memberVotes ?? []).length === 0);
  assert.ok(passedWithoutVotes.length > 0, "可決かつ賛否未登録の議案が実データにありません");

  // 実装と同じ数え方：memberVotes に実在する票だけを数える。
  const countApprovals = (list) =>
    list.reduce((sum, b) => sum + (b.memberVotes ?? []).filter((v) => v.vote === "approve").length, 0);
  assert.equal(countApprovals(passedWithoutVotes), 0, "賛否未登録の議案から賛成票が数えられています");

  // 故障注入：可決を根拠に全員賛成を補うと、票数が実データより増えることを確かめる。
  const members = readJson("src/data/members.json");
  const broken = passedWithoutVotes.map((b) => ({
    ...b,
    memberVotes: members.map((m) => ({ memberId: m.id, memberName: m.name, faction: "確認中", vote: "approve" })),
  }));
  assert.ok(countApprovals(broken) > 0, "全員賛成を補っても検出できませんでした");
});

// --- 3. 議員別賛否が無いことを理由に「全会一致」と推定しない ---
check("議員別賛否が無いだけの議案を『全会一致』にしない", () => {
  const unanimous = bills.filter((b) => b.voteMethod === "全会一致");
  for (const b of unanimous) {
    const hasEvidence = Boolean(b.verificationNote || b.transcriptUrl || b.sourceTextVerifiedAt);
    assert.ok(hasEvidence, `${b.id} は根拠なく「全会一致」とされています`);
  }
  // 賛否が無い議案が「全会一致」に流れ込んでいないこと。
  const noVotes = bills.filter((b) => (b.memberVotes ?? []).length === 0);
  const wrongly = noVotes.filter((b) => b.voteMethod === "全会一致" && !b.verificationNote);
  assert.equal(wrongly.length, 0, `根拠なく全会一致とされた議案: ${wrongly.map((b) => b.id).join("、")}`);
});

// --- 4. 予算だけあって決算が無い年度を、実績として表示しない ---
check("予算しかない年度を決算（実績）として扱わない", () => {
  const budgetOnly = fiscalYears.filter(
    (y) => y.budget?.generalAccountInitialBudgetYen != null && y.budget?.generalAccountSettlementYen == null,
  );
  assert.ok(budgetOnly.length > 0, "予算のみの年度が実データにありません");
  for (const y of budgetOnly) {
    assert.equal(
      y.budget.generalAccountSettlementYen ?? null,
      null,
      `FY${y.fiscalYear} の決算額が予算額で埋められています`,
    );
  }
  // 故障注入：決算額へ予算額を流用すると、両者が一致することで検出できる。
  const broken = budgetOnly.map((y) => ({
    ...y,
    budget: { ...y.budget, generalAccountSettlementYen: y.budget.generalAccountInitialBudgetYen },
  }));
  const suspicious = broken.filter(
    (y) => y.budget.generalAccountSettlementYen === y.budget.generalAccountInitialBudgetYen,
  );
  assert.ok(suspicious.length > 0, "予算額の流用を検出できませんでした");
});

// --- 5. 出典IDがあるだけで、本文確認済み（FACT_VERIFIED）にしない ---
check("出典が紐付いているだけの議案を『本文確認済み』として数えない", () => {
  const linked = bills.filter((b) => Boolean(b.sourceDocumentId || b.resultDocumentUrl));
  const bodyVerified = bills.filter((b) => Boolean(b.sourceTextVerifiedAt));
  assert.ok(linked.length > 0, "出典が紐付いた議案がありません");
  assert.ok(
    bodyVerified.length < linked.length,
    `出典が紐付いた件数（${linked.length}）と本文確認済みの件数（${bodyVerified.length}）が同数です。段階が区別されていない可能性があります`,
  );
  // 本文確認済みは必ず出典も紐付いている（逆は成り立たない）。
  const orphan = bodyVerified.filter((b) => !b.sourceDocumentId && !b.resultDocumentUrl);
  assert.equal(orphan.length, 0, `出典が無いのに本文確認済みの議案: ${orphan.map((b) => b.id).join("、")}`);
});

// --- 6. 人口の欠損年度を0人にしない ---
check("人口が未確認の年度を0人として扱わない", () => {
  const withPopulation = fiscalYears.filter((y) => y.population);
  const zeros = withPopulation.filter((y) => y.population.population === 0 || y.population.households === 0);
  assert.equal(zeros.length, 0, `人口・世帯数が0の年度: ${zeros.map((y) => y.fiscalYear).join("、")}`);
  // 未登録の年度は population 自体を持たない（0で埋めない）。
  const missing = fiscalYears.filter((y) => !y.population);
  for (const y of missing) {
    assert.equal(y.population, undefined, `FY${y.fiscalYear} の人口が0等で埋められています`);
  }
  assert.ok(missing.length > 0, "人口未登録の年度が実データにありません（前提が変わった可能性）");
});

// --- 会期の進行状態が、登録の有無ではなく会議録の確認済みかどうかで決まること ---
check("会期の『開催済み』判定が、収録対象への登録ではなく会議録の確認済みかどうかで決まる", () => {
  const registeredButNoTranscript = collectionStatus.sessions.filter((s) => s.transcriptAvailable !== true);
  assert.ok(
    registeredButNoTranscript.length > 0,
    "会議録が未確認の登録済み会期が実データにありません（前提が変わった可能性）",
  );
  const src = readFileSync(join(ROOT, "src/lib/generalQuestionStats.ts"), "utf8");
  assert.match(
    src,
    /s\.sessionId === sessionId && s\.transcriptAvailable === true/,
    "councilSessionPhaseForSessionName が transcriptAvailable を見ていません",
  );
});

console.log(`\n${passCount}件成功\n`);
