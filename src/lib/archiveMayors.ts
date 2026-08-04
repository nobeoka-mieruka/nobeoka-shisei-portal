import type { ArchiveMayor, ArchiveMayorTerm, ArchiveVerificationStatus } from "../types/historicalArchive";

/** verificationStatusの日本語ラベル。「確認中」「未確認」を0や空欄と混同しないよう明示する。 */
export function archiveVerificationStatusLabel(status: ArchiveVerificationStatus): string {
  switch (status) {
    case "verified":
      return "確認済み";
    case "partiallyVerified":
      return "一部確認済み";
    case "needsReview":
      return "要確認";
    case "sourceUnavailable":
      return "出典資料未確認";
  }
}

export function termsForMayor(terms: ArchiveMayorTerm[], mayorId: string): ArchiveMayorTerm[] {
  return terms.filter((t) => t.mayorId === mayorId).sort((a, b) => a.termStart.localeCompare(b.termStart));
}

/** 就任回数の表示用テキスト。件数不明の場合はterms配列長を使わず「確認中」とする。 */
export function mayorTermCountLabel(mayor: ArchiveMayor, terms: ArchiveMayorTerm[]): string {
  const own = termsForMayor(terms, mayor.id);
  return own.length > 0 ? `${own.length}期` : "確認中";
}
