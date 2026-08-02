import { useState } from "react";
import type { TopicAggregate } from "../../lib/councilSpeeches";

const INITIAL_VISIBLE_COUNT = 10;

interface QuestionTopicChartProps {
  topics: TopicAggregate[];
  /** テーマ行クリック時（会期別質問一覧の絞り込みに使う）。 */
  onSelectTopic?: (topic: string) => void;
  selectedTopic?: string;
}

/**
 * 議員1名分の「質問テーマの傾向」横棒グラフ。
 * 棒の長さは、この議員の最大会期数を100%とした相対値。件数（○会期）は必ず文字でも表示し、
 * 棒の長さだけで判断させない。他議員との比較は行わない（このコンポーネント単体では不可能な設計）。
 */
export function QuestionTopicChart({ topics, onSelectTopic, selectedTopic }: QuestionTopicChartProps) {
  const [expanded, setExpanded] = useState(false);

  if (topics.length === 0) return null;

  const maxCount = Math.max(...topics.map((t) => t.sessionCount));
  const visibleTopics = expanded ? topics : topics.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMore = topics.length > INITIAL_VISIBLE_COUNT;

  return (
    <div>
      <ul className="space-y-2.5">
        {visibleTopics.map((t) => {
          const widthPercent = maxCount > 0 ? (t.sessionCount / maxCount) * 100 : 0;
          const isSelected = selectedTopic === t.topic;
          return (
            <li key={t.topic}>
              <button
                type="button"
                onClick={() => onSelectTopic?.(isSelected ? "" : t.topic)}
                aria-pressed={isSelected}
                aria-label={`${t.topic}：${t.sessionCount}会期で確認`}
                className={`w-full rounded-lg p-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isSelected ? "bg-primary-container" : "hover:bg-surface-container-high"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 break-words text-sm font-medium text-on-surface">{t.topic}</span>
                  <span className="shrink-0 text-xs text-on-surface-variant">{t.sessionCount}会期</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className={`h-full rounded-full ${isSelected ? "bg-primary" : "bg-primary/70"}`}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {expanded ? "折りたたむ" : `すべて表示（${topics.length}件）`}
        </button>
      )}
    </div>
  );
}
