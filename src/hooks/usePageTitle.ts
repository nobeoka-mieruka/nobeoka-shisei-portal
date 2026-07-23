import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getSeoForPath } from "../lib/seo";
import { SITE_NAME } from "../config/site";

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
 * 現在のURL（location.pathname）から src/lib/seo.ts の getSeoForPath で導出した
 * title・meta description・canonical・OGP・Twitter Card・robotsをまとめて設定する。
 * ページ固有の値は各ページ側ではなく getSeoForPath 側で一元管理し、
 * ビルド時のプリレンダリングと同じ情報源を使う。
 */
export function usePageTitle(): void {
  const location = useLocation();

  useEffect(() => {
    const seo = getSeoForPath(location.pathname);

    document.title = seo.fullTitle;

    upsertMeta("name", "description", seo.description);
    upsertMeta("name", "robots", seo.robots);
    upsertLink("canonical", seo.canonical);

    upsertMeta("property", "og:title", seo.fullTitle);
    upsertMeta("property", "og:description", seo.description);
    upsertMeta("property", "og:url", seo.canonical);
    upsertMeta("property", "og:image", seo.image);
    upsertMeta("property", "og:type", seo.ogType);
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", "ja_JP");

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", seo.fullTitle);
    upsertMeta("name", "twitter:description", seo.description);
    upsertMeta("name", "twitter:image", seo.image);
  }, [location.pathname]);
}
