import type { CouncilDocumentCategory } from "../types";

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
