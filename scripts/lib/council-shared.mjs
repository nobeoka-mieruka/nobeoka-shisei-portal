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
const HEISEI_START_YEAR = 1989;
const SHOWA_START_YEAR = 1926;

/**
 * Phase163で発見・修正：この関数は従来「令和◯年」の式のみを固定的に返しており、平成・昭和の
 * 年（例：2007年→本来は「平成19年」）を渡すと「令和-10年」のような不正な文字列を生成していた
 * （令和1年=2019年からの単純な引き算のみで、元号の境界を一切考慮していなかったため）。
 * 呼び出し元（generate-council-documents.mjs・fetch-nobeoka-council-documents.mjs）は令和期の
 * 会期のみを扱うため従来は問題が表面化しなかったが、session-summary.mjsのformatEraDateが
 * 平成期の会期（councilSessions.jsonの19件のsummaryStatus=unavailable会期を含む）の日付を
 * 渡すと不正な文字列を生成することが判明した。令和1年（2019年）の結果は従来と完全に同じ
 * （既存の令和期呼び出し元の挙動は変えない）。元年（1年）は「元年」と表記する（会議録検索
 * システム・公式資料の表記慣行と一致させる。scripts/lib/minutes-source.mjsのERA_CONFIGと同じ方針）。
 */
export function eraYearFor(year) {
  if (year >= REIWA_START_YEAR) {
    const n = year - REIWA_START_YEAR + 1;
    return `令和${n === 1 ? "元" : n}年`;
  }
  if (year >= HEISEI_START_YEAR) {
    const n = year - HEISEI_START_YEAR + 1;
    return `平成${n === 1 ? "元" : n}年`;
  }
  if (year >= SHOWA_START_YEAR) {
    const n = year - SHOWA_START_YEAR + 1;
    return `昭和${n === 1 ? "元" : n}年`;
  }
  // 大正以前は本サイトの対象範囲外（延岡市議会関連データは大正末期以降のみを扱う）。
  // 推測で元号を割り当てず、西暦をそのまま返す（項目18：無理に何かを返さない）。
  return `西暦${year}年`;
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
