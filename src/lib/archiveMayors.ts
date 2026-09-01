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

/**
 * Phase135：どの市長の任期にも属さない空白期間を検出する。
 * scripts/validate-data.mjsとMayorsPage.tsxで同じ検出ロジックを個別に実装しており、
 * MayorsPage側は件数を「13件」等の固定文言でハードコードしていたため、この共通関数へ
 * 一本化した（データが更新されて空白期間の件数が変わっても、両者が自動的に一致するように
 * するため）。退任日の翌日に次の任期が始まる場合（termEndを含む日まで在職）は空白ではない
 * ため、日付を1日進めてから比較する。
 * @param todayIso 呼び出し元の「今日」（JST基準のYYYY-MM-DD）。ビルド時とクライアント実行時で
 *   ずれる可能性があるため、呼び出し元が明示的に渡す。
 */
export function findMayorTermGaps(
  terms: ArchiveMayorTerm[],
  todayIso: string,
): { from: string; to: string }[] {
  if (terms.length === 0 || !terms.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.termStart))) return [];
  const nextDay = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const sortedByStart = [...terms].sort((a, b) => a.termStart.localeCompare(b.termStart));
  let coveredUntil = sortedByStart[0].termStart;
  const gaps: { from: string; to: string }[] = [];
  for (const t of sortedByStart) {
    if (t.termStart > nextDay(coveredUntil)) gaps.push({ from: coveredUntil, to: t.termStart });
    const end = t.termEnd ?? todayIso;
    if (end > coveredUntil) coveredUntil = end;
  }
  if (coveredUntil < todayIso) gaps.push({ from: coveredUntil, to: todayIso });
  return gaps;
}

/**
 * TASK-085：就任日が日単位まで確認済みの任期かどうか。未設定はday（既存データとの後方互換）。
 * MayorsPage・DataStatusPage・dataCompletenessSummaryの3箇所で同じ判定式を
 * 個別に実装していたため、この共通関数へ一本化した（将来ズレないようにするため）。
 */
export function isDayPreciseTerm(term: ArchiveMayorTerm): boolean {
  return (term.termStartPrecision ?? "day") === "day";
}

/** 日単位で確認済みの任期数を数える。 */
export function countDayPreciseTerms(terms: ArchiveMayorTerm[]): number {
  return terms.filter(isDayPreciseTerm).length;
}

/**
 * 就任日（day単位で確認済みのtermStart）から基準日までの在任日数を算出する。
 * 就任日当日を1日目として数える（例：就任日と同じ日が基準日なら1日）。
 * 呼び出し側は、必ずisDayPreciseTerm()がtrueの任期でのみ使うこと（月・年単位の
 * 概算日付から日数を計算すると、不正確な数値を確定した事実であるかのように
 * 見せてしまうため）。
 * @param todayIso 呼び出し元の「今日」（JST基準のYYYY-MM-DD）。
 */
export function daysInOffice(termStartIso: string, todayIso: string): number {
  const start = new Date(`${termStartIso}T00:00:00Z`).getTime();
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  return Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
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
