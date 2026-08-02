/**
 * 「AIによる質問内容の分析」（src/data/memberSpeechAnalysis.json）の確認・承認・却下を行うCLI。
 * scripts/review-speech-summaries.mjsと同じ運用方針（AI生成は必ずpendingで保存し、
 * 人による確認前にverifiedへ変更しない）に合わせている。
 *
 * 使い方：
 *   node scripts/review-member-speech-analysis.mjs --list-pending
 *   node scripts/review-member-speech-analysis.mjs --review --member=m21
 *   node scripts/review-member-speech-analysis.mjs --approve --member=m21 [--partial] [--dry-run]
 *   node scripts/review-member-speech-analysis.mjs --reject --member=m21 --reason="..." [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataPath = join(root, "src", "data", "memberSpeechAnalysis.json");
const membersPath = join(root, "src", "data", "members.json");
const speechPath = join(root, "src", "data", "councilSpeechSummaries.json");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isPartial = args.includes("--partial");
const mode = args.includes("--approve")
  ? "approve"
  : args.includes("--reject")
    ? "reject"
    : args.includes("--review")
      ? "review"
      : args.includes("--list-pending")
        ? "list"
        : undefined;
const memberId = args.find((a) => a.startsWith("--member="))?.split("=")[1];
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

const PENDING_STATUSES = new Set(["pending", "partially-verified"]);

const data = readJson(dataPath);
const members = readJson(membersPath);
const speechData = readJson(speechPath);
const memberName = (id) => members.find((m) => m.id === id)?.name ?? id;
const speechById = new Map(speechData.members.flatMap((m) => m.speeches.map((s) => [s.id, s])));

function findAnalysis(id) {
  return data.members.find((a) => a.memberId === id);
}

function runApprovalChecks(analysis) {
  const checks = [];
  const check = (label, ok, detail) => checks.push({ label, ok, detail });

  const hasOverview = !!analysis.overview?.trim();
  check("分析概要（overview）があるか", hasOverview, hasOverview ? "OK" : "空です");

  const hasEvidence = analysis.evidenceSpeechIds.length > 0;
  check("根拠となる発言データがあるか", hasEvidence, hasEvidence ? `${analysis.evidenceSpeechIds.length}件` : "0件です");

  const allEvidenceExists = analysis.evidenceSpeechIds.every((id) => speechById.has(id));
  check("根拠speechIdが実在するか", allEvidenceExists, allEvidenceExists ? "OK" : "存在しないspeechIdを含みます");

  const topicEvidenceOk = [...analysis.mainTopics, ...analysis.recurringTopics, ...analysis.newTopics].every(
    (t) => t.evidenceSpeechIds.length > 0,
  );
  check("各テーマに根拠speechIdがあるか", topicEvidenceOk, topicEvidenceOk ? "OK" : "根拠のないテーマがあります");

  return checks;
}

if (mode === "list") {
  const pending = data.members.filter((a) => PENDING_STATUSES.has(a.analysisStatus));
  if (pending.length === 0) {
    console.log("[review-member-speech-analysis] 確認待ちのAI分析はありません。");
  } else {
    console.log(`[review-member-speech-analysis] 確認待ち ${pending.length}件:`);
    for (const a of pending) {
      console.log(`  --member=${a.memberId}  ${memberName(a.memberId)}  解析済み${a.analyzedSessionCount}会期  状態=${a.analysisStatus}`);
    }
  }
  process.exit(0);
}

if (mode === "review") {
  if (!memberId) {
    console.error("[review-member-speech-analysis] --member=<memberId> を指定してください。");
    process.exit(1);
  }
  const analysis = findAnalysis(memberId);
  if (!analysis) {
    console.error(`[review-member-speech-analysis] 指定された議員のAI分析は見つかりません: ${memberId}`);
    process.exit(1);
  }
  console.log(`議員名　　　: ${memberName(analysis.memberId)}（${analysis.memberId}）`);
  console.log(`分析対象期間: ${analysis.analysisPeriod.from} 〜 ${analysis.analysisPeriod.to ?? "（最新まで）"}`);
  console.log(`解析済み会期: ${analysis.analyzedSessionCount}会期`);
  console.log(`確認状態　　: ${analysis.analysisStatus}`);
  console.log(`生成日　　　: ${analysis.generatedAt ?? "未生成"}`);
  console.log(`確認日　　　: ${analysis.verifiedAt ?? "未確認"}`);
  console.log(`\n分析概要:\n${analysis.overview || "（なし）"}`);

  const printTopics = (label, topics) => {
    console.log(`\n${label}（${topics.length}件）:`);
    for (const t of topics) {
      console.log(`  - ${t.label}：${t.statement}`);
      console.log(`    根拠speechId: ${t.evidenceSpeechIds.join("、")} / 会期: ${t.sessionIds.join("、")}`);
    }
  };
  printTopics("主なテーマ", analysis.mainTopics);
  printTopics("継続テーマ", analysis.recurringTopics);
  printTopics("新規テーマ", analysis.newTopics);

  console.log(`\n質問形式: ${analysis.questionApproaches.map((a) => `${a.label}${a.count}件`).join("、") || "なし"}`);
  console.log(`答弁状態: ${analysis.answerStatusCounts.map((a) => `${a.label}${a.count}件`).join("、") || "なし"}`);

  console.log(`\n元の質問・答弁一覧（根拠データ）:`);
  for (const speechId of analysis.evidenceSpeechIds) {
    const speech = speechById.get(speechId);
    if (!speech) continue;
    console.log(`  [${speechId}] ${speech.sessionId} / ${speech.date} / ${speech.speechType}`);
    for (const q of speech.questionItems) {
      console.log(`    - ${q.title}`);
      console.log(`      質問: ${q.questionSummary}`);
      console.log(`      答弁: ${q.answerSummary}`);
      console.log(`      形式: ${q.questionApproach ?? "未分類"} / 答弁状態: ${q.answerStatus ?? "未分類"}`);
    }
  }

  console.log(`\n分析上の注意:`);
  for (const l of analysis.limitations) console.log(`  - ${l}`);
  process.exit(0);
}

if (mode === "approve" || mode === "reject") {
  if (!memberId) {
    console.error("[review-member-speech-analysis] --member=<memberId> を指定してください。");
    process.exit(1);
  }
  const analysis = findAnalysis(memberId);
  if (!analysis) {
    console.error(`[review-member-speech-analysis] 指定された議員のAI分析は見つかりません: ${memberId}`);
    process.exit(1);
  }

  if (mode === "reject") {
    if (isDryRun) {
      console.log(`[review-member-speech-analysis] ${memberId}: --dry-run のため実際の変更は行いませんでした。`);
      process.exit(0);
    }
    analysis.analysisStatus = "insufficient-data";
    analysis.limitations = [...analysis.limitations, reason ?? "人による確認の結果、分析内容が原文と一致しないため却下されました。"];
    writeJson(dataPath, data);
    console.log(`[review-member-speech-analysis] ${memberId} のAI分析を却下しました。`);
    process.exit(0);
  }

  console.log(`\n[review-member-speech-analysis] ${memberId} の承認前チェック:`);
  const checks = runApprovalChecks(analysis);
  let allOk = true;
  for (const c of checks) {
    console.log(`  ${c.ok ? "OK" : "NG"}  ${c.label}: ${c.detail}`);
    if (!c.ok) allOk = false;
  }
  if (!allOk) {
    console.error(`[review-member-speech-analysis] ${memberId}: 確認に失敗した項目があるため承認しませんでした。`);
    process.exit(1);
  }
  if (isDryRun) {
    console.log(`[review-member-speech-analysis] ${memberId}: --dry-run のため実際の変更は行いませんでした。`);
    process.exit(0);
  }
  analysis.analysisStatus = isPartial ? "partially-verified" : "verified";
  analysis.verifiedAt = todayIso();
  writeJson(dataPath, data);
  console.log(`[review-member-speech-analysis] ${memberId} を承認しました（analysisStatus: ${analysis.analysisStatus}）。`);
  process.exit(0);
}

console.error("[review-member-speech-analysis] --list-pending / --review --member=<id> / --approve --member=<id> / --reject --member=<id> のいずれかを指定してください。");
process.exit(1);
