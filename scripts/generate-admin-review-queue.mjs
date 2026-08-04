/**
 * 管理者向け「要確認データ」一覧を、既存アーカイブJSONから機械的に集計する。
 * 公開画面（App.tsxのルーティング）からは一切参照しない内部データであり、
 * 内部エラー・技術的な詳細は含めない（利用者向けの日本語説明のみを保存する）。
 *
 * 対象：AI要約未確認、AI分類候補、関連資料候補、出典不足・要確認、低信頼度候補。
 * 人物ID・会派ID・委員会ID未特定は、該当するIDフィールドが存在しないレコードを検出する
 * （委員会マスタ自体が未整備のため、committeeIdは「1件も設定されていない」ことのみ報告する）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readJsonSafe(relPath) {
  try {
    return JSON.parse(readFileSync(join(root, relPath), "utf8"));
  } catch {
    return [];
  }
}

const items = [];
function pushItem(category, sourceEntityType, sourceEntityId, detail, extra = {}) {
  items.push({ category, sourceEntityType, sourceEntityId, detail, ...extra });
}

const LOW_CONFIDENCE_THRESHOLD = 0.5;

// --- AI分類候補・関連資料候補（未確認のもの、低信頼度のもの） ---
for (const c of readJsonSafe("src/data/archiveAiCategoryCandidates.json")) {
  if (c.status !== "candidate" && c.status !== "needsReview") continue;
  pushItem(
    "aiCategoryCandidate",
    c.sourceEntityType,
    c.sourceEntityId,
    `テーマ分類候補「${c.categoryId}」（確信度${c.confidence}）が未確認です`,
    { confidence: c.confidence },
  );
  if (c.confidence < LOW_CONFIDENCE_THRESHOLD) {
    pushItem("lowConfidenceCandidate", c.sourceEntityType, c.sourceEntityId, `分類候補の確信度が低いです（${c.confidence}）`, {
      confidence: c.confidence,
    });
  }
}

for (const r of readJsonSafe("src/data/archiveRelationCandidates.json")) {
  if (r.status !== "candidate" && r.status !== "needsReview") continue;
  pushItem(
    "relationCandidate",
    r.sourceEntityType,
    r.sourceEntityId,
    `${r.targetEntityType}（${r.targetEntityId}）との関連候補「${r.relationType}」（確信度${r.confidence}）が未確認です`,
    { confidence: r.confidence },
  );
  if (r.confidence < LOW_CONFIDENCE_THRESHOLD) {
    pushItem("lowConfidenceCandidate", r.sourceEntityType, r.sourceEntityId, `関連候補の確信度が低いです（${r.confidence}）`, {
      confidence: r.confidence,
    });
  }
}

// --- AI要約未確認 ---
for (const s of readJsonSafe("src/data/archiveAiSummaries.json")) {
  if (s.verificationStatus === "confirmed") continue;
  pushItem("aiSummaryUnreviewed", s.sourceEntityType, s.sourceEntityId, "AI要約が未確認（人によるレビュー待ち）です");
}

// --- 出典不足・要確認、原文変更による再確認対象（sourceRefsのverificationStatus） ---
function scanSourceRefs(entityType, records) {
  for (const r of records) {
    for (const ref of r.sourceRefs ?? []) {
      if (ref.verificationStatus === "needsReview" || ref.verificationStatus === "sourceUnavailable") {
        pushItem(
          "sourceInsufficient",
          entityType,
          r.id,
          `出典「${ref.sourceTitle ?? ref.sourceUrl ?? "資料名未確認"}」の確認状況が「${ref.verificationStatus}」です`,
        );
      }
    }
  }
}
scanSourceRefs("policy", readJsonSafe("src/data/archivePolicies.json"));
scanSourceRefs("councilDocument", readJsonSafe("src/data/archiveCouncilDocuments.json"));
scanSourceRefs("mayor", readJsonSafe("src/data/archiveMayors.json"));
scanSourceRefs("memberProfile", readJsonSafe("src/data/archiveMemberProfiles.json"));

// --- 委員会マスタ未整備の報告（1件のみ集計、個別レコードは列挙しない） ---
const councilDocuments = readJsonSafe("src/data/archiveCouncilDocuments.json");
const withCommittee = councilDocuments.filter((d) => d.committeeId);
if (councilDocuments.length > 0 && withCommittee.length === 0) {
  pushItem(
    "committeeIdMissing",
    "councilDocument",
    "(全件)",
    `委員会マスタが未整備のため、${councilDocuments.length}件すべてでcommitteeIdが未設定です`,
  );
}

// --- 重複候補（同一sourceEntityに対する複数のAI分類候補） ---
const catCandidates = readJsonSafe("src/data/archiveAiCategoryCandidates.json");
const bySource = new Map();
for (const c of catCandidates) {
  const key = `${c.sourceEntityType}:${c.sourceEntityId}`;
  if (!bySource.has(key)) bySource.set(key, []);
  bySource.get(key).push(c);
}
for (const [key, group] of bySource) {
  if (group.length > 1) {
    const [entityType, entityId] = key.split(":");
    pushItem(
      "possibleDuplicateCandidate",
      entityType,
      entityId,
      `同一資料に対して${group.length}件のテーマ分類候補があります（${group.map((g) => g.categoryId).join("、")}）`,
    );
  }
}

// --- AIジョブの要確認・失敗（フェーズ10C） ---
for (const j of readJsonSafe("src/data/archiveAiJobs.json")) {
  if (j.status === "needsReview") {
    pushItem("aiSummaryPending", j.sourceEntityType, j.sourceEntityId, `AIジョブ（${j.jobType}）が要確認です: ${j.lastError ?? "詳細未記録"}`);
  } else if (j.status === "failed") {
    pushItem("aiJobFailed", j.sourceEntityType, j.sourceEntityId, `AIジョブ（${j.jobType}）が失敗しました（${j.attempts}/${j.maxAttempts}回試行）: ${j.lastError ?? "詳細未記録"}`);
  }
}

// --- 人物・固有表現候補が未確認（フェーズ10C） ---
for (const e of readJsonSafe("src/data/archiveEntityExtractionCandidates.json")) {
  if (e.status !== "candidate" && e.status !== "needsReview") continue;
  pushItem(
    "entityExtractionCandidate",
    e.sourceEntityType,
    e.sourceEntityId,
    e.candidateIds.length > 0
      ? `「${e.rawName}」の人物候補（${e.candidateIds.join("、")}）が未確認です`
      : `「${e.rawName}」が既存マスタと一致せず未確認です`,
  );
}

const queue = {
  generatedAt: new Date().toISOString(),
  totalItems: items.length,
  byCategory: Object.fromEntries(
    [...new Set(items.map((i) => i.category))].map((cat) => [cat, items.filter((i) => i.category === cat).length]),
  ),
  items,
};

writeFileSync(join(root, "src/data/adminReviewQueue.json"), `${JSON.stringify(queue, null, 2)}\n`);
console.log(`[generate-admin-review-queue] ${items.length}件の要確認データを集計しました`);
