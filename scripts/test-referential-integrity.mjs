/**
 * データ間の参照（外部キー）と、日付・年度・重複の整合性を検査する。
 *
 * 各データは単体では validate-data.mjs が検査しているが、ファイルをまたぐ参照
 * （議員ID・議案ID・会期ID・委員会ID・公約ID・一般質問ID など）が実在するかは
 * 一部しか見ていなかった。参照先が消えたり、IDを打ち間違えたりすると、画面では
 * リンク切れや「確認中」として静かに表示されるだけで気づけないため、ここで止める。
 *
 * 【やらないこと】
 * - 題名が似ているだけで重複と判定しない（検出するのは、同じ議員の同じ登壇を
 *   同じ会議録の位置で二重に公開しているものだけ）。
 * - 見つけたものを自動で直さない・消さない。
 *
 * 使い方: node scripts/test-referential-integrity.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const TODAY = new Date().toISOString().slice(0, 10);

let passCount = 0;
function check(label, fn) {
  fn();
  passCount += 1;
  console.log(`  ok - ${label}`);
}
/** 見つかった問題を最大件数まで並べて失敗させる。 */
function expectNone(problems, message) {
  assert.equal(problems.length, 0, `${message}（${problems.length}件）:\n  ${problems.slice(0, 15).join("\n  ")}`);
}

const members = read("src/data/members.json");
const formerMembers = read("src/data/formerMembers.json");
const personIds = new Set([...members.map((m) => m.id), ...formerMembers.map((m) => m.id)]);
const sessions = read("src/data/councilSessions.json");
const sessionIds = new Set(sessions.map((s) => s.id));
const billVotes = read("src/data/billVotes.json");
const billIds = new Set(billVotes.map((b) => b.id));
const committees = read("src/data/committees.json");
const committeeIds = new Set(committees.map((c) => c.id));
const generalQuestions = read("src/data/generalQuestions.json");
const questionIds = new Set(generalQuestions.map((q) => q.id));
const promisesData = read("src/data/mayorPromises.json");
const promiseIds = new Set(promisesData.promises.map((p) => p.id));
const promiseCategoryIds = new Set(promisesData.categories.map((c) => c.id));
const promiseDocumentKeys = new Set(
  Array.isArray(promisesData.documents) ? promisesData.documents.map((d) => d.key ?? d.id) : Object.keys(promisesData.documents),
);
const speechData = read("src/data/councilSpeechSummaries.json");
const speeches = speechData.members.flatMap((m) => m.speeches ?? []);
const speechById = new Map(speeches.map((s) => [s.id, s]));
const archiveMayorIds = new Set(read("src/data/archiveMayors.json").map((m) => m.id));

console.log("\nデータ間の参照・日付・重複の整合性");

check("議員IDの参照先が、現職または元議員として実在する", () => {
  const problems = [];
  const refs = [
    ["billVotes.json（議員別の賛否）", billVotes.flatMap((b) => (b.memberVotes ?? []).map((v) => [b.id, v.memberId]))],
    ["committees.json（委員）", committees.flatMap((c) => c.members.map((m) => [c.id, m.memberId]))],
    ["committeeReportActivity.json", read("src/data/committeeReportActivity.json").events.map((e) => [e.id, e.memberId])],
    ["councilDebateSpeeches.json", read("src/data/councilDebateSpeeches.json").speeches.map((d) => [d.id, d.memberId ?? d.formerMemberId])],
    ["councilLeadershipTerms.json", read("src/data/councilLeadershipTerms.json").terms.map((t) => [t.id, t.memberId])],
    ["councilSpeechSummaries.json", speechData.members.map((m) => [m.memberId, m.memberId])],
    ["generalQuestions.json", generalQuestions.map((q) => [q.id, q.memberId])],
    ["billProposalRoles.json", read("src/data/billProposalRoles.json").roles.map((r) => [r.recordId, r.personId])],
    ["petitionIntroducers.json", read("src/data/petitionIntroducers.json").records.flatMap((r) => r.introducerMemberIds.map((id) => [r.billId, id]))],
  ];
  for (const [file, pairs] of refs) {
    for (const [owner, id] of pairs) if (id && !personIds.has(id)) problems.push(`${file} ${owner} → ${id}`);
  }
  expectNone(problems, "存在しない議員IDを参照しています");
});

check("会期IDの参照先が councilSessions.json に実在する", () => {
  const problems = [];
  for (const b of billVotes) if (b.sessionId && !sessionIds.has(b.sessionId)) problems.push(`billVotes ${b.id} → ${b.sessionId}`);
  for (const s of speeches) if (s.sessionId && !sessionIds.has(s.sessionId)) problems.push(`speech ${s.id} → ${s.sessionId}`);
  for (const d of read("src/data/councilDebateSpeeches.json").speeches)
    if (d.sessionId && !sessionIds.has(d.sessionId)) problems.push(`debate ${d.id} → ${d.sessionId}`);
  for (const s of read("src/data/questionCollectionStatus.json").sessions)
    if (s.sessionId && !sessionIds.has(s.sessionId)) problems.push(`questionCollectionStatus → ${s.sessionId}`);
  expectNone(problems, "存在しない会期IDを参照しています");
});

check("議案IDの参照先が billVotes.json に実在する", () => {
  const problems = [];
  for (const r of read("src/data/billProposalRoles.json").roles) if (!billIds.has(r.billId)) problems.push(`billProposalRoles ${r.recordId} → ${r.billId}`);
  for (const r of read("src/data/petitionIntroducers.json").records) if (!billIds.has(r.billId)) problems.push(`petitionIntroducers → ${r.billId}`);
  for (const b of billVotes) {
    for (const id of b.relatedBillIds ?? []) if (!billIds.has(id)) problems.push(`${b.id}.relatedBillIds → ${id}`);
    if (b.revisionOfBillId && !billIds.has(b.revisionOfBillId)) problems.push(`${b.id}.revisionOfBillId → ${b.revisionOfBillId}`);
  }
  expectNone(problems, "存在しない議案IDを参照しています");
});

check("委員会IDの参照先が committees.json に実在する", () => {
  const problems = [];
  for (const [file, list] of [
    ["committeeReportActivity.json", read("src/data/committeeReportActivity.json").events],
    ["committeeActivityReports.json", read("src/data/committeeActivityReports.json")],
    ["archiveCommitteeMembers.json", read("src/data/archiveCommitteeMembers.json")],
  ]) {
    for (const r of list) if (r.committeeId && !committeeIds.has(r.committeeId)) problems.push(`${file} ${r.id ?? ""} → ${r.committeeId}`);
  }
  expectNone(problems, "存在しない委員会IDを参照しています");
});

check("市長公約・施策・一般質問・政策の参照先が実在する", () => {
  const problems = [];
  const measures = read("src/data/mayorPromiseMeasures.json");
  for (const m of Array.isArray(measures) ? measures : measures.measures) {
    if (m.promiseId && !promiseIds.has(m.promiseId)) problems.push(`施策 ${m.measureId} → 公約 ${m.promiseId}`);
    if (m.categoryId && !promiseCategoryIds.has(m.categoryId)) problems.push(`施策 ${m.measureId} → 分野 ${m.categoryId}`);
  }
  for (const p of promisesData.promises) {
    if (p.categoryId && !promiseCategoryIds.has(p.categoryId)) problems.push(`公約 ${p.id} → 分野 ${p.categoryId}`);
    for (const e of p.evidenceItems ?? []) if (!promiseDocumentKeys.has(e.documentKey)) problems.push(`公約 ${p.id} → 資料 ${e.documentKey}`);
  }
  for (const b of billVotes) for (const id of b.relatedMayorPromiseIds ?? []) if (!promiseIds.has(id)) problems.push(`議案 ${b.id} → 公約 ${id}`);
  for (const q of generalQuestions) for (const id of q.relatedMayorPromiseIds ?? []) if (!promiseIds.has(id)) problems.push(`一般質問 ${q.id} → 公約 ${id}`);
  const policies = read("src/data/archivePolicies.json");
  const policyIds = new Set(policies.map((p) => p.id));
  for (const r of read("src/data/archivePolicyQuestionRelations.json")) {
    if (!policyIds.has(r.policyId)) problems.push(`政策と質問の関連 ${r.id} → 政策 ${r.policyId}`);
    if (!questionIds.has(r.questionId)) problems.push(`政策と質問の関連 ${r.id} → 質問 ${r.questionId}`);
  }
  for (const p of [...policies, ...promisesData.promises])
    for (const id of p.relatedQuestionIds ?? []) if (!questionIds.has(id)) problems.push(`${p.id}.relatedQuestionIds → ${id}`);
  expectNone(problems, "市長公約・政策の関連が存在しないIDを参照しています");
});

check("歴代市長の参照（前任・後任・年度の市長）が実在する", () => {
  const problems = [];
  for (const t of read("src/data/archiveMayorTerms.json")) {
    for (const key of ["mayorId", "previousMayorId", "nextMayorId"]) if (t[key] && !archiveMayorIds.has(t[key])) problems.push(`${t.id}.${key} → ${t[key]}`);
  }
  for (const y of read("src/data/archiveFiscalYears.json")) if (y.mayorId && !archiveMayorIds.has(y.mayorId)) problems.push(`${y.fiscalYear}.mayorId → ${y.mayorId}`);
  expectNone(problems, "存在しない市長IDを参照しています");
});

check("一般質問の重複：同じ議員の同じ登壇（会議録の同じ位置）を二重に公開していない", () => {
  // 題名の類似では判定しない。会議録の同じ発言位置（fileName＋pos）を最初の出典に持つ
  // 公開記録が、同じ議員に2件以上あるものだけを重複とする。
  const firstPos = (s) => {
    const url = s.summarySources?.find((x) => /GetText3\.exe/.test(x.sourceUrl ?? ""))?.sourceUrl;
    const m = url && /\/([A-Z]\d{6}[A-Z])\/(\d+)\//.exec(url);
    return m ? `${m[1]}/${m[2]}` : null;
  };
  const byKey = new Map();
  for (const s of speeches.filter((x) => x.isPublished)) {
    const pos = firstPos(s);
    if (!pos) continue;
    const key = `${s.memberId}|${pos}`;
    byKey.set(key, [...(byKey.get(key) ?? []), s.id]);
  }
  const dups = [...byKey.entries()].filter(([, ids]) => ids.length > 1).map(([k, ids]) => `${k}: ${ids.join(" / ")}`);
  expectNone(dups, "同じ登壇を複数の公開記録にしています（重複を確認し、片方を非公開にして duplicateOfSpeechId を付けてください）");
  // 非公開にした記録の参照先が、公開中の記録であること。
  const broken = speeches
    .filter((s) => s.duplicateOfSpeechId)
    .filter((s) => !speechById.get(s.duplicateOfSpeechId)?.isPublished || s.isPublished)
    .map((s) => `${s.id} → ${s.duplicateOfSpeechId}`);
  expectNone(broken, "重複として非公開にした記録の参照先が不正です");
});

check("確認日・公表日・議決日などが未来の日付になっていない", () => {
  // 予定（会期日程・次回確認日・任期満了日など）は未来でよい。過去の事実や確認の記録だけを見る。
  const PAST_FIELDS = /^(verifiedAt|lastVerified|lastVerifiedAt|checkedAt|accessedAt|confirmedAt|retrievedAt|sourcePublishedDate|votingDate|memberVoteRecordedDate|meetingDate|reportedDate|publishedDate)$/;
  const problems = [];
  const walk = (v, file, path) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, file, `${path}[${i}]`));
    if (!v || typeof v !== "object") return;
    for (const [k, x] of Object.entries(v)) {
      if (PAST_FIELDS.test(k) && typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x) && x.slice(0, 10) > TODAY) {
        problems.push(`${file} ${path}.${k} = ${x}`);
      } else walk(x, file, `${path}.${k}`);
    }
  };
  for (const f of readdirSync(join(ROOT, "src/data")).filter((n) => n.endsWith(".json") && !n.includes("backup"))) {
    walk(read(`src/data/${f}`), f, "");
  }
  expectNone(problems, "未来の日付が過去の事実・確認の記録として入っています");
});

check("年度の整合：年度データの重複がなく、入れ子の年度が親の年度と一致する", () => {
  const years = read("src/data/archiveFiscalYears.json");
  const seen = new Set();
  const problems = [];
  for (const y of years) {
    if (seen.has(y.fiscalYear)) problems.push(`年度 ${y.fiscalYear} が重複しています`);
    seen.add(y.fiscalYear);
    for (const key of ["budget", "finance", "debt", "fund", "population"]) {
      const inner = y[key]?.fiscalYear;
      if (inner != null && inner !== y.fiscalYear) problems.push(`${y.fiscalYear}.${key}.fiscalYear = ${inner}`);
    }
  }
  expectNone(problems, "年度が矛盾しています");
});

console.log(`\n${passCount}件成功\n`);
