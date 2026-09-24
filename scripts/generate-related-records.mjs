/**
 * 詳細ページの「つながり（確認できる関連）」に使う、確定した関連だけの対応表をビルド時に生成する。
 * 出力：src/data/relatedRecordsIndex.json
 *
 * 関連として載せるのは、次のように既存データのIDや一次資料の位置で確認できるものだけ。
 * キーワードや題名が似ているだけのものは載せない（テーマページの「同じキーワードを含む資料」とは別）。
 * - 一般質問 → 会期：一般質問の会期名（sessionName）から決まる会期ID
 * - 一般質問 → 本会議の日：一般質問の会議録URL（GetText3）のファイル名が、会期の本会議日のファイル名と一致
 * - 一般質問 ⇄ 会議録の発言ページ：同じ議員で、会議録の同じ発言位置（ファイル名＋位置）
 * - 一般質問 → 政策：archivePolicyQuestionRelations.json のうち確認済み（verified）の関連
 * - 会期 → 一般質問：上の「一般質問 → 会期」の逆
 * - 議案 → 提出者（決議）：billProposalRoles.json のうち確認済み（verified）
 * - 議案 → 議案・条例・請願・陳情のページ：archiveCouncilDocuments.json の existingBillVoteId の逆
 * - 議案 → 予算の事業 → 市長公約：budgetRevisions.json の会計（billId）と事業（公式資料で関連が明記された relatedPromiseIds）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const REIWA_START_YEAR = 2019;
/** src/lib/councilSessions.ts の councilSessionIdFromSessionName と同じ規則。 */
function sessionIdFromName(name) {
  const m = String(name ?? "").match(/^令和(\d+)年(\d{1,2})月(定例会|臨時会)$/);
  if (!m) return null;
  const year = REIWA_START_YEAR + Number(m[1]) - 1;
  return `${year}-${String(Number(m[2])).padStart(2, "0")}${m[3] === "臨時会" ? "-extraordinary" : ""}`;
}
/** 会議録URL（GetText3）からファイル名と発言位置を取り出す。 */
function minutesPos(url) {
  const m = typeof url === "string" && /GetText3\.exe\?[^/]+\/([A-Z]\d{6}[A-Z])\/(\d+)\//.exec(url);
  return m ? { fileName: m[1], pos: m[2] } : null;
}

const sessions = readJson("src/data/councilSessions.json");
const sessionById = new Map(sessions.map((s) => [s.id, s]));
const questions = readJson("src/data/generalQuestions.json");
const speechData = readJson("src/data/councilSpeechSummaries.json");

const out = {
  questionToSession: {},
  questionToMeetingDay: {},
  questionToSpeech: {},
  speechToQuestion: {},
  questionToPolicies: {},
  sessionQuestions: {},
  billSubmitters: {},
  billDocuments: {},
  billBudgetProjects: {},
};

// 会議録の発言ページ（公開中のものだけ）を、議員＋発言位置で引けるようにする。
const speechByPos = new Map();
for (const rec of speechData.members ?? []) {
  for (const sp of rec.speeches ?? []) {
    if (!sp.isPublished) continue;
    const p = minutesPos(sp.summarySources?.[0]?.sourceUrl);
    if (p) speechByPos.set(`${sp.memberId}|${p.fileName}|${p.pos}`, sp);
  }
}

for (const q of questions) {
  const sid = sessionIdFromName(q.sessionName);
  const session = sid ? sessionById.get(sid) : null;
  if (session) {
    out.questionToSession[q.id] = { sessionId: session.id, title: session.title };
    (out.sessionQuestions[session.id] ??= []).push({
      id: q.id,
      title: q.title,
      memberName: q.memberName,
      date: q.questionDate ?? null,
    });
  }
  const p = minutesPos(q.transcriptUrl);
  if (p && session) {
    const day = (session.meetingDays ?? []).find((d) => d.fileName === p.fileName);
    if (day) {
      out.questionToMeetingDay[q.id] = {
        sessionId: session.id,
        date: day.date,
        meetingNumber: day.meetingNumber ?? null,
        minutesUrl: day.minutesUrl ?? null,
      };
    }
  }
  if (p) {
    const sp = speechByPos.get(`${q.memberId}|${p.fileName}|${p.pos}`);
    if (sp) {
      out.questionToSpeech[q.id] = { memberId: sp.memberId, speechId: sp.id };
      out.speechToQuestion[sp.id] = { questionId: q.id, title: q.title };
    }
  }
}
for (const list of Object.values(out.sessionQuestions)) {
  list.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id));
}

{
  const policies = new Map(readJson("src/data/archivePolicies.json").map((p) => [p.id, p]));
  for (const r of readJson("src/data/archivePolicyQuestionRelations.json")) {
    if (r.verificationStatus !== "verified") continue;
    const qid = r.questionId ?? r.generalQuestionId;
    const p = policies.get(r.policyId);
    if (!qid || !p) continue;
    (out.questionToPolicies[qid] ??= []).push({ slug: p.slug, title: p.title });
  }
}

{
  const roles = readJson("src/data/billProposalRoles.json").roles ?? [];
  for (const r of roles) {
    if (r.verificationStatus !== "verified" || r.role !== "submitter") continue;
    (out.billSubmitters[r.billId] ??= []).push({
      personId: r.personId,
      personName: r.personName,
      recordType: r.recordType,
      date: r.date ?? null,
      sourceUrl: r.sourceRefs?.[0]?.url ?? null,
    });
  }
}

{
  const BASE = { bill: "/bills", ordinance: "/ordinances", petition: "/petitions", request: "/requests" };
  for (const d of readJson("src/data/archiveCouncilDocuments.json")) {
    if (!d.existingBillVoteId || !BASE[d.documentType]) continue;
    (out.billDocuments[d.existingBillVoteId] ??= []).push({ title: d.title, path: `${BASE[d.documentType]}/${d.slug}`, documentType: d.documentType });
  }
}

{
  for (const r of readJson("src/data/budgetRevisions.json")) {
    for (const a of r.accounts ?? []) {
      if (!a.billId) continue;
      const projects = (r.projects ?? []).filter((p) => p.accountName === a.accountName && (p.relatedPromiseIds ?? []).length > 0);
      if (projects.length === 0) continue;
      out.billBudgetProjects[a.billId] = projects.map((p) => ({
        revisionId: r.id,
        projectId: p.id,
        name: p.name,
        promiseIds: p.relatedPromiseIds,
      }));
    }
  }
}

writeFileSync(join(root, "src/data/relatedRecordsIndex.json"), `${JSON.stringify(out, null, 1)}\n`, "utf8");
const counts = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.values(v).reduce((n, x) => n + (Array.isArray(x) ? x.length : 1), 0)]));
console.log(`[generate-related-records] ${JSON.stringify(counts)}`);
