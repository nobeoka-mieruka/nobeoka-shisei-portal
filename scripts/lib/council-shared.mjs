/**
 * councilSessions.json関連のスクリプト（generate-council-documents.mjs /
 * fetch-nobeoka-council-documents.mjs）で共有するヘルパー。
 * ロジックの二重管理を避けるため、定例会ID・年度・元号の導出はすべてここに集約する。
 */
import { createHash } from "node:crypto";

export const CATEGORY_FOLDERS = [
  "proposals",
  "results",
  "petitions",
  "statements",
  "minutes",
  "newsletters",
  "other",
];
export const CATEGORY_FOLDER_SET = new Set(CATEGORY_FOLDERS);

const REIWA_START_YEAR = 2019;

export function eraYearFor(year) {
  return `令和${year - REIWA_START_YEAR + 1}年`;
}

/** "令和8年度" → 2026。パースできない場合（元年表記・平成以前など）はnull。 */
export function parseEraFiscalYearHeading(heading) {
  const match = heading.match(/^令和(\d+)年度$/);
  if (!match) return null;
  return Number(match[1]) + REIWA_START_YEAR - 1;
}

/** "2023-07-extraordinary-02" → { year:2023, month:7, extraordinary:true, seq:2 } */
export function parseSessionId(sessionId) {
  const match = sessionId.match(/^(\d{4})-(\d{2})(-extraordinary)?(?:-(\d+))?$/);
  if (!match) return null;
  const [, yearStr, monthStr, extraordinaryFlag, seqStr] = match;
  return {
    year: Number(yearStr),
    month: Number(monthStr),
    extraordinary: !!extraordinaryFlag,
    seq: seqStr ? Number(seqStr) : undefined,
  };
}

export function titleForSessionId(sessionId) {
  const parsed = parseSessionId(sessionId);
  if (!parsed) return sessionId;
  return titleFor(parsed.year, parsed.month, parsed.extraordinary, parsed.seq);
}

export function titleFor(year, month, extraordinary, seq) {
  const eraYear = eraYearFor(year);
  const sessionType = extraordinary ? "臨時会" : "定例会";
  const suffix = seq ? `（${seq}）` : "";
  return `${eraYear}${month}月${sessionType}${suffix}`;
}

/** 年度（4月始まり）と月から、その回が属する暦年を返す。 */
export function calendarYearFromFiscalYear(fiscalYear, month) {
  return month >= 4 ? fiscalYear : fiscalYear + 1;
}

export function sha256OfBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
