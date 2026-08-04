import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { councilSpeechPeriod } from "./lib/council-speech-period.mjs";
import {
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

for (const b of billVotes) {
  const tag = `billVotes.json (${b.id ?? "id不明"})`;
  if (isBlank(b.id)) err(tag, "idが空です");
  else if (billIds.has(b.id)) err(tag, `議案IDが重複しています: ${b.id}`);
  else billIds.add(b.id);

  if (isBlank(b.billNumber)) err(tag, "billNumberが空です");
  if (isBlank(b.billTitle)) err(tag, "billTitleが空です");
  if (isBlank(b.summary)) err(tag, "summaryが空です");
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
    if (!memberIds.has(v.memberId)) err(tag, `存在しない議員IDを参照しています: ${v.memberId}`);
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

  for (const m of archiveMayors) {
    const tag = `archiveMayors.json (${m.id ?? "id不明"})`;
    if (isBlank(m.name)) err(tag, "nameが空です");
    if (typeof m.isCurrentMayor !== "boolean") err(tag, "isCurrentMayorが真偽値ではありません");
    if (m.lastVerifiedAt && !DATE_RE.test(m.lastVerifiedAt)) err(tag, `lastVerifiedAtの形式が不正です: ${m.lastVerifiedAt}`);
    checkSourceRefs({ err, warn }, m.sourceRefs, tag);
    requireAtLeastOneSourceRef({ err }, m.sourceRefs, tag);
  }
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveMayors.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

try {
  const archiveMayorTerms = readJson("src/data/archiveMayorTerms.json");
  if (!Array.isArray(archiveMayorTerms)) throw new Error("配列ではありません");

  archiveMayorTermIds = checkDuplicateIds({ err, warn }, archiveMayorTerms, "id", "archiveMayorTerms.json");

  for (const t of archiveMayorTerms) {
    const tag = `archiveMayorTerms.json (${t.id ?? "id不明"})`;
    checkReferenceExists({ err, warn }, t.mayorId, archiveMayorIds, tag, `存在しない市長IDを参照しています: ${t.mayorId}`);
    checkPeriodConsistency({ err }, t.termStart, t.termEnd, tag);
    if (t.termNumber !== undefined && typeof t.termNumber !== "number") err(tag, "termNumberが数値ではありません");
    checkNonNegative({ err }, t.populationAtStart ?? null, "populationAtStart", tag);
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
} catch (e) {
  if (e?.code === "ENOENT") warn("archiveMayorTerms.json", "読み込めませんでした（存在しない場合はスキップ）");
  else throw e;
}

// --- archiveFiscalYears.json（延岡市政アーカイブ：財政） ---
try {
  const archiveFiscalYears = readJson("src/data/archiveFiscalYears.json");
  if (!Array.isArray(archiveFiscalYears)) throw new Error("配列ではありません");

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

// --- searchIndex.json（サイト内横断検索インデックス） ---
const VALID_SEARCH_TYPES = new Set([
  "member",
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
  "page",
]);
// 実在するルートの先頭一致のみを許可する（管理用・非公開データの混入を防ぐ）。
const VALID_URL_PREFIXES = [
  "/",
  "/members/",
  "/mayor",
  "/finance",
  "/dashboard",
  "/compensation",
  "/city-guide",
  "/bills",
  "/council-documents",
  "/questions",
  "/search",
  "/about",
  "/editorial-policy",
  "/terms",
  "/contact",
  "/updates",
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
        if (speech.date && speech.date < councilSpeechPeriod.from) {
          const msg = `発言日（${speech.date}）が収録対象期間（${councilSpeechPeriod.from}以降）より前です`;
          if (speech.isPublished) err(speechTag, `${msg}。公開できません`);
          else warn(speechTag, msg);
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
  }
} catch (e) {
  if (e?.code === "ENOENT") {
    warn("councilSpeechSummaries.json", "読み込めませんでした（存在しない場合はスキップ）");
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
