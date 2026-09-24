/**
 * 市政タイムライン（/timeline）の表示用ヘルパー。
 * データは scripts/generate-civic-event-timeline.mjs がビルド時に生成する（src/data/civicEventTimeline.json）。
 *
 * 日付は元データの確認精度（precision）のまま扱い、年月までしか分からないものに日を付けない。
 * 並び順は日付のみ（重要度による並べ替えはしない）。
 */

export type CivicEventType =
  | "election"
  | "mayor"
  | "promise"
  | "session"
  | "generalQuestion"
  | "billSubmitted"
  | "billDecided"
  | "budget"
  | "settlement"
  | "committee"
  | "adminDocument";

export type CivicEventPrecision = "day" | "month" | "year";

export interface CivicEventItem {
  title: string;
  route: string;
  sourceUrl: string | null;
}

export interface CivicEvent {
  id: string;
  type: CivicEventType;
  /** "YYYY-MM-DD"（day）／"YYYY-MM"（month）／"YYYY"（year）。 */
  date: string;
  precision: CivicEventPrecision;
  /** done＝実施済み（資料で確認できた事実）、scheduled＝予定（開催・実施の確認前）。 */
  status: "done" | "scheduled";
  title: string;
  note?: string;
  route: string;
  sourceUrl: string | null;
  items?: CivicEventItem[];
}

export const CIVIC_EVENT_TYPE_LABELS: Record<CivicEventType, string> = {
  election: "選挙",
  mayor: "市長就任",
  promise: "市長公約",
  session: "議会の開会・閉会",
  generalQuestion: "一般質問",
  billSubmitted: "議案の提出",
  billDecided: "議決",
  budget: "予算・補正予算",
  settlement: "決算",
  committee: "委員会",
  adminDocument: "行政資料の公開",
};

export const CIVIC_EVENT_TYPES = Object.keys(CIVIC_EVENT_TYPE_LABELS) as CivicEventType[];

export const CIVIC_EVENT_STATUS_LABELS: Record<CivicEvent["status"], string> = {
  done: "実施済み",
  scheduled: "予定",
};

/** 日付を確認精度どおりに表示する（例：2025年7月20日／2025年7月／2025年）。架空の日を補わない。 */
export function formatCivicEventDate(date: string, precision: CivicEventPrecision): string {
  const [y, m, d] = date.split("-");
  if (precision === "day" && d) return `${Number(y)}年${Number(m)}月${Number(d)}日`;
  if (precision !== "year" && m) return `${Number(y)}年${Number(m)}月`;
  return `${Number(y)}年`;
}

/** 月の見出し内で使う短い日付（例：9月18日）。日が確認できないものは「日付未確定」。 */
export function shortDayLabel(event: CivicEvent): string {
  if (event.precision !== "day") return event.precision === "month" ? "日付未確定（月のみ確認）" : "時期未確定（年のみ確認）";
  const [, m, d] = event.date.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

export interface CivicEventMonthGroup {
  /** "YYYY-MM"、または年しか分からないものは "YYYY"。 */
  key: string;
  label: string;
  events: CivicEvent[];
}

/**
 * 年の中を月ごとにまとめる（新しい月が上）。月の中は日付の早い順、日付未確定（月のみ）は月の末尾。
 * 年しか分からないものは、その年の最後に「時期未確定」としてまとめる。
 */
export function groupCivicEventsByMonth(events: CivicEvent[]): CivicEventMonthGroup[] {
  const groups = new Map<string, CivicEvent[]>();
  for (const e of events) {
    const key = e.precision === "year" ? e.date.slice(0, 4) : e.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const rank = (e: CivicEvent) => (e.precision === "day" ? 0 : 1);
  return [...groups.entries()]
    .sort(([a], [b]) => {
      // 年だけのグループ（"YYYY"）は、同じ年の月グループより後ろ（下）に置く。
      const ay = a.slice(0, 4);
      const by = b.slice(0, 4);
      if (ay !== by) return by.localeCompare(ay);
      if (a.length !== b.length) return b.length - a.length;
      return b.localeCompare(a);
    })
    .map(([key, list]) => ({
      key,
      label: key.length === 4 ? `${Number(key)}年（時期未確定）` : `${Number(key.slice(0, 4))}年${Number(key.slice(5, 7))}月`,
      events: [...list].sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    }));
}

export function yearsOfCivicEvents(events: CivicEvent[]): number[] {
  return [...new Set(events.map((e) => Number(e.date.slice(0, 4))))].sort((a, b) => b - a);
}
