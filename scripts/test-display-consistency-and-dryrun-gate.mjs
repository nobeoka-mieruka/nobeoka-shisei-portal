/**
 * 2026-10-21：公開版で見つかった説明文の不整合と、自動更新dry-runの判定漏れの回帰テスト。
 *
 * このテストが固定すること：
 *   1. 委員会ページとデータ収録状況ページの名簿基準日が、委員会データの出典（各委員会等名簿）から
 *      算出され、直書きの古い日付（令和8年5月8日現在）が残っていない
 *   2. 委員会の表示人数（memberCount）と委員配列の件数が一致する
 *   3. パブリックコメントの「運用状況一覧の確認日」と「各案件の確認日」を混同しない
 *   4. 既知の削除済み（removed-confirmed）質問通告書14件がRED・サーキットブレーカー対象にならない
 *   5. 未知の新規リンク切れ（会議録確認済み会期の通告書の消失疑い）は従来どおりREDになる
 *   6. 人口の正常な月次更新1件でサーキットブレーカーが発動しない
 *   7. Updaterの失敗・RED・サーキットブレーカー・error・品質監査失敗のいずれかでワークフローが失敗する
 *
 * 使い方: node scripts/test-display-consistency-and-dryrun-gate.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { evaluateDryRunGate } from "./auto-update/core/gate.mjs";
import { classifyItem } from "./auto-update/core/classify.mjs";
import { checkPopulationCircuitBreaker, computePopulationOverallLevel } from "./auto-update/population/population-levels.mjs";
import { evaluateQuestionNoticeRecord, isResolvedQuestionNoticeRecord } from "./auto-update/questions/update-questions.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const readSrc = (relPath) => readFileSync(join(ROOT, relPath), "utf8");
const readJson = (relPath) => JSON.parse(readSrc(relPath));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

console.log("委員会名簿の人数・基準日");

const committees = readJson("src/data/committees.json");

/** src/lib/committees.ts の latestCommitteeRosterAsOf() と同じ規則。 */
function latestRosterAsOf(list) {
  const dates = [];
  for (const c of list) {
    for (const ref of c.sourceRefs ?? []) {
      const m = ref.label.match(/委員会等名簿（令和(\d+)年(\d+)月(\d+)日現在）/);
      if (m) dates.push(`${2018 + Number(m[1])}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
    }
  }
  return dates.sort().at(-1);
}

check("委員会の表示人数（memberCount）と委員配列の件数が一致し、常任委員会の人数が期待値どおり", () => {
  for (const c of committees) assert.equal(c.memberCount, c.members.length, `${c.id}: memberCountと委員数が一致しない`);
  const byName = new Map(committees.map((c) => [c.name, c.members.length]));
  assert.equal(byName.get("厚生教育委員会"), 7);
  assert.equal(byName.get("産業建設委員会"), 8);
  assert.equal(byName.get("総務政策委員会"), 9);
});

check("現行名簿の基準日は委員会データの出典から算出され、2026-10-14 になる", () => {
  assert.equal(latestRosterAsOf(committees), "2026-10-14");
  const lib = readSrc("src/lib/committees.ts");
  assert.ok(lib.includes("export function latestCommitteeRosterAsOf"), "latestCommitteeRosterAsOf が無い");
});

check("委員会ページとデータ収録状況ページが同じ算出関数を使い、古い基準日を直書きしていない", () => {
  for (const page of ["src/pages/DataStatusPage.tsx", "src/pages/CommitteesPage.tsx"]) {
    const src = readSrc(page);
    assert.ok(src.includes("latestCommitteeRosterAsOf("), `${page}: 名簿基準日を委員会データから算出していない`);
    assert.ok(!/委員名簿（令和\d+年\d+月\d+日現在）/.test(src), `${page}: 名簿基準日が直書きされている`);
  }
});

console.log("\nパブリックコメントの確認日");

const publicComments = readJson("src/data/publicComments.json");

/** src/lib/publicComments.ts の publicCommentVerificationSummary() と同じ規則。 */
function verificationSummary(dataset) {
  const all = dataset.entries.every((e) => e.lastVerifiedAt >= dataset.lastVerifiedAt);
  return all
    ? { all, label: `掲載データ（全${dataset.entries.length}件）の最終確認日` }
    : { all, label: "運用状況一覧の確認日" };
}

check("一部の案件だけを確認した場合は、ページ全体の日付を「運用状況一覧の確認日」と表示する", () => {
  const partial = {
    lastVerifiedAt: "2026-10-09",
    entries: [{ lastVerifiedAt: "2026-10-20" }, { lastVerifiedAt: "2026-09-05" }],
  };
  assert.equal(verificationSummary(partial).all, false);
  assert.equal(verificationSummary(partial).label, "運用状況一覧の確認日");
  const full = { lastVerifiedAt: "2026-10-21", entries: [{ lastVerifiedAt: "2026-10-21" }] };
  assert.equal(verificationSummary(full).label, "掲載データ（全1件）の最終確認日");
});

check("パブリックコメントのページは確認日の意味を算出結果で表示し、固定の「掲載データの最終確認日」を使わない", () => {
  const src = readSrc("src/pages/PublicCommentsPage.tsx");
  assert.ok(src.includes("publicCommentVerificationSummary(dataset)"));
  assert.ok(!src.includes('dataAsOfLabel="掲載データの最終確認日"'));
  const lib = readSrc("src/lib/publicComments.ts");
  assert.ok(lib.includes("e.lastVerifiedAt >= dataset.lastVerifiedAt"), "lib側の判定規則がテストと食い違っている");
});

check("登録データ：一覧の更新日は確認日以前で、個別確認日は一覧確認日と矛盾しない。教育大綱はInternet Archive保存版を出典に維持", () => {
  assert.ok(publicComments.statusSourceUpdatedAt <= publicComments.lastVerifiedAt);
  for (const e of publicComments.entries) {
    assert.ok(!e.sourcePageUpdatedAt || e.sourcePageUpdatedAt <= e.lastVerifiedAt, `${e.id}: 公式ページ更新日が確認日より後`);
  }
  const kyoiku = publicComments.entries.find((e) => e.id === "pc-r08-005");
  assert.ok(kyoiku.sourceRefs.some((r) => r.url.startsWith("https://web.archive.org/")), "教育大綱の保存版出典が無い");
  assert.equal(kyoiku.resultUrl, null, "教育大綱の結果は未公表のはず");
});

console.log("\n一般質問（questions）Updater");

const memberIdSet = new Set(readJson("src/data/members.json").map((m) => m.id));
const allowedHosts = new Set(["www.city.nobeoka.miyazaki.jp"]);

check("既知の削除済み（removed-confirmed）質問通告書14件は判定対象外で、RED・サーキットブレーカーの母数にならない", () => {
  const notices = readJson("src/data/councilWatchedDocuments.json").filter((r) => r.category === "question-notice");
  const resolved = notices.filter(isResolvedQuestionNoticeRecord);
  assert.equal(resolved.length, 14, "removed-confirmed の質問通告書が14件ではない");
  const remaining = notices.filter((r) => !isResolvedQuestionNoticeRecord(r));
  assert.ok(remaining.every((r) => r.status === "published"), "判定対象に削除済み資料が残っている");
});

check("未知の新規リンク切れ（会議録確認済み会期の通告書が消失疑い）は従来どおりREDになる", () => {
  const record = {
    category: "question-notice",
    status: "removed-suspected",
    title: "第26回延岡市議会(令和8年6月定例会)（6月23日 個人質問）",
    memberName: "宮田博徳",
    memberId: "m24",
    sourceUrl: "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/99999.pdf",
    speakerIdentificationStatus: "confirmed",
  };
  assert.equal(isResolvedQuestionNoticeRecord(record), false);
  const ev = evaluateQuestionNoticeRecord(record, {
    generalQuestionsByUrl: new Map(),
    transcriptAvailableSessionIds: new Set(ev0SessionId(record)),
    memberIdSet,
    allowedHosts,
  });
  const result = classifyItem({
    schemaValid: ev.validation.valid,
    schemaErrors: ev.validation.errors ?? [],
    isOfficialPrimarySource: true,
    anomalyDetected: ev.anomalyDetected,
    anomalyReason: ev.anomalyReason,
    outcome: ev.outcome,
    reachable: null,
    requiresHumanReview: ev.requiresHumanReview,
  });
  assert.equal(result.level, "RED", `未知のリンク切れがREDにならない（${result.reason}）`);
  assert.match(result.reason, /会議録確認済み/, "RED の理由が会議録確認済み会期の安全装置ではない");
});

function ev0SessionId(record) {
  // 会議録確認済み会期として扱うため、評価関数自身が導出するsessionIdをそのまま使う。
  const ev = evaluateQuestionNoticeRecord(record, {
    generalQuestionsByUrl: new Map(),
    transcriptAvailableSessionIds: new Set(),
    memberIdSet,
    allowedHosts,
  });
  return ev.sessionInfo?.sessionId ? [ev.sessionInfo.sessionId] : [];
}

console.log("\n人口（population）Updater");

check("正常な月次更新1件（新しい基準日1件）ではサーキットブレーカーが発動せず、総合REDにならない", () => {
  const cb = checkPopulationCircuitBreaker({ newCount: 1, detectedTotal: 1 });
  assert.equal(cb.tripped, false, cb.reason ?? "");
  const level = computePopulationOverallLevel({
    circuitBreakerTripped: cb.tripped,
    summary: { detected: 1, green: 0, yellow: 1, red: 0, error: 0 },
    resolutionSeverity: null,
  });
  assert.equal(level, "YELLOW");
});

check("1回で2件以上の新しい基準日、または検出0件のときはサーキットブレーカーが発動する", () => {
  assert.equal(checkPopulationCircuitBreaker({ newCount: 2, detectedTotal: 2 }).tripped, true);
  assert.equal(checkPopulationCircuitBreaker({ newCount: 0, detectedTotal: 0 }).tripped, true);
  assert.equal(
    computePopulationOverallLevel({ circuitBreakerTripped: false, summary: { red: 1, yellow: 0, error: 0 }, resolutionSeverity: null }),
    "RED",
  );
});

console.log("\nGitHub Actions の最終判定（gate.mjs）");

const okUpdaters = { bills: "success", questions: "success", finance: "success", population: "success" };
const okAudits = { validate: "success", typecheck: "success", lint: "success", build: "success" };
const greenReport = { target: "bills", overallLevel: "GREEN", circuitBreakerTripped: false, summary: { error: 0 } };

check("すべて正常ならSuccess", () => {
  assert.equal(evaluateDryRunGate({ updaterOutcomes: okUpdaters, auditOutcomes: okAudits, reports: [greenReport] }).failed, false);
});

check("Updaterの終了コード1（outcome=failure）ならFailure", () => {
  const r = evaluateDryRunGate({ updaterOutcomes: { ...okUpdaters, questions: "failure" }, auditOutcomes: okAudits, reports: [] });
  assert.equal(r.failed, true);
});

check("overallLevel=RED・circuitBreakerTripped・error>0 のいずれかでFailure", () => {
  for (const bad of [
    { ...greenReport, overallLevel: "RED" },
    { ...greenReport, circuitBreakerTripped: true },
    { ...greenReport, summary: { error: 1 } },
    { target: "x", parseError: "Unexpected token" },
  ]) {
    assert.equal(evaluateDryRunGate({ updaterOutcomes: okUpdaters, auditOutcomes: okAudits, reports: [bad] }).failed, true);
  }
});

check("validate・typecheck・lint・build のいずれかが失敗ならFailure", () => {
  for (const step of Object.keys(okAudits)) {
    const r = evaluateDryRunGate({ updaterOutcomes: okUpdaters, auditOutcomes: { ...okAudits, [step]: "failure" }, reports: [] });
    assert.equal(r.failed, true, step);
  }
});

check("ワークフローの最終ステップが always() で gate.mjs を実行し、build を監査している", () => {
  const wf = readSrc(".github/workflows/auto-update-dryrun.yml");
  assert.ok(/name: Fail job on updater\/report\/audit failures\r?\n\s+if: always\(\)/.test(wf));
  assert.ok(wf.includes("node scripts/auto-update/core/gate.mjs"));
  assert.ok(wf.includes("id: audit_build"));
  for (const id of ["run_bills", "run_questions", "run_finance", "run_population"]) {
    assert.ok(wf.includes(`steps.${id}.outcome`), `${id} の結果を最終判定に渡していない`);
  }
});

console.log(`\n${passCount}件成功`);
console.log("すべてのテストが成功しました。");
