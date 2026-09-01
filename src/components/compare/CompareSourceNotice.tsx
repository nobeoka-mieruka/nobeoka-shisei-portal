import { archiveVerificationStatusLabel } from "../../lib/archiveMayors";
import type { CompareSourceNoticeItem } from "../../types/compare";

interface CompareSourceNoticeProps {
  items: CompareSourceNoticeItem[];
  className?: string;
}

/**
 * 比較表の下に並べる、比較対象ごとの出典一覧・定義注記の共通表示。
 * 出典URLが無い場合は「出典URL未確認」、出典自体が0件の場合は「出典未登録」と表示し、
 * 確認できないことを0や空欄と混同しない。
 */
export function CompareSourceNotice({ items, className = "" }: CompareSourceNoticeProps) {
  return (
    <div className={`mt-4 space-y-3 ${className}`}>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="rounded-lg border border-outline-variant p-3 text-xs">
          <p className="font-semibold text-on-surface">{item.label}の出典</p>
          {(item.definitionNote || item.unit) && (
            <p className="mt-1 text-on-surface-variant">
              {item.unit && <>単位：{item.unit}　</>}
              {item.definitionNote && <>定義：{item.definitionNote}</>}
            </p>
          )}
          <ul className="mt-1 space-y-1">
            {item.sourceRefs.map((ref, i) => (
              <li key={i} className="text-on-surface-variant">
                {ref.sourceUrl ? (
                  <a
                    href={ref.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-words text-primary hover:underline"
                  >
                    {ref.sourceTitle ?? ref.sourceUrl}
                  </a>
                ) : (
                  "出典URL未確認"
                )}
                {ref.pageNumber != null && <>（p.{ref.pageNumber}）</>}
                （{archiveVerificationStatusLabel(ref.verificationStatus)}）
                {(ref.sourceOrganization || ref.sourcePublishedDate || ref.accessedAt) && (
                  <span className="block text-on-surface-variant/80">
                    {ref.sourceOrganization && <>公表機関：{ref.sourceOrganization}　</>}
                    {ref.sourcePublishedDate && <>公表日：{ref.sourcePublishedDate}　</>}
                    {ref.accessedAt && <>取得日：{ref.accessedAt}</>}
                  </span>
                )}
              </li>
            ))}
            {item.sourceRefs.length === 0 && <li className="text-on-surface-variant">出典未登録</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
