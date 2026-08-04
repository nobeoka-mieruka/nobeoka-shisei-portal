/**
 * フェーズ10A：自動巡回基盤の型。
 *
 * このフェーズでは実際のHTTP取得・AI解析・差分の自動反映は行わない
 * （src/lib/archiveCrawler.tsはダミー実装）。一般質問・議案・条例・請願・陳情・議員名簿は
 * 既にscripts/sync-council-data.mjs・scripts/fetch-nobeoka-council-documents.mjsが実データ取得を
 * 行っているため、ここでは重複実装せず、ArchiveCrawlerTarget.existingImplementationで参照する。
 */

export type ArchiveCrawlerCategory =
  | "generalQuestion"
  | "bill"
  | "ordinance"
  | "petition"
  | "request"
  | "mayor"
  | "memberRoster"
  | "finance"
  | "population"
  | "fund"
  | "debt"
  | "policy"
  | "theme";

/** 巡回対象1件分の設定（src/data/archiveCrawlerTargets.jsonの1エントリ）。 */
export interface ArchiveCrawlerTarget {
  id: string;
  category: ArchiveCrawlerCategory;
  categoryLabel: string;
  /** 監視対象の公式ページURL。単一ページに集約できない場合や、内部分類で外部ソースが無い場合はnull。 */
  url: string | null;
  /**
   * 既にscripts/配下で実データ取得を行っている場合、そのスクリプトパス。
   * 設定されている対象は、このスクリプト側で新たな取得処理を実装しないこと（重複実装防止）。
   */
  existingImplementation: string | null;
  notes?: string;
}

export type ArchiveCrawlerRunStatus = "ok" | "changed" | "unchanged" | "error" | "skipped";

/** 1対象・1回分の巡回結果。 */
export interface ArchiveCrawlerResult {
  targetId: string;
  status: ArchiveCrawlerRunStatus;
  checkedAt: string;
  /** ダミー実装では常にnull。実装後はページ本文等から算出したハッシュ値を入れる。 */
  contentHash: string | null;
  errorMessage?: string;
}

/** logs/YYYY-MM-DD.json 1件分の形。今回のフェーズでは型のみ（実際のファイル出力は行わない）。 */
export interface ArchiveCrawlerLog {
  runAt: string;
  results: ArchiveCrawlerResult[];
  summary: {
    total: number;
    changed: number;
    unchanged: number;
    errors: number;
    skipped: number;
  };
}

/** 巡回対象ごとの最終状態。 */
export interface ArchiveCrawlerTargetState {
  targetId: string;
  lastCheckedAt: string | null;
  lastSuccessfulAt: string | null;
  lastStatus: ArchiveCrawlerRunStatus | null;
  lastContentHash: string | null;
}

/** src/data/archiveCrawlerState.json全体の形。 */
export interface ArchiveCrawlerState {
  /** 最終巡回日時（結果の成否を問わない）。 */
  lastRunAt: string | null;
  /** 最終正常実行日時（120時間ゲートの起点として使う）。 */
  lastSuccessfulRunAt: string | null;
  targets: ArchiveCrawlerTargetState[];
  /** 直近の巡回対象件数。 */
  totalCount: number;
  /** 直近の巡回で変更ありと判定された件数。 */
  changedCount: number;
  /** 直近の巡回で取得エラーとなった件数。 */
  errorCount: number;
}
