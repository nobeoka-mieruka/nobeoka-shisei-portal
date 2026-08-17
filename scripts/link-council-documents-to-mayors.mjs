/**
 * TASK-081：archiveCouncilDocuments.json（議案・条例・請願・陳情アーカイブ）の各件に
 * relatedMayorIds を機械的に紐付ける。
 *
 * 推測はしない。決定日（decisionDate）→会議日（meetingDate）→提出日（submittedDate）→
 * 会期ID（sessionId、"YYYY-MM"形式を月初日として解釈）の順に、確認済みの日付アンカーを
 * 1件選び、archiveMayorTerms.json（一次資料で確認済みの就任日・退任日）とその1日が
 * 重なる公選市長の任期を機械的に特定する。該当が単一の市長に定まらない場合（アンカー日付が
 * 無い、または複数任期にまたがる境界日など）はrelatedMayorIdsを設定しない。
 *
 * 既存のrelatedMayorIdsが既に設定されている件は上書きしない。
 *
 * 使い方：node scripts/link-council-documents-to-mayors.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const docsPath = join(root, "src", "data", "archiveCouncilDocuments.json");
const termsPath = join(root, "src", "data", "archiveMayorTerms.json");

const docs = JSON.parse(readFileSync(docsPath, "utf8"));
const terms = JSON.parse(readFileSync(termsPath, "utf8")).filter(
  (t) => t.mayorRole !== "acting" && t.mayorRole !== "temporaryActing",
);

function anchorDate(doc) {
  if (doc.decisionDate) return { date: doc.decisionDate, source: "decisionDate" };
  if (doc.meetingDate) return { date: doc.meetingDate, source: "meetingDate" };
  if (doc.submittedDate) return { date: doc.submittedDate, source: "submittedDate" };
  if (doc.sessionId && /^\d{4}-\d{2}$/.test(doc.sessionId)) return { date: `${doc.sessionId}-01`, source: "sessionId（月初推定）" };
  return null;
}

function mayorOnDate(dateStr) {
  const d = new Date(dateStr);
  const hits = terms.filter((t) => {
    const ts = new Date(t.termStart);
    const te = t.termEnd ? new Date(t.termEnd) : new Date("2100-01-01");
    return ts <= d && te >= d;
  });
  const mayorIds = [...new Set(hits.map((h) => h.mayorId))];
  return mayorIds.length === 1 ? mayorIds[0] : null;
}

let linked = 0;
let skippedExisting = 0;
let skippedNoAnchor = 0;

for (const doc of docs) {
  if (doc.relatedMayorIds && doc.relatedMayorIds.length > 0) {
    skippedExisting++;
    continue;
  }
  const anchor = anchorDate(doc);
  if (!anchor) {
    skippedNoAnchor++;
    continue;
  }
  const mayorId = mayorOnDate(anchor.date);
  if (mayorId) {
    doc.relatedMayorIds = [mayorId];
    linked++;
  }
}

writeFileSync(docsPath, JSON.stringify(docs, null, 2) + "\n");
console.log(
  `[link-council-documents-to-mayors] relatedMayorIds新規設定=${linked}件 / 既存値保護=${skippedExisting}件 / 日付アンカーなし（未設定）=${skippedNoAnchor}件`,
);
