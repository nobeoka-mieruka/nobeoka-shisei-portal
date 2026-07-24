/**
 * SEOのルート判定（getSeoForPath）で使うpathnameの正規化。
 *
 * Cloudflare Pagesの静的ディレクトリ配信は、末尾スラッシュなしのURL（例: /compensation）を
 * 末尾スラッシュ付きURL（/compensation/）へ307リダイレクトする。React Router自体は
 * パスマッチングで末尾スラッシュを許容するためページ表示は崩れないが、location.pathname
 * そのものは末尾スラッシュを含んだ文字列のままになる。
 *
 * getSeoForPathは完全一致（switch文・正規表現の$アンカー）でルートを判定しているため、
 * 正規化しないまま渡すと「未登録のURL」＝404扱い（noindex, nofollow）に誤判定される。
 * クライアント側（usePageTitle経由）とビルド側（プリレンダリング）の両方が、
 * ルート判定の直前に必ずこの関数を通すこと。
 *
 * ルール：
 * - トップページ「/」はそのまま
 * - それ以外は末尾の「/」（1つ以上連続していても）をすべて削除
 * - クエリ文字列・ハッシュは対象外（呼び出し側がpathnameだけを渡す前提）
 */
export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  const withoutTrailingSlashes = pathname.replace(/\/+$/, "");
  return withoutTrailingSlashes === "" ? "/" : withoutTrailingSlashes;
}

/**
 * decodeURIComponentは不正な%エンコーディング（例: "%"だけ、"%zz"等）に対して
 * URIErrorを投げる。動的セグメント（議員ID・日付など）はURL由来の値のため、
 * 壊れたURLでページ全体が例外停止しないよう、失敗時は元の文字列をそのまま返す。
 */
export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
