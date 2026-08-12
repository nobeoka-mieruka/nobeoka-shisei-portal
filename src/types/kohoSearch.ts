/**
 * 広報のべおかOCR全文検索の索引1件分（src/data/kohoOcrSearchIndex.json）。
 *
 * Windows OCR基盤（WinRT）で文字起こしした広報のべおかのテキストから、
 * あらかじめ定めたキーワードでヒットした箇所を抽出したもの。OCR結果そのものは
 * 未確認情報であり、verificationStatus="verified"（元PDF画像と目視照合済み）の
 * 一部を除き、内容の正確性は保証されない。
 *
 * この索引はページ単位・キーワード単位で集約済みであり、ページ全文は含まない
 * （生のOCRテキストは大量・低品質のためサイトには含めない方針。詳細は
 * reports/koho-ocr-*.json、およびTASKS.md/CLAUDE.mdの運用方針を参照）。
 */
export interface KohoOcrSearchEntry {
  /** 広報のべおかの号id（例: "koho-2018-11"）。 */
  issueId: string;
  /** 発行年月（ISO形式、例: "2018-11"）。未確認の場合はnull。 */
  issueDate: string | null;
  /** 元PDFのURL。未確認の場合はnull。 */
  sourcePdf: string | null;
  /** ヒットしたページ番号（PDF内の1始まりページ番号）。 */
  page: number;
  keyword: string;
  category: "mayorPolitics" | "councilElection" | "finance" | "cityAdmin";
  /** OCRテキストからのキーワード周辺の抜粋（前後20文字程度、空白除去済み）。 */
  context: string;
  /** 同一ページ内での当該キーワードの出現回数。 */
  occurrences: number;
  /** ページ単位の抽出信頼度（キーワードの特異性・共起状況から機械的に判定）。 */
  confidence: "HIGH" | "MEDIUM";
  /** "verified" = 元PDF画像と目視照合済み。"raw" = OCR結果そのまま（未照合）。 */
  verificationStatus: "verified" | "raw";
}
