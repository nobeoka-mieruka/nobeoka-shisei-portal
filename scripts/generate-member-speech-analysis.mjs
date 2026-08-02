/**
 * councilSpeechSummaries.json（公開済み・収録対象期間内の発言データ）から、議員ごとの
 * 「AIによる質問内容の分析」を機械的に生成し、src/data/memberSpeechAnalysis.json へ保存する。
 *
 * 重要な方針：
 * - 議員の能力・活動量・優劣・政治思想は一切評価しない。確認できる事実（テーマ・質問形式・
 *   答弁状態・会期数）のみを整理する。
 * - 質問形式（questionApproach）・答弁状態（answerStatus）は、各questionItemに既に人が
 *   原文を読んで設定した値をそのまま集計するだけで、このスクリプト自身が原文を解釈して
 *   新たに分類することはしない（誤分類のリスクを避けるため）。
 * - 生成した分析は必ず analysisStatus: "pending" とし、自動的にverifiedへ変更しない
 *   （人による確認・承認は別途 scripts/review-member-speech-analysis.mjs で行う）。
 * - 継続テーマ（recurringTopics）は、異なる2会期以上で確認できたテーマのみを対象とする。
 * - 新規テーマ（newTopics）は、比較対象となる「以前に解析済みのテーマ」が無い場合は
 *   意味を持たないため、その旨をlimitationsに明記し、空のまま生成する
 *   （存在しない継続性・新規性を断定しないため）。
 *
 * 使い方：
 *   node scripts/generate-member-speech-analysis.mjs
 *   node scripts/generate-member-speech-analysis.mjs --member=m21
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { councilSpeechPeriod } from "./lib/council-speech-period.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const speechPath = join(root, "src", "data", "councilSpeechSummaries.json");
const outPath = join(root, "src", "data", "memberSpeechAnalysis.json");

const args = process.argv.slice(2);
const onlyMemberId = args.find((a) => a.startsWith("--member="))?.split("=")[1];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function formatDateJa(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

function isPublishedAndInPeriod(speech) {
  return speech.isPublished && speech.date && speech.date >= councilSpeechPeriod.from;
}

function aggregateTopics(speeches) {
  const byTopic = new Map();
  for (const speech of speeches) {
    for (const topic of speech.topics ?? []) {
      const entry = byTopic.get(topic) ?? { sessionIds: new Set(), speechIds: new Set() };
      entry.sessionIds.add(speech.sessionId);
      entry.speechIds.add(speech.id);
      byTopic.set(topic, entry);
    }
  }
  return [...byTopic.entries()]
    .map(([topic, { sessionIds, speechIds }]) => ({
      topic,
      sessionCount: sessionIds.size,
      sessionIds: [...sessionIds].sort(),
      speechIds: [...speechIds],
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount || a.topic.localeCompare(b.topic, "ja"));
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = item[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"));
}

function buildOverview({ record, topicAgg, questionApproaches, answerStatusCounts, recurringTopics }) {
  const analyzedSessionCount = record.analyzedSessionCount ?? 0;
  const parts = [];

  if (analyzedSessionCount <= 1) {
    parts.push(
      `${formatDateJa(councilSpeechPeriod.from)}以降の本会議のうち、現在解析済みの${analyzedSessionCount}会期で確認された質問内容を整理しています。データが限られているため、継続的な傾向を示すものではありません。`,
    );
  } else {
    parts.push(`${formatDateJa(councilSpeechPeriod.from)}以降の本会議のうち、現在解析済みの${analyzedSessionCount}会期では、次のような質問が確認されています。`);
  }

  if (topicAgg.length > 0) {
    const topicNames = topicAgg.slice(0, 6).map((t) => t.topic);
    parts.push(`確認された主なテーマは、${topicNames.join("、")}などです。`);
  }

  if (recurringTopics.length > 0) {
    const names = recurringTopics.map((t) => `${t.topic}（${t.sessionCount}会期）`).join("、");
    parts.push(`このうち、${names}は複数の会期で確認されています。`);
  }

  if (questionApproaches.length > 0) {
    parts.push(`質問の取り上げ方としては、${questionApproaches.map((a) => a.label).join("、")}などが確認されています。`);
  }

  if (answerStatusCounts.length > 0) {
    parts.push(`市側からは、${answerStatusCounts.map((a) => `${a.label}${a.count}件`).join("、")}などの答弁が確認されています。`);
  }

  const unanalyzed = record.unfetchedSessionCount ?? 0;
  if (unanalyzed > 0) {
    parts.push(`未解析の${unanalyzed}会期はこの分析に含まれていません。`);
  }

  return parts.join("");
}

function buildLimitations(record) {
  const limitations = [];
  if ((record.unfetchedSessionCount ?? 0) > 0) {
    limitations.push(`未解析の${record.unfetchedSessionCount}会期は分析に含まれていません。`);
  }
  if ((record.sessionsWithoutSpeechCount ?? 0) > 0) {
    limitations.push(`解析済みだが質問・質疑が確認されなかった会期が${record.sessionsWithoutSpeechCount}会期あります。`);
  }
  if ((record.analyzedSessionCount ?? 0) <= 1) {
    limitations.push("解析済みの会期が1会期のみのため、継続テーマ・新規テーマの判定は行っていません（2会期以上のデータが揃い次第、対応します）。");
  }
  const hasPending = record.speeches?.some((s) => s.summaryStatus !== "verified");
  if (hasPending) {
    limitations.push("一部の発言要約は人による最終確認前（AI要約・確認待ち）のため、この分析も暫定的なものです。");
  }
  return limitations;
}

function analyzeMember(record) {
  const speeches = (record.speeches ?? []).filter(isPublishedAndInPeriod);
  if (speeches.length === 0) {
    return {
      memberId: record.memberId,
      analysisPeriod: { from: councilSpeechPeriod.from, to: councilSpeechPeriod.to },
      analyzedSessionCount: record.analyzedSessionCount ?? 0,
      analysisStatus: "not-analyzed",
      generatedAt: null,
      verifiedAt: null,
      overview: "",
      mainTopics: [],
      recurringTopics: [],
      newTopics: [],
      questionApproaches: [],
      answerStatusCounts: [],
      evidenceSpeechIds: [],
      limitations: [],
    };
  }

  const topicAgg = aggregateTopics(speeches);
  const recurringTopicAgg = topicAgg.filter((t) => t.sessionCount >= 2);
  const questionItems = speeches.flatMap((s) => s.questionItems ?? []);

  const toEvidence = (t) => ({
    label: t.topic,
    statement: `${t.topic}について、質問・質疑が確認されています（${t.sessionCount}会期）。`,
    evidenceSpeechIds: t.speechIds,
    sessionIds: t.sessionIds,
  });

  const questionApproaches = countBy(questionItems, "questionApproach");
  const answerStatusCounts = countBy(questionItems, "answerStatus");

  const overview = buildOverview({
    record,
    topicAgg,
    questionApproaches,
    answerStatusCounts,
    recurringTopics: recurringTopicAgg,
  });

  const hasSufficientData = questionItems.length > 0 && questionItems.every((q) => q.questionSummary);

  return {
    memberId: record.memberId,
    analysisPeriod: { from: councilSpeechPeriod.from, to: councilSpeechPeriod.to },
    analyzedSessionCount: record.analyzedSessionCount ?? 0,
    analysisStatus: hasSufficientData ? "pending" : "insufficient-data",
    generatedAt: todayIso(),
    verifiedAt: null,
    overview,
    mainTopics: topicAgg.map(toEvidence),
    recurringTopics: recurringTopicAgg.map(toEvidence),
    // 比較対象となる「以前に解析済みのテーマ」がまだ存在しないため、現時点では生成しない
    // （limitationsに理由を明記する）。
    newTopics: [],
    questionApproaches,
    answerStatusCounts,
    evidenceSpeechIds: speeches.map((s) => s.id),
    limitations: buildLimitations(record),
  };
}

function main() {
  const speechData = readJson(speechPath);
  const existing = existsSync(outPath) ? readJson(outPath) : { version: 1, generatedAt: null, members: [] };
  const existingById = new Map(existing.members.map((m) => [m.memberId, m]));

  let updated = 0;
  const nextMembers = [];
  for (const record of speechData.members) {
    if (onlyMemberId && record.memberId !== onlyMemberId) {
      const prev = existingById.get(record.memberId);
      if (prev) nextMembers.push(prev);
      continue;
    }
    const prev = existingById.get(record.memberId);
    // 人が確認済み（verified/partially-verified）の分析は、明示的な再生成指示がない限り上書きしない。
    if (prev && (prev.analysisStatus === "verified" || prev.analysisStatus === "partially-verified")) {
      nextMembers.push(prev);
      continue;
    }
    const analysis = analyzeMember(record);
    if (prev && JSON.stringify({ ...prev, generatedAt: null }) === JSON.stringify({ ...analysis, generatedAt: null })) {
      nextMembers.push(prev);
      continue;
    }
    nextMembers.push(analysis);
    updated++;
  }

  console.log(`[generate-member-speech-analysis] 対象議員: ${nextMembers.length}名 / 更新: ${updated}件`);
  const result = { version: 1, generatedAt: updated > 0 ? todayIso() : existing.generatedAt, members: nextMembers };
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`[generate-member-speech-analysis] ${outPath} を更新しました。`);
}

main();
