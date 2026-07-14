import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE } from "../config/site";

export interface SeoOptions {
  /** ページ固有のタイトル。省略時はサイト名のみを表示する。 */
  title?: string;
  /** ページ固有のmeta description。省略時はサイト全体の既定文を使う。 */
  description?: string;
  /** canonical URLに使うパス（クエリ文字列を含めない）。省略時は現在のpathnameを使う。 */
  path?: string;
  /** 検索結果に載せたくないページ（404、データ未存在ページなど）でtrueにする。 */
  noindex?: boolean;
  /** OGP画像の絶対URL。省略時はサイト共通OGP画像を使う。 */
  image?: string;
}

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * ページごとのtitle・meta description・canonical・OGP・Twitter Card・robotsをまとめて設定する。
 * 文字列を渡した場合は従来どおりtitleのみを設定する（後方互換）。
 */
export function usePageTitle(options?: string | SeoOptions): void {
  const location = useLocation();
  const opts: SeoOptions = typeof options === "string" ? { title: options } : (options ?? {});
  const { title, description, path, noindex, image } = opts;

  useEffect(() => {
    const fullTitle = title ? `${title}｜${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;

    const resolvedDescription = description ?? DEFAULT_DESCRIPTION;
    const canonicalUrl = `${SITE_URL}${path ?? location.pathname}`;
    const resolvedImage = image ?? DEFAULT_OG_IMAGE;

    upsertMeta("name", "description", resolvedDescription);
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    upsertLink("canonical", canonicalUrl);

    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", resolvedDescription);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", resolvedImage);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", "ja_JP");

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", resolvedDescription);
    upsertMeta("name", "twitter:image", resolvedImage);

    return () => {
      document.title = SITE_NAME;
    };
  }, [title, description, path, noindex, image, location.pathname]);
}
