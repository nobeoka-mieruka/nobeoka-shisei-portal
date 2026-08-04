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
          {item.definitionNote && <p className="mt-1 text-on-surface-variant">定義：{item.definitionNote}</p>}
          <ul className="mt-1 space-y-1">
            {item.sourceRefs.map((ref, i) => (
              <li key={i} className="text-on-surface-variant">
                {ref.sourceUrl ? (
                  <a
                    href={ref.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {ref.sourceTitle ?? ref.sourceUrl}
                  </a>
                ) : (
                  "出典URL未確認"
                )}
                （{archiveVerificationStatusLabel(ref.verificationStatus)}）
              </li>
            ))}
            {item.sourceRefs.length === 0 && <li className="text-on-surface-variant">出典未登録</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
