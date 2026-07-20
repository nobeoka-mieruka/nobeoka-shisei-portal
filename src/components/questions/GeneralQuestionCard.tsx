import { useState } from "react";
import { Link } from "react-router-dom";
import type { GeneralQuestionItem } from "../../types";
import { formatJapaneseDate } from "../../config/site";
import { GlobeIcon, PlayIcon } from "../icons";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const questionTypeStyle: Record<GeneralQuestionItem["questionType"], string> = {
  一般質問: "bg-primary-container text-on-primary-container",
  代表質問: "bg-tertiary-container text-on-tertiary-container",
};

function videoHref(item: GeneralQuestionItem): string {
  if (!item.videoUrl) return "";
  if (item.videoStartSeconds == null) return item.videoUrl;
  const sep = item.videoUrl.includes("?") ? "&" : "?";
  return `${item.videoUrl}${sep}t=${item.videoStartSeconds}s`;
}

function videoLabel(item: GeneralQuestionItem): string {
  if (item.videoStartSeconds != null) {
    return `質問開始位置から再生（${item.videoStartLabel ?? `${item.videoStartSeconds}秒`}）`;
  }
  return "議会映像を見る";
}

export function GeneralQuestionCard({ item }: { item: GeneralQuestionItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <span>{formatJapaneseDate(item.questionDate)}</span>
          <span>{item.sessionName}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${questionTypeStyle[item.questionType]}`}>
            {item.questionType}
          </span>
        </div>
        <Link
          to={`/questions/${item.id}`}
          className={`shrink-0 rounded-full bg-primary-container px-3.5 py-1.5 text-xs font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 ${linkClass}`}
        >
          詳細を見る
        </Link>
      </div>

      <div className="mt-2">
        <Link
          to={`/members/${item.memberId}`}
          className={`inline-block py-1 text-sm font-medium text-primary hover:underline ${linkClass}`}
        >
          {item.memberName}
        </Link>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`block w-full text-left ${linkClass}`}
        >
          <h3 className="text-base font-semibold leading-snug text-on-surface">{item.title}</h3>
        </button>
      </div>

      {item.topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.topics.map((topic) => (
            <span key={topic} className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant">
              {topic}
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{item.summary}</p>
      <p className="mt-1 text-xs text-on-surface-variant">質問項目 {item.questionItems.length}件</p>

      {(item.noticeUrl || item.transcriptUrl || item.videoUrl) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.noticeUrl && (
            <a
              href={item.noticeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.title}の質問通告書を新しいタブで開く`}
              className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-high ${linkClass}`}
            >
              <GlobeIcon className="h-3.5 w-3.5" />
              質問通告書を見る
            </a>
          )}
          {item.transcriptUrl && (
            <a
              href={item.transcriptUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.title}の会議録を新しいタブで開く`}
              className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-high ${linkClass}`}
            >
              <GlobeIcon className="h-3.5 w-3.5" />
              会議録を見る
            </a>
          )}
          {item.videoUrl && (
            <a
              href={videoHref(item)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.title}の議会映像を新しいタブで開く`}
              className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-high ${linkClass}`}
            >
              <PlayIcon className="h-3.5 w-3.5" />
              {videoLabel(item)}
            </a>
          )}
          {item.documentUrl && (
            <a
              href={item.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.title}の質問資料を新しいタブで開く`}
              className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-high ${linkClass}`}
            >
              <GlobeIcon className="h-3.5 w-3.5" />
              質問資料を見る
            </a>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={`mt-3 text-sm font-medium text-primary hover:underline ${linkClass}`}
      >
        {expanded ? "閉じる" : "詳しく見る"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-outline-variant pt-3">
          {item.questionItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-on-surface-variant">質問項目</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-on-surface">
                {item.questionItems.map((qi, i) => (
                  <li key={i}>{qi}</li>
                ))}
              </ol>
            </div>
          )}
          <div className="text-xs leading-relaxed text-on-surface-variant">
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.sourceTitle}を新しいタブで開く`}
              className={`inline-flex items-center gap-1 text-primary hover:underline ${linkClass}`}
            >
              <GlobeIcon className="h-3.5 w-3.5" />
              {item.sourceTitle}
            </a>
            <p className="mt-1">公表機関：{item.sourceOrganization}</p>
            <p className="mt-1">最終確認：{formatJapaneseDate(item.lastVerified)}</p>
            {item.notes && <p className="mt-1">{item.notes}</p>}
          </div>
        </div>
      )}
    </li>
  );
}
