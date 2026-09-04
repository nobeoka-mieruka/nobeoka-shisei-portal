import type { BillVoteItem } from "../types";

/**
 * Phase220：議案データの `fiscalYear` が何を指すのかの単一情報源。
 *
 * 確認した事実（1,177件全件で照合）：
 * - `billVotes.fiscalYear` は、`councilSessions.json` の当該会期の `fiscalYear`（4月始まりの年度）と
 *   **1件の例外もなく一致**する。
 * - 議決日（`votingDate`）が属する年度、提出日（`submittedDate`）が属する年度とも一致する。
 * したがってこの値は「議案の中身が対象とする年度」ではなく、
 * **その議案を審議した定例会・臨時会が属する年度（＝会期年度）** である。
 *
 * 一方、議案名には別の年度が入ることがある。例えば
 * 「令和8年度水道事業会計予算」は令和8年3月定例会（＝令和7年度）で議決される。
 * 3月の定例会はまだ前年度のうちに開かれ、そこで翌年度の当初予算を議決するためで、
 * 決算議案は逆に、終わった年度の決算を翌年度の9月定例会で認定する。
 * どちらも公式資料どおりの表記であり、**データの誤りではない**。
 *
 * そのため本サイトでは
 * - ラベルを「年度」から「会期年度」へ改め（値そのものは変更しない）、
 * - 議案名の年度と会期年度が食い違う議案では、その理由を市民向けに説明する。
 * 議案名から取り出した年度は「説明のための引用」であって確定値ではないため、
 * データとして新しいフィールドへ保存することはしない（推測値を作らない）。
 */

/** 画面上のラベル。「年度」だけでは何の年度か分からないため使わない。 */
export const BILL_SESSION_FISCAL_YEAR_LABEL = "会期年度";

/** ラベルに添える一行の補足（表の見出し等、短くしか書けない場所で使う）。 */
export const BILL_SESSION_FISCAL_YEAR_HINT = "議案を審議した定例会・臨時会が属する年度";

/** 用語解説（GlossaryNote等で使う本文）。制度一般の説明のみで、延岡市固有の事実主張は含まない。 */
export const BILL_SESSION_FISCAL_YEAR_DESCRIPTION =
  "議会の年度は4月から翌年3月までです。会期年度は、その議案を審議した定例会・臨時会がどの年度に開かれたかを示します。" +
  "議案名に書かれている年度（予算・決算などが対象とする年度）とは別のもので、両方が違う年を指すことがあります。";

const ERA_BASE_YEAR: Record<string, number> = { 令和: 2018, 平成: 1988, 昭和: 1925 };

/** 「令和7年度」「令和元年度」等のラベルを西暦の年度（4月始まりの開始年）に変換する。判別できない場合はnull。 */
export function parseJapaneseFiscalYearLabel(label: string): number | null {
  const m = /^(令和|平成|昭和)(元|[0-9]+)年度$/.exec(label.trim());
  if (!m) return null;
  const base = ERA_BASE_YEAR[m[1]];
  if (base === undefined) return null;
  return base + (m[2] === "元" ? 1 : Number(m[2]));
}

/**
 * 議案名の中に書かれている年度を、**最初の1つだけ**そのままの表記で取り出す。
 * 名称に年度表記が無い議案はnull（無い年度を推測して補わない）。
 */
export function findFiscalYearLabelInBillTitle(billTitle: string): { label: string; year: number } | null {
  const m = /(令和|平成|昭和)(元|[0-9]+)年度/.exec(billTitle);
  if (!m) return null;
  const label = m[0];
  const year = parseJapaneseFiscalYearLabel(label);
  return year === null ? null : { label, year };
}

/**
 * 「議案名の年度」と「会期年度」が食い違っている議案かどうかを判定する。
 * 食い違う場合のみ、市民向けの説明を出すための表記を返す（判定に使うのは既存フィールドのみ）。
 */
export function billTitleFiscalYearNote(
  bill: Pick<BillVoteItem, "billTitle" | "fiscalYear">,
): { sessionFiscalYearLabel: string; titleFiscalYearLabel: string } | null {
  const sessionYear = parseJapaneseFiscalYearLabel(bill.fiscalYear);
  if (sessionYear === null) return null;
  const inTitle = findFiscalYearLabelInBillTitle(bill.billTitle);
  if (!inTitle || inTitle.year === sessionYear) return null;
  return { sessionFiscalYearLabel: bill.fiscalYear, titleFiscalYearLabel: inTitle.label };
}
