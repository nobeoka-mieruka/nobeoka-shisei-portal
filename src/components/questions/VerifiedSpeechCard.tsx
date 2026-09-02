import { Link } from "react-router-dom";
import type { CouncilSpeech } from "../../types";
import { formatJapaneseDate } from "../../config/site";
import { speechSummaryStatusLabel } from "../../lib/councilSpeeches";
import { GlobeIcon } from "../icons";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 公式会議録本文を基にした確認済み質問・答弁（councilSpeechSummaries.json）1件分のカード。
 * 質問通告書ベースのGeneralQuestionCardとは元資料が異なるため、混同しないよう別コンポーネントとしている。
 */
export function VerifiedSpeechCard({
  speech,
  memberName,
  memberHref,
  sessionTitle,
}: {
  speech: CouncilSpeech;
  memberName: string;
  memberHref: string;
  sessionTitle: string;
}) {
  const detailHref = `/members/${speech.memberId}/questions/${speech.id}`;

  return (
    <li className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <span>{speech.date ? formatJapaneseDate(speech.date) : "発言日確認中"}</span>
          <span>{sessionTitle}</span>
          <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-medium text-on-tertiary-container">
            {speech.speechType}
          </span>
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
            会議録ベース・{speechSummaryStatusLabel(speech.summaryStatus)}
          </span>
        </div>
        <Link
          to={detailHref}
          className={`shrink-0 rounded-full bg-primary-container px-3.5 py-1.5 text-xs font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 ${linkClass}`}
        >
          詳細を見る
        </Link>
      </div>

      <div className="mt-2">
        <Link to={memberHref} className={`inline-block py-1 text-sm font-medium text-primary underline ${linkClass}`}>
          {memberName}
        </Link>
        <Link to={detailHref} className={`block w-full text-left ${linkClass}`}>
          <h2 className="text-base font-semibold leading-snug text-on-surface">
            {memberName}議員の{speech.speechType}
          </h2>
        </Link>
      </div>

      {speech.topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {speech.topics.map((topic) => (
            <span key={topic} className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant">
              {topic}
            </span>
          ))}
        </div>
      )}

      {speech.shortSummary && <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{speech.shortSummary}</p>}
      <p className="mt-1 text-xs text-on-surface-variant">質問項目 {speech.questionItems.length}件</p>

      {speech.summarySources.length > 0 && speech.summarySources[0]?.sourceUrl && (
        <div className="mt-3">
          <a
            href={speech.summarySources[0].sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="公式会議録を新しいタブで開く"
            className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-high ${linkClass}`}
          >
            <GlobeIcon className="h-3.5 w-3.5" />
            公式会議録を見る
          </a>
        </div>
      )}
    </li>
  );
}
