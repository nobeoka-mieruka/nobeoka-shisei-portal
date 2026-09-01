import civicTimelineEventsData from "../data/civicTimelineEvents.json";
import type { CivicTimelineEvent, CivicTimelineCategory } from "../types";
import { fiscalYearOfIsoDate } from "./archiveTimeline";

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

/**
 * 市政年表の出来事1件について、対応する会計年度（4月始まり）を近似的に求める。
 * dateLabelから年月まで判読できた場合はfiscalYearOfIsoDate()と同じ規則（4月〜翌年3月を
 * 1年度とする）で計算し、月が資料上不明な場合はyearフィールドをそのまま会計年度とみなす
 * （日付精度が年単位までしかない出来事について、月の推測で会計年度を確定させることは
 * しない。最大で前後1年度分ずれる可能性がある近似値であり、「/timeline/年度」ページへの
 * 横断的な誘導リンク用。市長任期との厳密な対応関係はrelatedPersonIdsで別途、一次資料が
 * 確認できた場合のみ管理している）。
 */
export function civicTimelineEventFiscalYear(event: CivicTimelineEvent): number {
  const match = event.dateLabel.match(/^(\d{4})年(\d{1,2})月/);
  if (match) {
    return fiscalYearOfIsoDate(`${match[1]}-${match[2].padStart(2, "0")}-01`);
  }
  return event.year;
}

/**
 * 指定した会計年度（近似、civicTimelineEventFiscalYear()による）に対応する市政年表の
 * 出来事を、年の新しい順で返す。TimelineYearPage（年度別ページ）から市政年表イベントへ
 * 逆引きするために使う。
 */
export function civicTimelineEventsInFiscalYear(fiscalYear: number): CivicTimelineEvent[] {
  return sortedCivicTimelineEvents().filter((e) => civicTimelineEventFiscalYear(e) === fiscalYear);
}
