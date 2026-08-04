import { Link, useLocation } from "react-router-dom";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import type { ArchiveMayor, ArchiveMayorTerm } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LandmarkIcon, ClockIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { mayorTermCountLabel, termsForMayor } from "../lib/archiveMayors";

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MayorsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  return (
    <div className="px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <LandmarkIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">歴代市長（延岡市政アーカイブ）</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市長の任期・経歴を公式資料で確認できた範囲で整理しています。市長個人への評価・採点は行っていません。
        </p>
      </div>

      <div className="mb-5 rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        現在登録しているのは現職市長のみです。前任・歴代の市長については、公式資料（市政要覧・市議会だより等）で在任期間・経歴を確認できたものから順次追加します。未登録の期間があることは、情報が「無い」ことを意味しません。
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {archiveMayors.map((mayor) => {
          const terms = termsForMayor(archiveMayorTerms, mayor.id);
          const latestTerm = terms.at(-1);
          return (
            <li key={mayor.id}>
              <Link
                to={`/mayors/${mayor.slug}`}
                className={`block h-full rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-on-surface">{mayor.name}</p>
                  {mayor.isCurrentMayor && (
                    <span className="rounded-full bg-primary-container px-2 py-0.5 text-xs font-semibold text-on-primary-container">
                      現職
                    </span>
                  )}
                </div>
                {mayor.nameKana && <p className="mt-0.5 text-xs text-on-surface-variant">{mayor.nameKana}</p>}
                <p className="mt-2 flex items-center gap-1 text-xs text-on-surface-variant">
                  <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {latestTerm
                    ? `任期 ${formatJapaneseDate(latestTerm.termStart)}〜${
                        latestTerm.termEnd ? formatJapaneseDate(latestTerm.termEnd) : "現在"
                      }（${mayorTermCountLabel(mayor, archiveMayorTerms)}）`
                    : "任期情報：確認中"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 px-1 text-xs leading-relaxed text-on-surface-variant">
        現職市長の公約・市政方針・記者会見等の詳細は
        <Link to="/mayor" className={`mx-1 text-primary hover:underline ${linkClass}`}>
          市長情報ページ
        </Link>
        でも確認できます。
      </p>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="歴代市長" />
      </div>
    </div>
  );
}
