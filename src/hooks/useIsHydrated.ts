import { useSyncExternalStore } from "react";

/**
 * Phase221で導入し、Phase240で共通化した「ハイドレーションが完了したか」を返す仕組み。
 *
 * 本サイトはビルド時にHTMLを書き出し（scripts/prerender.mjs）、ブラウザ側でハイドレーションする。
 * レンダリング中に「サーバー側では分からない情報」（現在時刻・URLのクエリ文字列・端末の状態など）を
 * 使って表示を変えると、サーバー生成HTMLと初回クライアントレンダリングが食い違い、
 * React のハイドレーションエラー（本番ビルドでは Minified React error #418）になる。
 *
 * useSyncExternalStore の getServerSnapshot / getSnapshot を使うと、
 *   - サーバー生成時と、ハイドレーション中の初回クライアントレンダリング → false（＝未確定）
 *   - ハイドレーション完了後の再レンダリング → true（＝確定）
 * となる。サーバー出力と初回クライアント出力が必ず一致するため、ハイドレーション不一致は
 * 構造的に発生しない。確定後にだけ差し替える、という方針で使う。
 *
 * `suppressHydrationWarning` で警告を隠す方法は採らない（表示の食い違い自体は残るため）。
 */
const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** ハイドレーションが完了し、閲覧時にしか分からない情報を安全に参照できる状態になったか。 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);
}
