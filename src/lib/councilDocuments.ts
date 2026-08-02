import type { CouncilDocument, CouncilDocumentCategory } from "../types";

/** 資料分類の表示順（このページ内の並び順として使う）。 */
export const councilDocumentCategoryOrder: CouncilDocumentCategory[] = [
  "proposals",
  "results",
  "petitions",
  "statements",
  "minutes",
  "newsletters",
  "other",
];

export const councilDocumentCategoryLabels: Record<CouncilDocumentCategory, string> = {
  proposals: "議案・条例・予算",
  results: "審議結果・表決結果",
  petitions: "請願・陳情",
  statements: "意見書・決議・討論",
  minutes: "会議録",
  newsletters: "市議会だより",
  other: "その他の資料",
};

/**
 * 一般公開ページに表示してよい資料かどうか。
 * publicationStatus未設定（既存データとの後方互換）は"published"として扱う。
 * pendingReview系（自動取得後、人の確認が済んでいない資料）は一覧・詳細ページに表示しない。
 */
export function isPubliclyVisible(doc: CouncilDocument): boolean {
  return doc.publicationStatus === undefined || doc.publicationStatus === "published";
}

/** セッション内の、一般公開してよい資料だけを返す。 */
export function publicDocuments(documents: CouncilDocument[]): CouncilDocument[] {
  return documents.filter(isPubliclyVisible);
}
