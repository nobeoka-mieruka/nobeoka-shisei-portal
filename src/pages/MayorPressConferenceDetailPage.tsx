import { Link, useParams } from "react-router-dom";
import { getMayorPressConferenceByDate } from "../data/mayorPressConferences";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { SectionCard } from "../components/SectionCard";
import { MayorPressConferenceAnnouncementCard } from "../components/MayorPressConferenceAnnouncementCard";
import { LastUpdatedInfo } from "../components/LastUpdatedInfo";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { GlobeIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";

export function MayorPressConferenceDetailPage() {
  const { date } = useParams<{ date: string }>();
  const conference = date ? getMayorPressConferenceByDate(date) : undefined;

  usePageTitle({
    title: conference ? conference.title : "記者会見が見つかりません",
    description: conference
      ? `延岡市長定例記者会見（${formatJapaneseDate(conference.date)}）で発表された内容を、延岡市公式ホームページに基づいて掲載しています。`
      : undefined,
    noindex: !conference,
  });

  if (!conference) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
        <Breadcrumbs
          items={[{ label: "ホーム", to: "/" }, { label: "市長情報", to: "/mayor" }, { label: "記者会見" }]}
        />
        <p className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          お探しの記者会見の情報が見つかりませんでした。
        </p>
        <Link
          to="/mayor"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          市長情報に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "ホーム", to: "/" },
          { label: "市長情報", to: "/mayor" },
          { label: conference.title },
        ]}
      />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <span className="inline-flex rounded-full bg-surface-container-lowest px-2.5 py-0.5 text-xs font-semibold text-on-surface">
          延岡市公式発表
        </span>
        <h1 className="mt-2 text-xl font-semibold leading-relaxed text-on-primary-container break-words sm:text-2xl">
          {conference.title}
        </h1>
        <p className="mt-1 text-sm text-on-primary-container/80">開催日：{formatJapaneseDate(conference.date)}</p>
        <a
          href={conference.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="延岡市公式ホームページの記者会見情報を新しいタブで開く"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <GlobeIcon className="h-4 w-4" />
          延岡市公式ホームページで見る
        </a>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        出典：{conference.sourceLabel}／当サイトは延岡市公式サイトではありません。掲載内容は公式資料の記載をそのまま整理したもので、独自の評価や意見は加えていません。
      </p>

      <SectionCard title="発表事項">
        <ul className="space-y-3">
          {conference.announcements.map((a) => (
            <MayorPressConferenceAnnouncementCard key={a.id} announcement={a} />
          ))}
        </ul>
      </SectionCard>

      <LastUpdatedInfo verifiedAt={conference.verifiedAt} className="px-1" />

      <CorrectionRequestButton pageName={conference.title} />
    </div>
  );
}
