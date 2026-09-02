/**
 * Phase193：軽量インデックス（scripts/generate-data-indexes.mjs の生成物）が、
 * 元データと食い違っていないことを確認する。
 *
 * トップページの「議案件数」「一般質問件数」やSEOの議案タイトルは、
 * billVotes.json / councilSpeechSummaries.json ではなく、そこから項目を絞って生成した
 * billVotesIndex.json / councilSpeechIndex.json を参照している。
 * 元データだけを更新してインデックスを再生成し忘れると、画面の件数が古いままになるため、
 * ここで両者が一致することを機械的に確認する。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dataDir = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "src", "data");
const read = (name) => JSON.parse(readFileSync(path.join(dataDir, name), "utf8"));

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ok - ${label}`);
  } else {
    console.error(`  NG - ${label}${detail ? `：${detail}` : ""}`);
    failures++;
  }
}

console.log("軽量インデックスと元データの整合性（Phase193）");

// --- 議案インデックス -------------------------------------------------------
const bills = read("billVotes.json");
const billIndex = read("billVotesIndex.json");

check("議案の件数が一致する", bills.length === billIndex.length, `${bills.length} vs ${billIndex.length}`);

const billById = new Map(bills.map((b) => [b.id, b]));
let billFieldMismatch = 0;
let billOrderMismatch = 0;
let billVoterMismatch = 0;
for (const [i, entry] of billIndex.entries()) {
  if (bills[i]?.id !== entry.id) billOrderMismatch++;
  const source = billById.get(entry.id);
  if (!source) {
    billFieldMismatch++;
    continue;
  }
  for (const key of ["billNumber", "billTitle", "result", "verificationStatus", "publicationStatus", "proposerType"]) {
    const expected = source[key];
    const actual = entry[key];
    if ((expected ?? undefined) !== (actual ?? undefined)) billFieldMismatch++;
  }
  const expectedVoters = (source.memberVotes ?? []).map((v) => v.memberId);
  const actualVoters = entry.memberIdsWithVote ?? [];
  if (expectedVoters.join(",") !== actualVoters.join(",")) billVoterMismatch++;
}
check("議案インデックスの並び順が元データと一致する", billOrderMismatch === 0, `${billOrderMismatch}件`);
check("議案インデックスの各項目が元データと一致する", billFieldMismatch === 0, `${billFieldMismatch}項目`);
check("議案インデックスの賛否確認済み議員IDが元データと一致する", billVoterMismatch === 0, `${billVoterMismatch}件`);

// --- 発言要約インデックス ---------------------------------------------------
const speeches = read("councilSpeechSummaries.json");
const speechIndex = read("councilSpeechIndex.json");

check("議員レコード数が一致する", speeches.members.length === speechIndex.members.length);
check("軽量インデックスであることが明示されている", speechIndex.isLightweightIndex === true);
check("元データのgeneratedAtを引き継いでいる", speeches.generatedAt === speechIndex.generatedAt);

const countSpeeches = (data) => data.members.reduce((sum, m) => sum + (m.speeches ?? []).length, 0);
check("発言件数が一致する", countSpeeches(speeches) === countSpeeches(speechIndex));

let speechFieldMismatch = 0;
let questionItemCountMismatch = 0;
let leakedBodyText = 0;
for (const [mi, member] of speechIndex.members.entries()) {
  const sourceMember = speeches.members[mi];
  if (!sourceMember || sourceMember.memberId !== member.memberId) {
    speechFieldMismatch++;
    continue;
  }
  for (const [si, speech] of member.speeches.entries()) {
    const source = sourceMember.speeches[si];
    if (!source) {
      speechFieldMismatch++;
      continue;
    }
    for (const key of ["id", "memberId", "sessionId", "date", "speechType", "isPublished", "summaryStatus", "term"]) {
      if ((source[key] ?? undefined) !== (speech[key] ?? undefined)) speechFieldMismatch++;
    }
    if ((source.topics ?? []).join("｜") !== (speech.topics ?? []).join("｜")) speechFieldMismatch++;
    if ((source.questionItems ?? []).length !== speech.questionItemCount) questionItemCountMismatch++;
    // 本文（質問項目・出典一覧）はインデックスに含めない方針が守られているか。
    if ((speech.questionItems ?? []).length > 0 || (speech.summarySources ?? []).length > 0) leakedBodyText++;
  }
}
check("発言の識別情報・分類が元データと一致する", speechFieldMismatch === 0, `${speechFieldMismatch}項目`);
check("questionItemCountが元データの質問項目数と一致する", questionItemCountMismatch === 0, `${questionItemCountMismatch}件`);
check("インデックスに本文（questionItems・summarySources）が含まれていない", leakedBodyText === 0, `${leakedBodyText}件`);

// --- 検索インデックスの件数 -------------------------------------------------
const searchIndex = read("searchIndex.json");
const searchIndexMeta = read("searchIndexMeta.json");
check(
  "searchIndexMeta.jsonの件数がsearchIndex.jsonと一致する",
  searchIndex.length === searchIndexMeta.entryCount,
  `${searchIndex.length} vs ${searchIndexMeta.entryCount}`,
);

if (failures > 0) {
  console.error(`\n${failures}件が不一致です。npm run generate:data-indexes と npm run generate:search を実行してください。`);
  process.exit(1);
}
console.log("\nすべてのテストが成功しました。");
