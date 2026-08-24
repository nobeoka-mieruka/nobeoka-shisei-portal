/**
 * 自動更新パイプライン（scripts/auto-update/）共通の結果契約。
 * B（一般質問）・C（議案）・D（財政・人口）の各Updaterは、この形に沿ったレポートを
 * reports/auto-update/run-<target>-<timestamp>.json へ書き出す。
 *
 * 型定義はTypeScriptだが、Updater本体は.mjs（Node直接実行、ビルド不要）で実装するため、
 * この型はコンパイル時の契約書として使い、.mjs側ではJSDocコメントで同じ形を守る
 * （scripts/auto-update/core/配下を参照）。
 */

export type AutoUpdateLevel = "GREEN" | "YELLOW" | "RED";

export type AutoUpdateOutcome = "new" | "updated" | "unchanged" | "reconciled" | "removed_candidate" | "error";

/** 1件（1URL・1資料）分の判定結果。 */
export interface AutoUpdateItemResult {
  sourceUrl: string;
  /** 例："一般質問通告書PDF（延岡市議会公式）"。人間が読んで分かる日本語の分類。 */
  sourceType: string;
  sessionId?: string | null;
  outcome: AutoUpdateOutcome;
  lastCheckedAt: string;
  httpStatus: number | null;
  contentHash: string | null;
  /** この判定を行ったUpdaterスクリプトのバージョン識別子（デバッグ・再現性のため）。 */
  parserVersion: string;
  extractionStatus: string;
  validationStatus: "schema_valid" | "schema_invalid";
  validationErrors: string[];
  level: AutoUpdateLevel;
  /** GREEN/YELLOW/RED判定の理由（市民向けではなく開発者向けの説明）。 */
  reason: string;
}

/** 1回の実行（1 target）分のレポート全体。 */
export interface AutoUpdateRunReport {
  target: string;
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  watchedSource?: string;
  baseScriptExitCode: number;
  overallLevel: AutoUpdateLevel;
  summary: {
    detected: number;
    green: number;
    yellow: number;
    red: number;
    error: number;
  };
  entries: AutoUpdateItemResult[];
  /** サーキットブレーカーが発動した場合はtrue（発動時はGREEN自動反映の対象外）。 */
  circuitBreakerTripped: boolean;
  circuitBreakerReason?: string | null;
  note: string;
}

/**
 * target（一般質問／議案／財政／人口等）ごとの「連続正常実行」記録。
 * AUTO_APPLY_GREENを将来ONにする際の判断材料として、
 * reports/auto-update/status.json に保存する。
 */
export interface AutoUpdateStatus {
  target: string;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  /** RED・circuitBreakerTrippedのいずれもない実行が何回連続しているか。 */
  consecutiveSuccessfulRuns: number;
  /** trueになるとGREEN自動反映の「解禁候補」（実際に反映するかはAUTO_APPLY_GREENフラグ次第）。 */
  eligibleForAutoApply: boolean;
}
