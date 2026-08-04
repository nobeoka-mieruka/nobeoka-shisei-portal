import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import type { ArchiveMayor, ArchiveMayorTerm } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { StatCard } from "../components/StatCard";
import { LandmarkIcon, ClockIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { decadeLabel, earliestTermStart, isActingMayorTerm, mayorTermCountLabel, termsForMayor } from "../lib/archiveMayors";
import archivePoliciesData from "../data/archivePolicies.json";
import type { ArchivePolicy } from "../types/historicalArchive";

const archivePolicies = archivePoliciesData as ArchivePolicy[];

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

type SortOrder = "newest" | "oldest";

export function MayorsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const actingOnlyCount = useMemo(
    () =>
      archiveMayors.filter((mayor) => {
        const terms = termsForMayor(archiveMayorTerms, mayor.id);
        return terms.length > 0 && terms.every(isActingMayorTerm);
      }).length,
    [],
  );

  // 収録状況スタット（自動集計。手入力値は使わない）。
  const termDates = archiveMayorTerms.map((t) => t.termStart).filter(Boolean).sort();
  const coveragePeriod = termDates.length > 0 ? `${termDates[0].slice(0, 4)}年〜現在` : "確認中";
  const dayPreciseTermCount = archiveMayorTerms.filter((t) => (t.termStartPrecision ?? "day") === "day").length;
  const unknownStatusCount = archiveMayors.filter((m) => m.status === "unknown").length;
  const profileConfirmedCount = archiveMayors.filter((m) => m.profile && m.profile.length > 0).length;
  const policyConfirmedMayorIds = new Set(archivePolicies.filter((p) => p.ownerType === "mayor").map((p) => p.ownerId));
  const policyConfirmedCount = archiveMayors.filter((m) => policyConfirmedMayorIds.has(m.id)).length;
  const latestVerifiedAt = archiveMayors
    .map((m) => m.lastVerifiedAt)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  const sortedMayors = useMemo(() => {
    const withStart = archiveMayors.map((mayor) => ({ mayor, start: earliestTermStart(mayor, archiveMayorTerms) ?? "" }));
    withStart.sort((a, b) => (sortOrder === "newest" ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
    return withStart.map((w) => w.mayor);
  }, [sortOrder]);

  const groups = useMemo(() => {
    const byDecade = new Map<string, ArchiveMayor[]>();
    for (const mayor of sortedMayors) {
      const start = earliestTermStart(mayor, archiveMayorTerms);
      const label = start ? decadeLabel(start) : "年代不明";
      if (!byDecade.has(label)) byDecade.set(label, []);
      byDecade.get(label)!.push(mayor);
    }
    return [...byDecade.entries()];
  }, [sortedMayors]);

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
          延岡市長の任期・経歴を公式資料で確認できた範囲で整理しています。市長個人への評価・採点は行っていません。全{archiveMayors.length}名を登録しています（1933年の市制施行〜現在）。
          {actingOnlyCount > 0 &&
            `うち${actingOnlyCount}名は公選の市長ではなく、市長職務代理者（副市長等）としての在任です。`}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="収録人数" value={archiveMayors.length} unit="名" />
        <StatCard label="収録任期数" value={archiveMayorTerms.length} unit="件" />
        <StatCard label="収録期間" value={coveragePeriod} compact />
        <StatCard label="日単位で確認済みの任期" value={dayPreciseTermCount} unit="件" hint={`全${archiveMayorTerms.length}件中`} />
        <StatCard label="経歴を確認できた人数" value={profileConfirmedCount} unit="名" />
        <StatCard label="政策・公約を確認できた人数" value={policyConfirmedCount} unit="名" />
        <StatCard label="調査中（在任状況未確認）" value={unknownStatusCount} unit="名" />
      </div>

      <div className="mb-5 rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        就任・退任の年月日は、延岡市公式資料（近代の年表等）で年月まで確認できたものが中心です。日単位の日付はWikipedia等の二次資料にとどまり独立資料で未確認のものを含みます。前任・後任市長の間に登録期間が無い箇所は、資料で確認できない空白期間であり、職務代理者を推測で補ってはいません（2026年8月時点で13件の空白期間が未解消です）。経歴・政策の確認は一部にとどまります。
      </div>

      <div className="mb-4 flex items-center justify-end gap-2">
        <span className="text-xs text-on-surface-variant">並び順：</span>
        <div className="inline-flex overflow-hidden rounded-full border border-outline-variant" role="group" aria-label="並び替え">
          {(["newest", "oldest"] as SortOrder[]).map((order) => (
            <button
              key={order}
              type="button"
              onClick={() => setSortOrder(order)}
              aria-pressed={sortOrder === order}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                sortOrder === order ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {order === "newest" ? "新しい順" : "古い順"}
            </button>
          ))}
        </div>
      </div>

      {groups.map(([decade, mayors]) => (
        <section key={decade} className="mb-6">
          <h2 className="mb-2 px-1 text-sm font-semibold text-on-surface-variant">{decade}</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mayors.map((mayor) => {
              const terms = termsForMayor(archiveMayorTerms, mayor.id);
              const latestTerm = terms.at(-1);
              const hasActingTerm = terms.some(isActingMayorTerm);
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
                      {hasActingTerm && (
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                          職務代理を含む
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
        </section>
      ))}

      <p className="mt-6 px-1 text-xs leading-relaxed text-on-surface-variant">
        現職市長の公約・市政方針・記者会見等の詳細は
        <Link to="/mayor" className={`mx-1 text-primary hover:underline ${linkClass}`}>
          市長情報ページ
        </Link>
        でも確認できます。市長を選んで比較したい場合は
        <Link to="/compare/mayors" className={`mx-1 text-primary hover:underline ${linkClass}`}>
          歴代市長の比較
        </Link>
        をご利用ください。
      </p>

      <LastUpdated
        className="mt-4"
        dataAsOfLabel="歴代市長データの最終確認日（最新値）"
        dataAsOf={latestVerifiedAt ? formatJapaneseDate(latestVerifiedAt) : undefined}
      />

      <div className="mt-4">
        <CorrectionRequestButton pageName="歴代市長" />
      </div>
    </div>
  );
}
