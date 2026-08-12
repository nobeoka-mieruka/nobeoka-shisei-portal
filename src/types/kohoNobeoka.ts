/**
 * 「広報のべおか」バックナンバー索引（src/data/kohoNobeokaIssues.json）の型。
 *
 * 延岡市公式サイトの広報のべおかPDF版バックナンバーページ
 * （https://www.city.nobeoka.miyazaki.jp/site/koho/1714.html）で取得可能な
 * 号のみを対象とする（2026-08-11時点で2010年4月号〜現在の197号、これ以前の
 * 号は同ページに掲載がなく存在を確認できないため、推測で生成しない）。
 *
 * 個々の記事の内容を引用する際は、この索引のidに加えて、記事タイトル・
 * 掲載ページ・確認した内容を出典（ArchiveSourceRef／SourceMeta）側の
 * notesに個別記録すること。この索引自体は「どの号のPDFがどのURLにあるか」
 * のカタログであり、号ごとの記事内容までは含まない（全197号のページ単位
 * 全文索引化は、資料量・処理時間の観点から本索引の対象外とした。既存データの
 * 欠損（市債・基金・市政年表等）を広報のべおかから補完する際は、発行年月から
 * 掲載号を絞り込んだうえで、都度PDFを取得して該当記事を確認する運用とする）。
 *
 * Phase59（2026-08-12）で、検索可能性インベントリ（テキスト抽出可否）を追加した。
 * 実行環境にはpdftotext（xpdf版）はあるがCJK CMapの一部が読めない。優先テーマの月
 * （1・2・6・7・8・11月）×主要年から39号を抽出しpdftotextで試験実行した結果、
 * 39号全てが画像PDF（本文の大半が画像スキャン）と判定された。
 *
 * Phase64（2026-08-12）で、残り158号すべてを同じ方式で検証し、全197号の判定を
 * 完了した（researchStatus: "not_yet_tested"は0件）。結果、197号全てが画像PDF
 * （imagePdf: true）で、テキスト抽出可能な号は0件だった。URL切れ・取得失敗も0件。
 *
 * Phase65（2026-08-12）で、Windows標準搭載のWinRT API（Windows.Data.Pdf＋
 * Windows.Media.Ocr、tesseract等の追加インストール不要・管理者権限不要）による
 * OCRパイプラインの実現可能性を確認した（詳細はTASKS.md TASK-087参照）。1ページ
 * あたり日本語で数千文字規模の実用的なテキスト抽出に成功したが、197号×平均20ページ
 * 規模の全文OCR処理は本セッションの残り時間では完了できず、次回セッションの
 * 優先候補として記録するに留めた（indexed: falseのまま）。
 *
 * Phase68（2026-08-12）で、上記OCRパイプラインを使い最初のバッチ（14号・176ページ）を
 * 実行した（ocrCompleted: true）。OCR結果は生データのため src/data には含めず、
 * reports/koho-ocr-batch1-performance.json（性能記録）・
 * reports/koho-ocr-keyword-candidates.json（キーワード候補、verificationStatus=raw/candidate/verified）
 * に分離して保存している。indexed（全文検索インデックス）は、OCR結果の量・精度がまだ
 * 不十分なため、この段階ではまだtrueにしていない。
 */
export interface KohoNobeokaIssue {
  /** 例: "koho-2020-06" */
  id: string;
  /** ISO形式の年月（例: "2020-06"）。発行年月であり、掲載されている財政年度・
   * 事業年度とは必ずしも一致しない（例: 2020年6月号に平成30年度決算特集が
   * 載る、等のケースがある）。年度対応は記事ごとに個別確認すること。 */
  issueYearMonth: string;
  title: string;
  pdfUrl: string;
  sourceOrganization: "延岡市";
  /** バックナンバーページの表示から取得したおおよそのファイルサイズ（MB）。参考情報。 */
  fileSizeApproxMb: number | null;
  /** ISO形式。この索引エントリ（号の存在とPDF URL）をサイト運営者がいつ確認したか。 */
  checkedAt: string;
  /** "textExtractable" | "imagePdf" | "untested"。pdftotextでの試験結果、または未検証。 */
  fileType: "textExtractable" | "imagePdf" | "untested";
  /** trueの場合、全文検索インデックスへ追加可能な見込み（今回は未実施）。未検証の号はnull。 */
  textExtractable: boolean | null;
  /** trueの場合、本文の大半が画像スキャンでpdftotextでは実質的な文章を抽出できない。未検証の号はnull。 */
  imagePdf: boolean | null;
  /** trueの場合、OCR（未導入）が無いと内容を確認できない。未検証の号はnull。 */
  ocrRequired: boolean | null;
  /** pdftotextで抽出できた非空白文字数（参考値）。未検証の号はnull。 */
  extractedNonWhitespaceChars: number | null;
  /** CJK CMapエラーにより安全に取得できなかったため、常にnull（今回は未実装）。 */
  pageCount: number | null;
  /** trueの場合、全文検索インデックス（searchIndex.json）へ追加済み。現状は全号false。 */
  indexed: boolean;
  /** "tested_pdftotext_sample" | "not_yet_tested"。 */
  researchStatus: "tested_pdftotext_sample" | "not_yet_tested";
  /** ISO形式。fileType等の検証状況を最後に確認した日。未検証の号はcheckedAtと同じ値。 */
  lastCheckedAt: string;
  /** PDF取得時のHTTPステータスコード。検証済みの号のみ設定（Phase64）。未検証の号は省略可。 */
  httpStatus?: number;
  /** trueの場合、Windows OCR基盤（WinRT）で全ページのOCRを実行済み（Phase68〜）。
   * OCR結果自体（生テキスト・キーワード候補）はreports/koho-ocr-*.jsonで別管理する。
   * 省略時はfalse相当（未実施）として扱う。 */
  ocrCompleted?: boolean;
  /** ocrCompleted=trueの場合の、OCR済みページ数。 */
  ocrPageCount?: number;
}
