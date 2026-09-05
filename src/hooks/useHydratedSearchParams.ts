import { useEffect, useRef, useState } from "react";
import { useSearchParams, type SetURLSearchParams } from "react-router-dom";
import { useIsHydrated } from "./useIsHydrated";

/**
 * Phase240：URLのクエリ文字列（?items=... ?q=... など）をハイドレーション安全に扱うための共通フック。
 *
 * 背景：本サイトはビルド時にHTMLを書き出し（scripts/prerender.mjs）、静的ホスティング
 * （Cloudflare Pages）で配信する。静的ホスティングはクエリ文字列を無視して同じファイルを返すため、
 * プリレンダリング済みHTMLの中身は常に「クエリなし」の状態になる。
 * ページ側がレンダリング中に useSearchParams() の値を使って表示を変えていると、
 * 初回クライアントレンダリングだけが絞り込み後の内容になり、サーバー出力と食い違って
 * React のハイドレーションエラー（本番ビルドでは Minified React error #418）になる。
 *
 * 対処方針は Phase221 と同じで、
 *   サーバー出力＝初回クライアント出力（＝クエリなし）→ ハイドレーション完了後に差し替える
 * とする。`suppressHydrationWarning` で警告を隠す方法は採らない。
 */

/** ハイドレーション前に返す空のクエリ。毎回同じ参照を返し、無用な再計算を起こさない。 */
const EMPTY_SEARCH_PARAMS = new URLSearchParams();

/**
 * useSearchParams() の代わりに使う。
 * ハイドレーション完了前は「クエリなし」（＝プリレンダリング済みHTMLと同じ状態）を返し、
 * 完了後に実際のクエリへ差し替える。書き込み用の setSearchParams はそのまま渡す。
 *
 * レンダリング中にクエリの値を読んで表示を変えるページは、必ずこちらを使う。
 */
export function useHydratedSearchParams(): [URLSearchParams, SetURLSearchParams] {
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrated = useIsHydrated();
  return [hydrated ? searchParams : EMPTY_SEARCH_PARAMS, setSearchParams];
}

/**
 * 絞り込み条件を useState で保持しているページ用。
 * 初期値は既定値（＝プリレンダリング済みHTMLと同じ）のままにし、ハイドレーション完了後に
 * 一度だけ、アクセス時のURLに入っていたクエリを state へ反映する。
 *
 * 戻り値は「反映済みか」。条件をURLへ書き戻す副作用は、これが true になるまで実行しないこと
 * （反映前に書き戻すと、共有されたURLの条件を消してしまう）。
 *
 * @param apply アクセス時のURLクエリを受け取り、対応する state を設定する関数。
 */
export function useInitialSearchParams(apply: (params: URLSearchParams) => void): boolean {
  const [searchParams] = useSearchParams();
  const hydrated = useIsHydrated();

  // アクセス時点のクエリを保持する。レンダリング結果には影響しないため、
  // 初回レンダリング中に読み取ってもハイドレーション不一致にはならない。
  const initialParamsRef = useRef<URLSearchParams | null>(null);
  if (initialParamsRef.current === null) initialParamsRef.current = new URLSearchParams(searchParams);

  const applyRef = useRef(apply);
  applyRef.current = apply;

  const [applied, setApplied] = useState(false);
  useEffect(() => {
    if (!hydrated || applied) return;
    applyRef.current(initialParamsRef.current ?? EMPTY_SEARCH_PARAMS);
    setApplied(true);
  }, [hydrated, applied]);

  return applied;
}
