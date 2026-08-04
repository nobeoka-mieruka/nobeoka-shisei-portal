/**
 * フェーズ10C：AI処理対象候補の作成・ルールベース候補生成・AI要約要求の管理。
 *
 * src/lib/ai/archiveAiProcessor.ts（TypeScript）と同じ判定ロジックをここでミラー実装している
 * （このプロジェクトのscripts/配下は他ファイルと同様、ビルド前のTypeScriptを直接importできない
 * ため）。ロジックを変更する場合は両方を更新すること。
 *
 * 重複実装を避けるための整理：
 * - テーマ分類候補・関連資料候補の生成ロジックは scripts/lib/theme-candidates-generator.mjs
 *   （フェーズ8のscripts/generate-theme-candidates.mjsから切り出し、共用）をそのまま使う。
 *   このスクリプトが新たにキーワード分類ロジックを実装することはない。
 * - このスクリプトの役割は「どの資料をいつ・どのジョブ種別で（再）処理すべきか」を
 *   archiveAiJobs.jsonで追跡することであり、テーマ分類候補・関連資料候補ファイル自体の
 *   生成は上記の既存ロジックに委譲する。
 *
 * 実行モード：
 * - dry-run（既定）：対象件数・生成予定ジョブ数を表示するのみ。ファイルは一切更新しない。
 * - rule-based：キーワード辞書によるテーマ分類候補・関連資料候補・人物候補を生成する。
 *   外部AI APIは呼ばない。AI要約ジョブは"needsReview"のまま（要約の生成はできないため）。
 * - ai-enabled：ARCHIVE_AI_ENABLED=true かつ ARCHIVE_AI_API_KEY が設定されている場合のみ、
 *   AI要約の生成を試みる。現時点では実際の外部プロバイダー接続は未実装のため、
 *   常に"skipped"として記録する（有料APIを無断で呼び出さないため）。
 *   rule-based分の処理（テーマ分類・関連資料・人物候補）はai-enabledでも実行する。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateThemeCandidates } from "./lib/theme-candidates-generator.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}
function readJsonSafe(relPath, fallback = []) {
  try {
    return readJson(relPath);
  } catch (e) {
    if (e?.code === "ENOENT") return fallback;
    throw e;
  }
}
function writeJson(relPath, data) {
  writeFileSync(join(root, relPath), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
function sha256OfText(text) {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

// --- 引数・環境変数 ---
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
const mode = argValue("mode", "dry-run"); // dry-run | rule-based | ai-enabled
const target = argValue("target", "all"); // all | council | policies | finance | people
const isDryRun = mode === "dry-run";

const aiEnabledEnv = process.env.ARCHIVE_AI_ENABLED === "true";
const aiApiKeySet = Boolean(process.env.ARCHIVE_AI_API_KEY);
const aiProvider = process.env.ARCHIVE_AI_PROVIDER || "(未設定)";
const aiModel = process.env.ARCHIVE_AI_MODEL || "(未設定)";

let aiAvailable = false;
let aiUnavailableReason = "";
if (mode === "ai-enabled") {
  if (!aiEnabledEnv) {
    aiUnavailableReason = "ARCHIVE_AI_ENABLEDがtrueに設定されていません。";
  } else if (!aiApiKeySet) {
    aiUnavailableReason = "ARCHIVE_AI_API_KEYが設定されていません。";
  } else {
    // フェーズ10Cでは実際の外部AIプロバイダー接続を実装していない（有料APIを無断で呼び出さないため）。
    aiUnavailableReason = "AIプロバイダーの実装が未接続です（フェーズ10Cでは外部AI APIの実呼び出しを行っていません）。";
  }
}

console.log(`[ai-processor] mode=${mode} target=${target}`);
if (mode === "ai-enabled") {
  console.log(`[ai-processor] AI設定: enabled=${aiEnabledEnv} apiKeySet=${aiApiKeySet} provider=${aiProvider} model=${aiModel}`);
  if (!aiAvailable) console.log(`[ai-processor] AI要約は実行しません: ${aiUnavailableReason}`);
}

// --- 判定ロジック（src/lib/ai/archiveAiProcessor.tsのミラー） ---
function isEligibleForAiProcessing(candidate) {
  if (["unchanged", "error", "skipped", "possiblyRemoved"].includes(candidate.crawlStatus)) return false;
  if (candidate.text.trim().length === 0) return false;
  if (candidate.verificationStatus === "sourceUnavailable") return false;
  if (candidate.ocrPending) return false;
  if (candidate.containsPrivateIndividualInfo) return false;
  return true;
}
function filterUnprocessedJobRequests(requests, existingJobs) {
  const existingKeys = new Set(existingJobs.map((j) => `${j.sourceEntityId}::${j.jobType}::${j.sourceTextHash}`));
  return requests.filter((r) => r.candidate.forceReprocess || !existingKeys.has(`${r.candidate.sourceEntityId}::${r.jobType}::${r.sourceTextHash}`));
}
let jobSeq = 0;
function buildPendingJob(request, now) {
  jobSeq += 1;
  return {
    id: `aijob-${now.replace(/[^0-9]/g, "").slice(0, 14)}-${String(jobSeq).padStart(4, "0")}`,
    sourceEntityType: request.candidate.sourceEntityType,
    sourceEntityId: request.candidate.sourceEntityId,
    jobType: request.jobType,
    sourceTextHash: request.sourceTextHash,
    status: "pending",
    priority: 0,
    attempts: 0,
    maxAttempts: 3,
    createdAt: now,
  };
}
function completeJob(job, now, resultId, verificationStatus) {
  return { ...job, status: "completed", attempts: job.attempts + 1, startedAt: job.startedAt ?? now, completedAt: now, resultId, verificationStatus };
}
function failOrSkipJob(job, now, status, errorMessage) {
  return { ...job, status, attempts: job.attempts + 1, startedAt: job.startedAt ?? now, completedAt: now, lastError: errorMessage };
}

// --- 対象資料の収集 ---
const archivePolicies = readJsonSafe("src/data/archivePolicies.json");
const archiveCouncilDocuments = readJsonSafe("src/data/archiveCouncilDocuments.json");
const archivePolicyCategories = readJsonSafe("src/data/archivePolicyCategories.json");
const members = readJsonSafe("src/data/members.json");
const formerMembers = readJsonSafe("src/data/formerMembers.json");
const archiveMayors = readJsonSafe("src/data/archiveMayors.json");
const factions = readJsonSafe("src/data/factions.json");

function collectCandidates() {
  const candidates = [];
  if (target === "all" || target === "policies") {
    for (const p of archivePolicies) {
      candidates.push({
        sourceEntityType: "policy",
        sourceEntityId: p.id,
        text: [p.title, p.summary].filter(Boolean).join(" "),
        // 政策は現時点で自動巡回の対象外（archiveCrawlerTargets.jsonのpolicy.url=null）のため、
        // crawlStatusは"unknown"とし、原文ハッシュの差分（ジョブの重複防止判定）のみで
        // 新規・更新を判断する。
        crawlStatus: "unknown",
        verificationStatus: p.sourceRefs?.[0]?.verificationStatus,
      });
    }
  }
  if (target === "all" || target === "council") {
    for (const d of archiveCouncilDocuments) {
      candidates.push({
        sourceEntityType: d.documentType,
        sourceEntityId: d.id,
        text: [d.title, d.summary].filter(Boolean).join(" "),
        crawlStatus: "unknown",
        verificationStatus: d.verificationStatus,
      });
    }
  }
  if (target === "finance" || target === "people") {
    console.log(`[ai-processor] target="${target}"は、既存の参照整合性チェック対象（archivePolicies/archiveCouncilDocuments）に対応するAI処理対象がまだ無いため、0件です。`);
  }
  return candidates;
}

const knownEntities = [
  ...members.map((m) => ({ id: m.id, name: m.name })),
  ...formerMembers.map((m) => ({ id: m.id, name: m.name })),
  ...archiveMayors.map((m) => ({ id: m.id, name: m.name })),
  ...factions.map((f) => ({ id: f.id, name: f.name })),
];

/** 既存マスタの名前が本文に含まれるかどうかの単純一致（ルールベース、推測でIDを割り当てない）。 */
function extractEntitiesRuleBased(text) {
  const matched = [];
  for (const entity of knownEntities) {
    if (entity.name && text.includes(entity.name)) matched.push(entity);
  }
  return matched;
}

const now = new Date().toISOString();
const existingJobs = readJsonSafe("src/data/archiveAiJobs.json");
const JOB_TYPES = ["summary", "categoryClassification", "relationCandidate", "entityExtraction"];

const candidates = collectCandidates().map((c) => ({ ...c, sourceTextHash: sha256OfText(c.text) }));
const eligible = candidates.filter(isEligibleForAiProcessing);

const requests = eligible.flatMap((candidate) => JOB_TYPES.map((jobType) => ({ candidate, jobType, sourceTextHash: candidate.sourceTextHash })));
const newRequests = filterUnprocessedJobRequests(requests, existingJobs);

console.log(
  `[ai-processor] 資料候補: ${candidates.length}件（対象外除外後: ${eligible.length}件）／新規ジョブ候補: ${newRequests.length}件（既存ジョブ: ${existingJobs.length}件）`,
);

if (isDryRun) {
  const byType = Object.fromEntries(JOB_TYPES.map((t) => [t, newRequests.filter((r) => r.jobType === t).length]));
  console.log(`[ai-processor] dry-run: ジョブ種別ごとの生成予定件数: ${JSON.stringify(byType)}`);
  console.log("[ai-processor] dry-runのため、ファイルは更新していません。");
  writeSummary({ mode, target, candidateCount: candidates.length, eligibleCount: eligible.length, newJobCount: newRequests.length, completed: 0, needsReview: 0, failed: 0, skipped: 0 });
  process.exit(0);
}

// --- 新規ジョブの発行 ---
let jobs = [...existingJobs];
const pendingByType = { summary: [], categoryClassification: [], relationCandidate: [], entityExtraction: [] };
for (const request of newRequests) {
  const job = buildPendingJob(request, now);
  jobs.push(job);
  pendingByType[request.jobType].push({ job, candidate: request.candidate });
}

let entityExtractionCandidates = readJsonSafe("src/data/archiveEntityExtractionCandidates.json");
let entityExtractionSeq = entityExtractionCandidates.length + 1;

// --- ルールベース：テーマ分類候補・関連資料候補（既存ロジックへ委譲、重複実装しない） ---
if (pendingByType.categoryClassification.length > 0 || pendingByType.relationCandidate.length > 0) {
  const { categoryCandidates, relationCandidates } = generateThemeCandidates({
    categories: archivePolicyCategories,
    policies: archivePolicies,
    councilDocuments: archiveCouncilDocuments,
    now,
  });
  writeJson("src/data/archiveAiCategoryCandidates.json", categoryCandidates);
  writeJson("src/data/archiveRelationCandidates.json", relationCandidates);

  for (const { job, candidate } of pendingByType.categoryClassification) {
    const matches = categoryCandidates.filter((c) => c.sourceEntityType === candidate.sourceEntityType && c.sourceEntityId === candidate.sourceEntityId);
    const idx = jobs.indexOf(job);
    jobs[idx] = completeJob(job, now, matches[0]?.id, "candidate");
  }
  for (const { job, candidate } of pendingByType.relationCandidate) {
    const matches = relationCandidates.filter((r) => r.sourceEntityType === candidate.sourceEntityType && r.sourceEntityId === candidate.sourceEntityId);
    const idx = jobs.indexOf(job);
    jobs[idx] = completeJob(job, now, matches[0]?.id, "candidate");
  }
  console.log(`[ai-processor] テーマ分類候補・関連資料候補を再生成しました（既存ロジックscripts/lib/theme-candidates-generator.mjsを再利用）。`);
}

// --- ルールベース：人物・固有表現候補 ---
for (const { job, candidate } of pendingByType.entityExtraction) {
  const matched = extractEntitiesRuleBased(candidate.text);
  const idx = jobs.indexOf(job);
  if (matched.length === 0) {
    jobs[idx] = completeJob(job, now, undefined, "candidate");
    continue;
  }
  const entry = {
    id: `entcand-${String(entityExtractionSeq++).padStart(4, "0")}`,
    sourceEntityType: candidate.sourceEntityType,
    sourceEntityId: candidate.sourceEntityId,
    rawName: matched.map((m) => m.name).join("、"),
    candidateIds: matched.map((m) => m.id),
    needsReview: true,
    method: "ruleBased",
    generatedAt: now,
    status: "candidate",
  };
  entityExtractionCandidates.push(entry);
  jobs[idx] = completeJob(job, now, entry.id, "candidate");
}
if (pendingByType.entityExtraction.length > 0) {
  writeJson("src/data/archiveEntityExtractionCandidates.json", entityExtractionCandidates);
}

// --- AI要約：rule-basedでは生成できない。ai-enabledでも今回は未接続のため常にskip/needsReview。 ---
for (const { job } of pendingByType.summary) {
  const idx = jobs.indexOf(job);
  if (mode === "ai-enabled") {
    jobs[idx] = failOrSkipJob(job, now, "skipped", aiUnavailableReason);
  } else {
    jobs[idx] = failOrSkipJob(job, now, "needsReview", "ルールベースでは要約を生成できません（人による要約作成、または将来のAI有効化を待っています）。");
  }
}

writeJson("src/data/archiveAiJobs.json", jobs);

const newJobResults = jobs.filter((j) => newRequests.some((r) => r.candidate.sourceEntityId === j.sourceEntityId && r.jobType === j.jobType && r.sourceTextHash === j.sourceTextHash));
const counts = {
  completed: newJobResults.filter((j) => j.status === "completed").length,
  needsReview: newJobResults.filter((j) => j.status === "needsReview").length,
  failed: newJobResults.filter((j) => j.status === "failed").length,
  skipped: newJobResults.filter((j) => j.status === "skipped").length,
};

console.log(
  `[ai-processor] ジョブ${newRequests.length}件を処理しました（完了${counts.completed}／要確認${counts.needsReview}／失敗${counts.failed}／スキップ${counts.skipped}）。`,
);

writeSummary({ mode, target, candidateCount: candidates.length, eligibleCount: eligible.length, newJobCount: newRequests.length, ...counts });

function writeSummary(info) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const lines = [
    "## AI処理候補（フェーズ10C）",
    "",
    `- モード: ${info.mode} / 対象: ${info.target}`,
    `- 資料候補: ${info.candidateCount}件（対象外除外後: ${info.eligibleCount}件）`,
    `- 新規ジョブ: ${info.newJobCount}件（完了${info.completed}／要確認${info.needsReview}／失敗${info.failed}／スキップ${info.skipped}）`,
    mode === "ai-enabled" ? `- AI要約: ${aiAvailable ? "実行" : `未実行（${aiUnavailableReason}）`}` : "- AI要約: 未実行（rule-based/dry-runモードのため）",
    "",
  ];
  writeFileSync(summaryPath, `${lines.join("\n")}\n`, { flag: "a" });
}
