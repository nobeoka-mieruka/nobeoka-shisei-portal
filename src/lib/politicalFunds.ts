import organizationsData from "../data/politicalFundOrganizations.json";
import reportsData from "../data/politicalFundReports.json";
import type { PoliticalFundOrganization, PoliticalFundReport } from "../types";

/**
 * 政治資金収支報告書関連のデータアクセス・表示整形ヘルパー（TASK-015）。
 *
 * 実データ（politicalFundOrganizations.json / politicalFundReports.json）は
 * 本タスクの時点では0件。TASK-016で公式資料（政治資金収支報告書）を確認できた分から
 * 順次登録する。画面側は0件でも「情報未登録」表示のまま崩れないことを前提に設計する。
 */

export const politicalFundOrganizations = organizationsData as PoliticalFundOrganization[];
export const politicalFundReports = reportsData as PoliticalFundReport[];

/** 政治団体を名称の五十音（文字コード）順で返す。 */
export function sortedPoliticalFundOrganizations(): PoliticalFundOrganization[] {
  return [...politicalFundOrganizations].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export function getPoliticalFundOrganization(id: string): PoliticalFundOrganization | undefined {
  return politicalFundOrganizations.find((o) => o.id === id);
}

/** 指定した政治団体の収支報告書を、対象年（fiscalYear）の新しい順で返す。 */
export function reportsForOrganization(organizationId: string): PoliticalFundReport[] {
  return politicalFundReports
    .filter((r) => r.organizationId === organizationId)
    .sort((a, b) => b.fiscalYear.localeCompare(a.fiscalYear, "ja"));
}

/** 指定した政治団体の最新（対象年が最も新しい）収支報告書。1件も無い場合はundefined。 */
export function latestReportForOrganization(organizationId: string): PoliticalFundReport | undefined {
  return reportsForOrganization(organizationId)[0];
}

/** 円単位の金額を表示用文字列に変換する。未確認（null）は「確認中」。 */
export function formatPoliticalFundYen(value: number | null | undefined): string {
  if (value === null || value === undefined) return "確認中";
  return `${value.toLocaleString("ja-JP")}円`;
}
