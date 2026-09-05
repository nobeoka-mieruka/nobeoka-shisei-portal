import { COUNCIL_SESSION_TIME_ZONE, dateStringInTimeZone } from "../lib/councilSessionSchedule";
import { useIsHydrated } from "./useIsHydrated";

/**
 * Phase221：プリレンダリング済みHTMLと閲覧時で表示が食い違わない形で「今日」を得るための仕組み。
 *
 * 本サイトはビルド時にHTMLを書き出し（scripts/prerender.mjs）、ブラウザ側でハイドレーションする。
 * レンダリング中に new Date() を呼ぶと、
 *   - サーバー生成HTMLにはビルド日時の判定結果が焼き付き、翌日以降ずっと古い状態が表示される
 *   - ハイドレーション時にサーバー出力とクライアント出力が食い違い、React が警告を出す
 * という2つの問題が同時に起きる。
 *
 * そのため useIsHydrated()（src/hooks/useIsHydrated.ts、Phase240で共通化）で
 * 「ハイドレーション完了後」だけ日時を確定させる。日付に依存する文言は確定後だけに出す。
 */

// 既存の呼び出し側（Phase221当時から useTodayJst.ts の useIsHydrated を参照している箇所）との
// 互換のため、共通化後もここから再エクスポートする。
export { useIsHydrated } from "./useIsHydrated";

/**
 * 日本標準時（Asia/Tokyo）の今日（YYYY-MM-DD）。
 * サーバー生成時・ハイドレーション完了前は null を返す（＝日付に依存した表示をしない）。
 *
 * 閲覧端末の時間帯設定が日本以外でも、必ず Asia/Tokyo の暦日を返す
 * （延岡市議会の日程はすべて日本時間で公表されているため）。
 */
export function useTodayJst(): string | null {
  const hydrated = useIsHydrated();
  return hydrated ? dateStringInTimeZone(new Date(), COUNCIL_SESSION_TIME_ZONE) : null;
}
