import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { councilSpeechPeriod } from "./lib/council-speech-period.mjs";
import {
  ARCHIVE_VERIFICATION_STATUSES,
  checkAnyNonNullRequiresField,
  checkDuplicateIds,
  checkDuplicateSlugs,
  checkDuplicateYears,
  checkNoOverlappingPeriods,
  checkNonNegative,
  checkPercentRange,
  checkPeriodConsistency,
  checkReferenceExists,
  checkSourceRefs,
  checkValuesHaveSource,
  checkYearGaps,
  checkYearRange,
  requireAtLeastOneSourceRef,
} from "./lib/validate-archive-common.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const errors = [];
const warnings = [];

function err(file, message) {
  errors.push(`[ERROR] ${file}: ${message}`);
}
function warn(file, message) {
  warnings.push(`[WARN] ${file}: ${message}`);
}

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/\S+$/;

function isBlank(v) {
  return typeof v !== "string" || v.trim().length === 0;
}

// --- formerMembers.json（現職ではない元議員。過去会期の発言履歴を保持するための別マスター） ---
let formerMemberIds = new Set();
const formerMemberServedSessions = new Map();
try {
  const formerMembers = readJson("src/data/formerMembers.json");
  if (!Array.isArray(formerMembers)) throw new Error("配列ではありません");
  for (const fm of formerMembers) {
    formerMemberServedSessions.set(fm.id, new Set(Array.isArray(fm.servedSessions) ? fm.servedSessions : []));
    const tag = `formerMembers.json (${fm.id ?? "id不明"})`;
    if (isBlank(fm.id)) err(tag, "idが空です");
    else if (formerMemberIds.has(fm.id)) err(tag, `idが重複しています: ${fm.id}`);
    else formerMemberIds.add(fm.id);
    if (isBlank(fm.name)) err(tag, "nameが空です");
    if (!Array.isArray(fm.servedSessions) || fm.servedSessions.length === 0) {
      err(tag, "servedSessionsが空です（在職を確認できた会期を1件以上指定してください）");
    }
    if (fm.lastVerified && !DATE_RE.test(fm.lastVerified)) err(tag, `lastVerifiedの形式が不正です: ${fm.lastVerified}`);
  }
} catch (e) {
  if (e?.code !== "ENOENT") warn("formerMembers.json", `読み込みに失敗しました: ${e.message}`);
}

// --- members.json ---
const members = readJson("src/data/members.json");
const memberIds = new Set();
const VALID_GENDERS = new Set(["male", "female", "other", "undisclosed", "unknown"]);

for (const m of members) {
  const tag = `members.json (${m.id ?? "id不明"})`;
  if (isBlank(m.id)) err(tag, "idが空です");
  else if (memberIds.has(m.id)) err(tag, `議員IDが重複しています: ${m.id}`);
  else memberIds.add(m.id);

  if (isBlank(m.name)) err(tag, "nameが空です");
  if (isBlank(m.nameKana)) err(tag, "nameKanaが空です");
  if (isBlank(m.factionId)) warn(tag, "factionIdが空です");
  if (m.gender && !VALID_GENDERS.has(m.gender)) err(tag, `未定義のgenderです: ${m.gender}`);
  if (m.termCount !== undefined && typeof m.termCount !== "number") err(tag, "termCountが数値ではありません");
  if (m.age !== undefined && typeof m.age !== "number") err(tag, "ageが数値ではありません");

  if (m.photoUrl) {
    const localPath = join(root, "public", m.photoUrl.replace(/^\//, ""));
    if (!existsSync(localPath)) warn(tag, `photoUrlのファイルが見つかりません: ${m.photoUrl}`);
  }
  if (m.profileUrl && !URL_RE.test(m.profileUrl)) err(tag, `profileUrlの形式が不正です: ${m.profileUrl}`);

  const snsUrls = new Set();
  for (const s of m.sns ?? []) {
    if (!URL_RE.test(s.url ?? "")) err(tag, `SNS URLの形式が不正です: ${s.url}`);
    if (snsUrls.has(s.url)) err(tag, `同じSNS URLが重複登録されています: ${s.url}`);
    snsUrls.add(s.url);
  }

  for (const v of m.votes ?? []) {
    if (v.date && !DATE_RE.test(v.date)) err(tag, `votes[].dateの形式が不正です: ${v.date}`);
  }
  for (const q of m.questions ?? []) {
    if (q.date && !DATE_RE.test(q.date)) err(tag, `questions[].dateの形式が不正です: ${q.date}`);
  }
  if (formerMemberIds.has(m.id)) {
    err(tag, `現職議員IDと元議員（formerMembers.json）IDが重複しています: ${m.id}`);
  }
}

// --- generalQuestions.json ---
const generalQuestions = readJson("src/data/generalQuestions.json");
const questionIds = new Set();
const VALID_SESSION_TYPES = new Set(["定例会", "臨時会"]);
const VALID_QUESTION_TYPES = new Set(["一般質問", "代表質問"]);

for (const q of generalQuestions) {
  const tag = `generalQuestions.json (${q.id ?? "id不明"})`;
  if (isBlank(q.id)) err(tag, "idが空です");
  else if (questionIds.has(q.id)) err(tag, `一般質問IDが重複しています: ${q.id}`);
  else questionIds.add(q.id);

  if (!memberIds.has(q.memberId)) err(tag, `存在しない議員IDを参照しています: ${q.memberId}`);
  if (q.sessionType && !VALID_SESSION_TYPES.has(q.sessionType)) err(tag, `未定義のsessionTypeです: ${q.sessionType}`);
  if (q.questionType && !VALID_QUESTION_TYPES.has(q.questionType)) err(tag, `未定義のquestionTypeです: ${q.questionType}`);
  if (q.questionDate && !DATE_RE.test(q.questionDate)) err(tag, `questionDateの形式が不正です: ${q.questionDate}`);
  if (isBlank(q.title)) err(tag, "titleが空です");
  if (q.questionCount !== undefined && q.questionItems && q.questionCount !== q.questionItems.length) {
    warn(tag, `questionCount(${q.questionCount})とquestionItemsの件数(${q.questionItems.length})が一致しません`);
  }
  if (q.durationMinutes !== undefined && (typeof q.durationMinutes !== "number" || q.durationMinutes <= 0)) {
    err(tag, `durationMinutesが不正です（0より大きい数値である必要があります）: ${q.durationMinutes}`);
  }
  if (q.transcriptPdfUrl && !URL_RE.test(q.transcriptPdfUrl)) {
    err(tag, `transcriptPdfUrlの形式が不正です: ${q.transcriptPdfUrl}`);
  }
  for (const item of q.relatedFinanceItems ?? []) {
    if (isBlank(item)) err(tag, "relatedFinanceItemsに空文字が含まれています");
  }
}

// --- billVotes.json ---
const billVotes = readJson("src/data/billVotes.json");
const billIds = new Set();
const billVotesById = new Map(billVotes.filter((b) => !isBlank(b?.id)).map((b) => [b.id, b]));
const VALID_VOTE_STATUS = new Set([
  "approve",
  "oppose",
  "departed",
  "absent",
  "recused",
  "notVoting",
  "abstained",
  "unconfirmed",
]);
const VALID_PROPOSER_TYPES = new Set(["mayor", "member", "committee", "other"]);
const VALID_BILL_VOTE_RESULTS = new Set([
  "原案可決",
  "修正可決",
  "否決",
  "承認",
  "不承認",
  "認定",
  "不認定",
  "原案可決及び認定",
  "否決及び不認定",
  "同意",
  "不同意",
  "採択",
  "一部採択",
  "趣旨採択",
  "不採択",
  "継続審査",
  "撤回",
  "廃案",
  "その他",
  "確認中",
]);
const VALID_BILL_CATEGORIES = new Set([
  "条例",
  "予算",
  "決算",
  "契約",
  "財産取得",
  "人事",
  "意見書",
  "決議",
  "請願",
  "陳情",
  "専決処分",
  "その他",
  "不明",
]);
const VALID_RELATION_STATUSES = new Set(["confirmed", "suggested", "rejected"]);
const VALID_BILL_PUBLICATION_STATUSES = new Set([
  "published",
  "pendingReview",
  "updatedPendingReview",
  "rejected",
  "error",
]);
const VALID_BILL_VERIFICATION_STATUSES = new Set([
  "verified",
  "partially-verified",
  "pending",
  "individual-votes-unavailable",
]);
const VALID_BILL_SUMMARY_SOURCES = new Set(["template", "pdf", "manual"]);
const VALID_BILL_VOTE_METHODS = new Set([
  "全会一致",
  "起立多数",
  "起立少数",
  "簡易採決",
  "記名投票",
  "無記名投票",
  "採決なし",
  "確認できず",
]);
const VALID_INDIVIDUAL_VOTE_DISCLOSURE_STATUSES = new Set(["disclosed", "notDisclosed", "unconfirmed"]);
const seenSessionBillNumberPairs = new Map();

for (const b of billVotes) {
  const tag = `billVotes.json (${b.id ?? "id不明"})`;
  if (isBlank(b.id)) err(tag, "idが空です");
  else if (billIds.has(b.id)) err(tag, `議案IDが重複しています: ${b.id}`);
  else billIds.add(b.id);

  if (isBlank(b.billNumber)) err(tag, "billNumberが空です");
  if (isBlank(b.billTitle)) err(tag, "billTitleが空です");
  if (isBlank(b.summary)) err(tag, "summaryが空です");

  // 同一会期・同一議案番号の重複登録（同じ案件を別IDで二重登録していないか）。
  if (!isBlank(b.sessionId) && !isBlank(b.billNumber)) {
    const pairKey = `${b.sessionId}::${b.billNumber}`;
    const prevId = seenSessionBillNumberPairs.get(pairKey);
    if (prevId && prevId !== b.id) {
      err(tag, `同一会期・同一議案番号のデータが重複登録されています: ${b.billNumber}（既存: ${prevId}）`);
    } else {
      seenSessionBillNumberPairs.set(pairKey, b.id);
    }
  }

  if (b.submittedDate && b.votingDate && b.submittedDate > b.votingDate) {
    err(tag, `votingDate（${b.votingDate}）がsubmittedDate（${b.submittedDate}）より前です`);
  }
  if (b.voteMethod && !VALID_BILL_VOTE_METHODS.has(b.voteMethod)) {
    err(tag, `未定義のvoteMethodです: ${b.voteMethod}`);
  }
  if (
    b.individualVoteDisclosureStatus &&
    !VALID_INDIVIDUAL_VOTE_DISCLOSURE_STATUSES.has(b.individualVoteDisclosureStatus)
  ) {
    err(tag, `未定義のindividualVoteDisclosureStatusです: ${b.individualVoteDisclosureStatus}`);
  }
  // 個人別賛否データがあるのにdisclosed以外、または無いのにdisclosedのままという矛盾を防ぐ。
  const hasMemberVotes = (b.memberVotes ?? []).length > 0;
  if (hasMemberVotes && b.individualVoteDisclosureStatus && b.individualVoteDisclosureStatus !== "disclosed") {
    err(tag, `memberVotesがあるのにindividualVoteDisclosureStatusが"${b.individualVoteDisclosureStatus}"です`);
  }
  if (!hasMemberVotes && b.individualVoteDisclosureStatus === "disclosed") {
    err(tag, 'memberVotesが空なのにindividualVoteDisclosureStatusが"disclosed"です');
  }
  // 最終確認日（lastVerified）が古すぎる場合は、内容の再確認を推奨する警告を出す（エラーにはしない）。
  if (b.lastVerified && DATE_RE.test(b.lastVerified)) {
    const ageDays = (Date.now() - new Date(b.lastVerified).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 365) warn(tag, `lastVerifiedが1年以上前です（${b.lastVerified}）。内容の再確認を推奨します。`);
  }
  if (b.summarySource && !VALID_BILL_SUMMARY_SOURCES.has(b.summarySource)) {
    err(tag, `未定義のsummarySourceです: ${b.summarySource}`);
  }
  if (b.summaryGeneratedAt && !DATE_RE.test(b.summaryGeneratedAt)) {
    err(tag, `summaryGeneratedAtの形式が不正です: ${b.summaryGeneratedAt}`);
  }
  if (b.submittedDate && !DATE_RE.test(b.submittedDate)) err(tag, `submittedDateの形式が不正です: ${b.submittedDate}`);
  if (b.votingDate && !DATE_RE.test(b.votingDate)) err(tag, `votingDateの形式が不正です: ${b.votingDate}`);
  if (!VALID_BILL_VOTE_RESULTS.has(b.result)) err(tag, `未定義の議決結果です: ${b.result}`);

  const seenVoters = new Set();
  for (const v of b.memberVotes ?? []) {
    // 議決当時は現職議員だったが、その後退任してformerMembers.json側へ移った人物の記名投票結果も
    // 有効な参照として認める（現職・元議員のいずれのIDにも一致しない場合のみエラーとする）。
    if (!memberIds.has(v.memberId) && !formerMemberIds.has(v.memberId)) {
      err(tag, `存在しない議員IDを参照しています: ${v.memberId}`);
    }
    if (!VALID_VOTE_STATUS.has(v.vote)) err(tag, `未定義の賛否状態です: ${v.vote}`);
    if (seenVoters.has(v.memberId)) err(tag, `同じ議員の賛否が二重登録されています: ${v.memberId}`);
    seenVoters.add(v.memberId);
  }

  const billDocUrls = [b.billDocumentUrl, b.resultDocumentUrl, b.transcriptUrl, b.committeeDocumentUrl, b.budgetDocumentUrl, b.videoUrl];
  for (const url of billDocUrls) {
    if (url && !URL_RE.test(url)) err(tag, `根拠資料URLの形式が不正です: ${url}`);
  }
  // 「確認中」以外＝議決結果が確定しているデータには、必ず何らかの根拠資料URLを求める。
  const hasAnyDocument = billDocUrls.some(Boolean) || (b.relatedDocumentUrls ?? []).length > 0;
  if (b.result && b.result !== "確認中" && !hasAnyDocument) {
    err(tag, "議決結果が確定しているのに根拠資料URLが1件もありません");
  }

  if (b.proposerType && !VALID_PROPOSER_TYPES.has(b.proposerType)) {
    err(tag, `未定義のproposerTypeです: ${b.proposerType}`);
  }
  if (b.category && !VALID_BILL_CATEGORIES.has(b.category)) {
    err(tag, `未定義のcategoryです: ${b.category}`);
  }
  if (b.publicationStatus && !VALID_BILL_PUBLICATION_STATUSES.has(b.publicationStatus)) {
    err(tag, `未定義のpublicationStatusです: ${b.publicationStatus}`);
  }
  // rejected・errorのみ一般公開ページから除外する。pendingReview等は「確認待ち」表示を伴って公開される。
  if (b.publicationStatus === "rejected" || b.publicationStatus === "error") {
    warn(tag, `一般公開ページから除外されます（publicationStatus: ${b.publicationStatus}）。`);
  }
  if (b.verificationStatus && !VALID_BILL_VERIFICATION_STATUSES.has(b.verificationStatus)) {
    err(tag, `未定義のverificationStatusです: ${b.verificationStatus}`);
  }
  if (b.verificationStatus && b.verificationStatus !== "verified") {
    warn(tag, `確認待ち状態です（verificationStatus: ${b.verificationStatus}）。一般公開ページには「確認待ち」等の表示を伴って掲載されます。`);
    if (isBlank(b.verificationNote)) {
      err(tag, `verificationStatus="${b.verificationStatus}"なのにverificationNote（利用者向けの確認待ち理由）が設定されていません`);
    }
  }
  if (
    b.extractionConfidence !== undefined &&
    (typeof b.extractionConfidence !== "number" || b.extractionConfidence < 0 || b.extractionConfidence > 1)
  ) {
    err(tag, `extractionConfidenceが不正です（0〜1の数値が必要）: ${b.extractionConfidence}`);
  }
  if (b.extractedAt && !DATE_RE.test(b.extractedAt)) err(tag, `extractedAtの形式が不正です: ${b.extractedAt}`);

  for (const ordinance of b.relatedOrdinances ?? []) {
    if (isBlank(ordinance)) err(tag, "relatedOrdinancesに空文字が含まれています");
  }

  for (const qId of b.relatedQuestionIds ?? []) {
    if (!questionIds.has(qId)) warn(tag, `存在しない一般質問IDを参照しています: ${qId}`);
  }

  for (const item of b.relatedFinanceItems ?? []) {
    if (isBlank(item)) err(tag, "relatedFinanceItemsに空文字が含まれています");
  }

  if (b.relationStatus && !VALID_RELATION_STATUSES.has(b.relationStatus)) {
    err(tag, `未定義のrelationStatusです: ${b.relationStatus}`);
  }
  if (b.revisionOfBillId === b.id) err(tag, "revisionOfBillIdが自分自身を参照しています");
  if (b.replacesBillId === b.id) err(tag, "replacesBillIdが自分自身を参照しています");
  if (b.supersededByBillId === b.id) err(tag, "supersededByBillIdが自分自身を参照しています");
  if ((b.relatedBillIds ?? []).includes(b.id)) err(tag, "relatedBillIdsに自分自身が含まれています");
}

// 一般公開ページ（/bills/votes等）が表示する件数（publicationStatusがrejected/error以外）が、
// 実データが存在するのに0件になる回帰を検知するための保険。
{
  const publiclyVisibleCount = billVotes.filter(
    (b) => b.publicationStatus !== "rejected" && b.publicationStatus !== "error",
  ).length;
  if (billVotes.length > 0 && publiclyVisibleCount === 0) {
    err("billVotes.json", `議案データが${billVotes.length}件存在するのに、一般公開対象の集計が0件になっています`);
  }
}

// 関連議案の参照整合性・循環参照チェック（全IDが出揃った後に行う）。
for (const b of billVotes) {
  const tag = `billVotes.json (${b.id ?? "id不明"})`;
  for (const relId of b.relatedBillIds ?? []) {
    if (!billIds.has(relId)) warn(tag, `存在しない議案IDをrelatedBillIdsで参照しています: ${relId}`);
  }
  for (const [field, relId] of [
    ["revisionOfBillId", b.revisionOfBillId],
    ["replacesBillId", b.replacesBillId],
    ["supersededByBillId", b.supersededByBillId],
  ]) {
    if (relId && !billIds.has(relId)) warn(tag, `存在しない議案IDを${field}で参照しています: ${relId}`);
  }
  // revisionOfBillId → その議案のrevisionOfBillId → … と辿って自分自身に戻ってこないかを確認する（循環参照防止）。
  if (b.revisionOfBillId) {
    const visited = new Set([b.id]);
    let cursor = billVotesById.get(b.revisionOfBillId);
    while (cursor) {
      if (visited.has(cursor.id)) {
        err(tag, `revisionOfBillIdの参照が循環しています: ${[...visited, cursor.id].join(" → ")}`);
        break;
      }
      visited.add(cursor.id);
      cursor = cursor.revisionOfBillId ? billVotesById.get(cursor.revisionOfBillId) : undefined;
    }
  }
}

// --- councilSessions.json ---
const VALID_COUNCIL_SESSION_TYPES = new Set(["定例会", "臨時会"]);
const VALID_DOCUMENT_CATEGORIES = new Set([
  "proposals",
  "results",
  "petitions",
  "statements",
  "minutes",
  "newsletters",
  "other",
]);
const VALID_STORAGE_TYPES = new Set(["local", "external"]);
const VALID_VERIFICATION_STATUSES = new Set(["確認済み", "要確認", "自動取得"]);
const VALID_SESSION_SUMMARY_STATUSES = new Set(["verified", "partially-verified", "pending", "unavailable"]);
const VALID_PUBLICATION_STATUSES = new Set([
  "published",
  "pendingReview",
  "updatedPendingReview",
  "removedPendingReview",
  "error",
]);

/**
 * filePathが実在するかを、大文字小文字を区別して確認する。
 * Windows等の大文字小文字を区別しないファイルシステムでも existsSync だけでは検出できない
 * ケース（例: "Results.pdf" と登録したが実ファイルは "results.pdf"）を検出するため、
 * 実際のディレクトリ一覧（readdirSync）と完全一致するかを確認する。
 */
function localFileExistsCaseSensitive(relFilePath) {
  const absPath = join(root, "public", relFilePath.replace(/^\//, ""));
  const dir = dirname(absPath);
  const base = absPath.split(/[\\/]/).pop();
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).includes(base);
  } catch {
    return false;
  }
}

let councilSessions = [];
try {
  councilSessions = readJson("src/data/councilSessions.json");
  const sessionIds = new Set();
  const documentIds = new Set();
  const usedFilePaths = new Map();

  for (const s of councilSessions) {
    const tag = `councilSessions.json (${s.id ?? "id不明"})`;
    if (isBlank(s.id)) err(tag, "idが空です");
    else if (sessionIds.has(s.id)) err(tag, `定例会IDが重複しています: ${s.id}`);
    else sessionIds.add(s.id);

    if (isBlank(s.title)) err(tag, "titleが空です");
    if (isBlank(s.eraYear)) err(tag, "eraYearが空です");
    if (typeof s.year !== "number") err(tag, "yearが数値ではありません");
    if (typeof s.fiscalYear !== "number") err(tag, "fiscalYearが数値ではありません");
    if (!VALID_COUNCIL_SESSION_TYPES.has(s.sessionType)) err(tag, `未定義のsessionTypeです: ${s.sessionType}`);
    if (isBlank(s.folderPath) || !s.folderPath.startsWith("/council-documents/")) {
      err(tag, `folderPathの形式が不正です: ${s.folderPath}`);
    }
    if (s.startDate && !DATE_RE.test(s.startDate)) err(tag, `startDateの形式が不正です: ${s.startDate}`);
    if (s.endDate && !DATE_RE.test(s.endDate)) err(tag, `endDateの形式が不正です: ${s.endDate}`);
    if (s.lastVerified && !DATE_RE.test(s.lastVerified)) err(tag, `lastVerifiedの形式が不正です: ${s.lastVerified}`);
    if (s.officialSessionUrl && !URL_RE.test(s.officialSessionUrl)) {
      err(tag, `officialSessionUrlの形式が不正です: ${s.officialSessionUrl}`);
    }
    if (s.status && !VALID_VERIFICATION_STATUSES.has(s.status)) err(tag, `未定義のstatusです: ${s.status}`);
    if (s.status === "要確認") warn(tag, "自動生成された定例会データです。正式名称・会期などを人の目で確認してください。");

    if (s.summaryStatus && !VALID_SESSION_SUMMARY_STATUSES.has(s.summaryStatus)) {
      err(tag, `未定義のsummaryStatusです: ${s.summaryStatus}`);
    }
    if (s.summaryStatus === "unavailable" && (s.summary || s.shortSummary)) {
      err(tag, 'summaryStatus="unavailable"なのにsummary/shortSummaryが設定されています');
    }
    if (s.summaryStatus && s.summaryStatus !== "unavailable" && isBlank(s.summary)) {
      err(tag, `summaryStatus="${s.summaryStatus}"なのにsummaryが空です`);
    }
    if (s.summaryStatus && s.summaryStatus !== "verified") {
      warn(tag, `会期要約が確認待ち状態です（summaryStatus: ${s.summaryStatus}）。`);
    }
    if (s.summaryGeneratedAt && !DATE_RE.test(s.summaryGeneratedAt)) {
      err(tag, `summaryGeneratedAtの形式が不正です: ${s.summaryGeneratedAt}`);
    }
    if (s.summaryVerifiedAt && !DATE_RE.test(s.summaryVerifiedAt)) {
      err(tag, `summaryVerifiedAtの形式が不正です: ${s.summaryVerifiedAt}`);
    }
    for (const src of s.summarySources ?? []) {
      if (isBlank(src.title)) err(tag, "summarySourcesの資料titleが空です");
      if (src.sourceUrl && !URL_RE.test(src.sourceUrl)) err(tag, `summarySourcesのsourceUrlの形式が不正です: ${src.sourceUrl}`);
    }

    for (const d of s.documents ?? []) {
      const docTag = `councilSessions.json (${s.id ?? "id不明"} / ${d.id ?? "資料id不明"})`;
      if (isBlank(d.id)) err(docTag, "資料のidが空です");
      else if (documentIds.has(d.id)) err(docTag, `資料IDが重複しています: ${d.id}`);
      else documentIds.add(d.id);

      if (isBlank(d.title)) err(docTag, "資料のtitleが空です");
      if (!VALID_DOCUMENT_CATEGORIES.has(d.category)) err(docTag, `未定義のcategoryです: ${d.category}`);
      if (!VALID_STORAGE_TYPES.has(d.storageType)) err(docTag, `未定義のstorageTypeです: ${d.storageType}`);
      if (typeof d.isOfficial !== "boolean") err(docTag, "isOfficialが真偽値ではありません");
      if (d.verificationStatus && !VALID_VERIFICATION_STATUSES.has(d.verificationStatus)) {
        err(docTag, `未定義のverificationStatusです: ${d.verificationStatus}`);
      }
      if (d.verificationStatus === "要確認") {
        warn(docTag, "自動検出されたPDFです。資料名・分類・出典URLを人の目で確認してください。");
      }
      if (d.publicationStatus && !VALID_PUBLICATION_STATUSES.has(d.publicationStatus)) {
        err(docTag, `未定義のpublicationStatusです: ${d.publicationStatus}`);
      }
      if (d.publicationStatus && d.publicationStatus !== "published") {
        warn(docTag, `公開保留状態です（publicationStatus: ${d.publicationStatus}）。一般公開ページには表示されません。`);
      }
      if (d.sourcePageUrl && !URL_RE.test(d.sourcePageUrl)) {
        err(docTag, `sourcePageUrlの形式が不正です: ${d.sourcePageUrl}`);
      }

      if (d.storageType === "local") {
        if (isBlank(d.filePath)) {
          err(docTag, 'storageType="local"なのにfilePathが未設定です');
        } else {
          if (!d.filePath.startsWith("/council-documents/")) {
            err(docTag, `filePathは/council-documents/配下である必要があります: ${d.filePath}`);
          }
          if (/[^ -~]/.test(d.filePath) || /\s/.test(d.filePath)) {
            warn(docTag, `filePathに日本語または空白が含まれています（半角英数字を推奨）: ${d.filePath}`);
          }
          if (!localFileExistsCaseSensitive(d.filePath)) {
            err(docTag, `filePathのファイルが見つかりません（大文字小文字の違いも含む）: ${d.filePath}`);
          }
          const prevOwner = usedFilePaths.get(d.filePath);
          if (prevOwner) err(docTag, `同じfilePathが複数の資料で重複登録されています: ${d.filePath}（${prevOwner}）`);
          else usedFilePaths.set(d.filePath, docTag);
        }
      } else if (d.storageType === "external" && isBlank(d.sourceUrl)) {
        err(docTag, 'storageType="external"なのにsourceUrlが未設定です');
      }

      if (d.sourceUrl && !URL_RE.test(d.sourceUrl)) err(docTag, `sourceUrlの形式が不正です: ${d.sourceUrl}`);
      if (d.publishedDate && !DATE_RE.test(d.publishedDate)) err(docTag, `publishedDateの形式が不正です: ${d.publishedDate}`);
      if (d.verifiedAt && !DATE_RE.test(d.verifiedAt)) err(docTag, `verifiedAtの形式が不正です: ${d.verifiedAt}`);
      if (d.pages !== undefined && d.pages !== null && (typeof d.pages !== "number" || d.pages <= 0)) {
        err(docTag, `pagesが不正です（nullまたは0より大きい数値である必要があります）: ${d.pages}`);
      }
    }
  }

  for (const b of billVotes) {
    const tag = `billVotes.json (${b.id})`;
    if (b.sessionId && !sessionIds.has(b.sessionId)) {
      warn(tag, `存在しない定例会IDを参照しています: ${b.sessionId}`);
    }
    if (b.sourceDocumentId && !documentIds.has(b.sourceDocumentId)) {
      warn(tag, `存在しない定例会資料IDを参照しています: ${b.sourceDocumentId}`);
    }
  }
} catch {
  warn("councilSessions.json", "読み込めませんでした（存在しない場合はスキップ）");
}

// --- mayorPromises.json ---
let mayorPromiseIds = new Set();
const VALID_PROMISE_STATUS_LABELS = new Set([
  "達成",
  "進行中",
  "一部実施",
  "未着手",
  "方針変更",
  "確認中",
  "検討中",
  "実施済み",
]);
// 「達成」相当の確定的な状況。確定ステータスなのに根拠資料がない場合はエラーとする。
const CONFIRMED_PROMISE_STATUSES = new Set(["達成", "実施済み"]);

try {
  const mayorPromises = readJson("src/data/mayorPromises.json");
  const categoryIds = new Set((mayorPromises.categories ?? []).map((c) => c.id));
  const documentKeys = new Set((mayorPromises.documents ?? []).map((d) => d.key));
  // status(内部キー)とstatusLabel(表示ラベル)の対応が公約データ全体で一貫しているかを確認する
  // （固定の対応表を用意するのではなく、実データ内の対応関係自体の矛盾を検出する）。
  const statusToLabel = new Map();
  const labelToStatus = new Map();

  for (const p of mayorPromises.promises ?? []) {
    const tag = `mayorPromises.json (${p.id ?? "id不明"})`;

    if (isBlank(p.id)) err(tag, "idが空です");
    else if (mayorPromiseIds.has(p.id)) err(tag, `公約IDが重複しています: ${p.id}`);
    else mayorPromiseIds.add(p.id);

    if (isBlank(p.promiseText)) err(tag, "promiseTextが空です");
    if (isBlank(p.categoryTitle)) err(tag, "categoryTitleが空です");
    if (isBlank(p.categoryId)) err(tag, "categoryIdが空です");
    else if (!categoryIds.has(p.categoryId)) err(tag, `存在しないcategoryIdを参照しています: ${p.categoryId}`);

    if (!VALID_PROMISE_STATUS_LABELS.has(p.statusLabel)) err(tag, `未定義のstatusLabelです: ${p.statusLabel}`);
    if (CONFIRMED_PROMISE_STATUSES.has(p.statusLabel) && (p.evidenceItems ?? []).length === 0) {
      err(tag, `statusLabel="${p.statusLabel}"（確定的な状況）なのに根拠資料（evidenceItems）が1件もありません`);
    }
    if (isBlank(p.status)) {
      err(tag, "statusが空です");
    } else if (p.statusLabel) {
      const mappedLabel = statusToLabel.get(p.status);
      if (mappedLabel === undefined) {
        statusToLabel.set(p.status, p.statusLabel);
      } else if (mappedLabel !== p.statusLabel) {
        err(
          tag,
          `statusとstatusLabelの対応が他の公約と矛盾しています: status="${p.status}" が "${mappedLabel}" と "${p.statusLabel}" の両方に対応付けられています`,
        );
      }

      const mappedStatus = labelToStatus.get(p.statusLabel);
      if (mappedStatus === undefined) labelToStatus.set(p.statusLabel, p.status);
      else if (mappedStatus !== p.status) {
        warn(tag, `statusLabel="${p.statusLabel}" に複数のstatusキー（"${mappedStatus}" と "${p.status}"）が使われています`);
      }
    }

    if (p.referenceDate && !DATE_RE.test(p.referenceDate)) err(tag, `referenceDateの形式が不正です: ${p.referenceDate}`);
    if (p.lastVerified && !DATE_RE.test(p.lastVerified)) err(tag, `lastVerifiedの形式が不正です: ${p.lastVerified}`);
    if (p.announcedDate && !DATE_RE.test(p.announcedDate)) err(tag, `announcedDateの形式が不正です: ${p.announcedDate}`);
    if (p.siteUpdatedAt && !DATE_RE.test(p.siteUpdatedAt)) err(tag, `siteUpdatedAtの形式が不正です: ${p.siteUpdatedAt}`);

    const seenDocKeys = new Set();
    for (const ev of p.evidenceItems ?? []) {
      if (!documentKeys.has(ev.documentKey)) err(tag, `存在しないdocumentKeyを参照しています: ${ev.documentKey}`);
      if (seenDocKeys.has(ev.documentKey)) warn(tag, `同じ根拠資料（${ev.documentKey}）が重複して参照されています`);
      seenDocKeys.add(ev.documentKey);
    }

    for (const link of p.relatedLinks ?? []) {
      if (!URL_RE.test(link.url ?? "")) err(tag, `relatedLinksのURL形式が不正です: ${link.url}`);
    }

    for (const bId of p.relatedBillVoteIds ?? []) {
      if (!billIds.has(bId)) warn(tag, `存在しない議案IDを参照しています: ${bId}`);
    }
    for (const qId of p.relatedQuestionIds ?? []) {
      if (!questionIds.has(qId)) warn(tag, `存在しない一般質問IDを参照しています: ${qId}`);
    }
    // mayorPressConferences.tsはTypeScriptモジュールのためこのスクリプトからは直接参照できず、日付形式のみ検証する。
    for (const d of p.relatedPressConferenceDates ?? []) {
      if (!DATE_RE.test(d)) err(tag, `relatedPressConferenceDatesの形式が不正です: ${d}`);
    }

    if (p.progressHistory && p.progressHistory.length > 0) {
      for (const h of p.progressHistory) {
        if (!DATE_RE.test(h.date ?? "")) err(tag, `progressHistory[].dateの形式が不正です: ${h.date}`);
        if (!VALID_PROMISE_STATUS_LABELS.has(h.statusLabel))
          err(tag, `progressHistory[]に未定義のstatusLabelがあります: ${h.statusLabel}`);
        // 進捗状況の変更には出典URLと確認日（date）を必須とする。
        if (isBlank(h.sourceUrl)) err(tag, `progressHistory[]（${h.date ?? "日付不明"}）にsourceUrl（出典URL）がありません`);
        else if (!URL_RE.test(h.sourceUrl)) err(tag, `progressHistory[].sourceUrlの形式が不正です: ${h.sourceUrl}`);
      }
      const dates = p.progressHistory.map((h) => h.date);
      const sortedDates = [...dates].sort();
      if (JSON.stringify(dates) !== JSON.stringify(sortedDates)) {
        err(tag, "progressHistoryが日付の昇順に並んでいません");
      }
    }

    // 詳細ページ（/mayor/policy-progress/:id）を安全に描画できるかの最低条件。
    if (isBlank(p.id) || isBlank(p.promiseText) || !VALID_PROMISE_STATUS_LABELS.has(p.statusLabel)) {
      err(tag, "詳細ページの生成に必要な項目（id / promiseText / statusLabel）が不足しています");
    }
  }

  const docUrls = new Set();
  for (const d of mayorPromises.documents ?? []) {
    const docTag = `mayorPromises.json (documents:${d.key ?? "key不明"})`;
    if (d.publishedDate && !DATE_RE.test(d.publishedDate)) err(docTag, `publishedDateの形式が不正です: ${d.publishedDate}`);
    if (isBlank(d.url)) continue;
    if (docUrls.has(d.url)) warn("mayorPromises.json (documents)", `根拠資料のURLが重複しています: ${d.url}`);
    docUrls.add(d.url);
  }
} catch {
  warn("mayorPromises.json", "読み込めませんでした（存在しない場合はスキップ）");
}

for (const b of billVotes) {
  for (const pId of b.relatedMayorPromiseIds ?? []) {
    if (!mayorPromiseIds.has(pId)) warn(`billVotes.json (${b.id})`, `存在しない市長公約IDを参照しています: ${pId}`);
  }
}

for (const q of generalQuestions) {
  const tag = `generalQuestions.json (${q.id ?? "id不明"})`;
  for (const bId of q.relatedBillVoteIds ?? []) {
    if (!billIds.has(bId)) warn(tag, `存在しない議案IDを参照しています: ${bId}`);
  }
  for (const pId of q.relatedMayorPromiseIds ?? []) {
    if (!mayorPromiseIds.has(pId)) warn(tag, `存在しない市長公約IDを参照しています: ${pId}`);
  }
}

// --- compensationComparison.json ---
function isPositiveAmount(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

try {
  const compensation = readJson("src/data/compensationComparison.json");
  const compensationIds = new Set();
  const sourceUrls = new Map();

  for (const c of compensation) {
    const tag = `compensationComparison.json (${c.id ?? c.municipality ?? "id不明"})`;

    if (isBlank(c.id)) err(tag, "idが空です");
    else if (compensationIds.has(c.id)) err(tag, `自治体IDが重複しています: ${c.id}`);
    else compensationIds.add(c.id);

    if (isBlank(c.municipality)) err(tag, "municipalityが空です");
    if (isBlank(c.prefecture)) err(tag, "prefectureが空です");
    if (!c.referenceDate || !DATE_RE.test(c.referenceDate)) err(tag, `referenceDateが未登録または形式が不正です: ${c.referenceDate}`);
    if (c.confirmedAt && !DATE_RE.test(c.confirmedAt)) err(tag, `confirmedAtの形式が不正です: ${c.confirmedAt}`);

    for (const [key, label] of [
      ["mayorMonthly", "市長月額"],
      ["chairMonthly", "議長月額"],
      ["viceChairMonthly", "副議長月額"],
      ["memberMonthly", "議員月額"],
    ]) {
      if (!isPositiveAmount(c[key])) err(tag, `${label}(${key})が不正、または0以下の金額です: ${c[key]}`);
    }

    for (const key of ["mayorBonusMonths", "councilBonusMonths", "bonusAdjustmentRate"]) {
      const v = c[key];
      if (v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
        err(tag, `${key}が不正です（null または0以上の数値である必要があります）: ${v}`);
      }
    }

    if (!URL_RE.test(c.sourceUrl ?? "")) err(tag, `sourceUrlの形式が不正です: ${c.sourceUrl}`);
    if (isBlank(c.sourceTitle)) err(tag, "sourceTitleが空です");
    if (c.sourceUrl) {
      const prevMunicipality = sourceUrls.get(c.sourceUrl);
      if (prevMunicipality && prevMunicipality !== c.municipality) {
        warn(tag, `sourceUrlが別の自治体（${prevMunicipality}）と重複しています: ${c.sourceUrl}`);
      }
      sourceUrls.set(c.sourceUrl, c.municipality);
    }

    if (c.pendingProposal?.sourceUrl && !URL_RE.test(c.pendingProposal.sourceUrl)) {
      err(tag, `pendingProposal.sourceUrlの形式が不正です: ${c.pendingProposal.sourceUrl}`);
    }
  }
} catch {
  warn("compensationComparison.json", "読み込めませんでした（存在しない場合はスキップ）");
}

// --- nationalCompensationRanking.json / similarMunicipalityComparison.json（役職別の順位・範囲データ） ---
function validateRoleRankingFile(relPath) {
  try {
    const data = readJson(relPath);
    const tag = (role) => `${relPath} (${role})`;

    if (!URL_RE.test(data.sourceUrl ?? "")) err(relPath, `sourceUrlの形式が不正です: ${data.sourceUrl}`);
    if (data.referenceDate && !DATE_RE.test(data.referenceDate)) err(relPath, `referenceDateの形式が不正です: ${data.referenceDate}`);
    if (data.lastVerified && !DATE_RE.test(data.lastVerified)) err(relPath, `lastVerifiedの形式が不正です: ${data.lastVerified}`);

    for (const r of data.roles ?? []) {
      const hasRank = r.rank !== null && r.rank !== undefined;
      const hasMonthly = r.monthly !== null && r.monthly !== undefined;
      if (hasRank !== hasMonthly) {
        err(tag(r.role), `順位状態(rank)と順位値(monthly)の整合性が取れていません: rank=${r.rank}, monthly=${r.monthly}`);
      }
      if (r.max !== undefined && r.min !== undefined) {
        if (r.min > r.max) {
          err(tag(r.role), `最低額(min=${r.min})が最高額(max=${r.max})を上回っています`);
        }
        const nobeoka = (readJson("src/data/compensationComparison.json") ?? []).find((c) => c.id === "nobeoka");
        if (nobeoka) {
          const monthlyKey = { mayor: "mayorMonthly", chair: "chairMonthly", viceChair: "viceChairMonthly", member: "memberMonthly" }[
            r.role
          ];
          const nobeokaAmount = nobeoka[monthlyKey];
          if (typeof nobeokaAmount === "number" && (nobeokaAmount < r.min || nobeokaAmount > r.max)) {
            err(
              tag(r.role),
              `延岡市の金額(${nobeokaAmount})が類似団体の最高・最低範囲(${r.min}〜${r.max})の外にあります`,
            );
          }
        }
      }
    }
  } catch {
    warn(relPath, "読み込めませんでした（存在しない場合はスキップ）");
  }
}

validateRoleRankingFile("src/data/nationalCompensationRanking.json");
validateRoleRankingFile("src/data/similarMunicipalityComparison.json");

// --- councilWatchedDocuments.json（5日ごと自動巡回の差分取得結果） ---
try {
  const watched = readJson("src/data/councilWatchedDocuments.json");
  if (!Array.isArray(watched)) throw new Error("配列ではありません");

  const ALLOWED_WATCH_CATEGORIES = new Set([
    "session-schedule",
    "statement-resolution",
    "committee-activity-report",
    "question-notice",
    "question-notice-index-state",
    "member-roster-watch",
  ]);
  const ALLOWED_WATCH_STATUS = new Set([
    "published",
    "baseline",
    "url-change-suspected",
    "removed-confirmed-suspected",
    "要確認（変更検知）",
  ]);
  const ALLOWED_OCR_STATUS = new Set(["text-extracted", "OCR確認待ち", undefined, null]);
  const ALLOWED_HOST_RE = /^https:\/\/(www\.)?city\.nobeoka\.miyazaki\.jp\//;

  const seenIds = new Set();
  for (const r of watched) {
    const tag = `councilWatchedDocuments.json (${r.id ?? "id不明"})`;
    if (isBlank(r.id)) err(tag, "idが空です");
    else if (seenIds.has(r.id)) err(tag, `idが重複しています: ${r.id}`);
    else seenIds.add(r.id);

    if (!ALLOWED_WATCH_CATEGORIES.has(r.category)) err(tag, `未知のcategoryです: ${r.category}`);
    if (isBlank(r.title)) err(tag, "titleが空です");
    if (!r.sourceUrl || !ALLOWED_HOST_RE.test(r.sourceUrl)) {
      err(tag, `sourceUrlが延岡市公式サイト以外、または不正です: ${r.sourceUrl}`);
    }
    if (r.status !== undefined && !ALLOWED_WATCH_STATUS.has(r.status)) {
      warn(tag, `statusが想定外の値です（誤りではないが確認推奨）: ${r.status}`);
    }
    if (!ALLOWED_OCR_STATUS.has(r.ocrStatus)) {
      warn(tag, `ocrStatusが想定外の値です（誤りではないが確認推奨）: ${r.ocrStatus}`);
    }
    if (r.firstDetectedAt && !DATE_RE.test(r.firstDetectedAt)) err(tag, `firstDetectedAtの形式が不正です: ${r.firstDetectedAt}`);
    if (r.lastCheckedAt && !DATE_RE.test(r.lastCheckedAt)) err(tag, `lastCheckedAtの形式が不正です: ${r.lastCheckedAt}`);

    if (r.category === "question-notice" && r.memberId) {
      const memberExists = (members ?? []).some((m) => m.id === r.memberId);
      if (!memberExists) err(tag, `memberIdが議員データに存在しません: ${r.memberId}`);
    }
  }
} catch {
  warn("councilWatchedDocuments.json", "読み込めませんでした（存在しない場合はスキップ）");
}

// --- financeDashboard.json ---
try {
  const finance = readJson("src/data/financeDashboard.json");
  const tag = "financeDashboard.json";

  if (finance.fiscalYear && !/^\d{4}$/.test(finance.fiscalYear)) err(tag, `fiscalYearの形式が不正です: ${finance.fiscalYear}`);
  if (finance.referenceDate && !DATE_RE.test(finance.referenceDate)) err(tag, `referenceDateの形式が不正です: ${finance.referenceDate}`);
  if (finance.lastVerified && !DATE_RE.test(finance.lastVerified)) err(tag, `lastVerifiedの形式が不正です: ${finance.lastVerified}`);

  function checkAmountItems(items, label) {
    const seenLabels = new Set();
    for (const item of items ?? []) {
      const itemTag = `${tag} (${label}:${item.label ?? "項目不明"})`;
      if (isBlank(item.label)) err(itemTag, "labelが空です");
      else if (seenLabels.has(item.label)) err(itemTag, `${label}内で項目名が重複しています: ${item.label}`);
      else seenLabels.add(item.label);
      if (typeof item.amountThousandYen !== "number" || !Number.isFinite(item.amountThousandYen)) {
        err(itemTag, `amountThousandYenが数値ではありません: ${item.amountThousandYen}`);
      } else if (item.amountThousandYen < 0) {
        err(itemTag, `amountThousandYenが負の値です: ${item.amountThousandYen}`);
      }
      if (item.percentage !== undefined && (item.percentage < 0 || item.percentage > 100)) {
        err(itemTag, `percentageが0〜100の範囲外です: ${item.percentage}`);
      }
    }
  }
  checkAmountItems(finance.revenue, "revenue");
  checkAmountItems(finance.expenditureByPurpose, "expenditureByPurpose");
  checkAmountItems(finance.expenditureByNature, "expenditureByNature");

  for (const p of finance.supplementaryBudgetProjects ?? []) {
    if (isBlank(p.title)) err(tag, "supplementaryBudgetProjects[].titleが空です");
    if (typeof p.amountThousandYen !== "number" || p.amountThousandYen < 0) {
      err(tag, `supplementaryBudgetProjects[].amountThousandYenが不正です: ${p.amountThousandYen}`);
    }
  }

  // 年度重複・年度欠落（連続する年度が飛んでいないか）・負の値のチェック
  function checkFiscalYearSeries(entries, label, yearField, amountField) {
    const seenYears = new Set();
    for (const e of entries ?? []) {
      const y = e[yearField];
      const seriesTag = `${tag} (${label}:${y ?? "年度不明"})`;
      if (isBlank(y)) err(seriesTag, "年度ラベルが空です");
      else if (seenYears.has(y)) err(seriesTag, `${label}内で年度が重複しています: ${y}`);
      else seenYears.add(y);
      const amount = e[amountField];
      if (typeof amount !== "number" || !Number.isFinite(amount)) {
        err(seriesTag, `${amountField}が数値ではありません: ${amount}`);
      } else if (amount < 0) {
        err(seriesTag, `${amountField}が負の値です: ${amount}`);
      }
    }
  }
  checkFiscalYearSeries(finance.fundBalance?.fiscalAdjustmentFunds, "fundBalance.fiscalAdjustmentFunds", "fiscalYear", "amountThousands");
  checkFiscalYearSeries(finance.debtBalanceTrend, "debtBalanceTrend", "fiscalYear", "amountThousandYen");

  if (finance.fundBalance?.totalFunds) {
    const t = finance.fundBalance.totalFunds;
    const sum = (t.fiscalAdjustmentFunds ?? 0) + (t.otherSpecificPurposeFunds ?? 0);
    if (typeof t.total === "number" && sum !== t.total) {
      err(tag, `fundBalance.totalFunds: 内訳の合計(${sum})とtotal(${t.total})が一致しません`);
    }
  }

  // 人口推移：年度重複・0以下の人口（0除算防止）・世界的にありえない値の防止
  const seenPopYears = new Set();
  for (const p of finance.populationTrend?.trend ?? []) {
    const popTag = `${tag} (populationTrend:${p.year ?? "年不明"})`;
    if (seenPopYears.has(p.year)) err(popTag, `populationTrend内で年が重複しています: ${p.year}`);
    else seenPopYears.add(p.year);
    if (p.referenceDate && !DATE_RE.test(p.referenceDate)) err(popTag, `referenceDateの形式が不正です: ${p.referenceDate}`);
    if (typeof p.population !== "number" || p.population <= 0) {
      err(popTag, `populationが不正です（0より大きい数値が必要）: ${p.population}`);
    }
  }
  if (finance.populationTrend?.latest) {
    const latest = finance.populationTrend.latest;
    if (typeof latest.population !== "number" || latest.population <= 0) {
      err(tag, `populationTrend.latest.populationが不正です（人口0除算の原因になります）: ${latest.population}`);
    }
    if (latest.referenceDate && !DATE_RE.test(latest.referenceDate)) {
      err(tag, `populationTrend.latest.referenceDateの形式が不正です: ${latest.referenceDate}`);
    }
  }

  // 財政指標：%範囲チェック（0〜100を超えることがある比率は除外し、常識的な範囲のみチェック）
  const fi = finance.financialIndicators;
  if (fi) {
    if (isBlank(fi.fiscalYearLabel)) err(`${tag} (financialIndicators)`, "fiscalYearLabelが空です");
    for (const [key, label] of [
      ["realDebtServiceRatioPercent", "実質公債費比率"],
      ["futureBurdenRatioPercent", "将来負担比率"],
      ["currentBalanceRatioPercent", "経常収支比率"],
    ]) {
      const v = fi[key];
      if (v !== null && (typeof v !== "number" || v < 0)) {
        err(`${tag} (financialIndicators)`, `${label}(${key})が不正です（nullまたは0以上の数値が必要）: ${v}`);
      }
    }
    if (fi.fiscalStrengthIndex !== null && (typeof fi.fiscalStrengthIndex !== "number" || fi.fiscalStrengthIndex < 0)) {
      err(`${tag} (financialIndicators)`, `fiscalStrengthIndexが不正です: ${fi.fiscalStrengthIndex}`);
    }
  }

  // 出典：sectionの重複、URL形式、日付形式
  const seenSections = new Set();
  for (const s of finance.sources ?? []) {
    const sourceTag = `${tag} (sources:${s.section ?? "section不明"})`;
    if (isBlank(s.section)) err(sourceTag, "sectionが空です");
    else if (seenSections.has(s.section)) warn(sourceTag, `同じsectionの出典が複数登録されています: ${s.section}`);
    seenSections.add(s.section);
    if (isBlank(s.title)) err(sourceTag, "titleが空です");
    if (isBlank(s.organization)) err(sourceTag, "organizationが空です");
    // 資料URLはドキュメントルート相対パス（/documents/...）または絶対URLのいずれかを許可する。
    if (isBlank(s.url) || !(s.url.startsWith("/") || URL_RE.test(s.url))) {
      err(sourceTag, `urlの形式が不正です: ${s.url}`);
    }
    if (s.referenceDate && !DATE_RE.test(s.referenceDate)) err(sourceTag, `referenceDateの形式が不正です: ${s.referenceDate}`);
    if (s.confirmedDate && !DATE_RE.test(s.confirmedDate)) err(sourceTag, `confirmedDateの形式が不正です: ${s.confirmedDate}`);
  }
} catch {
  warn("financeDashboard.json", "読み込めませんでした（存在しない場合はスキップ）");
}

// --- politicalFundOrganizations.json / politicalFundReports.json（政治資金収支報告書。TASK-016Aから実データを順次登録） ---
try {
  const politicalFundOrganizations = readJson("src/data/politicalFundOrganizations.json");
  const politicalFundReports = readJson("src/data/politicalFundReports.json");
  const VALID_ORG_TYPES = new Set(["資金管理団体", "後援会", "政党支部", "その他の政治団体", "確認中"]);
  const VALID_DISCLOSURE_AUTHORITIES = new Set(["総務省", "宮崎県選挙管理委員会", "延岡市選挙管理委員会", "確認中"]);
  const VALID_REPORT_STATUSES = new Set(["確認済み", "確認中", "情報未登録"]);
  const VALID_ORG_VERIFICATION_STATUSES = new Set(["confirmed", "partiallyVerified", "pending"]);
  const orgIds = new Set();

  // relatedMemberIdとrelatedPersonNameの矛盾検出用（現職・元議員の氏名を突合する）。
  const memberNameById = new Map(members.map((m) => [m.id, m.name]));
  try {
    const formerMembersForNameCheck = readJson("src/data/formerMembers.json");
    for (const fm of formerMembersForNameCheck) memberNameById.set(fm.id, fm.name);
  } catch {
    // formerMembers.jsonの読み込み自体は別のブロックで検証済みのためここでは無視する
  }

  // 団体名の重複候補検出用（全角/半角スペース・記号の差だけで別団体扱いにしないよう正規化して比較する）。
  const normalizeOrgName = (name) =>
    typeof name === "string" ? name.replace(/[\s　]+/g, "").normalize("NFKC") : "";
  const seenNormalizedNames = new Map();

  for (const o of politicalFundOrganizations) {
    const tag = `politicalFundOrganizations.json (${o.id ?? "id不明"})`;
    if (isBlank(o.id)) err(tag, "idが空です");
    else if (orgIds.has(o.id)) err(tag, `idが重複しています: ${o.id}`);
    else orgIds.add(o.id);

    if (isBlank(o.name)) err(tag, "nameが空です");
    if (!VALID_ORG_TYPES.has(o.organizationType)) err(tag, `未定義のorganizationTypeです: ${o.organizationType}`);
    if (!VALID_DISCLOSURE_AUTHORITIES.has(o.disclosureAuthority)) {
      err(tag, `未定義のdisclosureAuthorityです: ${o.disclosureAuthority}`);
    }
    if (!VALID_ORG_VERIFICATION_STATUSES.has(o.verificationStatus)) {
      err(tag, `未定義のverificationStatusです: ${o.verificationStatus}`);
    }

    // representativeName：nullは「一次資料で未確認」を表す正式な状態として許容するが、
    // その場合はverificationStatusがconfirmed（確認済み扱い）であってはならない。
    // 空文字（""）はnullと違い単なる入力漏れとみなし、常にエラーとする。
    if (o.representativeName === null) {
      if (o.verificationStatus === "confirmed") {
        err(tag, "representativeNameがnullなのにverificationStatusがconfirmedです（未確認の項目が残っています）");
      }
    } else if (isBlank(o.representativeName)) {
      err(tag, "representativeNameが空文字です（未確認の場合はnull、確認済みの場合は氏名を設定してください）");
    }

    if (o.relatedMemberId && !memberIds.has(o.relatedMemberId) && !formerMemberIds.has(o.relatedMemberId)) {
      err(tag, `存在しない議員IDをrelatedMemberIdで参照しています: ${o.relatedMemberId}`);
    }
    // relatedMemberIdとrelatedPersonNameの矛盾：両方設定されている場合、参照先の氏名と一致しなければならない。
    if (o.relatedMemberId && !isBlank(o.relatedPersonName)) {
      const resolvedName = memberNameById.get(o.relatedMemberId);
      if (resolvedName && resolvedName !== o.relatedPersonName) {
        err(
          tag,
          `relatedPersonName（${o.relatedPersonName}）がrelatedMemberId（${o.relatedMemberId}）の氏名（${resolvedName}）と一致しません`,
        );
      }
    }
    if (o.officialListUrl && !URL_RE.test(o.officialListUrl)) err(tag, `officialListUrlの形式が不正です: ${o.officialListUrl}`);
    if (o.verifiedAt && !DATE_RE.test(o.verifiedAt)) err(tag, `verifiedAtの形式が不正です: ${o.verifiedAt}`);
    // 確認日を記録している（＝サイト運営者が確認済みとして扱っている）のに一次資料へのリンクが無いのは
    // 出典不備として扱う。
    if (o.verifiedAt && isBlank(o.officialListUrl)) {
      err(tag, "verifiedAtが設定されているのにofficialListUrlが未設定です（確認済み扱いには出典URLが必要です）");
    }

    // 同一団体と思われる重複候補（表記ゆれのみの違いは警告に留め、機械的にエラー扱いしない）。
    const normalized = normalizeOrgName(o.name);
    if (normalized) {
      const prevId = seenNormalizedNames.get(normalized);
      if (prevId && prevId !== o.id) {
        warn(tag, `団体名が正規化後に一致する団体があります（重複候補、要目視確認）: ${prevId}`);
      } else {
        seenNormalizedNames.set(normalized, o.id);
      }
    }
  }

  const reportIds = new Set();
  const seenOrgYearPairs = new Set();
  for (const r of politicalFundReports) {
    const tag = `politicalFundReports.json (${r.id ?? "id不明"})`;
    if (isBlank(r.id)) err(tag, "idが空です");
    else if (reportIds.has(r.id)) err(tag, `idが重複しています: ${r.id}`);
    else reportIds.add(r.id);

    if (isBlank(r.organizationId)) err(tag, "organizationIdが空です");
    else if (!orgIds.has(r.organizationId)) err(tag, `存在しない政治団体IDを参照しています: ${r.organizationId}`);
    if (isBlank(r.fiscalYear)) err(tag, "fiscalYearが空です");
    if (!VALID_REPORT_STATUSES.has(r.reportStatus)) err(tag, `未定義のreportStatusです: ${r.reportStatus}`);
    if (r.amountUnit !== "円") err(tag, `amountUnitは"円"固定です: ${r.amountUnit}`);

    const pairKey = `${r.organizationId}::${r.fiscalYear}`;
    if (seenOrgYearPairs.has(pairKey)) err(tag, `同じ政治団体・同じ年分の収支報告書が重複登録されています: ${r.fiscalYear}`);
    seenOrgYearPairs.add(pairKey);

    for (const amountField of [
      "carriedOverFromPreviousYear",
      "totalIncome",
      "totalExpenditure",
      "carriedOverToNextYear",
    ]) {
      const v = r[amountField];
      if (v !== null && v !== undefined && (typeof v !== "number" || v < 0)) {
        err(tag, `${amountField}が不正です（null、または0以上の数値が必要）: ${v}`);
      }
    }
    for (const breakdown of [r.incomeBreakdown, r.expenditureBreakdown]) {
      if (!breakdown) continue;
      for (const [k, v] of Object.entries(breakdown)) {
        if (v !== null && v !== undefined && (typeof v !== "number" || v < 0)) {
          err(tag, `内訳項目${k}が不正です（null、または0以上の数値が必要）: ${v}`);
        }
      }
    }
    if (r.publishedDate && !DATE_RE.test(r.publishedDate)) err(tag, `publishedDateの形式が不正です: ${r.publishedDate}`);
    if (r.verifiedAt && !DATE_RE.test(r.verifiedAt)) err(tag, `verifiedAtの形式が不正です: ${r.verifiedAt}`);
    if (r.sourceUrl && !URL_RE.test(r.sourceUrl)) err(tag, `sourceUrlの形式が不正です: ${r.sourceUrl}`);
    // 確認済み（金額が確定している）状態には一次資料URLを求める。情報未登録・確認中はまだ資料未収集のため対象外。
    if (r.reportStatus === "確認済み" && isBlank(r.sourceUrl)) {
      err(tag, 'reportStatus="確認済み"なのにsourceUrl（一次資料）が設定されていません');
    }
  }
} catch (e) {
  if (e?.code !== "ENOENT") {
    warn("politicalFundOrganizations.json / politicalFundReports.json", `読み込みに失敗しました: ${e.message}`);
  }
}

// --- committees.json（常任委員会・議会運営委員会・特別委員会） ---
try {
  const committees = readJson("src/data/committees.json");
  const VALID_COMMITTEE_TYPES = new Set(["常任委員会", "議会運営委員会", "特別委員会"]);
  const VALID_COMMITTEE_ROLES = new Set(["委員長", "副委員長", "委員"]);
  const committeeIds = new Set();
  const committeeNames = new Set();

  for (const c of committees) {
    const tag = `committees.json (${c.id ?? "id不明"})`;
    if (isBlank(c.id)) err(tag, "idが空です");
    else if (committeeIds.has(c.id)) err(tag, `idが重複しています: ${c.id}`);
    else committeeIds.add(c.id);

    if (isBlank(c.name)) err(tag, "nameが空です");
    else if (committeeNames.has(c.name)) err(tag, `nameが重複しています: ${c.name}`);
    else committeeNames.add(c.name);

    if (!VALID_COMMITTEE_TYPES.has(c.type)) err(tag, `未定義のtypeです: ${c.type}`);

    if (!Array.isArray(c.members) || c.members.length === 0) {
      err(tag, "membersが空です");
    } else {
      const seenMemberIds = new Set();
      let chairCount = 0;
      let viceChairCount = 0;
      for (const mem of c.members) {
        if (isBlank(mem.memberId)) {
          err(tag, "membersにmemberIdが空の要素があります");
        } else if (!memberIds.has(mem.memberId) && !formerMemberIds.has(mem.memberId)) {
          err(tag, `存在しない議員IDを参照しています: ${mem.memberId}`);
        } else if (seenMemberIds.has(mem.memberId)) {
          err(tag, `同じ議員が委員として重複登録されています: ${mem.memberId}`);
        } else {
          seenMemberIds.add(mem.memberId);
        }
        if (!VALID_COMMITTEE_ROLES.has(mem.role)) err(tag, `未定義のroleです: ${mem.role}`);
        if (mem.role === "委員長") chairCount++;
        if (mem.role === "副委員長") viceChairCount++;
      }
      if (chairCount > 1) err(tag, `委員長が複数登録されています（${chairCount}名）`);
      if (viceChairCount > 1) err(tag, `副委員長が複数登録されています（${viceChairCount}名）`);
      if (c.memberCount !== c.members.length) {
        err(tag, `memberCount（${c.memberCount}）がmembers配列の要素数（${c.members.length}）と一致しません`);
      }
    }

    if (c.termStart && !DATE_RE.test(c.termStart)) err(tag, `termStartの形式が不正です: ${c.termStart}`);
    if (c.termEnd && !DATE_RE.test(c.termEnd)) err(tag, `termEndの形式が不正です: ${c.termEnd}`);
    if (c.establishedDate && !DATE_RE.test(c.establishedDate)) err(tag, `establishedDateの形式が不正です: ${c.establishedDate}`);
    if (c.termStart && c.termEnd && c.termStart > c.termEnd) err(tag, "termStartがtermEndより後の日付です");
    if (c.minutesSearchUrl && !URL_RE.test(c.minutesSearchUrl)) err(tag, `minutesSearchUrlの形式が不正です: ${c.minutesSearchUrl}`);
    if (!Array.isArray(c.sourceRefs) || c.sourceRefs.length === 0) {
      err(tag, "sourceRefsが空です（出典が必要です）");
    } else {
      for (const s of c.sourceRefs) {
        if (isBlank(s.url) || !URL_RE.test(s.url)) err(tag, `sourceRefsのurlが不正です: ${s.url}`);
      }
    }
    if (!c.lastVerifiedAt || !DATE_RE.test(c.lastVerifiedAt)) err(tag, `lastVerifiedAtの形式が不正です: ${c.lastVerifiedAt}`);
  }

  // billVotes.jsonのcommitteeフィールドが、committees.jsonに存在しない委員会名を参照している場合は
  // 気づけるよう警告する（委員会条例改正等で名称が変わった場合の見落とし防止。誤りとは限らないためwarn）。
  const billCommitteeNames = new Set(billVotes.map((b) => b.committee).filter(Boolean));
  for (const name of billCommitteeNames) {
    if (!committeeNames.has(name) && !/審査特別委員会$/.test(name)) {
      warn("committees.json", `billVotes.jsonのcommitteeで参照されているが委員会名簿に無い委員会名です: ${name}`);
    }
  }
} catch (e) {
  if (e?.code !== "ENOENT") {
    warn("committees.json", `読み込みに失敗しました: ${e.message}`);
  }
}

// --- archiveMayors.json / archiveMayorTerms.json（延岡市政アーカイブ：歴代市長） ---
let archiveMayorIds = new Set();
let archiveMayorTermIds = new Set();
try {
  const archiveMayors = readJson("src/data/archiveMayors.json");
  if (!Array.isArray(archiveMayors)) throw new Error("配列ではありません");

  archiveMayorIds = checkDuplicateIds({ err, warn }, archiveMayors, "id", "archiveMayors.json");
  checkDuplicateSlugs({ err, warn }, archiveMayors, "slug", "archiveMayors.json");

  const currentMayors = archiveMayors.filter((m) => m.isCurrentMayor);
  if (currentMayors.length > 1) {
    err("archiveMayors.json", `isCurrentMayor:trueが複数登録されています: ${currentMayors.map((m) => m.id).join("、")}`);
  }

  const ARCHIVE_MAYOR_STATUSES = new Set(["current", "former", "deceased", "unknown"]);
  const mayorNameKeys = new Map(); // 氏名の重複登録（同一人物の別ID登録）検出用
  for (const m of archiveMayors) {
    const tag = `archiveMayors.json (${m.id ?? "id不明"})`;
    if (isBlank(m.name)) err(tag, "nameが空です");
    if (typeof m.isCurrentMayor !== "boolean") err(tag, "isCurrentMayorが真偽値ではありません");
    if (m.status !== undefined && !ARCHIVE_MAYOR_STATUSES.has(m.status)) err(tag, `statusの値が不正です: ${m.status}`);
    if (m.birthDate && !DATE_RE.test(m.birthDate)) err(tag, `birthDateの形式が不正です: ${m.birthDate}`);
    if (m.deathDate && !DATE_RE.test(m.deathDate)) err(tag, `deathDateの形式が不正です: ${m.deathDate}`);
    if (m.birthDate && m.deathDate && m.birthDate > m.deathDate) err(tag, `birthDate(${m.birthDate})がdeathDate(${m.deathDate})より後になっています`);
    if (m.alternateNames !== undefined && !Array.isArray(m.alternateNames)) err(tag, "alternateNamesが配列ではありません");
    if (m.lastVerifiedAt && !DATE_RE.test(m.lastVerifiedAt)) err(tag, `lastVerifiedAtの形式が不正です: ${m.lastVerifiedAt}`);
    checkSourceRefs({ err, warn }, m.sourceRefs, tag);
    requireAtLeastOneSourceRef({ err }, m.sourceRefs, tag);

    // 同一氏名（別表記含む）が別IDで重複登録されていないかを警告する（同一人物の重複登録防止）。
    for (const key of [m.name, ...(m.alternateNames ?? [])].filter((n) => !isBlank(n))) {
      if (mayorNameKeys.has(key) && mayorNameKeys.get(key) !== m.id) {
        warn(tag, `氏名「${key}」が別の市長ID（${mayorNameKeys.get(key)}）と重複しています。同一人物の重複登録でないか確認してください`);
      } else {
        mayorNameKeys.set(key, m.id);
      }
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveMayors.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

try {
  const archiveMayorTerms = readJson("src/data/archiveMayorTerms.json");
  if (!Array.isArray(archiveMayorTerms)) throw new Error("配列ではありません");

  archiveMayorTermIds = checkDuplicateIds({ err, warn }, archiveMayorTerms, "id", "archiveMayorTerms.json");

  const ARCHIVE_DATE_PRECISIONS = new Set(["day", "month", "year"]);
  const ARCHIVE_RETIREMENT_REASONS = new Set([
    "任期満了",
    "辞職",
    "失職",
    "市長選挙立候補",
    "死去",
    "選挙落選",
    "合併・制度変更",
    "職務代理終了",
    "不明",
  ]);
  const ARCHIVE_MAYOR_ROLES = new Set(["elected", "acting", "temporaryActing"]);

  for (const t of archiveMayorTerms) {
    const tag = `archiveMayorTerms.json (${t.id ?? "id不明"})`;
    checkReferenceExists({ err, warn }, t.mayorId, archiveMayorIds, tag, `存在しない市長IDを参照しています: ${t.mayorId}`);
    checkPeriodConsistency({ err }, t.termStart, t.termEnd, tag);
    if (t.termNumber !== undefined && typeof t.termNumber !== "number") err(tag, "termNumberが数値ではありません");
    checkNonNegative({ err }, t.populationAtStart ?? null, "populationAtStart", tag);
    if (t.termStartPrecision !== undefined && !ARCHIVE_DATE_PRECISIONS.has(t.termStartPrecision)) {
      err(tag, `termStartPrecisionの値が不正です: ${t.termStartPrecision}`);
    }
    if (t.termEndPrecision !== undefined && !ARCHIVE_DATE_PRECISIONS.has(t.termEndPrecision)) {
      err(tag, `termEndPrecisionの値が不正です: ${t.termEndPrecision}`);
    }
    if (t.retirementReason !== undefined && !ARCHIVE_RETIREMENT_REASONS.has(t.retirementReason)) {
      err(tag, `retirementReasonの値が不正です: ${t.retirementReason}`);
    }
    if (t.mayorRole !== undefined && !ARCHIVE_MAYOR_ROLES.has(t.mayorRole)) {
      err(tag, `mayorRoleの値が不正です: ${t.mayorRole}`);
    }
    // 前任・後任が自分自身（同一mayorId）を指していないかを確認する（単純な自己参照の防止）。
    if (t.previousMayorId && t.previousMayorId === t.mayorId) {
      err(tag, `previousMayorIdが自分自身（${t.mayorId}）を指しています`);
    }
    if (t.nextMayorId && t.nextMayorId === t.mayorId) {
      err(tag, `nextMayorIdが自分自身（${t.mayorId}）を指しています`);
    }
    checkReferenceExists(
      { err, warn },
      t.previousMayorId,
      archiveMayorIds,
      tag,
      `存在しない前任市長IDを参照しています: ${t.previousMayorId}`,
      { level: "warn" },
    );
    checkReferenceExists(
      { err, warn },
      t.nextMayorId,
      archiveMayorIds,
      tag,
      `存在しない後任市長IDを参照しています: ${t.nextMayorId}`,
      { level: "warn" },
    );
    checkSourceRefs({ err, warn }, t.sourceRefs, tag);
    requireAtLeastOneSourceRef({ err }, t.sourceRefs, tag);
  }
  checkNoOverlappingPeriods(
    { err },
    archiveMayorTerms,
    { groupField: "mayorId", startField: "termStart", endField: "termEnd" },
    "archiveMayorTerms.json",
  );

  // 現在市長を含む在任期間全体（最古の任期開始〜現在）に、どの市長の任期にも属さない
  // 空白期間がないかを警告する（1933年市制施行からの完全収録を目指す指標。エラーではなく
  // 警告とし、調査途上のデータでもvalidate:data自体は失敗させない）。
  // 退任日の翌日に次の任期が始まる場合（termEndを含む日まで在職）は空白ではないため、
  // 日付を1日進めてから比較する（単純な文字列比較では退任日と就任日が連続していても
  // 1日分の見せかけの空白として誤検出してしまうため）。
  if (archiveMayorTerms.length > 0 && archiveMayorTerms.every((t) => DATE_RE.test(t.termStart))) {
    const nextDay = (iso) => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    };
    const sortedByStart = [...archiveMayorTerms].sort((a, b) => String(a.termStart).localeCompare(String(b.termStart)));
    const todayIso = new Date().toISOString().slice(0, 10);
    let coveredUntil = sortedByStart[0].termStart;
    const gaps = [];
    for (const t of sortedByStart) {
      if (t.termStart > nextDay(coveredUntil)) gaps.push([coveredUntil, t.termStart]);
      const end = t.termEnd ?? todayIso;
      if (end > coveredUntil) coveredUntil = end;
    }
    if (coveredUntil < todayIso) gaps.push([coveredUntil, todayIso]);
    if (gaps.length > 0) {
      warn(
        "archiveMayorTerms.json",
        `任期が登録されていない空白期間があります（${gaps.length}件）: ${gaps.map(([from, to]) => `${from}〜${to}`).join("、")}`,
      );
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveMayorTerms.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

// --- archiveFiscalYears.json（延岡市政アーカイブ：財政） ---
let archiveFiscalYearSet = new Set();
try {
  const archiveFiscalYears = readJson("src/data/archiveFiscalYears.json");
  if (!Array.isArray(archiveFiscalYears)) throw new Error("配列ではありません");
  archiveFiscalYearSet = new Set(archiveFiscalYears.map((e) => e.fiscalYear));

  checkDuplicateYears({ err, warn }, archiveFiscalYears, "fiscalYear", "archiveFiscalYears.json");
  checkYearGaps({ err, warn }, archiveFiscalYears.map((e) => e.fiscalYear), "archiveFiscalYears.json");

  const BUDGET_YEN_FIELDS = [
    "generalAccountInitialBudgetYen",
    "generalAccountFinalBudgetYen",
    "generalAccountSettlementYen",
    "specialAccountBudgetYen",
    "enterpriseAccountBudgetYen",
    "totalRevenueYen",
    "totalExpenditureYen",
    "localTaxRevenueYen",
    "localAllocationTaxYen",
    "nationalSubsidiesYen",
    "prefecturalSubsidiesYen",
  ];
  const BOND_BALANCE_FIELDS = [
    "generalAccountBondBalanceYen",
    "ordinaryAccountLocalBondBalanceYen",
    "includingSpecialAccountsYen",
    "includingEnterpriseAccountsYen",
    "perCapitaYen",
  ];
  const FUND_BALANCE_FIELDS = [
    "totalYen",
    "fiscalAdjustmentFundYen",
    "bondRedemptionFundYen",
    "otherSpecificPurposeFundsYen",
    "perCapitaYen",
  ];
  const FINANCE_RATIO_FIELDS = [
    "debtServiceRatioPercent",
    "realDebtServiceRatioPercent",
    "futureBurdenRatioPercent",
    "currentAccountRatioPercent",
  ];

  for (const entry of archiveFiscalYears) {
    const tag = `archiveFiscalYears.json (${entry.fiscalYear ?? "年度不明"})`;
    checkYearRange({ err }, entry.fiscalYear, tag);
    checkReferenceExists(
      { err, warn },
      entry.mayorId,
      archiveMayorIds,
      tag,
      `存在しない市長IDを参照しています: ${entry.mayorId}`,
      { level: "warn" },
    );
    checkReferenceExists(
      { err, warn },
      entry.mayorTermId,
      archiveMayorTermIds,
      tag,
      `存在しない市長任期IDを参照しています: ${entry.mayorTermId}`,
      { level: "warn" },
    );
    if (entry.verifiedAt && !DATE_RE.test(entry.verifiedAt)) err(tag, `verifiedAtの形式が不正です: ${entry.verifiedAt}`);

    if (entry.population) {
      const p = entry.population;
      const pTag = `${tag} / population`;
      if (p.fiscalYear !== entry.fiscalYear) {
        err(pTag, `population.fiscalYear(${p.fiscalYear})が年度エントリのfiscalYear(${entry.fiscalYear})と一致しません`);
      }
      checkNonNegative({ err }, p.population, "population", pTag);
      checkNonNegative({ err }, p.households, "households", pTag);
      if (p.referenceDate && !DATE_RE.test(p.referenceDate)) err(pTag, `referenceDateの形式が不正です: ${p.referenceDate}`);
      checkSourceRefs({ err, warn }, p.sourceRefs, pTag);
      checkValuesHaveSource({ warn }, p, ["population", "households"], p.sourceRefs, pTag);
    }

    if (entry.budget) {
      const b = entry.budget;
      const bTag = `${tag} / budget`;
      if (b.fiscalYear !== entry.fiscalYear) {
        err(bTag, `budget.fiscalYear(${b.fiscalYear})が年度エントリのfiscalYear(${entry.fiscalYear})と一致しません`);
      }
      for (const f of BUDGET_YEN_FIELDS) checkNonNegative({ err }, b[f], f, bTag);
      checkSourceRefs({ err, warn }, b.sourceRefs, bTag);
      checkValuesHaveSource({ warn }, b, BUDGET_YEN_FIELDS, b.sourceRefs, bTag);
    }

    if (entry.debt) {
      const d = entry.debt;
      const dTag = `${tag} / debt`;
      if (d.fiscalYear !== entry.fiscalYear) {
        err(dTag, `debt.fiscalYear(${d.fiscalYear})が年度エントリのfiscalYear(${entry.fiscalYear})と一致しません`);
      }
      checkNonNegative({ err }, d.municipalBondIssuanceYen, "municipalBondIssuanceYen", dTag);
      if (d.municipalBondIssuanceYen !== null && d.municipalBondIssuanceYen !== undefined && isBlank(d.notes)) {
        warn(
          dTag,
          "municipalBondIssuanceYenが設定されていますが、出典を示すnotesがありません（ArchiveDebtには発行額専用のsourceRefsが無いため、notesでの出典明記を推奨）",
        );
      }
      if (d.balance) {
        const balTag = `${dTag} / balance`;
        for (const f of BOND_BALANCE_FIELDS) checkNonNegative({ err }, d.balance[f], f, balTag);
        checkAnyNonNullRequiresField(
          { err },
          d.balance,
          BOND_BALANCE_FIELDS,
          "definitionNote",
          balTag,
          "市債残高の区分に値があるのにdefinitionNote（元資料の定義注記）が空です",
        );
        checkSourceRefs({ err, warn }, d.balance.sourceRefs, balTag);
        checkValuesHaveSource({ warn }, d.balance, BOND_BALANCE_FIELDS, d.balance.sourceRefs, balTag);
      }
    }

    if (entry.fund) {
      const f = entry.fund;
      const fTag = `${tag} / fund`;
      if (f.fiscalYear !== entry.fiscalYear) {
        err(fTag, `fund.fiscalYear(${f.fiscalYear})が年度エントリのfiscalYear(${entry.fiscalYear})と一致しません`);
      }
      if (f.balance) {
        const balTag = `${fTag} / balance`;
        for (const ff of FUND_BALANCE_FIELDS) checkNonNegative({ err }, f.balance[ff], ff, balTag);
        checkSourceRefs({ err, warn }, f.balance.sourceRefs, balTag);
        checkValuesHaveSource({ warn }, f.balance, FUND_BALANCE_FIELDS, f.balance.sourceRefs, balTag);
      }
    }

    if (entry.finance) {
      const fi = entry.finance;
      const fiTag = `${tag} / finance`;
      if (fi.fiscalYear !== entry.fiscalYear) {
        err(fiTag, `finance.fiscalYear(${fi.fiscalYear})が年度エントリのfiscalYear(${entry.fiscalYear})と一致しません`);
      }
      for (const rf of FINANCE_RATIO_FIELDS) checkPercentRange({ err }, fi[rf], rf, fiTag);
      checkNonNegative({ err }, fi.financialStrengthIndex, "financialStrengthIndex", fiTag);
      checkSourceRefs({ err, warn }, fi.sourceRefs, fiTag);
      checkValuesHaveSource({ warn }, fi, [...FINANCE_RATIO_FIELDS, "financialStrengthIndex"], fi.sourceRefs, fiTag);
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveFiscalYears.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

// --- archiveMemberProfiles.json / archiveMemberTerms.json / archiveMemberAffiliations.json（延岡市政アーカイブ：過去議員） ---
let archiveMemberProfileIds = new Set();
try {
  const archiveMemberProfiles = readJson("src/data/archiveMemberProfiles.json");
  if (!Array.isArray(archiveMemberProfiles)) throw new Error("配列ではありません");

  archiveMemberProfileIds = checkDuplicateIds({ err, warn }, archiveMemberProfiles, "id", "archiveMemberProfiles.json");
  checkDuplicateSlugs({ err, warn }, archiveMemberProfiles, "slug", "archiveMemberProfiles.json");

  const seenLegacyMemberIds = new Set();
  const seenLegacyFormerMemberIds = new Set();
  for (const p of archiveMemberProfiles) {
    const tag = `archiveMemberProfiles.json (${p.id ?? "id不明"})`;
    if (isBlank(p.name)) err(tag, "nameが空です");
    if (typeof p.currentMember !== "boolean") err(tag, "currentMemberが真偽値ではありません");
    if (p.lastVerifiedAt && !DATE_RE.test(p.lastVerifiedAt)) err(tag, `lastVerifiedAtの形式が不正です: ${p.lastVerifiedAt}`);
    checkSourceRefs({ err, warn }, p.sourceRefs, tag);
    requireAtLeastOneSourceRef({ err }, p.sourceRefs, tag);

    if (p.legacyMemberId) {
      checkReferenceExists(
        { err, warn },
        p.legacyMemberId,
        memberIds,
        tag,
        `存在しない現職議員IDを参照しています: ${p.legacyMemberId}`,
      );
      if (seenLegacyMemberIds.has(p.legacyMemberId)) {
        err(tag, `legacyMemberIdが他のプロフィールと重複しています: ${p.legacyMemberId}`);
      } else seenLegacyMemberIds.add(p.legacyMemberId);
    }
    if (p.legacyFormerMemberId) {
      checkReferenceExists(
        { err, warn },
        p.legacyFormerMemberId,
        formerMemberIds,
        tag,
        `存在しない元議員IDを参照しています: ${p.legacyFormerMemberId}`,
      );
      if (seenLegacyFormerMemberIds.has(p.legacyFormerMemberId)) {
        err(tag, `legacyFormerMemberIdが他のプロフィールと重複しています: ${p.legacyFormerMemberId}`);
      } else seenLegacyFormerMemberIds.add(p.legacyFormerMemberId);
    }
    if (!p.legacyMemberId && !p.legacyFormerMemberId) {
      warn(tag, "legacyMemberId・legacyFormerMemberIdのいずれも設定されていません（既存データとの対応が不明です）");
    }
    if (p.legacyMemberId && p.legacyFormerMemberId) {
      err(tag, "legacyMemberIdとlegacyFormerMemberIdを同時に設定できません（現職・元職どちらか一方を参照してください）");
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveMemberProfiles.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

try {
  const archiveMemberTerms = readJson("src/data/archiveMemberTerms.json");
  if (!Array.isArray(archiveMemberTerms)) throw new Error("配列ではありません");

  checkDuplicateIds({ err, warn }, archiveMemberTerms, "id", "archiveMemberTerms.json");
  for (const t of archiveMemberTerms) {
    const tag = `archiveMemberTerms.json (${t.id ?? "id不明"})`;
    checkReferenceExists(
      { err, warn },
      t.memberProfileId,
      archiveMemberProfileIds,
      tag,
      `存在しない議員プロフィールIDを参照しています: ${t.memberProfileId}`,
    );
    checkPeriodConsistency({ err }, t.termStart, t.termEnd, tag);
    checkSourceRefs({ err, warn }, t.sourceRefs, tag);
    requireAtLeastOneSourceRef({ err }, t.sourceRefs, tag);
  }
  checkNoOverlappingPeriods(
    { err },
    archiveMemberTerms,
    { groupField: "memberProfileId", startField: "termStart", endField: "termEnd" },
    "archiveMemberTerms.json",
  );
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveMemberTerms.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

try {
  const archiveMemberAffiliations = readJson("src/data/archiveMemberAffiliations.json");
  if (!Array.isArray(archiveMemberAffiliations)) throw new Error("配列ではありません");

  const VALID_AFFILIATION_TYPES = new Set(["faction", "party", "committee", "councilRole"]);
  checkDuplicateIds({ err, warn }, archiveMemberAffiliations, "id", "archiveMemberAffiliations.json");
  for (const a of archiveMemberAffiliations) {
    const tag = `archiveMemberAffiliations.json (${a.id ?? "id不明"})`;
    checkReferenceExists(
      { err, warn },
      a.memberProfileId,
      archiveMemberProfileIds,
      tag,
      `存在しない議員プロフィールIDを参照しています: ${a.memberProfileId}`,
    );
    if (!VALID_AFFILIATION_TYPES.has(a.affiliationType)) err(tag, `未定義のaffiliationTypeです: ${a.affiliationType}`);
    if (isBlank(a.affiliationId)) err(tag, "affiliationIdが空です");
    checkPeriodConsistency({ err }, a.startDate, a.endDate, tag);
    if (a.sourceRef) checkSourceRefs({ err, warn }, [a.sourceRef], tag);
    else err(tag, "sourceRefが設定されていません");
  }
  const byGroup = new Map();
  for (const a of archiveMemberAffiliations) {
    const key = `${a.memberProfileId}::${a.affiliationType}::${a.affiliationId}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(a);
  }
  for (const records of byGroup.values()) {
    checkNoOverlappingPeriods(
      { err },
      records,
      { groupField: "memberProfileId", startField: "startDate", endField: "endDate" },
      "archiveMemberAffiliations.json",
    );
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveMemberAffiliations.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

// --- archivePolicyCategories.json / archivePolicies.json / archivePolicyQuestionRelations.json /
//     archivePolicyFiscalRelations.json（延岡市政アーカイブ：政策） ---
let archivePolicyCategoryIds = new Set();
try {
  const archivePolicyCategories = readJson("src/data/archivePolicyCategories.json");
  if (!Array.isArray(archivePolicyCategories)) throw new Error("配列ではありません");

  archivePolicyCategoryIds = checkDuplicateIds({ err, warn }, archivePolicyCategories, "id", "archivePolicyCategories.json");
  for (const c of archivePolicyCategories) {
    const tag = `archivePolicyCategories.json (${c.id ?? "id不明"})`;
    if (isBlank(c.label)) err(tag, "labelが空です");
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archivePolicyCategories.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

let archivePolicyIds = new Set();
try {
  const archivePolicies = readJson("src/data/archivePolicies.json");
  if (!Array.isArray(archivePolicies)) throw new Error("配列ではありません");

  archivePolicyIds = checkDuplicateIds({ err, warn }, archivePolicies, "id", "archivePolicies.json");
  checkDuplicateSlugs({ err, warn }, archivePolicies, "slug", "archivePolicies.json");

  // factions.jsonはvalidate-data.mjs全体で他ファイルからの参照整合性チェック対象になっていないため、
  // ここでは政策のownerId検証専用に読み込む（会派マスタそのものの検証は行わない）。
  let policyFactionIds = new Set();
  try {
    const factions = readJson("src/data/factions.json");
    policyFactionIds = new Set((factions ?? []).map((f) => f.id));
  } catch {
    // 読み込めない場合はfaction所有者のID参照チェックのみスキップする
  }

  const VALID_POLICY_OWNER_TYPES = new Set(["mayor", "member", "formerMember", "faction", "city"]);
  const VALID_POLICY_SOURCE_TYPES = new Set([
    "electionManifesto",
    "policyDocument",
    "councilQuestion",
    "mayorPolicySpeech",
    "budgetDocument",
    "settlementDocument",
    "comprehensivePlan",
    "ordinance",
    "bill",
    "officialStatement",
    "otherOfficialSource",
  ]);
  const VALID_POLICY_STATUSES = new Set([
    "proposed",
    "planned",
    "budgeted",
    "started",
    "ongoing",
    "completed",
    "changed",
    "suspended",
    "notVerified",
  ]);

  for (const p of archivePolicies) {
    const tag = `archivePolicies.json (${p.id ?? "id不明"})`;
    if (isBlank(p.title)) err(tag, "titleが空です");
    if (isBlank(p.summary)) err(tag, "summaryが空です");
    if (!VALID_POLICY_OWNER_TYPES.has(p.ownerType)) err(tag, `未定義のownerTypeです: ${p.ownerType}`);
    if (!VALID_POLICY_SOURCE_TYPES.has(p.sourceType)) err(tag, `未定義のsourceTypeです: ${p.sourceType}`);
    if (p.status !== undefined && !VALID_POLICY_STATUSES.has(p.status)) err(tag, `未定義のstatusです: ${p.status}`);
    if (p.lastVerifiedAt && !DATE_RE.test(p.lastVerifiedAt)) err(tag, `lastVerifiedAtの形式が不正です: ${p.lastVerifiedAt}`);
    if (p.announcedDate && !DATE_RE.test(p.announcedDate)) err(tag, `announcedDateの形式が不正です: ${p.announcedDate}`);

    checkSourceRefs({ err, warn }, p.sourceRefs, tag);
    requireAtLeastOneSourceRef({ err }, p.sourceRefs, tag);

    if (!Array.isArray(p.categoryIds) || p.categoryIds.length === 0) {
      warn(tag, "categoryIdsが未設定です（テーマ未分類）");
    }
    for (const cid of p.categoryIds ?? []) {
      checkReferenceExists({ err, warn }, cid, archivePolicyCategoryIds, tag, `存在しない政策テーマIDを参照しています: ${cid}`);
    }

    if (p.ownerType === "city") {
      if (p.ownerId) err(tag, "ownerType=cityの場合、ownerIdは設定しないでください（特定の主体に紐づかないため）");
    } else if (isBlank(p.ownerId)) {
      err(tag, "ownerIdが空です（ownerType=city以外はownerId必須）");
    } else if (p.ownerType === "mayor") {
      checkReferenceExists({ err, warn }, p.ownerId, archiveMayorIds, tag, `存在しない市長IDを参照しています: ${p.ownerId}`);
    } else if (p.ownerType === "member") {
      checkReferenceExists({ err, warn }, p.ownerId, memberIds, tag, `存在しない現職議員IDを参照しています: ${p.ownerId}`);
    } else if (p.ownerType === "formerMember") {
      checkReferenceExists({ err, warn }, p.ownerId, formerMemberIds, tag, `存在しない元議員IDを参照しています: ${p.ownerId}`);
    } else if (p.ownerType === "faction" && policyFactionIds.size > 0) {
      checkReferenceExists({ err, warn }, p.ownerId, policyFactionIds, tag, `存在しない会派IDを参照しています: ${p.ownerId}`);
    }

    for (const bid of p.relatedBillVoteIds ?? []) {
      checkReferenceExists({ err, warn }, bid, billIds, tag, `存在しない議案IDを参照しています: ${bid}`);
    }
    for (const qid of p.relatedQuestionIds ?? []) {
      checkReferenceExists({ err, warn }, qid, questionIds, tag, `存在しない一般質問IDを参照しています: ${qid}`);
    }
    if (archiveFiscalYearSet.size > 0) {
      for (const fy of p.relatedFiscalYears ?? []) {
        if (!archiveFiscalYearSet.has(fy)) {
          warn(tag, `relatedFiscalYearsの年度(${fy})がarchiveFiscalYears.jsonに存在しません（/timeline/${fy}に反映されません）`);
        }
      }
    }

    // 完了・変更・停止のような「確定的な状況」を示すstatusは、独自判定ではなく公式資料の裏付けを
    // 必須とする（達成・未達成の推測登録を防ぐ）。verified出典またはstatusEvidenceUrlのどちらも
    // 無い場合は警告する。
    const CONFIRMED_POLICY_STATUSES = new Set(["completed", "changed", "suspended"]);
    if (CONFIRMED_POLICY_STATUSES.has(p.status)) {
      const hasVerifiedSource = (p.sourceRefs ?? []).some((r) => r.verificationStatus === "verified");
      if (!hasVerifiedSource && isBlank(p.statusEvidenceUrl)) {
        warn(
          tag,
          `status="${p.status}"（確定的な状況）ですが、確認済み(verified)の出典・statusEvidenceUrlのいずれもありません`,
        );
      }
    }

    // AI生成コンテンツ（aiAnalysis）は公式データ（summary/sourceOriginalText）と型レベルで
    // 分離されている前提を検証する。原文へのリンクが無いままAI要約だけが独り歩きしないようにする。
    if (p.aiAnalysis) {
      const aiTag = `${tag} (aiAnalysis)`;
      const checkAiContent = (content, fieldLabel) => {
        if (!content) return;
        if (isBlank(content.text)) err(aiTag, `${fieldLabel}.textが空です`);
        if (!content.generatedAt || !/^\d{4}-\d{2}-\d{2}/.test(content.generatedAt)) {
          err(aiTag, `${fieldLabel}.generatedAtの形式が不正です: ${content.generatedAt}`);
        }
        if (typeof content.humanReviewed !== "boolean") err(aiTag, `${fieldLabel}.humanReviewedが真偽値ではありません`);
      };
      checkAiContent(p.aiAnalysis.aiSummary, "aiSummary");
      checkAiContent(p.aiAnalysis.aiCategoryLabels, "aiCategoryLabels");
      if (p.aiAnalysis.aiSummary && isBlank(p.sourceOriginalText)) {
        warn(aiTag, "aiSummaryが設定されていますが、公式原文（sourceOriginalText）が未設定です（AI要約と原文を分離して確認できません）");
      }
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archivePolicies.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

try {
  const archivePolicyQuestionRelations = readJson("src/data/archivePolicyQuestionRelations.json");
  if (!Array.isArray(archivePolicyQuestionRelations)) throw new Error("配列ではありません");

  const VALID_QUESTION_RELATION_TYPES = new Set([
    "proposedInQuestion",
    "discussedInQuestion",
    "requestedInQuestion",
    "answeredByCity",
    "relatedTheme",
    "needsReview",
  ]);
  checkDuplicateIds({ err, warn }, archivePolicyQuestionRelations, "id", "archivePolicyQuestionRelations.json");
  for (const r of archivePolicyQuestionRelations) {
    const tag = `archivePolicyQuestionRelations.json (${r.id ?? "id不明"})`;
    checkReferenceExists({ err, warn }, r.policyId, archivePolicyIds, tag, `存在しない政策IDを参照しています: ${r.policyId}`);
    checkReferenceExists({ err, warn }, r.questionId, questionIds, tag, `存在しない一般質問IDを参照しています: ${r.questionId}`);
    if (!VALID_QUESTION_RELATION_TYPES.has(r.relationType)) err(tag, `未定義のrelationTypeです: ${r.relationType}`);
    if (!r.verificationStatus || !ARCHIVE_VERIFICATION_STATUSES.has(r.verificationStatus)) {
      err(tag, `未定義または未設定のverificationStatusです: ${r.verificationStatus}`);
    }
    if (r.sourceRef) checkSourceRefs({ err, warn }, [r.sourceRef], tag);
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archivePolicyQuestionRelations.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

try {
  const archivePolicyFiscalRelations = readJson("src/data/archivePolicyFiscalRelations.json");
  if (!Array.isArray(archivePolicyFiscalRelations)) throw new Error("配列ではありません");

  const VALID_FISCAL_RELATION_TYPES = new Set(["proposed", "budgeted", "includedInProject", "settled", "related", "needsReview"]);
  checkDuplicateIds({ err, warn }, archivePolicyFiscalRelations, "id", "archivePolicyFiscalRelations.json");
  for (const r of archivePolicyFiscalRelations) {
    const tag = `archivePolicyFiscalRelations.json (${r.id ?? "id不明"})`;
    checkReferenceExists({ err, warn }, r.policyId, archivePolicyIds, tag, `存在しない政策IDを参照しています: ${r.policyId}`);
    checkYearRange({ err }, r.fiscalYear, tag);
    if (!VALID_FISCAL_RELATION_TYPES.has(r.relationType)) err(tag, `未定義のrelationTypeです: ${r.relationType}`);
    if (!r.verificationStatus || !ARCHIVE_VERIFICATION_STATUSES.has(r.verificationStatus)) {
      err(tag, `未定義または未設定のverificationStatusです: ${r.verificationStatus}`);
    }
    checkNonNegative({ err }, r.amountYen ?? null, "amountYen", tag);
    if (r.sourceRef) checkSourceRefs({ err, warn }, [r.sourceRef], tag);
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archivePolicyFiscalRelations.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

// --- archiveCouncilDocuments.json / archiveCouncilRelations.json（延岡市政アーカイブ：議案・条例・請願・陳情） ---
let archiveCouncilDocumentIds = new Set();
try {
  const archiveCouncilDocuments = readJson("src/data/archiveCouncilDocuments.json");
  if (!Array.isArray(archiveCouncilDocuments)) throw new Error("配列ではありません");

  archiveCouncilDocumentIds = checkDuplicateIds({ err, warn }, archiveCouncilDocuments, "id", "archiveCouncilDocuments.json");
  checkDuplicateSlugs({ err, warn }, archiveCouncilDocuments, "slug", "archiveCouncilDocuments.json");

  const sessionIdSet = new Set(councilSessions.map((s) => s.id));
  const VALID_DOCUMENT_TYPES = new Set(["bill", "ordinance", "petition", "request"]);
  const VALID_DOCUMENT_STATUSES = new Set([
    "submitted",
    "accepted",
    "referred",
    "continuedReview",
    "decided",
    "withdrawn",
    "unresolved",
  ]);
  // 議案・条例は既存BillVoteResult（原案可決等）、請願・陳情はArchivePetitionOutcome（英語キー）を使う。
  const BILL_ORDINANCE_RESULTS = new Set([
    "原案可決",
    "修正可決",
    "否決",
    "承認",
    "不承認",
    "認定",
    "不認定",
    "同意",
    "不同意",
    "採択",
    "一部採択",
    "趣旨採択",
    "不採択",
    "継続審査",
    "撤回",
    "廃案",
    "その他",
    "確認中",
  ]);
  const PETITION_REQUEST_RESULTS = new Set([
    "submitted",
    "accepted",
    "referred",
    "continuedReview",
    "adopted",
    "partiallyAdopted",
    "rejected",
    "withdrawn",
    "unresolved",
    "sourceUnavailable",
  ]);
  const VALID_REVISION_TYPES = new Set(["enactment", "fullRevision", "partialRevision", "repeal"]);
  const VALID_EFFECT_STATUSES = new Set(["inForce", "expired", "unknown"]);
  // 私人の氏名等が紛れ込んでいないかを検出するための許可リスト（自由記述を禁止する）。
  const ALLOWED_PETITIONER_CATEGORIES = new Set(["地域団体", "市民個人", "事業者団体", "その他"]);

  for (const d of archiveCouncilDocuments) {
    const tag = `archiveCouncilDocuments.json (${d.id ?? "id不明"})`;
    if (isBlank(d.title)) err(tag, "titleが空です");
    if (isBlank(d.summary)) err(tag, "summaryが空です");
    if (!VALID_DOCUMENT_TYPES.has(d.documentType)) err(tag, `未定義のdocumentTypeです: ${d.documentType}`);
    if (d.status !== undefined && !VALID_DOCUMENT_STATUSES.has(d.status)) err(tag, `未定義のstatusです: ${d.status}`);

    // nullと0の区別：fiscalYearは必須の数値（西暦）であり、null/未確認を許容しないフィールドのため
    // 通常のcheckYearRangeで整数・範囲のみを検証する（0や架空値で埋めていないかは別途、出典必須チェックで担保）。
    checkYearRange({ err }, d.fiscalYear, tag, { min: 1947, max: 2100 });
    if (archiveFiscalYearSet.size > 0 && d.fiscalYear != null && !archiveFiscalYearSet.has(d.fiscalYear)) {
      warn(tag, `fiscalYear(${d.fiscalYear})がarchiveFiscalYears.jsonに存在しません（/timeline/${d.fiscalYear}の財政データ欄には反映されません）`);
    }

    // decisionDate/submittedDate/meetingDateは/timeline・/timeline/:yearの年表イベントの日付・
    // 並び順に直接使われるため（フェーズ9D）、形式不正が並び順の乱れにつながらないよう検証する。
    if (d.decisionDate && !DATE_RE.test(d.decisionDate)) err(tag, `decisionDateの形式が不正です: ${d.decisionDate}`);
    if (d.submittedDate && !DATE_RE.test(d.submittedDate)) err(tag, `submittedDateの形式が不正です: ${d.submittedDate}`);
    if (d.meetingDate && !DATE_RE.test(d.meetingDate)) err(tag, `meetingDateの形式が不正です: ${d.meetingDate}`);

    if (d.sessionId) {
      checkReferenceExists({ err, warn }, d.sessionId, sessionIdSet, tag, `存在しない会期IDを参照しています: ${d.sessionId}`);
    }
    for (const pid of d.proposerIds ?? []) {
      checkReferenceExists({ err, warn }, pid, memberIds, tag, `存在しない議員IDを参照しています（proposerIds）: ${pid}`);
    }
    for (const mid of d.relatedMemberIds ?? []) {
      checkReferenceExists({ err, warn }, mid, memberIds, tag, `存在しない議員IDを参照しています（relatedMemberIds）: ${mid}`);
    }
    for (const mayorId of d.relatedMayorIds ?? []) {
      checkReferenceExists({ err, warn }, mayorId, archiveMayorIds, tag, `存在しない市長IDを参照しています（relatedMayorIds）: ${mayorId}`);
    }
    for (const pid of d.relatedPolicyIds ?? []) {
      checkReferenceExists({ err, warn }, pid, archivePolicyIds, tag, `存在しない政策IDを参照しています（relatedPolicyIds）: ${pid}`);
    }
    for (const qid of d.relatedQuestionIds ?? []) {
      checkReferenceExists({ err, warn }, qid, questionIds, tag, `存在しない一般質問IDを参照しています（relatedQuestionIds）: ${qid}`);
    }
    // relatedBudgetIds: 予算項目単位のID体系が未整備のため、参照整合性チェックは対象外
    // （空文字のみチェックする）。将来、予算項目マスタが整備された時点で参照チェックを追加する。
    for (const bid of d.relatedBudgetIds ?? []) {
      if (isBlank(bid)) err(tag, "relatedBudgetIdsに空文字が含まれています");
    }
    if (d.existingBillVoteId) {
      checkReferenceExists({ err, warn }, d.existingBillVoteId, billIds, tag, `存在しない既存議案IDを参照しています（existingBillVoteId）: ${d.existingBillVoteId}`);
    }

    checkSourceRefs({ err, warn }, d.sourceRefs, tag);
    requireAtLeastOneSourceRef({ err }, d.sourceRefs, tag);
    if (!d.verificationStatus || !ARCHIVE_VERIFICATION_STATUSES.has(d.verificationStatus)) {
      err(tag, `未定義または未設定のverificationStatusです: ${d.verificationStatus}`);
    }

    // 議案と条例の関連整合性：documentTypeに対応するdetailブロックのみを許可する。
    if (d.billDetail && d.documentType !== "bill") err(tag, "documentType!=\"bill\"なのにbillDetailが設定されています");
    if (d.ordinanceDetail && d.documentType !== "ordinance") {
      err(tag, "documentType!=\"ordinance\"なのにordinanceDetailが設定されています");
    }
    if (d.petitionDetail && d.documentType !== "petition") {
      err(tag, "documentType!=\"petition\"なのにpetitionDetailが設定されています");
    }
    if (d.requestDetail && d.documentType !== "request") {
      err(tag, "documentType!=\"request\"なのにrequestDetailが設定されています");
    }
    if (d.documentType === "ordinance" && !d.ordinanceDetail) warn(tag, "documentType=\"ordinance\"ですがordinanceDetailが未設定です");

    if (d.ordinanceDetail) {
      if (!VALID_REVISION_TYPES.has(d.ordinanceDetail.revisionType)) {
        err(tag, `未定義のordinanceDetail.revisionTypeです: ${d.ordinanceDetail.revisionType}`);
      }
      if (!VALID_EFFECT_STATUSES.has(d.ordinanceDetail.effectStatus)) {
        err(tag, `未定義のordinanceDetail.effectStatusです: ${d.ordinanceDetail.effectStatus}`);
      }
      for (const relId of d.ordinanceDetail.relatedOrdinanceDocumentIds ?? []) {
        checkReferenceExists(
          { err, warn },
          relId,
          archiveCouncilDocumentIds,
          tag,
          `存在しない関連条例IDを参照しています: ${relId}`,
        );
      }
    }

    // 請願・陳情の審査結果整合性：billVoteResult系の値を請願・陳情に、あるいはその逆を使っていないか。
    if (d.result) {
      if ((d.documentType === "bill" || d.documentType === "ordinance") && !BILL_ORDINANCE_RESULTS.has(d.result)) {
        err(tag, `documentType="${d.documentType}"のresultが議決結果の値ではありません: ${d.result}`);
      }
      if ((d.documentType === "petition" || d.documentType === "request") && !PETITION_REQUEST_RESULTS.has(d.result)) {
        err(tag, `documentType="${d.documentType}"のresultが請願・陳情の審査結果の値ではありません: ${d.result}`);
      }
    }

    // 私人情報の不要な保存がないこと：petitionerCategoryは許可リスト外の自由記述（氏名等の疑い）を禁止する。
    const petitionerCategory = d.petitionDetail?.petitionerCategory ?? d.requestDetail?.petitionerCategory;
    if (petitionerCategory && !ALLOWED_PETITIONER_CATEGORIES.has(petitionerCategory)) {
      err(
        tag,
        `petitionerCategoryが許可リスト外の値です（氏名等の個人情報が混入していないか確認してください）: ${petitionerCategory}`,
      );
    }

    for (const v of d.voteEntries ?? []) {
      checkReferenceExists({ err, warn }, v.memberId, memberIds, tag, `存在しない議員IDを参照しています（voteEntries）: ${v.memberId}`);
    }
    if (d.existingBillVoteId && (d.voteEntries?.length ?? 0) > 0) {
      warn(tag, "existingBillVoteIdとvoteEntriesの両方が設定されています（議員別賛否が重複登録されている可能性があります）");
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveCouncilDocuments.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

try {
  const archiveCouncilRelations = readJson("src/data/archiveCouncilRelations.json");
  if (!Array.isArray(archiveCouncilRelations)) throw new Error("配列ではありません");

  const VALID_RELATION_TYPES = new Set(["member", "mayor", "policy", "question", "budget", "document"]);
  checkDuplicateIds({ err, warn }, archiveCouncilRelations, "id", "archiveCouncilRelations.json");
  for (const r of archiveCouncilRelations) {
    const tag = `archiveCouncilRelations.json (${r.id ?? "id不明"})`;
    checkReferenceExists(
      { err, warn },
      r.documentId,
      archiveCouncilDocumentIds,
      tag,
      `存在しない文書IDを参照しています: ${r.documentId}`,
    );
    if (!VALID_RELATION_TYPES.has(r.relationType)) err(tag, `未定義のrelationTypeです: ${r.relationType}`);
    if (!r.verificationStatus || !ARCHIVE_VERIFICATION_STATUSES.has(r.verificationStatus)) {
      err(tag, `未定義または未設定のverificationStatusです: ${r.verificationStatus}`);
    }
    if (r.sourceRef) checkSourceRefs({ err, warn }, [r.sourceRef], tag);
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveCouncilRelations.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

// --- archiveAiCategoryCandidates.json / archiveRelationCandidates.json / archiveAiSummaries.json
//     （延岡市政アーカイブ：フェーズ8 横断検索・テーマ分類の候補データ。外部AI APIは未使用） ---
// sourceEntityType/targetEntityTypeのうち、現時点で参照整合性チェック可能な種別のみ対応する
// （他の20種別は今回データが存在しないため、存在しない種別も含めエラーにはしない）。
const CANDIDATE_ENTITY_ID_SETS = {
  policy: archivePolicyIds,
  bill: archiveCouncilDocumentIds,
  ordinance: archiveCouncilDocumentIds,
  petition: archiveCouncilDocumentIds,
  request: archiveCouncilDocumentIds,
};
function checkCandidateEntityRef({ err, warn }, entityType, entityId, tag, label) {
  const idSet = CANDIDATE_ENTITY_ID_SETS[entityType];
  if (!idSet) return; // 未対応の種別（今回データなし）は参照整合性チェックをスキップする
  checkReferenceExists({ err, warn }, entityId, idSet, tag, `存在しない${label}を参照しています: ${entityType}:${entityId}`);
}

try {
  const archiveAiCategoryCandidates = readJson("src/data/archiveAiCategoryCandidates.json");
  if (!Array.isArray(archiveAiCategoryCandidates)) throw new Error("配列ではありません");

  checkDuplicateIds({ err, warn }, archiveAiCategoryCandidates, "id", "archiveAiCategoryCandidates.json");
  const VALID_CANDIDATE_STATUSES = new Set(["candidate", "confirmed", "rejected", "needsReview"]);

  for (const c of archiveAiCategoryCandidates) {
    const tag = `archiveAiCategoryCandidates.json (${c.id ?? "id不明"})`;
    checkCandidateEntityRef({ err, warn }, c.sourceEntityType, c.sourceEntityId, tag, "sourceEntityId");
    checkReferenceExists(
      { err, warn },
      c.categoryId,
      archivePolicyCategoryIds,
      tag,
      `存在しないテーマIDを参照しています: ${c.categoryId}`,
    );
    if (typeof c.confidence !== "number" || c.confidence < 0 || c.confidence > 1) {
      err(tag, `confidenceが0〜1の範囲外、または数値ではありません: ${c.confidence}`);
    }
    if (!VALID_CANDIDATE_STATUSES.has(c.status)) err(tag, `未定義のstatusです: ${c.status}`);
    if (!c.generatedAt) err(tag, "generatedAtが未設定です");
    // AI分類候補と確定分類の分離：このファイルはあくまで候補置き場であり、
    // 確定分類（archivePolicies.json等のcategoryIds）とは別ファイルであること自体が分離を担保する。
    // ここでは「confirmed」のまま放置されていないか（人による確認記録が無いのにconfirmedになっていないか）を検出する。
    if (c.status === "confirmed" && !c.reviewedBy && !c.reviewedAt) {
      warn(tag, "status=confirmedですが、reviewedBy/reviewedAtが記録されていません（未確認候補が確定データへ混入していないか確認してください）");
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveAiCategoryCandidates.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

try {
  const archiveRelationCandidates = readJson("src/data/archiveRelationCandidates.json");
  if (!Array.isArray(archiveRelationCandidates)) throw new Error("配列ではありません");

  const VALID_RELATION_CANDIDATE_TYPES = new Set([
    "sameTheme",
    "relatedQuestion",
    "relatedAnswer",
    "relatedPolicy",
    "relatedBill",
    "relatedOrdinance",
    "relatedBudget",
    "relatedPerson",
    "sameFiscalYear",
    "possibleDuplicate",
    "needsReview",
  ]);
  const VALID_RELATION_METHODS = new Set(["explicitReference", "ruleBased", "keywordMatch", "manual", "aiCandidate"]);
  const VALID_CANDIDATE_STATUSES_2 = new Set(["candidate", "confirmed", "rejected", "needsReview"]);

  checkDuplicateIds({ err, warn }, archiveRelationCandidates, "id", "archiveRelationCandidates.json");
  for (const r of archiveRelationCandidates) {
    const tag = `archiveRelationCandidates.json (${r.id ?? "id不明"})`;
    checkCandidateEntityRef({ err, warn }, r.sourceEntityType, r.sourceEntityId, tag, "sourceEntityId");
    checkCandidateEntityRef({ err, warn }, r.targetEntityType, r.targetEntityId, tag, "targetEntityId");
    if (!VALID_RELATION_CANDIDATE_TYPES.has(r.relationType)) err(tag, `未定義のrelationTypeです: ${r.relationType}`);
    if (!VALID_RELATION_METHODS.has(r.method)) err(tag, `未定義のmethodです: ${r.method}`);
    if (typeof r.confidence !== "number" || r.confidence < 0 || r.confidence > 1) {
      err(tag, `confidenceが0〜1の範囲外、または数値ではありません: ${r.confidence}`);
    }
    if (!VALID_CANDIDATE_STATUSES_2.has(r.status)) err(tag, `未定義のstatusです: ${r.status}`);
    if (!r.createdAt) err(tag, "createdAtが未設定です");
    if (r.status === "confirmed" && !r.reviewedBy && !r.reviewedAt) {
      warn(tag, "status=confirmedですが、reviewedBy/reviewedAtが記録されていません（未確認候補が確定データへ混入していないか確認してください）");
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveRelationCandidates.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

try {
  const archiveAiSummaries = readJson("src/data/archiveAiSummaries.json");
  if (!Array.isArray(archiveAiSummaries)) throw new Error("配列ではありません");

  const VALID_CANDIDATE_STATUSES_3 = new Set(["candidate", "confirmed", "rejected", "needsReview"]);
  checkDuplicateIds({ err, warn }, archiveAiSummaries, "id", "archiveAiSummaries.json");
  for (const s of archiveAiSummaries) {
    const tag = `archiveAiSummaries.json (${s.id ?? "id不明"})`;
    checkCandidateEntityRef({ err, warn }, s.sourceEntityType, s.sourceEntityId, tag, "sourceEntityId");
    if (isBlank(s.summary)) err(tag, "summaryが空です");
    if (isBlank(s.model)) err(tag, "modelが空です");
    // AI要約と公式本文の分離：summaryはAI生成テキストであり、公式データ（archivePolicies.json等の
    // summary/body）とは別ファイル・別フィールドで管理されていること自体が分離の担保。
    // ここでは再確認判定に必要なsourceTextHashの存在のみ確認する。
    if (isBlank(s.sourceTextHash)) err(tag, "sourceTextHashが未設定です（原文変更時の再確認判定ができません）");
    if (!VALID_CANDIDATE_STATUSES_3.has(s.verificationStatus)) err(tag, `未定義のverificationStatusです: ${s.verificationStatus}`);
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveAiSummaries.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

// --- searchIndex.json（サイト内横断検索インデックス） ---
const VALID_SEARCH_TYPES = new Set([
  "member",
  "former-member",
  "mayor",
  "promise",
  "bill",
  "question",
  "speech",
  "compensation",
  "finance",
  "update",
  "guide",
  "press-conference",
  "policy",
  "council-document",
  "political-fund",
  "committee",
  "page",
]);
// 実在するルートの先頭一致のみを許可する（管理用・非公開データの混入を防ぐ）。
const VALID_URL_PREFIXES = [
  "/",
  "/members/",
  "/mayor",
  "/mayors",
  "/policies",
  "/finance",
  "/dashboard",
  "/compensation",
  "/city-guide",
  "/bills",
  "/ordinances",
  "/petitions",
  "/requests",
  "/council-documents",
  "/questions",
  "/search",
  "/about",
  "/editorial-policy",
  "/terms",
  "/contact",
  "/updates",
  "/political-funds",
  "/committees",
];

try {
  const searchIndex = readJson("src/data/searchIndex.json");
  const searchIds = new Set();
  const seenPairs = new Set();

  for (const s of searchIndex) {
    const tag = `searchIndex.json (${s.id ?? s.title ?? "id不明"})`;

    if (isBlank(s.id)) err(tag, "idが空です");
    else if (searchIds.has(s.id)) err(tag, `検索インデックスIDが重複しています: ${s.id}`);
    else searchIds.add(s.id);

    if (isBlank(s.title)) err(tag, "titleが空です");
    if (isBlank(s.url)) err(tag, "urlが空です");
    else if (!VALID_URL_PREFIXES.some((p) => s.url === p || s.url.startsWith(p))) {
      err(tag, `既知のルートに含まれない、または非公開の可能性があるURLです: ${s.url}`);
    }
    if (!VALID_SEARCH_TYPES.has(s.type)) err(tag, `未定義のtypeです: ${s.type}`);
    if (!Array.isArray(s.keywords) || s.keywords.length === 0) {
      warn(tag, "keywordsが空です");
    }
    if (s.date && !DATE_RE.test(s.date)) err(tag, `dateの形式が不正です: ${s.date}`);

    const pairKey = `${s.type}:${s.url}:${s.title}`;
    if (seenPairs.has(pairKey)) warn(tag, `同一内容（type/url/title）のエントリが重複登録されています`);
    seenPairs.add(pairKey);

    if (s.sourceId) {
      if (s.type === "member" && !memberIds.has(s.sourceId)) {
        warn(tag, `存在しない議員IDを参照しています: ${s.sourceId}`);
      }
      if (s.type === "bill") {
        if (!billIds.has(s.sourceId)) {
          warn(tag, `存在しない議案IDを参照しています: ${s.sourceId}`);
        } else {
          const referencedBill = billVotesById.get(s.sourceId);
          const status = referencedBill?.publicationStatus;
          // rejected・errorのみ一般公開の対象外（pendingReview等は「確認待ち」表示を伴い検索対象に含めてよい）。
          if (status === "rejected" || status === "error") {
            err(tag, `一般公開対象外（publicationStatus: ${status}）の議案が検索インデックスに含まれています: ${s.sourceId}`);
          }
        }
      }
      if (s.type === "promise" && !mayorPromiseIds.has(s.sourceId)) {
        warn(tag, `存在しない市長公約IDを参照しています: ${s.sourceId}`);
      }
      if (s.type === "question" && !questionIds.has(s.sourceId)) {
        warn(tag, `存在しない一般質問IDを参照しています: ${s.sourceId}`);
      }
      if (s.type === "policy" && archivePolicyIds.size > 0 && !archivePolicyIds.has(s.sourceId)) {
        warn(tag, `存在しない政策IDを参照しています: ${s.sourceId}`);
      }
      if (s.type === "council-document" && archiveCouncilDocumentIds.size > 0 && !archiveCouncilDocumentIds.has(s.sourceId)) {
        warn(tag, `存在しない議案・条例・請願・陳情IDを参照しています: ${s.sourceId}`);
      }
    }
  }
} catch {
  warn("searchIndex.json", "読み込めませんでした（存在しない場合はスキップ）");
}

// --- councilSpeechSummaries.json ---
const VALID_SPEECH_SUMMARY_STATUSES = new Set([
  "verified",
  "partially-verified",
  "pending",
  "source-unavailable",
  "minutes-not-fetched",
  "speaker-identification-pending",
  "question-answer-link-pending",
]);
const VALID_SPEECH_RELATION_STATUSES = new Set(["confirmed", "suggested", "rejected"]);
const RECOMMENDED_QUESTION_APPROACHES = new Set([
  "現状確認",
  "制度内容の確認",
  "予算・数値の確認",
  "実施時期の確認",
  "今後の方針の確認",
  "改善提案",
  "事業導入の提案",
  "対応の要望",
  "課題の指摘",
  "再質問による追加確認",
]);
const RECOMMENDED_ANSWER_STATUSES = new Set([
  "実施済み",
  "実施中",
  "実施予定",
  "検討中",
  "調査・研究",
  "関係機関と協議",
  "継続対応",
  "現時点では予定なし",
  "制度上対応困難",
  "回答のみで方針不明",
  "質問との対応確認中",
]);
const VALID_QA_LINK_STATUSES = new Set(["confirmed", "partially-confirmed", "pending", "ambiguous"]);
const NOT_YET_PUBLISHABLE_STATUSES = new Set(["minutes-not-fetched", "source-unavailable"]);
const sessionIdSet = new Set(councilSessions.map((s) => s.id));
const speechIds = new Set();
const publishedSpeechIds = new Set();
// src/lib/questionLikeSpeechTypes.tsと同じ値。このスクリプトはVite専用のTS importを使えないため複製する。
const QUESTION_LIKE_SPEECH_TYPES_FOR_VALIDATION = new Set(["一般質問", "代表質問", "関連質問", "総括質疑", "総括質疑・一般質問"]);

try {
  const speechData = readJson("src/data/councilSpeechSummaries.json");
  if (typeof speechData.version !== "number") err("councilSpeechSummaries.json", "versionが数値ではありません");
  if (speechData.generatedAt !== null && !DATE_RE.test(speechData.generatedAt ?? "")) {
    err("councilSpeechSummaries.json", `generatedAtの形式が不正です: ${speechData.generatedAt}`);
  }
  if (!Array.isArray(speechData.members)) {
    err("councilSpeechSummaries.json", "membersが配列ではありません");
  } else {
    const seenMemberIds = new Set();

    for (const record of speechData.members) {
      const tag = `councilSpeechSummaries.json (${record.memberId ?? "議員id不明"})`;
      if (isBlank(record.memberId)) err(tag, "memberIdが空です");
      else if (!memberIds.has(record.memberId) && !formerMemberIds.has(record.memberId)) {
        err(tag, `現職・元議員のいずれのIDにも一致しません: ${record.memberId}`);
      }
      if (record.isFormerMember && !formerMemberIds.has(record.memberId)) {
        err(tag, `isFormerMember:trueですがformerMembers.jsonに存在しないIDです: ${record.memberId}`);
      }
      if (seenMemberIds.has(record.memberId)) err(tag, `同じ議員のレコードが重複しています: ${record.memberId}`);
      else seenMemberIds.add(record.memberId);

      if (record.lastAnalyzedAt !== null && !DATE_RE.test(record.lastAnalyzedAt ?? "")) {
        err(tag, `lastAnalyzedAtの形式が不正です: ${record.lastAnalyzedAt}`);
      }

      for (const speech of record.speeches ?? []) {
        const speechTag = `councilSpeechSummaries.json (${record.memberId} / ${speech.id ?? "発言id不明"})`;
        if (isBlank(speech.id)) err(speechTag, "発言のidが空です");
        else if (speechIds.has(speech.id)) err(speechTag, `発言IDが重複しています: ${speech.id}`);
        else speechIds.add(speech.id);
        if (speech.id && speech.isPublished) publishedSpeechIds.add(speech.id);

        if (speech.memberId !== record.memberId) {
          err(speechTag, `発言のmemberIdがレコードのmemberIdと一致しません: ${speech.memberId}`);
        }
        if (isBlank(speech.sessionId) || !sessionIdSet.has(speech.sessionId)) {
          err(speechTag, `存在しない会期IDです: ${speech.sessionId}`);
        }
        if (formerMemberIds.has(record.memberId)) {
          const served = formerMemberServedSessions.get(record.memberId);
          if (!served || served.size === 0) {
            warn(speechTag, `元議員のservedSessionsが未設定のため、会期時点の在職を確認できません（needsReview）`);
          } else if (speech.sessionId && !served.has(speech.sessionId)) {
            err(
              speechTag,
              `元議員の在職確認済み会期（servedSessions: ${[...served].join("、")}）に含まれない会期の発言です: ${speech.sessionId}（推測で在職期間を広げないでください）`,
            );
          }
        }
        if (speech.date !== null && speech.date !== undefined && !DATE_RE.test(speech.date)) {
          err(speechTag, `dateの形式が不正です: ${speech.date}`);
        }
        if (speech.generatedAt !== null && speech.generatedAt !== undefined && !DATE_RE.test(speech.generatedAt)) {
          err(speechTag, `generatedAtの形式が不正です: ${speech.generatedAt}`);
        }
        // councilSpeechPeriod.fromは「現議員任期の対象範囲」を表す。旧任期のみに在職した元議員
        // （formerMembers.jsonのIDで、servedSessionsが別途検証済み）の発言、および継続して現職を
        // 務める議員の旧任期発言（speech.term:"previous"、TASK-005系）は、この現任期カットオフの
        // 対象外とする。それ以外の現職議員IDの発言は引き続きこのカットオフで検証する
        // （現任期の集計・議会活動データ等、他機能への影響を避けるため）。
        if (
          speech.date &&
          speech.date < councilSpeechPeriod.from &&
          !formerMemberIds.has(record.memberId) &&
          speech.term !== "previous"
        ) {
          const msg = `発言日（${speech.date}）が収録対象期間（${councilSpeechPeriod.from}以降）より前です`;
          if (speech.isPublished) err(speechTag, `${msg}。公開できません`);
          else warn(speechTag, msg);
        }
        if (speech.term !== undefined && speech.term !== "current" && speech.term !== "previous") {
          err(speechTag, `未定義のtermです: ${speech.term}`);
        }
        // term:"previous"は「旧任期の発言である」という明示的な申告のため、実際の発言日が
        // カットオフより前であることと矛盾していないかを確認する（誤って現任期の発言に
        // term:"previous"を付けると、活動レーダーチャート等の現任期集計から誤って除外されてしまう）。
        if (speech.term === "previous" && speech.date && speech.date >= councilSpeechPeriod.from) {
          err(
            speechTag,
            `term:"previous"（旧任期）と設定されていますが、発言日（${speech.date}）が現任期の対象期間（${councilSpeechPeriod.from}以降）です`,
          );
        }
        if (formerMemberIds.has(record.memberId) && speech.term === "previous") {
          warn(speechTag, 'formerMembers.jsonの元議員レコードにterm:"previous"は不要です（レコード全体が旧任期扱いのため）');
        }
        if (!VALID_SPEECH_SUMMARY_STATUSES.has(speech.summaryStatus)) {
          err(speechTag, `未定義のsummaryStatusです: ${speech.summaryStatus}`);
        }
        if (speech.isPublished && NOT_YET_PUBLISHABLE_STATUSES.has(speech.summaryStatus)) {
          err(speechTag, `summaryStatus="${speech.summaryStatus}"のまま公開（isPublished: true）されています`);
        }
        if (speech.summaryStatus === "verified") {
          if (!speech.summarySources || speech.summarySources.length === 0) {
            err(speechTag, 'summaryStatus="verified"なのに出典（summarySources）がありません');
          }
          if (!speech.questionItems || speech.questionItems.length === 0 || speech.questionItems.some((q) => isBlank(q.questionSummary))) {
            err(speechTag, 'summaryStatus="verified"なのに空の質問要約があります');
          }
        }

        const questionItemIds = new Set();
        for (const q of speech.questionItems ?? []) {
          if (isBlank(q.id)) err(speechTag, "質問項目のidが空です");
          else if (questionItemIds.has(q.id)) err(speechTag, `同一発言内で質問項目IDが重複しています: ${q.id}`);
          else questionItemIds.add(q.id);

          if (q.questionAnswerLinkStatus && !VALID_QA_LINK_STATUSES.has(q.questionAnswerLinkStatus)) {
            err(speechTag, `未定義のquestionAnswerLinkStatusです: ${q.questionAnswerLinkStatus}`);
          }
          if (q.questionAnswerLinkStatus === "ambiguous" && !isBlank(q.answerSummary)) {
            warn(speechTag, `questionAnswerLinkStatus="ambiguous"なのにanswerSummaryが設定されています（対応関係が曖昧な場合は無理に埋めないこと）`);
          }
          if (q.questionApproach && !RECOMMENDED_QUESTION_APPROACHES.has(q.questionApproach)) {
            warn(speechTag, `questionApproachが推奨語彙にありません（誤りではないが確認推奨）: ${q.questionApproach}`);
          }
          if (q.answerStatus && !RECOMMENDED_ANSWER_STATUSES.has(q.answerStatus)) {
            warn(speechTag, `answerStatusが推奨語彙にありません（誤りではないが確認推奨）: ${q.answerStatus}`);
          }

          for (const rel of q.relatedBills ?? []) {
            if (isBlank(rel.billId) || !billVotesById.has(rel.billId)) {
              err(speechTag, `関連議案として存在しない議案IDを参照しています: ${rel.billId}`);
            }
            if (!VALID_SPEECH_RELATION_STATUSES.has(rel.relationStatus)) {
              err(speechTag, `未定義のrelationStatusです: ${rel.relationStatus}`);
            }
            if (rel.relationStatus === "confirmed" && isBlank(rel.evidence)) {
              warn(speechTag, `confirmedの関連議案(${rel.billId})に根拠（evidence）が設定されていません`);
            }
          }
        }
      }
    }

    // 「同じ会期・同じ議員・同じ質問日」の重複登録チェック（IDが異なっていても、実質的な二重登録を検出する）。
    // isPublished:trueかつ一般質問データベース対象区分（src/lib/questionLikeSpeechTypes.tsと同じ値を
    // ここに複製する。このスクリプトはVite専用のTS importを使えないため複製せざるを得ない）のみを対象にする。
    const seenMemberSessionDate = new Map();
    const memberIdsWithConfirmedQuestion = new Set();
    for (const record of speechData.members) {
      for (const speech of record.speeches ?? []) {
        if (!speech.isPublished || !QUESTION_LIKE_SPEECH_TYPES_FOR_VALIDATION.has(speech.speechType)) continue;
        memberIdsWithConfirmedQuestion.add(record.memberId);
        // speechTypeも含める。同じ議員が同じ会期・同じ日に代表質問と一般質問の両方を行う等、
        // 区分が異なる複数登壇は正当なデータのため誤検出しない（区分が同じ場合のみ重複とみなす）。
        const key = `${record.memberId}::${speech.sessionId}::${speech.date ?? "日付不明"}::${speech.speechType}`;
        const existing = seenMemberSessionDate.get(key);
        if (existing) {
          err(
            `councilSpeechSummaries.json (${record.memberId})`,
            `同じ議員・同じ会期・同じ質問日の一般質問が重複登録されている可能性があります: ${existing} と ${speech.id}（意図的な複数登壇の場合は無視して構いませんが、確認してください）`,
          );
        } else {
          seenMemberSessionDate.set(key, speech.id);
        }
      }
    }
    // 現職議員（members.json）で、会議録確認済みの一般質問が1件も無い議員を警告として洗い出す
    // （エラーにはしない。単に未登壇の可能性もあり、欠損データとは限らないため）。
    const membersWithoutConfirmedQuestion = members.filter((m) => !memberIdsWithConfirmedQuestion.has(m.id));
    if (membersWithoutConfirmedQuestion.length > 0) {
      warn(
        "councilSpeechSummaries.json",
        `会議録で確認済みの一般質問が1件も無い現職議員: ${membersWithoutConfirmedQuestion.map((m) => `${m.id}(${m.name})`).join("、")}`,
      );
    }

    // トップページ・ダッシュボード等が使う「会議録確認済み一般質問」の集計（src/lib/generalQuestionStats.ts の
    // confirmedCount）は、この配列と同じ条件（isPublished && questionLikeSpeechTypes）で数える。
    // 実データが存在するのに、公開設定・区分判定の不具合で集計が0件になる回帰を検知するための保険。
    const totalConfirmedQuestionLikeSpeeches = speechData.members.reduce(
      (sum, record) =>
        sum +
        (record.speeches ?? []).filter((s) => s.isPublished && QUESTION_LIKE_SPEECH_TYPES_FOR_VALIDATION.has(s.speechType))
          .length,
      0,
    );
    const totalSpeechRecords = speechData.members.reduce((sum, record) => sum + (record.speeches ?? []).length, 0);
    if (totalSpeechRecords > 0 && totalConfirmedQuestionLikeSpeeches === 0) {
      err(
        "councilSpeechSummaries.json",
        `発言データが${totalSpeechRecords}件存在するのに、会議録確認済み一般質問の集計が0件になっています（isPublished/speechTypeの判定条件を確認してください）`,
      );
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") {
    warn("councilSpeechSummaries.json", "読み込めませんでした（存在しない場合はスキップ）");
  } else {
    throw e;
  }
}

// --- questionCollectionStatus.json（一般質問の会期別収録進捗） ---
const VALID_COLLECTION_STATUSES = new Set([
  "notStarted",
  "inProgress",
  "partial",
  "complete",
  "transcriptUnavailable",
  "needsReview",
  "failed",
]);
try {
  const progress = readJson("src/data/questionCollectionStatus.json");
  if (!Array.isArray(progress.sessions)) {
    err("questionCollectionStatus.json", "sessionsが配列ではありません");
  } else {
    const seenSessionIds = new Set();
    for (const s of progress.sessions) {
      const tag = `questionCollectionStatus.json (${s.sessionId ?? "会期id不明"})`;
      if (isBlank(s.sessionId)) err(tag, "sessionIdが空です");
      else if (seenSessionIds.has(s.sessionId)) err(tag, `sessionIdが重複しています: ${s.sessionId}`);
      else seenSessionIds.add(s.sessionId);

      if (s.sessionId && !sessionIdSet.has(s.sessionId)) {
        err(tag, `councilSessions.jsonに存在しない会期IDです: ${s.sessionId}`);
      }
      if (!VALID_COLLECTION_STATUSES.has(s.status)) {
        err(tag, `未定義のstatusです: ${s.status}`);
      }
      if (s.status === "complete" && (s.registeredSpeakerCount ?? 0) === 0) {
        err(tag, 'status="complete"なのにregisteredSpeakerCountが0件です（未完了の会期をcompleteにしないでください）');
      }
      if (s.status === "transcriptUnavailable" && s.transcriptAvailable === true) {
        err(tag, 'status="transcriptUnavailable"なのにtranscriptAvailable:trueは矛盾しています');
      }
      // 会期の実際の収録件数（councilSpeechSummaries.json側の公開済み発言）との不一致を検出する。
      const actualCount = speechIds.size > 0 ? [...publishedSpeechIds].filter((id) => id).length : 0;
      void actualCount; // 発言単位の件数比較はsessionId単位の集計が必要なため、将来の拡張余地として関数はここまでに留める。
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") {
    warn("questionCollectionStatus.json", "読み込めませんでした（存在しない場合はスキップ）");
  } else {
    throw e;
  }
}

// --- themes.json（質問テーマの固定辞書） ---
try {
  const themes = readJson("src/data/themes.json");
  if (!Array.isArray(themes)) {
    err("themes.json", "配列ではありません");
  } else {
    const seenIds = new Set();
    const seenSlugs = new Set();
    for (const theme of themes) {
      const tag = `themes.json (${theme.slug ?? theme.id ?? "id不明"})`;
      if (isBlank(theme.id)) err(tag, "idが空です");
      else if (seenIds.has(theme.id)) err(tag, `idが重複しています: ${theme.id}`);
      else seenIds.add(theme.id);

      if (isBlank(theme.slug)) err(tag, "slugが空です");
      else if (seenSlugs.has(theme.slug)) err(tag, `slugが重複しています: ${theme.slug}`);
      else seenSlugs.add(theme.slug);

      if (isBlank(theme.name)) err(tag, "nameが空です");
      if (isBlank(theme.description)) err(tag, "descriptionが空です");
      if (!Array.isArray(theme.keywords)) err(tag, "keywordsが配列ではありません");
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") {
    warn("themes.json", "読み込めませんでした（存在しない場合はスキップ）");
  } else {
    throw e;
  }
}

// --- memberSpeechAnalysis.json（AIによる質問内容の分析） ---
const VALID_MEMBER_ANALYSIS_STATUSES = new Set(["verified", "partially-verified", "pending", "insufficient-data", "not-analyzed"]);

try {
  const analysisData = readJson("src/data/memberSpeechAnalysis.json");
  if (typeof analysisData.version !== "number") err("memberSpeechAnalysis.json", "versionが数値ではありません");
  if (!Array.isArray(analysisData.members)) {
    err("memberSpeechAnalysis.json", "membersが配列ではありません");
  } else {
    const seenAnalysisMemberIds = new Set();
    for (const a of analysisData.members) {
      const tag = `memberSpeechAnalysis.json (${a.memberId ?? "議員id不明"})`;
      if (isBlank(a.memberId)) err(tag, "memberIdが空です");
      else if (!memberIds.has(a.memberId) && !formerMemberIds.has(a.memberId)) {
        err(tag, `現職・元議員のいずれのIDにも一致しません: ${a.memberId}`);
      }
      if (seenAnalysisMemberIds.has(a.memberId)) err(tag, `同じ議員のAI分析が重複しています: ${a.memberId}`);
      else seenAnalysisMemberIds.add(a.memberId);

      if (!VALID_MEMBER_ANALYSIS_STATUSES.has(a.analysisStatus)) {
        err(tag, `未定義のanalysisStatusです: ${a.analysisStatus}`);
      }
      if (a.analysisStatus === "verified" || a.analysisStatus === "partially-verified") {
        if (isBlank(a.overview)) err(tag, `analysisStatus="${a.analysisStatus}"なのにoverviewが空です`);
        if (!a.verifiedAt || !DATE_RE.test(a.verifiedAt)) err(tag, `analysisStatus="${a.analysisStatus}"なのにverifiedAtが未設定または不正です`);
      }
      if ((a.analysisStatus === "pending" || a.analysisStatus === "partially-verified") && isBlank(a.overview)) {
        err(tag, `analysisStatus="${a.analysisStatus}"なのにoverviewが空です`);
      }
      if (a.generatedAt && !DATE_RE.test(a.generatedAt)) err(tag, `generatedAtの形式が不正です: ${a.generatedAt}`);
      if (a.verifiedAt && !DATE_RE.test(a.verifiedAt)) err(tag, `verifiedAtの形式が不正です: ${a.verifiedAt}`);
      if (a.analysisPeriod && a.analysisPeriod.from !== councilSpeechPeriod.from) {
        err(tag, `analysisPeriod.fromがcouncilSpeechPeriod.from（${councilSpeechPeriod.from}）と一致しません: ${a.analysisPeriod.from}`);
      }
      if (a.recurringTopics?.some((t) => t.sessionIds.length < 2)) {
        err(tag, "recurringTopicsに、確認できた会期が2会期未満のテーマが含まれています（継続テーマの条件は2会期以上）");
      }

      for (const group of [a.mainTopics ?? [], a.recurringTopics ?? [], a.newTopics ?? []]) {
        for (const t of group) {
          for (const sid of t.evidenceSpeechIds ?? []) {
            if (!speechIds.has(sid)) err(tag, `テーマ「${t.label}」が存在しない発言IDを参照しています: ${sid}`);
          }
          for (const sesId of t.sessionIds ?? []) {
            if (!sessionIdSet.has(sesId)) err(tag, `テーマ「${t.label}」が存在しない会期IDを参照しています: ${sesId}`);
          }
        }
      }
      for (const sid of a.evidenceSpeechIds ?? []) {
        if (!speechIds.has(sid)) err(tag, `存在しない発言IDを参照しています: ${sid}`);
        else if (!publishedSpeechIds.has(sid)) warn(tag, `非公開の発言IDを根拠として参照しています: ${sid}`);
      }
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") {
    warn("memberSpeechAnalysis.json", "読み込めませんでした（存在しない場合はスキップ）");
  } else {
    throw e;
  }
}

// --- archiveCrawlerTargets.json / archiveCrawlerState.json（フェーズ10A：自動巡回基盤） ---
try {
  const archiveCrawlerTargets = readJson("src/data/archiveCrawlerTargets.json");
  if (!Array.isArray(archiveCrawlerTargets)) throw new Error("配列ではありません");

  const VALID_CRAWLER_CATEGORIES = new Set([
    "generalQuestion",
    "bill",
    "ordinance",
    "petition",
    "request",
    "mayor",
    "memberRoster",
    "finance",
    "population",
    "fund",
    "debt",
    "policy",
    "theme",
  ]);

  const crawlerTargetIds = checkDuplicateIds({ err, warn }, archiveCrawlerTargets, "id", "archiveCrawlerTargets.json");

  // URL重複：議案・条例・請願・陳情のように、同一の一覧ページを複数対象が意図的に共有する場合は
  // 許容する（existingImplementationが揃っている場合）。異なる実装が同じURLを指している場合のみ
  // 所有関係が曖昧なため警告する。
  const byUrl = new Map();
  for (const t of archiveCrawlerTargets) {
    if (!t.url) continue;
    const list = byUrl.get(t.url) ?? [];
    list.push(t);
    byUrl.set(t.url, list);
  }
  for (const [url, list] of byUrl) {
    if (list.length < 2) continue;
    const impls = new Set(list.map((t) => t.existingImplementation ?? null));
    if (impls.size > 1) {
      warn(
        "archiveCrawlerTargets.json",
        `URLが複数対象で共有されていますが、既存実装（existingImplementation）が一致しません: ${url}（対象: ${list.map((t) => t.id).join("、")}）`,
      );
    }
  }

  for (const t of archiveCrawlerTargets) {
    const tag = `archiveCrawlerTargets.json (${t.id ?? "id不明"})`;
    if (!VALID_CRAWLER_CATEGORIES.has(t.category)) err(tag, `未定義のcategoryです: ${t.category}`);
    if (isBlank(t.categoryLabel)) err(tag, "categoryLabelが空です");
    if (t.url != null && !URL_RE.test(t.url)) err(tag, `urlの形式が不正です: ${t.url}`);
    if (t.url == null && t.existingImplementation) {
      warn(tag, "urlが未確認なのにexistingImplementationが設定されています（矛盾している可能性があります）");
    }
  }

  const VALID_CRAWLER_STATUSES = new Set(["new", "changed", "unchanged", "possiblyRemoved", "error", "skipped"]);

  try {
    const archiveCrawlerState = readJson("src/data/archiveCrawlerState.json");
    const stateTag = "archiveCrawlerState.json";
    if (!Array.isArray(archiveCrawlerState.targets)) {
      err(stateTag, "targetsが配列ではありません");
    } else {
      for (const field of ["lastRunAt", "lastSuccessfulRunAt"]) {
        const v = archiveCrawlerState[field];
        if (v != null && Number.isNaN(Date.parse(v))) err(stateTag, `${field}の形式が不正です: ${v}`);
      }
      // 巡回結果整合性：totalCountは巡回対象の総数と一致し、changedCount（新規+変更）・
      // removedCount（削除候補）・errorCountはいずれもtotalCountを超えない。
      for (const field of ["totalCount", "changedCount", "removedCount", "errorCount"]) {
        const v = archiveCrawlerState[field];
        if (typeof v !== "number" || v < 0) err(stateTag, `${field}が非負の数値ではありません: ${v}`);
      }
      if (typeof archiveCrawlerState.totalCount === "number") {
        for (const field of ["changedCount", "removedCount", "errorCount"]) {
          const v = archiveCrawlerState[field];
          if (typeof v === "number" && v > archiveCrawlerState.totalCount) {
            err(stateTag, `${field}(${v})がtotalCount(${archiveCrawlerState.totalCount})を超えています`);
          }
        }
      }

      for (const ts of archiveCrawlerState.targets) {
        const tsTag = `${stateTag} (${ts.targetId ?? "id不明"})`;
        if (!crawlerTargetIds.has(ts.targetId)) {
          err(tsTag, `archiveCrawlerTargets.jsonに存在しない巡回対象IDを参照しています: ${ts.targetId}`);
        }
        for (const field of ["lastCheckedAt", "lastSuccessfulAt", "lastUpdatedAt"]) {
          const v = ts[field];
          if (v != null && Number.isNaN(Date.parse(v))) err(tsTag, `${field}の形式が不正です: ${v}`);
        }
        if (ts.lastStatus != null && !VALID_CRAWLER_STATUSES.has(ts.lastStatus)) {
          err(tsTag, `未定義のlastStatusです: ${ts.lastStatus}`);
        }
        if (typeof ts.consecutiveNotFoundCount !== "number" || ts.consecutiveNotFoundCount < 0) {
          err(tsTag, `consecutiveNotFoundCountが非負の数値ではありません: ${ts.consecutiveNotFoundCount}`);
        }
        // 削除判定の妥当性：possiblyRemovedは2回以上連続で取得できなかった場合のみ成立する
        // （src/lib/archiveCrawler.tsのshouldFlagAsPossiblyRemovedと同じ条件）。
        if (ts.lastStatus === "possiblyRemoved" && ts.consecutiveNotFoundCount < 2) {
          err(tsTag, `lastStatus="possiblyRemoved"ですが、consecutiveNotFoundCount(${ts.consecutiveNotFoundCount})が2未満です（1回の失敗だけでは削除候補にしない）`);
        }
        if (ts.lastStatus != null && ts.lastStatus !== "error" && ts.lastStatus !== "possiblyRemoved" && ts.consecutiveNotFoundCount !== 0) {
          warn(tsTag, `lastStatus="${ts.lastStatus}"ですが、consecutiveNotFoundCountが0にリセットされていません: ${ts.consecutiveNotFoundCount}`);
        }
      }
      // state整合性：登録済みの全対象がstateにも存在するか（片方にしか無い＝生成漏れ・削除漏れの可能性）。
      const stateTargetIds = new Set(archiveCrawlerState.targets.map((t) => t.targetId));
      for (const t of archiveCrawlerTargets) {
        if (!stateTargetIds.has(t.id)) {
          warn(stateTag, `archiveCrawlerTargets.jsonの対象がstateに存在しません（未実行のため反映されていない可能性）: ${t.id}`);
        }
      }
    }
  } catch (e) {
    if (e?.code === "ENOENT") warn("archiveCrawlerState.json", "読み込めませんでした（存在しない場合はスキップ）");
    else throw e;
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveCrawlerTargets.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

// --- archiveAiJobs.json / archiveEntityExtractionCandidates.json（フェーズ10C：AI処理ジョブキュー） ---
try {
  const archiveAiJobs = readJson("src/data/archiveAiJobs.json");
  if (!Array.isArray(archiveAiJobs)) throw new Error("配列ではありません");

  const VALID_JOB_TYPES = new Set(["summary", "categoryClassification", "relationCandidate", "entityExtraction"]);
  const VALID_JOB_STATUSES = new Set(["pending", "processing", "completed", "failed", "skipped", "needsReview"]);
  const VALID_CANDIDATE_STATUSES_4 = new Set(["candidate", "confirmed", "rejected", "needsReview"]);

  checkDuplicateIds({ err, warn }, archiveAiJobs, "id", "archiveAiJobs.json");

  // 同一(sourceEntityId, jobType, sourceTextHash)のジョブ重複を検出する
  // （src/lib/ai/archiveAiProcessor.tsのfilterUnprocessedJobRequestsが本来防ぐはずの状態）。
  const jobKeyCounts = new Map();
  for (const j of archiveAiJobs) {
    const key = `${j.sourceEntityId}::${j.jobType}::${j.sourceTextHash}`;
    jobKeyCounts.set(key, (jobKeyCounts.get(key) ?? 0) + 1);
  }

  for (const j of archiveAiJobs) {
    const tag = `archiveAiJobs.json (${j.id ?? "id不明"})`;
    checkCandidateEntityRef({ err, warn }, j.sourceEntityType, j.sourceEntityId, tag, "sourceEntityId");
    if (!VALID_JOB_TYPES.has(j.jobType)) err(tag, `未定義のjobTypeです: ${j.jobType}`);
    if (!VALID_JOB_STATUSES.has(j.status)) err(tag, `未定義のstatusです: ${j.status}`);
    if (isBlank(j.sourceTextHash)) err(tag, "sourceTextHashが未設定です（原文変更時の再確認判定ができません）");
    if (!j.createdAt) err(tag, "createdAtが未設定です");
    if (typeof j.attempts !== "number" || j.attempts < 0) err(tag, `attemptsが非負の数値ではありません: ${j.attempts}`);
    if (typeof j.maxAttempts !== "number" || j.maxAttempts < 1) err(tag, `maxAttemptsが1以上の数値ではありません: ${j.maxAttempts}`);
    if (typeof j.attempts === "number" && typeof j.maxAttempts === "number" && j.attempts > j.maxAttempts) {
      err(tag, `attempts(${j.attempts})がmaxAttempts(${j.maxAttempts})を超えています`);
    }
    if (j.verificationStatus != null && !VALID_CANDIDATE_STATUSES_4.has(j.verificationStatus)) {
      err(tag, `未定義のverificationStatusです: ${j.verificationStatus}`);
    }
    const key = `${j.sourceEntityId}::${j.jobType}::${j.sourceTextHash}`;
    if ((jobKeyCounts.get(key) ?? 0) > 1) {
      err(tag, `同一資料・同一ジョブ種別・同一原文ハッシュのジョブが重複しています（(sourceEntityId, jobType, sourceTextHash)の組み合わせが一意ではありません）`);
    }
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveAiJobs.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

try {
  const archiveEntityExtractionCandidates = readJson("src/data/archiveEntityExtractionCandidates.json");
  if (!Array.isArray(archiveEntityExtractionCandidates)) throw new Error("配列ではありません");

  let knownPersonIds = new Set();
  try {
    const factions = readJson("src/data/factions.json");
    knownPersonIds = new Set([...memberIds, ...formerMemberIds, ...archiveMayorIds, ...(factions ?? []).map((f) => f.id)]);
  } catch {
    // factions.jsonが読めない場合は会派IDの参照チェックのみスキップする
  }

  const VALID_CANDIDATE_STATUSES_5 = new Set(["candidate", "confirmed", "rejected", "needsReview"]);
  checkDuplicateIds({ err, warn }, archiveEntityExtractionCandidates, "id", "archiveEntityExtractionCandidates.json");

  for (const e of archiveEntityExtractionCandidates) {
    const tag = `archiveEntityExtractionCandidates.json (${e.id ?? "id不明"})`;
    checkCandidateEntityRef({ err, warn }, e.sourceEntityType, e.sourceEntityId, tag, "sourceEntityId");
    if (isBlank(e.rawName)) err(tag, "rawNameが空です");
    if (!Array.isArray(e.candidateIds)) {
      err(tag, "candidateIdsが配列ではありません");
    } else if (knownPersonIds.size > 0) {
      for (const cid of e.candidateIds) {
        if (!knownPersonIds.has(cid)) err(tag, `既存マスタに存在しない候補IDを参照しています（推測でIDを割り当てていないか確認）: ${cid}`);
      }
    }
    if (typeof e.needsReview !== "boolean") err(tag, `needsReviewが真偽値ではありません: ${e.needsReview}`);
    // 一致候補が0件（rawNameのみ）の場合はneedsReview=trueが必須（未確認のまま既存人物と暗黙に紐付けない）。
    if (Array.isArray(e.candidateIds) && e.candidateIds.length === 0 && e.needsReview !== true) {
      err(tag, "candidateIdsが空（既存マスタと一致なし）にもかかわらずneedsReview=trueではありません");
    }
    if (!VALID_CANDIDATE_STATUSES_5.has(e.status)) err(tag, `未定義のstatusです: ${e.status}`);
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveEntityExtractionCandidates.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

// --- report ---
for (const w of warnings) console.warn(w);
for (const e of errors) console.error(e);

console.log(
  `[validate-data] members=${members.length} generalQuestions=${generalQuestions.length} billVotes=${billVotes.length} councilSessions=${councilSessions.length} — errors=${errors.length} warnings=${warnings.length}`,
);

if (errors.length > 0) {
  console.error("\nデータ検証でエラーが見つかったため、ビルドを中止します。上記のエラー内容を確認してください。");
  process.exit(1);
}
