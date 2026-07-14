import siteUpdate from "../data/siteUpdate.json";

/** "2026年7月14日 20:30" のように、日本時間（Asia/Tokyo）で最終更新日時を整形する。 */
export function formatLastUpdated(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}年${get("month")}月${get("day")}日 ${get("hour")}:${get("minute")}`;
}

/** サイト全体の最終更新日時（Gitの最新コミット日時、ビルド時に自動生成）を表示用文字列で返す。 */
export function getLastUpdatedText(): string {
  return formatLastUpdated(siteUpdate.lastUpdated);
}
