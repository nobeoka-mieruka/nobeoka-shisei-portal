import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  /** 現在のページ（最後の項目）ではリンクを省略する。 */
  to?: string;
}

/**
 * 画面表示用のパンくずナビゲーション。
 * BreadcrumbList構造化データは、この見た目と同じ内容（items）から
 * src/lib/seo.ts の breadcrumbJsonLd() が生成し、各ページの <JsonLd> 経由で
 * 出力する（唯一の情報源。ここでは重複してJSON-LDを生成しない）。
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
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
