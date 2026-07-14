import type { MayorPromiseDocument, MayorPromiseItem, MayorPromiseStatusLabel } from "../../types";
import { GlobeIcon } from "../icons";
import { formatJapaneseDate } from "../../config/site";

const statusClass: Record<MayorPromiseStatusLabel, string> = {
  進行中: "bg-primary-container text-on-primary-container",
  検討中: "bg-surface-variant text-on-surface-variant",
  実施済み: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  確認中: "bg-surface-variant text-on-surface-variant",
};

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

interface PromiseCardProps {
  promise: MayorPromiseItem;
  documents: MayorPromiseDocument[];
}

export function PromiseCard({ promise, documents }: PromiseCardProps) {
  const evidenceDocs: (MayorPromiseDocument & { page?: string })[] = [];
  for (const ref of promise.evidenceItems) {
    const doc = documents.find((d) => d.key === ref.documentKey);
    if (doc) evidenceDocs.push({ ...doc, page: ref.page });
  }

  return (
    <li className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass[promise.statusLabel]}`}
      >
        {promise.statusLabel}
      </span>

      <p className="mt-2 text-sm font-medium leading-relaxed text-on-surface">{promise.promiseText}</p>

      {promise.progressSummary.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-on-surface-variant">現在確認できた取組</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-on-surface-variant">
            {promise.progressSummary.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-on-surface-variant">関連予算</p>
          <p className="mt-1 text-sm text-on-surface">{promise.relatedBudget}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-on-surface-variant">関連議案</p>
          <p className="mt-1 text-sm text-on-surface">{promise.relatedBill}</p>
        </div>
      </div>

      {evidenceDocs.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-on-surface-variant">根拠資料</p>
          <ul className="mt-1 space-y-1.5">
            {evidenceDocs.map((doc) => (
              <li key={doc.key}>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${doc.label}${doc.page ? `（${doc.page}）` : ""}を新しいタブで開く`}
                  className={`inline-flex flex-wrap items-center gap-1.5 rounded text-sm text-primary hover:underline ${linkClass}`}
                >
                  <GlobeIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {doc.label}
                    {doc.page && `（${doc.page}）`}
                  </span>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
                    {doc.sourceType}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-on-surface-variant">最終確認日：{formatJapaneseDate(promise.lastVerified)}</p>
    </li>
  );
}
