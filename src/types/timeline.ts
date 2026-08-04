/**
 * `/timeline`以下のページで共通利用する型。
 * 市長任期・年度別財政など、出典を持つ「時点の異なるアーカイブデータ」を年表として
 * 横断表示するための共通の形。個々のデータ型（ArchiveMayorTerm・ArchiveFiscalYear等）を
 * 複製せず、表示用に変換した結果だけをこの型で保持する。
 */
import type { ArchiveSourceRef } from "./historicalArchive";

export type ArchiveTimelineEventCategory = "mayorTerm" | "fiscalYear";

/**
 * 年表1件分。日単位の日付が確認できない場合（年度のみ確認等）はdateをnullにし、
 * dateLabelで代替表示する（0や架空の日付で埋めない）。
 */
export interface ArchiveTimelineEvent {
  id: string;
  category: ArchiveTimelineEventCategory;
  /** ISO日付（YYYY-MM-DD）。日単位で確認できない場合はnull。 */
  date: string | null;
  /** 表示用ラベル（例："2026年7月22日" "2024年度"）。dateがnullの場合も必ず設定する。 */
  dateLabel: string;
  /** 並び替え・年度別グルーピングに使う会計年度。 */
  fiscalYear: number;
  title: string;
  description?: string;
  /** クリックで遷移する既存詳細ページへのパス（確認できる場合のみ設定する）。 */
  relatedPath?: string;
  sourceRefs: ArchiveSourceRef[];
}

/** 年表を会計年度単位でまとめたもの。表示側の見出し（年度）を作るために使う。 */
export interface ArchiveTimelineYearGroup {
  fiscalYear: number;
  events: ArchiveTimelineEvent[];
}
