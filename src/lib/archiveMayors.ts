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

/** 就任順の並び替え用に、その市長の最も早い任期の開始日を返す（任期未登録の場合はundefined）。 */
export function earliestTermStart(mayor: ArchiveMayor, terms: ArchiveMayorTerm[]): string | undefined {
  return termsForMayor(terms, mayor.id)[0]?.termStart;
}

/** 一覧の年代別グルーピング用ラベル（西暦の10年区切り）。例: "1933-04-15" → "1930年代"。 */
export function decadeLabel(isoDate: string): string {
  const year = Number.parseInt(isoDate.slice(0, 4), 10);
  if (!Number.isInteger(year)) return "年代不明";
  return `${Math.floor(year / 10) * 10}年代`;
}

export function mayorRoleLabel(role: ArchiveMayorTerm["mayorRole"]): string {
  switch (role) {
    case "acting":
      return "職務代理";
    case "temporaryActing":
      return "一時的職務代理";
    case "elected":
    case undefined:
      return "公選";
  }
}

/** 職務代理者（acting/temporaryActing）の任期かどうか。未設定はelected（公選）扱い。 */
export function isActingMayorTerm(term: ArchiveMayorTerm): boolean {
  return term.mayorRole === "acting" || term.mayorRole === "temporaryActing";
}

/**
 * 日付を表示用に整形し、precisionがday未満の場合は「ごろ」を付け、
 * 日付そのものが確定した事実ではないことを明示する。dateがnullの場合は"現在"を返す。
 */
export function formatArchiveDateWithPrecision(
  date: string | null,
  precision: "day" | "month" | "year" | undefined,
  formatJapaneseDate: (iso: string) => string,
): string {
  if (date === null) return "現在";
  const formatted = formatJapaneseDate(date);
  if (precision === undefined || precision === "day") return formatted;
  return `${formatted}ごろ（${precision === "month" ? "月まで確認・日は未確定" : "年のみ確認・月日は未確定"}）`;
}
