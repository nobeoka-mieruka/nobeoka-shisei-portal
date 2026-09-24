import { Link } from "react-router-dom";

/** 「同じキーワードを含む資料」に必ず添える注記（テーマとの関連を断定しない）。 */
export const KEYWORD_MATCH_DISCLAIMER =
  "キーワードの一致を示すものであり、このテーマとの実質的な関連性を断定するものではありません。";

export interface KeywordMatchItem {
  key: string;
  title: string;
  route: string;
  matched: string;
  meta?: string;
  sourceUrl?: string | null;
}

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** 「同じキーワードを含む資料」の1区分（一般質問・議案など）。一致した語を必ず表示する。 */
export function KeywordMatchList({
  heading,
  items,
  limit = 10,
  moreLink,
}: {
  heading: string;
  items: KeywordMatchItem[];
  limit?: number;
  moreLink?: { to: string; label: string };
}) {
  if (items.length === 0) return null;
  const shown = items.slice(0, limit);
  return (
    <div>
      <h3 className="text-sm font-semibold text-on-surface">
        {heading}（{items.length}件）
      </h3>
      <ul className="mt-1 space-y-1.5">
        {shown.map((it) => (
          <li key={it.key} className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm">
            <Link to={it.route} className={`inline-flex min-h-11 items-center break-words text-primary underline ${linkClass}`}>
              {it.title}
            </Link>
            <p className="text-xs text-on-surface-variant">
              一致した語：「{it.matched}」{it.meta ? `／${it.meta}` : ""}
            </p>
            {it.sourceUrl && (
              <a
                href={it.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`「${it.title}」の一次資料（外部サイトが新しいタブで開きます）`}
                className={`inline-flex min-h-11 items-center text-xs text-primary underline ${linkClass}`}
              >
                一次資料
              </a>
            )}
          </li>
        ))}
      </ul>
      {items.length > limit && moreLink && (
        <Link to={moreLink.to} className={`mt-1 inline-flex min-h-11 items-center text-xs text-primary underline ${linkClass}`}>
          {moreLink.label}（残り{items.length - limit}件）
        </Link>
      )}
      {items.length > limit && !moreLink && (
        <p className="mt-1 text-xs text-on-surface-variant">ほか{items.length - limit}件（ここでは先頭{limit}件だけを表示しています）</p>
      )}
    </div>
  );
}
