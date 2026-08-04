/**
 * フェーズ10A：自動巡回基盤（ダミー実装）。
 *
 * ここでのHTTP取得は行わない（runDummyCrawlは常に「スキップ」または「変更なし」を返す）。
 * 対象読込・差分確認・更新判定・削除判定・ログ出力のインターフェースだけを用意し、
 * 実データ取得（フェーズ10B以降）はこの形にそのまま差し込めるようにする。
 *
 * 一般質問・議案・条例・請願・陳情・議員名簿は既にscripts/sync-council-data.mjs・
 * scripts/fetch-nobeoka-council-documents.mjsで実データ取得を行っているため、
 * ここでは重複実装しない（対象のexistingImplementationが設定されている場合は常にスキップする）。
 *
 * CI（.github/workflows/civic-archive-sync.yml）からはscripts/run-archive-crawler.mjsが
 * 同じ判定ロジックを（TypeScriptを直接importできないNode実行環境のため）ミラー実装して呼び出す。
 * ロジックを変更する場合は両方を更新すること。
 */
import type {
  ArchiveCrawlerLog,
  ArchiveCrawlerResult,
  ArchiveCrawlerState,
  ArchiveCrawlerTarget,
  ArchiveCrawlerTargetState,
} from "../types/archiveCrawler";

/**
 * 対象1件分のダミー取得。
 * - 既存実装（existingImplementation）がある対象は、重複取得を避けるため常にスキップする。
 * - 監視対象URLが未確認（null）の対象も、推測でアクセスしないためスキップする。
 * - それ以外は「変更なし」を返す（実際には取得していないため、変更検知はまだできない）。
 */
export function runDummyCrawl(targets: ArchiveCrawlerTarget[], now: Date = new Date()): ArchiveCrawlerLog {
  const checkedAt = now.toISOString();
  const results: ArchiveCrawlerResult[] = targets.map((target) => {
    if (target.existingImplementation) {
      return {
        targetId: target.id,
        status: "skipped",
        checkedAt,
        contentHash: null,
        errorMessage: `既存実装（${target.existingImplementation}）で取得済みのため、このダミー巡回ではスキップしました。`,
      };
    }
    if (!target.url) {
      return {
        targetId: target.id,
        status: "skipped",
        checkedAt,
        contentHash: null,
        errorMessage: "監視対象の公式URLが未確認のためスキップしました。",
      };
    }
    return { targetId: target.id, status: "unchanged", checkedAt, contentHash: null };
  });

  return {
    runAt: checkedAt,
    results,
    summary: {
      total: results.length,
      changed: results.filter((r) => r.status === "changed").length,
      unchanged: results.filter((r) => r.status === "unchanged").length,
      errors: results.filter((r) => r.status === "error").length,
      skipped: results.filter((r) => r.status === "skipped").length,
    },
  };
}

/**
 * 削除判定：URLに再度アクセスできなかった回数（consecutiveNotFoundCount）が2回以上、かつ
 * 代替URLが確認できていない場合のみ「削除候補」として扱う。1回だけの取得失敗では
 * 削除候補にしない（サーバー側の一時的な不調と区別できないため）。
 * ダミー実装では取得失敗自体が発生しないため、この関数は今回のフェーズでは呼び出されない。
 */
export function shouldFlagAsPossiblyRemoved(consecutiveNotFoundCount: number, hasAlternateUrlCandidate: boolean): boolean {
  return consecutiveNotFoundCount >= 2 && !hasAlternateUrlCandidate;
}

/** 巡回結果を既存stateへマージし、新しいArchiveCrawlerStateを返す（既存stateを直接変更しない）。 */
export function mergeCrawlerState(previous: ArchiveCrawlerState, log: ArchiveCrawlerLog): ArchiveCrawlerState {
  const byId = new Map<string, ArchiveCrawlerTargetState>(previous.targets.map((t) => [t.targetId, t]));

  for (const result of log.results) {
    const prev = byId.get(result.targetId);
    byId.set(result.targetId, {
      targetId: result.targetId,
      lastCheckedAt: result.checkedAt,
      lastSuccessfulAt: result.status === "error" ? (prev?.lastSuccessfulAt ?? null) : result.checkedAt,
      lastStatus: result.status,
      lastContentHash: result.contentHash ?? prev?.lastContentHash ?? null,
    });
  }

  const hadErrors = log.summary.errors > 0;

  return {
    lastRunAt: log.runAt,
    lastSuccessfulRunAt: hadErrors ? previous.lastSuccessfulRunAt : log.runAt,
    targets: [...byId.values()],
    totalCount: log.summary.total,
    changedCount: log.summary.changed,
    errorCount: log.summary.errors,
  };
}
