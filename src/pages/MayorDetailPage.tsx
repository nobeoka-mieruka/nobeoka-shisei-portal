import { Link, useLocation, useParams } from "react-router-dom";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import type { ArchiveMayor, ArchiveMayorTerm } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { BackLink } from "../components/BackLink";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { GlobeIcon, ClockIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { archiveVerificationStatusLabel, termsForMayor } from "../lib/archiveMayors";
import { buildCompareSearchParams } from "../lib/archiveCompare";
import { fiscalYearOfIsoDate } from "../lib/archiveTimeline";

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MayorDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const mayor = archiveMayors.find((m) => m.slug === slug);

  if (!mayor) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to="/mayors" label="歴代市長一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された市長情報は見つかりませんでした。
        </p>
      </div>
    );
  }

  const terms = termsForMayor(archiveMayorTerms, mayor.id);
  const mayorById = new Map(archiveMayors.map((m) => [m.id, m]));

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/mayors" label="歴代市長一覧に戻る" />

      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-on-surface">{mayor.name}</h1>
          {mayor.isCurrentMayor && (
            <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
              現職
            </span>
          )}
        </div>
        {mayor.nameKana && <p className="mt-1 text-sm text-on-surface-variant">{mayor.nameKana}</p>}
        {mayor.profile && <p className="mt-3 text-base leading-loose text-on-surface">{mayor.profile}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {mayor.isCurrentMayor && (
            <Link
              to="/mayor"
              className={`inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
            >
              現職市長の公約・市政方針を見る
            </Link>
          )}
          <Link
            to={`/compare/mayors?${buildCompareSearchParams([mayor.id]).toString()}`}
            className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
          >
            この市長を比較
          </Link>
          {terms[0] && (
            <Link
              to={`/timeline/${fiscalYearOfIsoDate(terms[0].termStart)}`}
              className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
            >
              この市長の任期を年表で見る
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">任期</h2>
        {terms.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">任期情報は確認中です。</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {terms.map((term) => {
              const previous = term.previousMayorId ? mayorById.get(term.previousMayorId) : undefined;
              const next = term.nextMayorId ? mayorById.get(term.nextMayorId) : undefined;
              return (
                <li key={term.id} className="rounded-lg border border-outline-variant p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-on-surface">
                    <ClockIcon className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
                    {term.termNumber ? `第${term.termNumber}期　` : ""}
                    {formatJapaneseDate(term.termStart)}〜{term.termEnd ? formatJapaneseDate(term.termEnd) : "現在"}
                  </p>
                  <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-2">
                    <div>
                      <dt className="inline">選挙区分：</dt>
                      <dd className="inline">{term.electionType ?? "確認中"}</dd>
                    </div>
                    <div>
                      <dt className="inline">就任当時人口：</dt>
                      <dd className="inline">
                        {term.populationAtStart != null ? `${term.populationAtStart.toLocaleString()}人` : "確認中"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">前任市長：</dt>
                      <dd className="inline">
                        {previous ? <Link to={`/mayors/${previous.slug}`} className={`text-primary hover:underline ${linkClass}`}>{previous.name}</Link> : "確認中"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">後任市長：</dt>
                      <dd className="inline">
                        {next ? <Link to={`/mayors/${next.slug}`} className={`text-primary hover:underline ${linkClass}`}>{next.name}</Link> : "確認中"}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {mayor.sourceRefs.length > 0 && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">出典・確認状況</h2>
          <ul className="mt-2 space-y-2">
            {mayor.sourceRefs.map((ref, i) => (
              <li key={`${ref.sourceUrl ?? "source"}-${i}`} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {ref.sourceUrl ? (
                    <a
                      href={ref.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${ref.sourceTitle ?? "出典"}を新しいタブで開く`}
                      className={`inline-flex items-center gap-1.5 text-primary hover:underline ${linkClass}`}
                    >
                      <GlobeIcon className="h-4 w-4 shrink-0" aria-hidden />
                      {ref.sourceTitle ?? ref.sourceUrl}
                    </a>
                  ) : (
                    <span className="text-on-surface-variant">出典URL未確認</span>
                  )}
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                    {archiveVerificationStatusLabel(ref.verificationStatus)}
                  </span>
                </div>
                {ref.notes && <p className="mt-1 text-xs text-on-surface-variant">{ref.notes}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName={`${mayor.name}（歴代市長）`} />
      </div>
    </div>
  );
}
