/**
 * Phase209：到達できない出典URL（外部リンク切れ）を、市民向け画面でリンクにしないための判定。
 *
 * 背景：`archiveMayorTerms.json` の Wikipedia「仲田又次郎」は 404 が続いており、
 * `/timeline`・`/timeline/:year` の出典欄でクリックできるリンクとして表示されていた。
 * 出典として記録した事実（いつ・何を根拠にしたか）は消さずに残す必要がある一方、
 * 市民が押すと「ページが見つかりません」に飛ぶ状態は避けたい。
 *
 * 方針：リンク切れの一覧は既に `src/data/dataQualitySummary.json` の `linkHealth.broken`
 * （`scripts/generate-quality-summary.mjs` が外部リンク監査から自動生成）に存在するため、
 * 新しい台帳を作らず、これを表示側から参照する。リンク切れが解消すれば監査の再生成だけで
 * 自動的にリンクへ戻る（コード・データの手直しが不要）。
 */
import dataQualitySummary from "../data/dataQualitySummary.json";

/** リンク切れの出典に表示する説明。色だけでなく文字でも状態を伝える。 */
export const BROKEN_SOURCE_LINK_LABEL = "リンク切れ・代替資料確認中";

const brokenUrls = new Set<string>(
  (dataQualitySummary.linkHealth?.broken ?? []).map((entry: { url: string }) => entry.url),
);

/** 外部リンク監査で到達できないと確認済みのURLかどうか。 */
export function isKnownBrokenSourceLink(url?: string | null): boolean {
  return url != null && brokenUrls.has(url);
}
