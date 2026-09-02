import { useState } from "react";
import { TIMELINE_EVENT_TYPE_LABELS, type TimelineEvent } from "../../lib/personTimeline";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const EVENT_TYPE_BADGE_CLASS: Record<string, string> = {
  election: "bg-tertiary-container text-on-tertiary-container",
  term_start: "bg-primary-container text-on-primary-container",
  term_end: "bg-surface-container-high text-on-surface-variant",
  party: "bg-surface-container-high text-on-surface-variant",
  committee: "bg-secondary-container text-on-secondary-container",
  role: "bg-secondary-container text-on-secondary-container",
  general_question: "bg-primary-container text-on-primary-container",
  speech: "bg-surface-container-high text-on-surface-variant",
  vote: "bg-tertiary-container text-on-tertiary-container",
  proposal: "bg-primary-container text-on-primary-container",
};

const DEFAULT_VISIBLE = 15;

/**
 * 人物単位の統合活動タイムライン表示（Phase120）。
 *
 * 【重要】イベントが無い期間を「活動なし」とは表示しない。データ自体が0件の場合は
 * 呼び出し側で「公開資料からは確認できていません」等と案内すること（このコンポーネントは
 * events.length===0の場合、何も描画しない＝呼び出し側がメッセージを出す設計）。
 */
export function PersonTimeline({ events }: { events: TimelineEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  if (events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, DEFAULT_VISIBLE);

  return (
    <div>
      <ol className="relative space-y-3 border-l border-outline-variant pl-4">
        {visible.map((e) => (
          <li key={e.eventId} className="relative">
            <span
              className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-outline"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <time className="text-xs font-medium text-on-surface-variant">{e.displayDate}</time>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVENT_TYPE_BADGE_CLASS[e.eventType] ?? "bg-surface-container-high text-on-surface-variant"}`}
              >
                {TIMELINE_EVENT_TYPE_LABELS[e.eventType]}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-on-surface">{e.title}</p>
            {e.summary && <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">{e.summary}</p>}
            {e.sourceRefs.length > 0 && (
              <p className="mt-0.5 text-xs text-on-surface-variant">
                出典：
                {e.sourceRefs.map((s, i) => (
                  <span key={i}>
                    {i > 0 && "、"}
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" className={`text-primary underline ${linkClass}`}>
                        {s.label}
                      </a>
                    ) : (
                      s.label
                    )}
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ol>
      {events.length > DEFAULT_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`mt-3 inline-flex min-h-11 items-center rounded-full border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-high ${linkClass}`}
        >
          {expanded ? "表示を減らす" : `すべて表示（${events.length}件）`}
        </button>
      )}
    </div>
  );
}
