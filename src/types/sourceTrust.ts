/**
 * 出典の信頼レベル（Phase122で「延岡市政アーカイブ」拡張のArchiveSourceRef向けに導入、
 * Phase128でサイト主要データ型（SourceMeta・FinanceSourceMeta・CompensationSourceMeta等）へ
 * 段階的に展開する任意フィールドの型）。
 *
 * 「事実確認状況（verificationStatus等）」が「この事実がこの資料の記載と一致することを
 * 確認したか」を表すのに対し、trustLevelは「この資料自体がどの種類の情報源か」を表す。
 * 両者は独立した軸であり、例えば信頼度の低い資料（NEWS・SOCIAL等）でも記載内容の
 * 事実確認自体はverified足りうる。
 *
 * - PRIMARY: 一次資料（議事録原本、議案書、予算書・決算書、公文書原本、NDL等で閲覧した歴史資料原本等）
 * - OFFICIAL_ARCHIVE: 公的機関が公表・保管する記録（市・市議会・県・総務省等の公式サイト、公式刊行物）
 * - SECONDARY: 編纂・要約された二次資料（辞典類、書籍、Wikipedia等の百科事典サイト）
 * - NEWS: 報道機関の記事
 * - SOCIAL: SNS投稿等の非公式発信
 * - UNVERIFIED: 出典の種別・信頼性を未分類、または資料に到達できず確認不能
 *
 * 既存データへの後方互換のため任意フィールドとし、全件への一括付与は行わず、
 * 新規追加・見直し時にパイロット的に付与する運用とする（詳細はreports/phase119-123-staging/
 * phase122-sources-findings.md、reports/phase125-129-staging/phase128-trustlevel-expansion-report.md参照）。
 *
 * このファイルはimportを持たない共通定義として独立させている（src/types/index.tsと
 * src/types/historicalArchive.tsの双方から参照するため、循環importを避ける目的）。
 * src/types/historicalArchive.tsのArchiveSourceTrustLevelはこの型を re-export したもの。
 */
export type ArchiveSourceTrustLevel =
  | "PRIMARY"
  | "OFFICIAL_ARCHIVE"
  | "SECONDARY"
  | "NEWS"
  | "SOCIAL"
  | "UNVERIFIED";
