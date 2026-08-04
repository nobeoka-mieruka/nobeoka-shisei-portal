/**
 * フェーズ10A・10B：自動巡回基盤の型。
 *
 * 一般質問・議案・条例・請願・陳情・議員名簿は既にscripts/sync-council-data.mjs・
 * scripts/fetch-nobeoka-council-documents.mjsが実データ取得を行っているため、ここでは
 * 重複取得せず、それぞれの実行結果（reports/配下のレポートJSON）を読み込んで統合する
 * （ArchiveCrawlerTarget.existingImplementationで参照）。
 *
 * 財政・人口・基金は、既存のscripts/lib/city-site-fetch.mjs（許可ドメイン制限・429/403/5xx処理・
 * SHA-256ハッシュ）を使って実際にHTTP取得する（scripts/run-archive-crawler.mjs側）。
 * このファイル（src/lib/archiveCrawler.ts）自体はブラウザ向けビルドにも含まれうるsrc/lib配下のため、
 * Node専用API（node:crypto・実際のHTTP取得）を直接呼び出さず、判定結果を受け取って処理する
 * 環境非依存のロジックのみを持つ。
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

/**
 * new＝前回状態が無く今回初めて確認できた／changed＝前回とハッシュが異なる／
 * unchanged＝前回とハッシュが一致／possiblyRemoved＝2回以上連続で取得できず削除候補
 * （1回の失敗だけでは削除扱いにしない）／error＝取得エラー（404除く。404は初回はnew判定に
 * 使えないため、これもerror扱いとしnotesに記録する）／skipped＝既存実装がある、または
 * 監視対象URLが未確認、または許可ドメイン外のため取得しない。
 */
export type ArchiveCrawlerRunStatus = "new" | "changed" | "unchanged" | "possiblyRemoved" | "error" | "skipped";

/** 1対象・1回分の巡回結果。 */
export interface ArchiveCrawlerResult {
  targetId: string;
  status: ArchiveCrawlerRunStatus;
  checkedAt: string;
  /** 取得した内容のSHA-256ハッシュ。取得しなかった（skipped/error）場合はnull。 */
  contentHash: string | null;
  errorMessage?: string;
  /** HTTPステータスコード（取得できた場合のみ）。 */
  httpStatus?: number;
}

/** logs/YYYY-MM-DD.json 1件分の形。今回のフェーズでも型のみ（実際のファイル出力は行わない）。 */
export interface ArchiveCrawlerLog {
  runAt: string;
  results: ArchiveCrawlerResult[];
  summary: {
    total: number;
    new: number;
    changed: number;
    unchanged: number;
    possiblyRemoved: number;
    errors: number;
    skipped: number;
  };
}

/** 巡回対象ごとの最終状態。 */
export interface ArchiveCrawlerTargetState {
  targetId: string;
  lastCheckedAt: string | null;
  /** 最後にstatus=error以外だった日時（削除判定・120時間ゲートの起点）。 */
  lastSuccessfulAt: string | null;
  /** 最後に内容の変更を確認できた日時（new/changedの最終発生日時）。 */
  lastUpdatedAt: string | null;
  lastStatus: ArchiveCrawlerRunStatus | null;
  lastContentHash: string | null;
  /** 取得できなかった（404等）連続回数。2以上でpossiblyRemoved判定に使う。 */
  consecutiveNotFoundCount: number;
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
  /** 直近の巡回でnew/changedと判定された件数（差分件数）。 */
  changedCount: number;
  /** 直近の巡回でpossiblyRemovedと判定された件数（削除候補件数）。 */
  removedCount: number;
  /** 直近の巡回で取得エラーとなった件数（失敗件数）。 */
  errorCount: number;
}
