import type { CouncilSession, CouncilSessionRecordedVideo } from "../../types";
import { SectionCard } from "../SectionCard";
import { formatJapaneseDate } from "../../config/site";
import { GlobeIcon, PlayIcon } from "../icons";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** 会議録の公開状況。録画の有無とは別に、会議録データ（meetingDays／meetingDaysStatus）だけから決める。 */
function minutesStatusLabel(session: CouncilSession): string {
  const published = (session.meetingDays ?? []).filter((d) => d.minutesUrl).length;
  if (published > 0) return `公開済み（本会議${published}日分）`;
  if (session.meetingDaysStatus === "minutesNotYetPublished") {
    return session.meetingDaysStatusCheckedAt
      ? `公開待ち（${formatJapaneseDate(session.meetingDaysStatusCheckedAt)}確認）`
      : "公開待ち";
  }
  return "確認中";
}

/**
 * 会期の録画配信（延岡市議会YouTube）。市議会は録画を「公式記録ではない」としているため、
 * 会議録の公開状況と並べて別々に示し、会議録の代わりとしては扱わない。
 * 録画のアドレスの無断転載が禁止されているため、リンク先は市議会の公式ページにする。
 */
export function SessionRecordedVideoCard({
  session,
  video,
}: {
  session: CouncilSession;
  video: CouncilSessionRecordedVideo;
}) {
  return (
    <SectionCard title="録画配信（YouTube）">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-on-surface-variant">録画の公開状況</dt>
        <dd className="text-on-surface">
          公開あり（{video.videoTitles.length}本）
          {video.publishedDate ? `／公開日：${formatJapaneseDate(video.publishedDate)}` : "／公開日：確認中"}
        </dd>
        <dt className="text-on-surface-variant">会議録の公開状況</dt>
        <dd className="text-on-surface">{minutesStatusLabel(session)}</dd>
      </dl>

      <p className="mt-3 rounded-lg bg-surface-container-low px-3 py-2 text-sm leading-relaxed text-on-surface">
        <strong className="font-semibold">録画は延岡市議会の公式記録ではありません</strong>
        （市議会の配信ページに明記されています）。このサイトでは、発言や答弁の内容は会議録で確認し、録画を会議録の代わりにはしていません。議員ごとの賛否も、録画からは判定していません。
      </p>

      <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{video.coverageNote}</p>

      <details className="mt-2 text-sm">
        <summary className={`inline-flex min-h-11 cursor-pointer items-center text-primary underline ${linkClass}`}>
          再生リストの動画（{video.videoTitles.length}本）を表示
        </summary>
        <ol className="mt-1 list-decimal space-y-0.5 pl-6 text-on-surface">
          {video.videoTitles.map((title) => (
            <li key={title} className="break-words">
              {title}
            </li>
          ))}
        </ol>
      </details>

      <a
        href={video.sourcePageUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`延岡市議会の録画配信ページ（${video.linkTitle}）を新しいタブで開く`}
        className={`mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${linkClass}`}
      >
        <PlayIcon className="h-3.5 w-3.5" />
        延岡市議会の配信ページで「{video.linkTitle}」を見る
      </a>

      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-on-surface-variant">
        <GlobeIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          出典：延岡市議会「{video.sourcePageTitle}」（ページの更新日：{formatJapaneseDate(video.sourcePageUpdatedDate)}
          ／当サイト確認日：{formatJapaneseDate(video.verifiedAt)}）。録画の公開日は、YouTube上で各動画に表示される公開日です。
          動画のアドレスは市議会が無断転載を禁止しているため、このサイトには掲載せず、市議会の配信ページへご案内しています。
        </span>
      </p>
    </SectionCard>
  );
}
