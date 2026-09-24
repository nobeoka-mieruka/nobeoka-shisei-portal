import { Link } from "react-router-dom";
import { SectionCard } from "./SectionCard";

/**
 * 詳細ページの「つながり（確認できる関連）」欄。
 * 既存データのIDや会議録の同じ位置など、関連が確認できるものだけを並べる（キーワードの一致だけのものは入れない）。
 * 各項目には、何をもって関連とみなしたか（basis）を必ず添える。
 */
export interface RelatedRecordLink {
  key: string;
  /** 資料の種類（例：「会期」「会議録（本会議の日）」）。 */
  kind: string;
  label: string;
  /** サイト内のページ。 */
  to?: string;
  /** 外部の一次資料（to が無い場合に使う）。 */
  href?: string;
  /** 関連とみなした根拠（例：「会議録の同じ発言位置」）。 */
  basis: string;
}

const linkClass =
  "inline-flex min-h-11 items-center break-words text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function RelatedRecords({ links, title = "つながり（確認できる関連）" }: { links: RelatedRecordLink[]; title?: string }) {
  if (links.length === 0) return null;
  return (
    <SectionCard title={title}>
      <p className="mb-2 text-xs leading-relaxed text-on-surface-variant">
        登録済みのIDや会議録の同じ位置などで関連が確認できる資料だけを表示しています（キーワードが一致しただけの資料は含みません）。
      </p>
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.key} className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm">
            <span className="mr-2 rounded-full bg-secondary-container px-2 py-0.5 text-xs text-on-secondary-container">{l.kind}</span>
            {l.to ? (
              <Link to={l.to} className={linkClass}>
                {l.label}
              </Link>
            ) : l.href ? (
              <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`${l.label}（外部サイトが新しいタブで開きます）`} className={linkClass}>
                {l.label}
                <span aria-hidden>（外部サイト）</span>
              </a>
            ) : (
              <span>{l.label}</span>
            )}
            <p className="text-xs text-on-surface-variant">関連の根拠：{l.basis}</p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
