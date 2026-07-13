import type { GeneralQuestion } from "../types";
import { SectionCard } from "./SectionCard";
import { PlayIcon } from "./icons";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function GeneralQuestionsSection({ questions }: { questions: GeneralQuestion[] }) {
  return (
    <SectionCard title={`一般質問一覧（${questions.length}件）`}>
      {questions.length > 0 ? (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li key={q.id} className="rounded-lg border border-outline-variant p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                <span>{q.date}</span>
                <span aria-hidden>・</span>
                <span>{q.session}</span>
              </div>
              <p className="mt-1 font-medium text-on-surface">{q.title}</p>
              {q.summary && <p className="mt-1 text-sm text-on-surface-variant">{q.summary}</p>}
              {q.answerSummary && (
                <p className="mt-1 text-sm text-on-surface-variant">市側答弁：{q.answerSummary}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {q.videoUrl && (
                  <a
                    href={q.videoUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${q.title}の質問動画を新しいタブで開く`}
                    className={`inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-3 py-1.5 text-xs font-medium text-on-tertiary-container transition hover:opacity-90 ${linkClass}`}
                  >
                    <PlayIcon className="h-4 w-4" />
                    質問動画を見る
                  </a>
                )}
                {q.minutesUrl && (
                  <a
                    href={q.minutesUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${q.title}の会議録を新しいタブで開く`}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
                  >
                    会議録を見る
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-sm text-on-surface-variant">現在、一般質問データを整理しています。</p>
      )}
    </SectionCard>
  );
}
