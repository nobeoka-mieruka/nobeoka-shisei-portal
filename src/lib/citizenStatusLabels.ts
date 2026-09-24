/**
 * 内部の状態コード（CONFIRMED / needsReview / SOURCE_NOT_PUBLISHED 等）を、市民向けの日本語表示へ
 * 変換する共通ヘルパー。市民向け画面では内部コードをそのまま表示せず、必ずここを通す。
 *
 * 表示語は次の6種類に限定する（同じ意味の言い換えを画面ごとに増やさない）。
 * - 確認済み：一次資料で確認できた
 * - 確認中：当サイトで確認作業中（誤りという意味ではない）
 * - 資料未公開：一次資料が公開されていない
 * - 一次資料待ち：公開予定・公表待ちの一次資料がある
 * - 個人単位で確認不可：公開資料が会派・全体単位で、個人ごとには確認できない
 * - 公開資料で確認できず：公開資料をひととおり調べたが確認できなかった
 *
 * 未知のコードは「確認中」として扱い、コード文字列を画面へ出さない。
 */

export type CitizenStatusKey =
  | "confirmed"
  | "underReview"
  | "sourceNotPublished"
  | "waitingOfficialSource"
  | "notIndividuallyAttributable"
  | "researchExhausted";

export const CITIZEN_STATUS_LABELS: Record<CitizenStatusKey, string> = {
  confirmed: "確認済み",
  underReview: "確認中",
  sourceNotPublished: "資料未公開",
  waitingOfficialSource: "一次資料待ち",
  notIndividuallyAttributable: "個人単位で確認不可",
  researchExhausted: "公開資料で確認できず",
};

export const CITIZEN_STATUS_DESCRIPTIONS: Record<CitizenStatusKey, string> = {
  confirmed: "一次資料（公式資料）で内容を確認できたもの。",
  underReview: "当サイトで一次資料との照合を進めているもの。",
  sourceNotPublished: "根拠となる一次資料が公開されていないもの。",
  waitingOfficialSource: "会議録の公開など、一次資料の公表を待っているもの。",
  notIndividuallyAttributable: "公開資料が全体・会派単位のため、個人ごとには確認できないもの。",
  researchExhausted: "公開されている資料を調べても確認できなかったもの。",
};

/** 「未確認」は「誤り」を意味しないことの説明（凡例・注記で共通利用）。 */
export const UNCONFIRMED_IS_NOT_ERROR_NOTE =
  "「確認中」「資料未公開」などは、当サイトが一次資料でまだ確認できていないことを示すもので、内容が誤っているという意味ではありません。";

/** コードの表記ゆれ（大文字・小文字、_ - 空白、camelCase）を吸収する。 */
function normalizeCode(code: string): string {
  return code
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

const CODE_TO_KEY: Record<string, CitizenStatusKey> = {
  CONFIRMED: "confirmed",
  VERIFIED: "confirmed",
  CONFIRMED_PRIMARY: "confirmed",
  PRIMARY_CONFIRMED: "confirmed",
  OFFICIAL: "confirmed",
  UNCONFIRMED: "underReview",
  NEEDS_REVIEW: "underReview",
  UNDER_REVIEW: "underReview",
  PENDING: "underReview",
  PARTIALLY_VERIFIED: "underReview",
  LIKELY: "underReview",
  CANDIDATE: "underReview",
  SOURCE_NOT_PUBLISHED: "sourceNotPublished",
  NOT_PUBLISHED: "sourceNotPublished",
  NOT_AVAILABLE: "sourceNotPublished",
  UNAVAILABLE: "sourceNotPublished",
  WAITING_OFFICIAL_SOURCE: "waitingOfficialSource",
  WAITING_PRIMARY_SOURCE: "waitingOfficialSource",
  AWAITING_PUBLICATION: "waitingOfficialSource",
  NOT_INDIVIDUALLY_ATTRIBUTABLE: "notIndividuallyAttributable",
  RESEARCH_EXHAUSTED: "researchExhausted",
  PRIMARY_NOT_FOUND: "researchExhausted",
  SOURCE_NOT_FOUND: "researchExhausted",
};

export function citizenStatusKey(code: string | null | undefined): CitizenStatusKey {
  if (!code) return "underReview";
  return CODE_TO_KEY[normalizeCode(code)] ?? "underReview";
}

/** 内部コード → 市民向けラベル。未知のコード・空値は「確認中」。 */
export function citizenStatusLabel(code: string | null | undefined): string {
  return CITIZEN_STATUS_LABELS[citizenStatusKey(code)];
}

/** 市民向け画面へ出してはいけない内部コード（テストで利用）。 */
export const INTERNAL_STATUS_CODES = [
  "CONFIRMED",
  "UNCONFIRMED",
  "NEEDS_REVIEW",
  "SOURCE_NOT_PUBLISHED",
  "WAITING_OFFICIAL_SOURCE",
  "NOT_INDIVIDUALLY_ATTRIBUTABLE",
  "RESEARCH_EXHAUSTED",
  "needsReview",
] as const;

/** 旧議員の任期記録の状態（ArchiveMemberTerm.status）。 */
export function memberTermStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "elected":
      return "当選";
    case "resigned":
      return "辞職";
    case "termCompleted":
      return "任期満了";
    default:
      return "確認中";
  }
}
