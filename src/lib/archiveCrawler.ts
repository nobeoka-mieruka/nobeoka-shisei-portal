/**
 * フェーズ10A・10B：自動巡回基盤の判定ロジック（環境非依存）。
 *
 * このファイルはsrc/lib配下（ブラウザ向けビルドにも含まれうる）のため、Node専用API
 * （node:crypto・実際のHTTP取得）を直接呼び出さない。実際のHTTP取得・SHA-256ハッシュ計算・
 * 既存巡回スクリプト（sync-council-data.mjs・fetch-nobeoka-council-documents.mjs）の
 * レポート読み込みは scripts/run-archive-crawler.mjs（Node実行スクリプト）側で行い、
 * その結果（ハッシュ・HTTPステータス等）をここへ渡して状態遷移を判定する。
 *
 * 一般質問・議案・条例・請願・陳情・議員名簿は既存スクリプトが実データ取得を行っているため、
 * ここでは重複取得しない（対象のexistingImplementationが設定されている場合は常にスキップする）。
 *
 * scripts/run-archive-crawler.mjsは同じ判定ロジックを（TypeScriptを直接importできないNode実行
 * 環境のため）ミラー実装して呼び出す。ロジックを変更する場合は両方を更新すること。
 */
import type {
  ArchiveCrawlerLog,
  ArchiveCrawlerResult,
  ArchiveCrawlerRunStatus,
  ArchiveCrawlerState,
  ArchiveCrawlerTarget,
  ArchiveCrawlerTargetState,
} from "../types/archiveCrawler";

/** 取得結果の要約を集計する（ArchiveCrawlerLog.summary）。 */
export function summarizeResults(results: ArchiveCrawlerResult[]): ArchiveCrawlerLog["summary"] {
  return {
    total: results.length,
    new: results.filter((r) => r.status === "new").length,
    changed: results.filter((r) => r.status === "changed").length,
    unchanged: results.filter((r) => r.status === "unchanged").length,
    possiblyRemoved: results.filter((r) => r.status === "possiblyRemoved").length,
    errors: results.filter((r) => r.status === "error").length,
    skipped: results.filter((r) => r.status === "skipped").length,
  };
}

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

  return { runAt: checkedAt, results, summary: summarizeResults(results) };
}

/**
 * 実際に取得できた場合の状態を、前回のハッシュと比較して判定する。
 * 前回ハッシュが無い（初回確認）場合は"new"、一致すれば"unchanged"、異なれば"changed"。
 */
export function determineFetchStatus(previousHash: string | null, newHash: string): "new" | "changed" | "unchanged" {
  if (previousHash == null) return "new";
  return previousHash === newHash ? "unchanged" : "changed";
}

/**
 * 削除判定：URLに再度アクセスできなかった回数（consecutiveNotFoundCount、今回の404を含む）が
 * 2回以上、かつ代替URLが確認できていない場合のみ「削除候補」として扱う。1回だけの取得失敗では
 * 削除候補にしない（サーバー側の一時的な不調と区別できないため）。
 */
export function shouldFlagAsPossiblyRemoved(consecutiveNotFoundCount: number, hasAlternateUrlCandidate: boolean): boolean {
  return consecutiveNotFoundCount >= 2 && !hasAlternateUrlCandidate;
}

/** 巡回結果を既存stateへマージし、新しいArchiveCrawlerStateを返す（既存stateを直接変更しない）。 */
export function mergeCrawlerState(previous: ArchiveCrawlerState, log: ArchiveCrawlerLog): ArchiveCrawlerState {
  const byId = new Map<string, ArchiveCrawlerTargetState>(previous.targets.map((t) => [t.targetId, t]));

  for (const result of log.results) {
    const prev = byId.get(result.targetId);
    const isFailure: ArchiveCrawlerRunStatus[] = ["error", "possiblyRemoved"];
    const consecutiveNotFoundCount =
      result.status === "possiblyRemoved" || result.status === "error"
        ? (prev?.consecutiveNotFoundCount ?? 0) + 1
        : 0;

    byId.set(result.targetId, {
      targetId: result.targetId,
      lastCheckedAt: result.checkedAt,
      lastSuccessfulAt: isFailure.includes(result.status) ? (prev?.lastSuccessfulAt ?? null) : result.checkedAt,
      lastUpdatedAt: result.status === "new" || result.status === "changed" ? result.checkedAt : (prev?.lastUpdatedAt ?? null),
      lastStatus: result.status,
      lastContentHash: result.contentHash ?? (result.status === "unchanged" ? prev?.lastContentHash ?? null : null),
      consecutiveNotFoundCount,
    });
  }

  const summary = summarizeResults(log.results);
  const hadErrors = summary.errors > 0;

  return {
    lastRunAt: log.runAt,
    lastSuccessfulRunAt: hadErrors ? previous.lastSuccessfulRunAt : log.runAt,
    targets: [...byId.values()],
    totalCount: summary.total,
    changedCount: summary.new + summary.changed,
    removedCount: summary.possiblyRemoved,
    errorCount: summary.errors,
  };
}
