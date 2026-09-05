import type { SourceEntry } from "./index";
import type { ArchiveSourceTrustLevel } from "./sourceTrust";

/**
 * パブリックコメント（意見募集）1件の状態（Phase239で新設）。
 *
 * **重要（推測禁止）**: この値は募集期間の日付から自動で決めない。
 * 延岡市公式ホームページ「延岡市政策等の形成過程における市民等参加条例（パブリックコメント条例）
 * 運用状況」（https://www.city.nobeoka.miyazaki.jp/soshiki/6/1699.html）が
 * 案件をどの見出しの下に掲載しているかを、そのまま転記する。
 * 締切日を過ぎているように見えても、市の公表区分が変わるまでこの値は変えない
 * （市が区分を更新するまでは、実際に募集が続いている場合があるため）。
 *
 * 併せて、ビルド時刻に依存した表示（プリレンダリング済みHTMLへの日付の焼き付き）を避けるため、
 * 画面側でも状態を日付から算出しない。閲覧日に依存する補足を出す場合は
 * `useTodayJst()`（src/hooks/useTodayJst.ts）でハイドレーション完了後にだけ表示する。
 *
 * - `planned`: 意見募集予定の案件
 * - `open`: 意見募集中の案件
 * - `closed-preparing-result`: 意見募集を終了した案件（結果準備中）
 * - `result-published`: 意見募集を終了した案件（結果公表済み）
 * - `not-conducted`: 意見募集をしなかった案件（条例の適用除外）
 */
export type PublicCommentStatus =
  | "planned"
  | "open"
  | "closed-preparing-result"
  | "result-published"
  | "not-conducted";

/**
 * 延岡市が実施したパブリックコメント（意見募集）1件分（src/data/publicComments.json）。
 *
 * 延岡市政策等の形成過程における市民等参加条例（パブリックコメント条例）に基づく手続きのうち、
 * 延岡市公式ホームページの「運用状況」一覧に掲載されている案件を、年度単位で整理する。
 * 市議会の議案（billVotes.json）や市長公約（mayorPromises.json）とは別管理とし、
 * 意見の内容や市の考え方の本文は転載せず、公式ページ・公式PDFへのリンクで案内する。
 *
 * **結果に関する数値は、市が結果を公表した案件にだけ設定する。**
 * 未公表を 0 と書かない（0人・0件は「意見が寄せられなかったことを市が公表した」場合にだけ使う）。
 */
export interface PublicComment {
  id: string;
  /** 案件名（公式ページの表記をそのまま使う）。 */
  title: string;
  /** 所管課（公式ページの問い合わせ先の表記）。 */
  department: string;
  /** 意見募集の開始日（ISO形式）。 */
  startDate: string;
  /** 意見募集の終了日（ISO形式）。 */
  endDate: string;
  /** 市の公表区分。日付から推定しない（PublicCommentStatusの説明を参照）。 */
  status: PublicCommentStatus;
  /** 案件を掲載している延岡市公式ページのURL。 */
  officialUrl: string;
  /** 意見募集の対象となった資料（案・素案等）のURL。 */
  documentUrls: string[];
  /**
   * 結果（提出された意見と市の考え方）を掲載しているページまたは資料のURL。
   * 結果が公表されていない場合はnull（推測で埋めない）。
   */
  resultUrl: string | null;
  /** 意見の提出者数。市が結果を公表した場合のみ設定する。未公表はnull（0にしない）。 */
  submitterCount: number | null;
  /** 提出された意見の件数。市が結果を公表した場合のみ設定する。未公表はnull（0にしない）。 */
  opinionCount: number | null;
  /** 補足（公式ページに記載された経緯・関連する審議会等）。確認できた範囲のみ。 */
  note?: string;
  /** 実施主体。延岡市以外の団体の意見募集は登録しない。 */
  sourceOrganization: string;
  trustLevel: ArchiveSourceTrustLevel;
  sourceRefs: SourceEntry[];
  /** 公式ページに表示されている更新日（ISO形式）。当サイトの確認日とは区別する。 */
  sourcePageUpdatedAt: string | null;
  /** 当サイトで公式ページを最後に確認した日（ISO形式）。 */
  lastVerifiedAt: string;
}

/** src/data/publicComments.jsonの構造。 */
export interface PublicCommentDataset {
  /** データの位置づけ・収録範囲の説明。 */
  note: string;
  /** 収録対象としている年度（例：["令和8年度"]）。 */
  coveredFiscalYears: string[];
  /** 市の「運用状況」一覧ページ（状態の根拠）。 */
  statusSource: SourceEntry;
  /** 「運用状況」一覧ページに表示されている更新日（ISO形式）。 */
  statusSourceUpdatedAt: string;
  /** 当サイトで「運用状況」一覧ページを最後に確認した日（ISO形式）。 */
  lastVerifiedAt: string;
  entries: PublicComment[];
}
