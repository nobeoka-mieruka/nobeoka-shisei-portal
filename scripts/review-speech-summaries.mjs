/**
 * 公式会議録本文を基にした一般質問・質疑要約（src/data/councilSpeechSummaries.json）の
 * 確認・承認・却下を行うCLI。scripts/approve-council-data.mjs / reject-council-data.mjs と
 * 同じ運用方針（確認待ちであっても公開する場合は必ず「暫定掲載」と表示する／
 * 承認は公開・非公開の切り替えではなく確認状況の更新である）に合わせている。
 *
 * 現時点ではcouncilSpeechSummaries.jsonのspeechesは全議員で空配列のため、このCLIは
 * 「0件」を正しく報告する以外に行うことがない。会議録取得・要約生成の実装後、
 * 実際にpending状態の発言データが登録されるようになってから機能する。
 *
 * 使い方：
 *   node scripts/review-speech-summaries.mjs --list-pending
 *   node scripts/review-speech-summaries.mjs --review --id=<speechId>
 *   node scripts/review-speech-summaries.mjs --approve --id=<speechId> [--reviewed-by=...] [--dry-run]
 *   node scripts/review-speech-summaries.mjs --reject --id=<speechId> --reason="..." [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataPath = join(root, "src", "data", "councilSpeechSummaries.json");
const membersPath = join(root, "src", "data", "members.json");
const sessionsPath = join(root, "src", "data", "councilSessions.json");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const mode = args.includes("--approve")
  ? "approve"
  : args.includes("--reject")
    ? "reject"
    : args.includes("--review")
      ? "review"
      : args.includes("--list-pending")
        ? "list"
        : undefined;
const speechId = args.find((a) => a.startsWith("--id="))?.split("=")[1];
const reviewedBy = args.find((a) => a.startsWith("--reviewed-by="))?.split("=").slice(1).join("=");
const reason = args.find((a) => a.startsWith("--reason="))?.split("=").slice(1).join("=");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const PENDING_STATUSES = new Set(["pending", "partially-verified", "speaker-identification-pending", "question-answer-link-pending"]);

const data = readJson(dataPath);
const allSpeeches = data.members.flatMap((m) => m.speeches.map((s) => ({ ...s, memberId: m.memberId })));
const members = readJson(membersPath);
const sessions = readJson(sessionsPath);
const memberName = (id) => members.find((m) => m.id === id)?.name ?? id;
const sessionTitle = (id) => sessions.find((s) => s.id === id)?.title ?? id;

function findSpeech(id) {
  for (const member of data.members) {
    const speech = member.speeches.find((s) => s.id === id);
    if (speech) return { member, speech };
  }
  return undefined;
}

/** 承認前チェック。1つでもNGなら承認不可（架空承認を防ぐ）。 */
function runApprovalChecks(speech) {
  const checks = [];
  const check = (label, ok, detail) => checks.push({ label, ok, detail });

  const hasQuestionSummary = speech.questionItems.length > 0 && speech.questionItems.every((q) => q.questionSummary?.trim());
  check("質問要約が入力されているか", hasQuestionSummary, hasQuestionSummary ? "OK" : "空の質問項目があります");

  const hasSource = speech.summarySources.length > 0;
  check("出典が登録されているか", hasSource, hasSource ? `${speech.summarySources.length}件` : "出典が0件です");

  const speakerConfirmed = speech.summaryStatus !== "speaker-identification-pending";
  check("発言者が確定しているか", speakerConfirmed, speakerConfirmed ? "OK" : "発言者確認中のため承認できません");

  const unresolvedLinks = speech.questionItems.filter((q) => q.questionAnswerLinkStatus === "pending" || q.questionAnswerLinkStatus === "ambiguous");
  check(
    "質問と答弁の対応が確認できているか",
    unresolvedLinks.length === 0,
    unresolvedLinks.length === 0 ? "全項目confirmed/partially-confirmed" : `未確定・曖昧な項目: ${unresolvedLinks.map((q) => q.id).join("、")}`,
  );

  return checks;
}

if (mode === "review") {
  if (!speechId) {
    console.error("[review-speech-summaries] --id=<speechId> を指定してください。");
    process.exit(1);
  }
  const found = findSpeech(speechId);
  if (!found) {
    console.error(`[review-speech-summaries] 指定されたIDの質問・答弁要約は見つかりません: ${speechId}`);
    process.exit(1);
  }
  const { speech } = found;
  console.log(`議員名　　　: ${memberName(speech.memberId)}（${speech.memberId}）`);
  console.log(`会期　　　　: ${sessionTitle(speech.sessionId)}（${speech.sessionId}）`);
  console.log(`発言日　　　: ${speech.date ?? "未確認"}／${speech.meetingNumber ?? ""}／${speech.meetingType}`);
  console.log(`発言区分　　: ${speech.speechType}`);
  console.log(`公開状態　　: isPublished=${speech.isPublished} / summaryStatus=${speech.summaryStatus}`);
  console.log(`最終確認日　: ${speech.verifiedAt ?? "未確認"}`);
  console.log(`\n出典URL・発言位置:`);
  for (const src of speech.summarySources) {
    console.log(`  - ${src.title}\n    ${src.sourceUrl}${src.speakerSection ? `（${src.speakerSection}）` : ""}`);
  }
  console.log(`\n質問項目（${speech.questionItems.length}件）:`);
  for (const q of speech.questionItems) {
    console.log(`\n  [${q.id}] ${q.title}`);
    console.log(`  質問と答弁の対応状態: ${q.questionAnswerLinkStatus}`);
    console.log(`  質問要約: ${q.questionSummary}`);
    console.log(`  答弁要約（答弁者: ${(q.answerers ?? []).join("、") || "未確認"}）: ${q.answerSummary}`);
    console.log(`  関連議案候補: ${q.relatedBills.length === 0 ? "なし" : q.relatedBills.map((r) => `${r.billId}(${r.relationStatus})`).join("、")}`);
  }
  console.log(`\nテーマ: ${speech.topics.join("、") || "なし"}`);
  console.log(`\n確認メモ: ${speech.verificationNote ?? "（なし）"}`);
  console.log(`\n※質問原文・答弁原文は上記の出典URL（延岡市議会公式会議録検索システム）で確認してください。`);
  process.exit(0);
}

if (mode === "list") {
  const pending = allSpeeches.filter((s) => PENDING_STATUSES.has(s.summaryStatus));
  if (pending.length === 0) {
    console.log("[review-speech-summaries] 確認待ちの質問・答弁要約はありません。");
  } else {
    console.log(`[review-speech-summaries] 確認待ち ${pending.length}件:`);
    for (const s of pending) {
      console.log(`  --id=${s.id}  議員=${s.memberId}  会期=${s.sessionId}  状態=${s.summaryStatus}`);
    }
  }
  process.exit(0);
}

if (mode === "approve" || mode === "reject") {
  if (!speechId) {
    console.error("[review-speech-summaries] --id=<speechId> を指定してください。");
    process.exit(1);
  }
  const found = findSpeech(speechId);
  if (!found) {
    console.error(`[review-speech-summaries] 指定されたIDの質問・答弁要約は見つかりません: ${speechId}`);
    console.error("（現時点ではcouncilSpeechSummaries.jsonに実データが1件も登録されていません）");
    process.exit(1);
  }
  const { speech } = found;

  if (mode === "reject") {
    if (isDryRun) {
      console.log(`[review-speech-summaries] ${speechId}: --dry-run のため実際の変更は行いませんでした。`);
      process.exit(0);
    }
    speech.isPublished = false;
    speech.verificationNote = reason ?? "内容を公式会議録と照合できなかったため非公開としました。";
    writeJson(dataPath, data);
    console.log(`[review-speech-summaries] ${speechId} を非公開にしました。`);
    process.exit(0);
  }

  console.log(`\n[review-speech-summaries] ${speechId} の承認前チェック:`);
  const checks = runApprovalChecks(speech);
  let allOk = true;
  for (const c of checks) {
    console.log(`  ${c.ok ? "OK" : "NG"}  ${c.label}: ${c.detail}`);
    if (!c.ok) allOk = false;
  }
  if (!allOk) {
    console.error(`[review-speech-summaries] ${speechId}: 確認に失敗した項目があるため承認しませんでした。`);
    process.exit(1);
  }
  if (isDryRun) {
    console.log(`[review-speech-summaries] ${speechId}: --dry-run のため実際の変更は行いませんでした。`);
    process.exit(0);
  }
  speech.summaryStatus = speech.summaryStatus === "partially-verified" ? "partially-verified" : "verified";
  speech.verifiedAt = todayIso();
  if (reviewedBy) speech.verificationNote = `${reviewedBy}が確認しました。`;
  writeJson(dataPath, data);
  console.log(`[review-speech-summaries] ${speechId} を承認しました（summaryStatus: ${speech.summaryStatus}）。`);
  process.exit(0);
}

console.error("[review-speech-summaries] --list-pending / --approve --id=<id> / --reject --id=<id> のいずれかを指定してください。");
process.exit(1);
