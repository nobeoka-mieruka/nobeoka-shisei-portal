import { useEffect } from "react";
import { Link } from "react-router-dom";
import { SITE_URL } from "../config/site";

export interface BreadcrumbItem {
  label: string;
  /** 現在のページ（最後の項目）ではリンクを省略する。 */
  to?: string;
}

const JSONLD_ID = "breadcrumb-jsonld";

function upsertJsonLd(data: object): void {
  let el = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = JSONLD_ID;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/** 画面表示のパンくずと、同じデータから生成するBreadcrumbList構造化データ（JSON-LD）。 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const key = items.map((i) => `${i.label}:${i.to ?? ""}`).join("|");

  useEffect(() => {
    upsertJsonLd({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.label,
        ...(item.to ? { item: `${SITE_URL}${item.to}` } : {}),
      })),
    });
    return () => {
      document.getElementById(JSONLD_ID)?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <nav aria-label="パンくずリスト" className="overflow-x-auto">
      <ol className="flex items-center gap-1 text-xs text-on-surface-variant">
        {items.map((item, i) => (
          <li key={i} className={`flex min-w-0 items-center gap-1 ${item.to ? "shrink-0" : "min-w-0"}`}>
            {i > 0 && (
              <span aria-hidden className="shrink-0">
                ＞
              </span>
            )}
            {item.to ? (
              <Link
                to={item.to}
                className="shrink-0 rounded whitespace-nowrap hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="min-w-0 truncate text-on-surface">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
