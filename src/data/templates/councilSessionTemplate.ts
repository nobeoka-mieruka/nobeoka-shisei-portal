/**
 * 定例会・議会資料を追加するときのコピー用テンプレート。
 *
 * 使い方：
 * 1. このファイルの `councilSessionTemplate` の中身をコピーする
 * 2. src/data/councilSessions.json の配列の中に、コピーした内容をJSON形式で貼り付ける
 *    （このファイル自体はビルドに含まれません。コピー元として参照するだけです）
 * 3. 実際に確認できた内容だけを入力し、確認できていない項目は書かない（キーごと省略する）
 *
 * 詳しい手順は docs/council-document-registration.md を参照してください。
 */
import type { CouncilDocument, CouncilSession } from "../../types";

/** 資料（PDF）1件分のテンプレート。 */
export const councilDocumentTemplate: CouncilDocument = {
  // 資料ID（session.id + 資料の種類など、サイト内で一意な文字列）
  id: "2026-06-results",
  // proposals(議案) / results(審議結果) / petitions(請願・陳情) /
  // statements(意見書・決議) / minutes(会議録) / newsletters(市議会だより) / other(その他)
  category: "results",
  // 資料名（公式資料の表記のとおり）
  title: "議案等審議結果",
  // 資料の説明（任意）
  description: "",
  // "local"：public/council-documents/配下にPDFを保存して表示する
  // "external"：サイト内に複製せず、公式サイトのURL（sourceUrl）のみを案内する
  //   公開可否が確認できない資料は必ず"external"にする
  storageType: "external",
  // storageType="local"の場合のみ入力。/council-documents/配下のパス
  // 例: "/council-documents/2026/2026-06/results/deliberation-results.pdf"
  filePath: undefined,
  fileType: "PDF",
  // 延岡市議会・延岡市公式サイト上の元の資料URL（storageTypeによらず、分かる場合は必ず入力する）
  sourceUrl: "https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/00000.pdf",
  // 公式サイトでの公開日（確認できた場合のみ、"YYYY-MM-DD"）
  publishedDate: undefined,
  // ページ数（確認できた場合のみ。分からない場合はnullまたは省略）
  pages: null,
  // ファイルサイズ（確認できた場合のみ、例: "1.2MB"）
  fileSize: undefined,
  // この資料の内容・公開状況を確認した日（"YYYY-MM-DD"）
  verifiedAt: "2026-08-02",
  // 延岡市・延岡市議会が公開した公式資料かどうか
  isOfficial: true,
  notes: undefined,
};

/** 定例会・臨時会1件分のテンプレート。 */
export const councilSessionTemplate: CouncilSession = {
  // ID：西暦-月（例: "2026-06"）。臨時会は末尾に"-extraordinary"を付け、
  // 同じ月に複数の臨時会がある場合は"-01" "-02"のように連番を付ける
  id: "2026-06",
  // 開催年（西暦）。会期が属する暦年（例：令和8年3月定例会なら2026）
  year: 2026,
  // 年度（西暦、4月始まり）。フォルダ分類・一覧ページの年度別グルーピングに使う
  fiscalYear: 2026,
  // 元号表記（開催年に対応する元号）
  eraYear: "令和8年",
  // 定例会名・臨時会名（例: "令和8年6月定例会"）
  title: "令和8年6月定例会",
  sessionType: "定例会",
  // 延岡市議会の回次（例: "第26回"）。確認できた場合のみ
  sessionNumber: undefined,
  // 会期開始日・終了日（確認できた場合のみ、"YYYY-MM-DD"）
  startDate: undefined,
  endDate: undefined,
  // public/council-documents/配下のフォルダパス
  folderPath: "/council-documents/2026/2026-06",
  description: "",
  // この定例会に登録する資料（PDF）の配列。まだ資料がない場合は空配列[]のままにする
  documents: [councilDocumentTemplate],
  // 延岡市議会公式サイトの、この定例会に関する情報が確認できるページのURL
  officialSessionUrl: "https://www.city.nobeoka.miyazaki.jp/site/gikai/1456.html",
  // このデータをいつ確認したか（"YYYY-MM-DD"）
  lastVerified: "2026-08-02",
};
