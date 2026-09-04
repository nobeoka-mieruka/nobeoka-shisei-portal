import { useSyncExternalStore } from "react";
import { COUNCIL_SESSION_TIME_ZONE, dateStringInTimeZone } from "../lib/councilSessionSchedule";

/**
 * Phase221：プリレンダリング済みHTMLと閲覧時で表示が食い違わない形で「今日」を得るための仕組み。
 *
 * 本サイトはビルド時にHTMLを書き出し（scripts/prerender.mjs）、ブラウザ側でハイドレーションする。
 * レンダリング中に new Date() を呼ぶと、
 *   - サーバー生成HTMLにはビルド日時の判定結果が焼き付き、翌日以降ずっと古い状態が表示される
 *   - ハイドレーション時にサーバー出力とクライアント出力が食い違い、React が警告を出す
 * という2つの問題が同時に起きる。
 *
 * そこで useSyncExternalStore の getServerSnapshot / getSnapshot を使い、
 *   - サーバー生成時と、ハイドレーション中の初回クライアントレンダリング → false（＝日付未確定）
 *   - ハイドレーション完了後の再レンダリング → true（＝日付確定）
 * とする。サーバー出力と初回クライアント出力が必ず一致するため、ハイドレーション不一致は
 * 構造的に発生しない。日付に依存する文言は「確定後」だけに出す。
 */
const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** ハイドレーションが完了し、閲覧時の日時を安全に参照できる状態になったか。 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);
}

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
