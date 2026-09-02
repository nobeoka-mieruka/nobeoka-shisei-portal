import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import updateHistoryData from "../data/updateHistory.json";
import type { UpdateHistoryEntry } from "../types";
import { SectionCard } from "../components/SectionCard";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { Pagination } from "../components/Pagination";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";
import { UPDATE_HISTORY_CATEGORY_CLASS, sortUpdateHistoryByDateDesc } from "../lib/updateHistory";

const history = updateHistoryData as UpdateHistoryEntry[];

// 88件（2026-08時点）を1ページに全件表示すると、スマートフォンでスクロールが
// 極端に長くなるため、20件ずつページ分割して表示する。
const UPDATES_PAGE_SIZE = 20;

const categoryClass = UPDATE_HISTORY_CATEGORY_CLASS;

export function UpdatesPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const sorted = useMemo(() => sortUpdateHistoryByDateDesc(history), []);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(sorted.length / UPDATES_PAGE_SIZE));
  const pagedEntries = sorted.slice((page - 1) * UPDATES_PAGE_SIZE, page * UPDATES_PAGE_SIZE);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <div id="updates-heading" className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">更新履歴</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          このサイトの機能追加・データ更新・出典追加などの記録です。新しい順に表示しています。
        </p>
      </div>

      <p className="text-sm text-on-surface-variant">
        {sorted.length}件中、全{totalPages}ページ中{page}ページ目を表示
      </p>

      <ul className="space-y-3">
        {pagedEntries.map((entry) => (
          <li key={entry.id}>
            <SectionCard title={entry.title}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                <span>{formatJapaneseDate(entry.date)}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryClass[entry.category]}`}
                >
                  {entry.category}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-on-surface">{entry.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entry.targetPages.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs text-on-surface-variant"
                  >
                    {p}
                  </span>
                ))}
              </div>
              {entry.sourceUsed && (
                <p className="mt-2 text-xs text-on-surface-variant">使用資料：{entry.sourceUsed}</p>
              )}
              {entry.linkUrl && entry.linkLabel && (
                <Link
                  to={entry.linkUrl}
                  className="mt-3 inline-flex min-h-11 items-center rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {entry.linkLabel}
                </Link>
              )}
            </SectionCard>
          </li>
        ))}
      </ul>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} scrollTargetId="updates-heading" />
    </div>
  );
}
