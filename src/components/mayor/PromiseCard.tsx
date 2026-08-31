import { Link } from "react-router-dom";
import type { MayorPromiseDocument, MayorPromiseItem } from "../../types";
import { GlobeIcon } from "../icons";
import { formatJapaneseDate } from "../../config/site";
import { MayorPromiseStatusBadge } from "./MayorPromiseStatusBadge";
import { isPromiseBudgetConfirmed, isPromiseBillConfirmed } from "../../lib/mayorPromiseStatus";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Phase140：予算・議案の確認状況を短い結論バッジで表す（色だけでなく文字で状態を示す）。 */
function ConclusionPill({ label, confirmed }: { label: string; confirmed: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        confirmed
          ? "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]"
          : "border border-outline-variant text-on-surface-variant"
      }`}
    >
      {label}：{confirmed ? "確認済み" : "資料確認中"}
    </span>
  );
}

interface PromiseCardProps {
  promise: MayorPromiseItem;
  documents: MayorPromiseDocument[];
  /** この公約に「完了した施策（成果）」が1件以上あるか。呼び出し側（一覧ページ）で計算済みの値を渡す。 */
  hasCompletedMeasure?: boolean;
}

export function PromiseCard({ promise, documents, hasCompletedMeasure = false }: PromiseCardProps) {
  const evidenceDocs: (MayorPromiseDocument & { page?: string })[] = [];
  for (const ref of promise.evidenceItems) {
    const doc = documents.find((d) => d.key === ref.documentKey);
    if (doc) evidenceDocs.push({ ...doc, page: ref.page });
  }
  const budgetConfirmed = isPromiseBudgetConfirmed(promise);
  const billConfirmed = isPromiseBillConfirmed(promise);

  return (
    <li className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <MayorPromiseStatusBadge status={promise.statusLabel} />
          <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs text-on-surface-variant">
            {promise.categoryTitle}
          </span>
        </div>
        <Link
          to={`/mayor/policy-progress/${promise.id}`}
          className={`shrink-0 rounded-full bg-primary-container px-3.5 py-1.5 text-xs font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 ${linkClass}`}
        >
          詳細を見る
        </Link>
      </div>

      <p className="mt-2 text-sm font-medium leading-relaxed text-on-surface">{promise.promiseText}</p>
      {promise.citizenSummary && (
        <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{promise.citizenSummary}</p>
      )}

      {/* Phase140項目3：結論（第1層）。詳しい経緯を読まなくても「予算・議案・成果まで
          確認できているか」がひと目で分かるようにする。 */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <ConclusionPill label="予算" confirmed={budgetConfirmed} />
        <ConclusionPill label="議案" confirmed={billConfirmed} />
        {hasCompletedMeasure && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#e0f2e9] px-2.5 py-1 text-xs font-medium text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]">
            成果：完了した取組あり
          </span>
        )}
      </div>

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

      {/* Phase140項目3・17：予算・議案の詳しい調査経緯（第3層）は折りたたみにし、
          結論だけ知りたい人の負担を減らす。一次資料の記載自体は削除しない。 */}
      <details className="mt-3 rounded-lg bg-surface-container-low">
        <summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-xs font-medium text-on-surface-variant [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>▶</span>
            予算・議案の詳しい調査内容を見る
          </span>
        </summary>
        <div className="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-on-surface-variant">関連予算</p>
            <p className="mt-1 text-sm text-on-surface">{promise.relatedBudget}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-on-surface-variant">関連議案</p>
            <p className="mt-1 text-sm text-on-surface">{promise.relatedBill}</p>
          </div>
        </div>
      </details>

      {evidenceDocs.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-on-surface-variant">出典を見る（一次資料）</p>
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
      ) : (
        <p className="mt-3 text-xs text-on-surface-variant">根拠資料を確認中</p>
      )}

      <p className="mt-3 text-xs text-on-surface-variant">最終確認日：{formatJapaneseDate(promise.lastVerified)}</p>
    </li>
  );
}
