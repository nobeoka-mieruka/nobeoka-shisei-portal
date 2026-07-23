import mayorData from "../data/mayor.json";
import mayorPromisesData from "../data/mayorPromises.json";
import billVotesData from "../data/billVotes.json";
import { getSortedMayorPressConferences } from "../data/mayorPressConferences";
import type { BillVoteItem, Mayor, MayorPromisesData } from "../types";
import { Avatar } from "../components/Avatar";
import { SnsLinks } from "../components/SnsLinks";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { SourceList } from "../components/SourceList";
import { LastUpdatedInfo } from "../components/LastUpdatedInfo";
import { LastUpdated } from "../components/LastUpdated";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { EmptyState } from "../components/EmptyState";
import { PlayIcon, GlobeIcon, ChartBarIcon, YenIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { Link, useLocation } from "react-router-dom";
import { aggregateCategoryStatus } from "../lib/mayorPromiseStatus";
import { MayorPromiseStatusBadge } from "../components/mayor/MayorPromiseStatusBadge";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const mayor = mayorData as Mayor;
const promisesData = mayorPromisesData as MayorPromisesData;
const pressConferences = getSortedMayorPressConferences();
const billVotes = billVotesData as BillVoteItem[];
const mayorSubmittedBills = billVotes
  .filter((b) => b.proposerType === "mayor")
  .sort((a, b) => (b.votingDate ?? b.submittedDate ?? "").localeCompare(a.votingDate ?? a.submittedDate ?? ""));

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const termStartEntry = mayor.career.find((c) => c.description.includes("市長") && c.description.includes("就任"));
const termStart = termStartEntry?.year ?? mayor.career[mayor.career.length - 1]?.year;

export function MayorPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar name={mayor.name} photoUrl={mayor.photoUrl} color="#375ca8" size="xl" loading="eager" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-on-surface-variant">延岡市長</p>
            <h1 className="text-2xl font-semibold text-on-surface">{mayor.name}</h1>
            <p className="text-sm text-on-surface-variant">{mayor.nameKana}</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-on-surface-variant sm:justify-start">
              {mayor.termCount && <span>当選{mayor.termCount}回</span>}
              {termStart && (
                <>
                  {mayor.termCount && <span aria-hidden>・</span>}
                  <span>任期 {termStart}〜</span>
                </>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-base leading-loose text-on-surface">{mayor.profile}</p>

        <Link
          to="/mayor/policy-progress"
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
        >
          <ChartBarIcon className="h-4 w-4" />
          公約の進捗状況
        </Link>

        <Link
          to="/mayor/entertainment-expenses"
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
        >
          <YenIcon className="h-4 w-4" />
          市長交際費を見る
        </Link>

        {mayor.officialUrl && (
          <a
            href={mayor.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="延岡市長 公式ホームページを新しいタブで開く"
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${linkClass}`}
          >
            <GlobeIcon className="h-4 w-4" />
            公式ホームページ
          </a>
        )}
        <SnsLinks links={mayor.sns} className="mt-4" />
        {mayor.sourceUrl && (
          <a
            href={mayor.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="このページの情報源を新しいタブで開く"
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
          >
            <GlobeIcon className="h-4 w-4" />
            情報源を見る
          </a>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="公約分野" value={mayor.pledges.length} unit="件" />
        <StatCard label="SNS" value={mayor.sns.length} unit="件" />
        <StatCard label="個別公約数" value={promisesData.promises.length} unit="件" />
        <StatCard label="任期開始" value={termStart ?? "情報確認中"} compact />
      </div>

      {mayor.career.length > 0 && (
        <SectionCard title="経歴">
          <ul className="space-y-2">
            {mayor.career.map((c) => (
              <li key={c.id} className="flex gap-3 text-sm">
                <span className="w-28 shrink-0 text-on-surface-variant">{c.year}</span>
                <span className="text-on-surface">{c.description}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="公約">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mayor.pledges.map((p) => {
            const category = promisesData.categories.find((c) => c.id === p.id);
            const status = aggregateCategoryStatus(promisesData.promises, p.id);
            const to = category ? `/mayor/policy-progress#${category.anchor}` : "/mayor/policy-progress";
            return (
              <li key={p.id}>
                <Link
                  to={to}
                  className={`block rounded-lg border border-outline-variant p-3 transition hover:bg-surface-container-high ${linkClass}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-on-surface">{p.title}</p>
                    {status && <MayorPromiseStatusBadge status={status} className="shrink-0" />}
                  </div>
                  {p.category && <p className="mt-1 text-xs text-on-surface-variant">{p.category}</p>}
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-on-surface-variant">
                    {p.description}
                  </p>
                  <p className="mt-2 border-t border-outline-variant pt-2 text-sm text-primary">
                    詳しい進捗と根拠資料を見る
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard title="市長提出議案">
        {mayorSubmittedBills.length > 0 ? (
          <>
            <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
              市長が提出した議案のうち、公開資料で確認できたものを新しい順に表示しています。
            </p>
            <ul className="space-y-2">
              {mayorSubmittedBills.slice(0, 5).map((bill) => (
                <li key={bill.id}>
                  <Link
                    to={`/bills/votes/${bill.id}`}
                    className={`block rounded-lg border border-outline-variant p-3 transition hover:bg-surface-container-high ${linkClass}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                      <span>{bill.billNumber}</span>
                      <span>{bill.session}</span>
                    </div>
                    <p className="mt-1 font-medium text-on-surface">{bill.billTitle}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">議決結果：{bill.result}</p>
                  </Link>
                </li>
              ))}
            </ul>
            {mayorSubmittedBills.length > 5 && (
              <Link to="/bills/votes" className={`mt-3 inline-block text-sm font-medium text-primary hover:underline ${linkClass}`}>
                市長提出議案をすべて見る
              </Link>
            )}
          </>
        ) : (
          <EmptyState message="現在、公開資料を確認しながら順次追加しています。" />
        )}
      </SectionCard>

      {pressConferences.length > 0 && (
        <SectionCard title="市長定例記者会見・発表">
          <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
            延岡市公式ホームページに掲載された市長定例記者会見の発表内容を、そのまま整理して掲載しています。当サイトは延岡市公式サイトではありません。
          </p>
          <ul className="space-y-2">
            {pressConferences.map((c) => (
              <li key={c.date}>
                <Link
                  to={`/mayor/press-conferences/${c.date}`}
                  className={`block rounded-lg border border-outline-variant p-3 transition hover:bg-surface-container-high ${linkClass}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-on-surface">{c.title}</p>
                    <span className="shrink-0 rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
                      延岡市公式発表
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    開催日：{formatJapaneseDate(c.date)}／発表事項{c.announcements.length}件
                  </p>
                  <p className="mt-2 border-t border-outline-variant pt-2 text-sm text-primary">
                    発表内容を見る
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/mayor/press-conferences" className={`mt-3 inline-block text-sm font-medium text-primary hover:underline ${linkClass}`}>
            市長定例記者会見をすべて見る
          </Link>
        </SectionCard>
      )}

      {mayor.policies.length > 0 && (
        <SectionCard title="市政方針">
          <ul className="space-y-3">
            {mayor.policies.map((s) => (
              <li key={s.id} className="rounded-lg border border-outline-variant p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                  {s.date && <span>{s.date}</span>}
                </div>
                <p className="mt-1 font-medium text-on-surface">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{s.body}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {mayor.videos.length > 0 && (
        <SectionCard title="動画">
          <ul className="space-y-2">
            {mayor.videos.map((v) => (
              <li key={v.id}>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${v.title}を新しいタブで開く`}
                  className={`flex items-center gap-3 rounded-lg border border-outline-variant p-3 transition hover:bg-surface-container-high ${linkClass}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
                    <PlayIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-on-surface">{v.title}</span>
                    {v.date && <span className="block text-xs text-on-surface-variant">{v.date}</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {mayor.sources && mayor.sources.length > 0 && (
        <SectionCard title="出典・参考資料">
          <SourceList sources={mayor.sources} />
        </SectionCard>
      )}

      <LastUpdatedInfo verifiedAt={mayor.verifiedAt} updatedAt={mayor.updatedAt} className="px-1" />
      <LastUpdated className="px-1" />

      <CorrectionRequestButton pageName={`${mayor.name}（市長）`} />
    </div>
  );
}
