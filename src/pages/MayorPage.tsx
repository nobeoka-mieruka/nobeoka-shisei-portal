import mayorData from "../data/mayor.json";
import mayorPromisesData from "../data/mayorPromises.json";
import type { Mayor, MayorPromisesData } from "../types";
import { Avatar } from "../components/Avatar";
import { SnsLinks } from "../components/SnsLinks";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { SourceList } from "../components/SourceList";
import { LastUpdatedInfo } from "../components/LastUpdatedInfo";
import { LastUpdated } from "../components/LastUpdated";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { PlayIcon, GlobeIcon, ChartBarIcon, YenIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { Link } from "react-router-dom";
import { aggregateCategoryStatus, mayorPromiseStatusClass } from "../lib/mayorPromiseStatus";

const mayor = mayorData as Mayor;
const promisesData = mayorPromisesData as MayorPromisesData;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const termStartEntry = mayor.career.find((c) => c.description.includes("市長") && c.description.includes("就任"));
const termStart = termStartEntry?.year ?? mayor.career[mayor.career.length - 1]?.year;

export function MayorPage() {
  usePageTitle({
    title: `延岡市長 ${mayor.name}`,
    description: `延岡市長${mayor.name}氏のプロフィール、経歴、公約、市政方針を公開資料に基づいて掲載しています。`,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <Breadcrumbs items={[{ label: "ホーム", to: "/" }, { label: "市長情報" }]} />
      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar name={mayor.name} photoUrl={mayor.photoUrl} color="#375ca8" size="xl" />
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
                    {status && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${mayorPromiseStatusClass[status]}`}
                      >
                        {status}
                      </span>
                    )}
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
