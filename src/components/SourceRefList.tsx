import type { ArchiveSourceRef } from "../types/historicalArchive";
import { archiveVerificationStatusLabel } from "../lib/archiveMayors";
import { formatJapaneseDate } from "../config/site";
import { GlobeIcon } from "./icons";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * TASK-087：出典1件分の表示（出典リンク・確認状態・確認日・注記）。
 * MayorDetailPage・MemberFormerDetailPage・FinanceBudgetPage・PolicyDetailPage・
 * CouncilDocumentsArchivePage等で個別に実装されていたほぼ同一のマークアップを
 * 一本化した。従来は出典URL・確認状態のみで、accessedAt（サイト運営者がこの資料に
 * アクセスした日）が収集済みなのに未表示だったため、あわせて追加した。
 */
export function SourceRefList({ refs }: { refs: ArchiveSourceRef[] }) {
  if (refs.length === 0) return null;
  return (
    <ul className="space-y-2">
      {refs.map((ref, i) => (
        <li key={`${ref.sourceUrl ?? "source"}-${i}`} className="text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {ref.sourceUrl ? (
              <a
                href={ref.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${ref.sourceTitle ?? "出典"}を新しいタブで開く`}
                className={`inline-flex items-center gap-1.5 text-primary hover:underline ${linkClass}`}
              >
                <GlobeIcon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="break-words">{ref.sourceTitle ?? ref.sourceUrl}</span>
              </a>
            ) : (
              <span className="break-words text-on-surface-variant">{ref.sourceTitle ?? "出典URL未確認"}</span>
            )}
            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
              {archiveVerificationStatusLabel(ref.verificationStatus)}
            </span>
          </div>
          {ref.accessedAt && (
            <p className="mt-0.5 text-xs text-on-surface-variant">確認日：{formatJapaneseDate(ref.accessedAt)}</p>
          )}
          {ref.notes && <p className="mt-1 text-xs text-on-surface-variant">{ref.notes}</p>}
        </li>
      ))}
    </ul>
  );
}
