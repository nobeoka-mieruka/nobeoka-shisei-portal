/**
 * フェーズ10C：AI処理ジョブの判定ロジック（環境非依存）。
 *
 * このファイルはsrc/lib配下（ブラウザ向けビルドにも含まれうる）のため、Node専用API
 * （node:crypto・実際のファイル読み書き・外部AI API呼び出し）を直接呼び出さない。
 * 原文のハッシュ計算・ジョブのファイルへの反映は scripts/run-archive-ai-processor.mjs
 * （Node実行スクリプト）側で行い、その結果をここへ渡して判定する。
 *
 * scripts/run-archive-ai-processor.mjsは同じ判定ロジックを（TypeScriptを直接importできない
 * Node実行環境のため）ミラー実装して呼び出す。ロジックを変更する場合は両方を更新すること。
 */
import type { ArchiveAiJob, ArchiveAiJobType, ArchiveSearchDocumentType, ArchiveVerificationStatus } from "../../types/historicalArchive";

/** 自動巡回・既存データから見た「AI処理対象になりうる資料」1件分。 */
export interface AiProcessingCandidate {
  sourceEntityType: ArchiveSearchDocumentType;
  sourceEntityId: string;
  /** 要約・分類の対象となる本文（タイトル＋概要等）。 */
  text: string;
  /** 自動巡回・データ生成側での取得結果ステータス。 */
  crawlStatus: "new" | "changed" | "unchanged" | "error" | "skipped" | "possiblyRemoved" | "unknown";
  /** 公式データ自体の確認状況。sourceUnavailableの場合はAI処理対象外。 */
  verificationStatus?: ArchiveVerificationStatus;
  /** OCR結果の確認待ちである場合はtrue。 */
  ocrPending?: boolean;
  /** 私人の個人情報を含む可能性があり要確認の場合はtrue。 */
  containsPrivateIndividualInfo?: boolean;
  /** 人による再解析指定。trueの場合、同一ハッシュでも重複防止をバイパスして新しいジョブを作る。 */
  forceReprocess?: boolean;
}

/**
 * AI処理対象として適格かどうかを判定する。
 * 変更なし・取得失敗・原文が空・OCR確認待ち・sourceUnavailable・私人情報要確認の資料は対象外。
 */
export function isEligibleForAiProcessing(candidate: AiProcessingCandidate): boolean {
  if (candidate.crawlStatus === "unchanged" || candidate.crawlStatus === "error" || candidate.crawlStatus === "skipped" || candidate.crawlStatus === "possiblyRemoved") {
    return false;
  }
  if (candidate.text.trim().length === 0) return false;
  if (candidate.verificationStatus === "sourceUnavailable") return false;
  if (candidate.ocrPending) return false;
  if (candidate.containsPrivateIndividualInfo) return false;
  return true;
}

/** ArchiveAiJob 1件分の新規発行に必要な最小情報。 */
export interface JobRequest {
  candidate: AiProcessingCandidate;
  jobType: ArchiveAiJobType;
  sourceTextHash: string;
}

/**
 * 既存ジョブと照合し、まだ処理されていない（同一sourceEntityId・jobType・sourceTextHashの
 * ジョブが存在しない）ものだけを返す。forceReprocess=trueの候補は常に対象に含める。
 */
export function filterUnprocessedJobRequests(requests: JobRequest[], existingJobs: ArchiveAiJob[]): JobRequest[] {
  const existingKeys = new Set(existingJobs.map((j) => `${j.sourceEntityId}::${j.jobType}::${j.sourceTextHash}`));
  return requests.filter((r) => {
    if (r.candidate.forceReprocess) return true;
    return !existingKeys.has(`${r.candidate.sourceEntityId}::${r.jobType}::${r.sourceTextHash}`);
  });
}

let jobSeq = 0;

/** テスト・複数回実行での採番の再現性のため、連番をリセットする（CIスクリプト側で実行のたびに呼ぶ）。 */
export function resetJobIdSequence(startAt = 0): void {
  jobSeq = startAt;
}

/** 新規ジョブ（status="pending"）を1件組み立てる。 */
export function buildPendingJob(request: JobRequest, now: string, options: { priority?: number; maxAttempts?: number } = {}): ArchiveAiJob {
  jobSeq += 1;
  return {
    id: `aijob-${now.replace(/[^0-9]/g, "").slice(0, 14)}-${String(jobSeq).padStart(4, "0")}`,
    sourceEntityType: request.candidate.sourceEntityType,
    sourceEntityId: request.candidate.sourceEntityId,
    jobType: request.jobType,
    sourceTextHash: request.sourceTextHash,
    status: "pending",
    priority: options.priority ?? 0,
    attempts: 0,
    maxAttempts: options.maxAttempts ?? 3,
    createdAt: now,
  };
}

/** ジョブを完了状態へ遷移させる（結果のIDと確認状況を記録する）。既存のジョブオブジェクトは変更せず新しいオブジェクトを返す。 */
export function completeJob(job: ArchiveAiJob, now: string, resultId: string, verificationStatus: ArchiveAiJob["verificationStatus"]): ArchiveAiJob {
  return { ...job, status: "completed", attempts: job.attempts + 1, startedAt: job.startedAt ?? now, completedAt: now, resultId, verificationStatus };
}

/** ジョブを失敗・スキップ状態へ遷移させる。attemptsがmaxAttempts以上に達した場合はstatusを"failed"のまま維持する（自動リトライしない）。 */
export function failOrSkipJob(job: ArchiveAiJob, now: string, status: "failed" | "skipped", errorMessage: string): ArchiveAiJob {
  return { ...job, status, attempts: job.attempts + 1, startedAt: job.startedAt ?? now, completedAt: now, lastError: errorMessage };
}
