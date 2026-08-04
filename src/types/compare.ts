/**
 * `/compare`以下のページで共通利用する型。
 * 比較対象の種類（市長・年度・政策等）によらず、選択肢・出典表示の形を一元管理する。
 * 比較表そのものの列定義は `src/components/finance/FinanceTable.tsx` の
 * `FinanceTableColumn`（compare配下からは `CompareTable` 経由で再利用）を使うため、ここでは重複定義しない。
 */
import type { ArchiveSourceRef } from "./historicalArchive";

/** CompareItemPickerに渡す選択肢1件分。 */
export interface CompareOption {
  id: string;
  label: string;
  sublabel?: string;
}

/**
 * 比較対象1件分の出典・定義注記。CompareSourceNoticeで使用する。
 * 出典が0件の場合は「出典未登録」と表示し、確認不可を0や空欄と混同しない。
 */
export interface CompareSourceNoticeItem {
  /** 比較対象を表すラベル（例：氏名・年度・政策名）。 */
  label: string;
  sourceRefs: ArchiveSourceRef[];
  /** 数値・区分の定義が資料により異なる場合の注記（例：市債残高の区分、基金の合算範囲）。 */
  definitionNote?: string;
  /** 数値の単位（例："円（億円表示）"・"%"）。金額・比率等を扱う場合のみ設定する。 */
  unit?: string;
}
