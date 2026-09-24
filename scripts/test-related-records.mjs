/**
 * 詳細ページの「つながり（確認できる関連）」（src/data/relatedRecordsIndex.json）と、
 * 議員別賛否の説明の検査。
 *
 * 1. 横断リンクの孤立ID = 0（一般質問・会期・会議録の発言・議員・議案・市長公約・政策が実在する）
 * 2. 横断リンクのリンク先が実在ページ（プリレンダリング対象）
 * 3. 一般質問⇄会議録の発言の対応が双方向で一致する
 * 4. 確定リンクにキーワード一致・候補（candidate / suggested）の関連を使っていない
 * 5. 議員別賛否を表示するページに「議案への賛否であり、政策・公約そのものへの賛否ではない」説明がある
 *
 * 使い方: node scripts/test-related-records.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { getPrerenderRoutes, root as ROOT } from "./lib/public-routes.mjs";

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const readJson = (p) => JSON.parse(read(p));

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}

const idx = readJson("src/data/relatedRecordsIndex.json");
const questions = new Map(readJson("src/data/generalQuestions.json").map((q) => [q.id, q]));
const sessions = new Map(readJson("src/data/councilSessions.json").map((s) => [s.id, s]));
const bills = new Map(readJson("src/data/billVotes.json").map((b) => [b.id, b]));
const promises = new Set(readJson("src/data/mayorPromises.json").promises.map((p) => p.id));
const members = new Set(readJson("src/data/members.json").map((m) => m.id));
const policies = new Set(readJson("src/data/archivePolicies.json").map((p) => p.slug));
const speeches = new Map();
for (const rec of readJson("src/data/councilSpeechSummaries.json").members ?? []) {
  for (const sp of rec.speeches ?? []) speeches.set(sp.id, sp);
}
const routes = new Set(getPrerenderRoutes().map((r) => r.path));

check("横断リンクの参照先IDがすべて実在する（孤立ID 0件）", () => {
  const bad = [];
  for (const [qid, v] of Object.entries(idx.questionToSession)) {
    if (!questions.has(qid)) bad.push(`question ${qid}`);
    if (!sessions.has(v.sessionId)) bad.push(`session ${v.sessionId}`);
  }
  for (const [qid, v] of Object.entries(idx.questionToMeetingDay)) {
    const s = sessions.get(v.sessionId);
    if (!questions.has(qid) || !s || !(s.meetingDays ?? []).some((d) => d.date === v.date)) bad.push(`meetingDay ${qid}`);
  }
  for (const [qid, v] of Object.entries(idx.questionToSpeech)) {
    const sp = speeches.get(v.speechId);
    if (!questions.has(qid) || !sp || !sp.isPublished || sp.memberId !== v.memberId) bad.push(`speech ${qid}→${v.speechId}`);
  }
  for (const [qid, list] of Object.entries(idx.questionToPolicies)) {
    if (!questions.has(qid)) bad.push(`policy-q ${qid}`);
    for (const p of list) if (!policies.has(p.slug)) bad.push(`policy ${p.slug}`);
  }
  for (const [sid, list] of Object.entries(idx.sessionQuestions)) {
    if (!sessions.has(sid)) bad.push(`sessionQuestions ${sid}`);
    for (const q of list) if (!questions.has(q.id)) bad.push(`sessionQuestions ${sid}/${q.id}`);
  }
  for (const [bid, list] of Object.entries(idx.billSubmitters)) {
    if (!bills.has(bid)) bad.push(`bill ${bid}`);
    for (const s of list) if (!members.has(s.personId)) bad.push(`member ${s.personId}`);
  }
  for (const [bid, list] of Object.entries(idx.billBudgetProjects)) {
    if (!bills.has(bid)) bad.push(`bill ${bid}`);
    for (const p of list) for (const pid of p.promiseIds) if (!promises.has(pid)) bad.push(`promise ${pid}`);
  }
  for (const bid of Object.keys(idx.billDocuments)) if (!bills.has(bid)) bad.push(`bill ${bid}`);
  assert.equal(bad.length, 0, bad.slice(0, 10).join(" / "));
});

check("横断リンクのリンク先がすべて実在ページ", () => {
  const paths = [
    ...Object.keys(idx.questionToSession).map((q) => `/questions/${q}`),
    ...Object.values(idx.questionToSession).map((v) => `/council-documents/${v.sessionId}`),
    ...Object.values(idx.questionToSpeech).map((v) => `/members/${v.memberId}/questions/${v.speechId}`),
    ...Object.values(idx.questionToPolicies).flat().map((p) => `/policies/${p.slug}`),
    ...Object.values(idx.billSubmitters).flat().map((s) => `/members/${s.personId}`),
    ...Object.values(idx.billDocuments).flat().map((d) => d.path),
    ...Object.values(idx.billBudgetProjects).flat().flatMap((p) => p.promiseIds.map((pid) => `/mayor/policy-progress/${pid}`)),
    ...Object.keys({ ...idx.billSubmitters, ...idx.billDocuments, ...idx.billBudgetProjects }).map((b) => `/bills/votes/${b}`),
  ];
  const missing = paths.filter((p) => !routes.has(p));
  assert.equal(missing.length, 0, missing.slice(0, 10).join(" / "));
});

check("一般質問⇄会議録の発言の対応が双方向で一致する", () => {
  for (const [qid, v] of Object.entries(idx.questionToSpeech)) {
    assert.equal(idx.speechToQuestion[v.speechId]?.questionId, qid, `${qid} ⇄ ${v.speechId}`);
  }
  assert.equal(Object.keys(idx.speechToQuestion).length, Object.keys(idx.questionToSpeech).length);
});

check("確定リンクにキーワード一致・候補の関連を使っていない", () => {
  const gen = read("scripts/generate-related-records.mjs").replace(/^\s*(\*|\/\/).*$/gm, "");
  for (const token of ["archiveRelationCandidates", "archiveAiCategoryCandidates", "relatedBillIds", "relatedBudgetCandidates", "themeKeywordMatches"]) {
    assert.ok(!gen.includes(token), `確定リンクの生成で ${token} を使っています`);
  }
  assert.ok(/verificationStatus !== "verified"/.test(gen), "確認済みに限定する条件がありません");
  const roles = readJson("src/data/billProposalRoles.json").roles;
  for (const [bid, list] of Object.entries(idx.billSubmitters)) {
    for (const s of list) {
      const r = roles.find((x) => x.billId === bid && x.personId === s.personId && x.role === "submitter");
      assert.equal(r?.verificationStatus, "verified", `未確認の提出者が確定リンクに入っています: ${bid}`);
    }
  }
});

check("議員別賛否を表示するページに、議案への賛否であることの説明がある", () => {
  const note = read("src/components/bills/VoteScopeNote.tsx");
  assert.ok(note.includes("議案への賛否を示すものであり、政策・公約そのものへの賛否を示すものではありません"));
  for (const f of [
    "src/pages/BillVoteDetailPage.tsx",
    "src/pages/MemberDetailPage.tsx",
    "src/pages/CouncilActivityMemberPage.tsx",
    "src/pages/MemberFormerDetailPage.tsx",
    "src/pages/MayorPromiseDetailPage.tsx",
  ]) {
    assert.ok(read(f).includes("<VoteScopeNote"), `${f} に VoteScopeNote がありません`);
  }
});

const total = Object.values(idx).reduce((n, v) => n + Object.values(v).reduce((m, x) => m + (Array.isArray(x) ? x.length : 1), 0), 0);
console.log(`\n✅ test-related-records: ${passCount} checks passed（確定リンク ${total}件）`);
