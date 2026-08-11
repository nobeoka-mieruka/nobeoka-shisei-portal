/**
 * 延岡市行政組織データ（src/data/cityOrganizationDivisions.json・
 * src/data/cityOrganizationSections.json）の共通ヘルパー。
 * /city-guide（市役所案内診断）など、担当課・電話番号・所在地の表示が
 * 必要な画面から共通で参照する想定（担当課名・電話番号を複数のJSONへ
 * 重複して手入力しないため）。
 */
import cityOrganizationDivisionsData from "../data/cityOrganizationDivisions.json";
import cityOrganizationSectionsData from "../data/cityOrganizationSections.json";
import type { CityOrganizationDivision, CityOrganizationSection } from "../types/cityOrganization";

export const cityOrganizationDivisions = cityOrganizationDivisionsData as CityOrganizationDivision[];
export const cityOrganizationSections = cityOrganizationSectionsData as CityOrganizationSection[];

export function cityOrganizationSectionById(id: string): CityOrganizationSection | undefined {
  return cityOrganizationSections.find((s) => s.id === id);
}

/** 課名（完全一致）から該当課を探す。表記ゆれ（総合支所名の併記等）は完全一致のみ対応する。 */
export function cityOrganizationSectionByName(name: string): CityOrganizationSection | undefined {
  return cityOrganizationSections.find((s) => s.name === name);
}

export function cityOrganizationDivisionById(id: string): CityOrganizationDivision | undefined {
  return cityOrganizationDivisions.find((d) => d.id === id);
}

/** 「総合政策部 総合政策課」のような上位組織付き表示名を生成する。 */
export function cityOrganizationSectionFullName(section: CityOrganizationSection): string {
  return `${section.parentDivisionName} ${section.name}`;
}
