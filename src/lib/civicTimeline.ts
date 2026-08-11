import civicTimelineEventsData from "../data/civicTimelineEvents.json";
import type { CivicTimelineEvent, CivicTimelineCategory } from "../types";

export const civicTimelineEvents = civicTimelineEventsData as CivicTimelineEvent[];

export const civicTimelineCategories: CivicTimelineCategory[] = ["市制施行・合併", "市庁舎", "行政組織", "災害", "公共事業", "教育・福祉・産業"];

/** 年の新しい順に並べた市政年表。 */
export function sortedCivicTimelineEvents(): CivicTimelineEvent[] {
  return [...civicTimelineEvents].sort((a, b) => b.year - a.year || a.id.localeCompare(b.id));
}

/** 収録されている年（重複無し、新しい順）。 */
export function civicTimelineYears(): number[] {
  return [...new Set(civicTimelineEvents.map((e) => e.year))].sort((a, b) => b - a);
}

/** 収録されている年代（10年単位、新しい順）。例：2020, 2010, 2000, ... */
export function civicTimelineDecades(): number[] {
  return [...new Set(civicTimelineEvents.map((e) => Math.floor(e.year / 10) * 10))].sort((a, b) => b - a);
}

export function getCivicTimelineEvent(id: string): CivicTimelineEvent | undefined {
  return civicTimelineEvents.find((e) => e.id === id);
}

/**
 * 指定した人物（歴代市長id等）が関連付けられている市政年表の出来事を、年の新しい順で返す。
 * relatedPersonIdsが一次資料で確認できた場合のみ設定されているため、ここで独自に
 * 期間から逆算して補完することはしない（推測による関連付けを避ける）。
 */
export function civicTimelineEventsForPerson(personId: string): CivicTimelineEvent[] {
  return sortedCivicTimelineEvents().filter((e) => e.relatedPersonIds?.includes(personId));
}
