import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import updateHistoryData from "../data/updateHistory.json";
import type { UpdateHistoryCategory, UpdateHistoryEntry } from "../types";
import { SectionCard } from "../components/SectionCard";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const history = updateHistoryData as UpdateHistoryEntry[];

const categoryClass: Record<UpdateHistoryCategory, string> = {
  新規追加: "bg-primary-container text-on-primary-container",
  データ更新: "bg-secondary-container text-on-secondary-container",
  表示改善: "bg-tertiary-container text-on-tertiary-container",
  出典追加: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  修正: "bg-surface-variant text-on-surface-variant",
};

export function UpdatesPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const sorted = useMemo(
    () => [...history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <Breadcrumbs items={seo.breadcrumbs} />
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">更新履歴</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          このサイトの機能追加・データ更新・出典追加などの記録です。新しい順に表示しています。
        </p>
      </div>

      <ul className="space-y-3">
        {sorted.map((entry) => (
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
                  className="mt-3 inline-flex items-center rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {entry.linkLabel}
                </Link>
              )}
            </SectionCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
