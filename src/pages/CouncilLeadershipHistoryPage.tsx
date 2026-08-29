import { Link, useLocation } from "react-router-dom";
import archiveCouncilLeadershipData from "../data/archiveCouncilLeadership.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import type { ArchiveCouncilLeadershipRole, ArchiveCouncilLeadershipTerm } from "../types/historicalArchive";
import type { ArchiveMemberProfile } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { SourceRefList } from "../components/SourceRefList";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { CsvDownloadButton } from "../components/CsvDownloadButton";
import { LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate, SITE_URL } from "../config/site";
import type { CsvColumn } from "../lib/csv";

const archiveCouncilLeadership = archiveCouncilLeadershipData as ArchiveCouncilLeadershipTerm[];
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function profileFor(memberProfileId?: string): ArchiveMemberProfile | undefined {
  if (!memberProfileId) return undefined;
  return archiveMemberProfiles.find((p) => p.id === memberProfileId);
}

function termLabel(t: ArchiveCouncilLeadershipTerm): string {
  const start = formatJapaneseDate(t.termStart);
  const end = t.termEnd ? formatJapaneseDate(t.termEnd) : "退任日確認中";
  return `${start}〜${end}`;
}

const LEADERSHIP_CSV_COLUMNS: CsvColumn<ArchiveCouncilLeadershipTerm>[] = [
  { header: "役職", value: (t) => t.role },
  { header: "代", value: (t) => `第${t.ordinal}代` },
  { header: "氏名", value: (t) => t.name },
  { header: "読み仮名", value: (t) => t.nameKana },
  { header: "在任開始", value: (t) => t.termStart },
  { header: "在任終了", value: (t) => t.termEnd },
  { header: "出典URL", value: (t) => t.sourceRefs.map((r) => r.sourceUrl).filter((u): u is string => !!u) },
  { header: "最終確認日", value: (t) => t.lastVerifiedAt },
  { header: "サイト内URL", value: () => `${SITE_URL}/committees/leadership-history` },
];

function LeadershipSection({ role, entries }: { role: ArchiveCouncilLeadershipRole; entries: ArchiveCouncilLeadershipTerm[] }) {
  const sorted = [...entries].sort((a, b) => a.termStart.localeCompare(b.termStart));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return (
    <SectionCard title={`歴代${role}（${entries.length}件、第${first.ordinal}代〜第${last.ordinal}代）`} className="mb-4">
      <ul className="space-y-3">
        {sorted.map((t) => {
          const profile = profileFor(t.memberProfileId);
          return (
            <li key={t.id} className="rounded-lg border border-outline-variant p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 rounded-full bg-primary-container px-2 py-0.5 text-xs font-semibold text-on-primary-container">
                  第{t.ordinal}代
                </span>
                <p className="text-sm font-semibold text-on-surface">{t.name}</p>
                {t.nameKana && <span className="text-xs text-on-surface-variant">（{t.nameKana}）</span>}
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">在任：{termLabel(t)}</p>
              {profile && (
                <Link
                  to={`/members/former/${profile.slug}`}
                  className={`mt-1 inline-block text-xs font-medium text-primary hover:underline ${linkClass}`}
                >
                  プロフィール・発言記録を見る →
                </Link>
              )}
              {t.notes && <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{t.notes}</p>}
              <div className="mt-2">
                <SourceRefList refs={t.sourceRefs} />
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

export function CouncilLeadershipHistoryPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const chairs = archiveCouncilLeadership.filter((t) => t.role === "議長");
  const viceChairs = archiveCouncilLeadership.filter((t) => t.role === "副議長");
  const latestVerifiedAt = archiveCouncilLeadership
    .map((t) => t.lastVerifiedAt)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <LandmarkIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">
            歴代議長・副議長（2001〜2012年分、確認済み）
          </h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市議会の歴代議長・副議長のうち、延岡市公式ホームページが公開する「延岡市史（市制80周年記念10年史）」で日単位の在任期間つきで確認できた範囲（2001年〜2012年、議長6件・副議長11件）を整理しています。当サイトは公式サイトではありません。議員個人への評価は行っていません。
        </p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        <span className="font-semibold text-on-surface">収録状況：</span>
        延岡市議会創設（初代）〜2001年以前の分、および2012年以降（第53代以降の議長・第61代以降の副議長）の分は、現時点でこのページには含まれていません（「議長不在」ではなく「調査中」です）。収録が進み次第、順次追加します。
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="歴代議長" value={chairs.length} unit="件" />
        <StatCard label="歴代副議長" value={viceChairs.length} unit="件" />
        <StatCard label="収録期間" value="2001〜2012年" compact />
        <StatCard label="出典" value="延岡市史" compact />
      </div>

      <div className="flex justify-end">
        <CsvDownloadButton filename="nobeoka-council-leadership.csv" rows={archiveCouncilLeadership} columns={LEADERSHIP_CSV_COLUMNS} />
      </div>

      <LeadershipSection role="議長" entries={chairs} />
      <LeadershipSection role="副議長" entries={viceChairs} />

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        現在の常任委員会・議会運営委員会・特別委員会の委員長・副委員長は
        <Link to="/committees" className={`mx-1 text-primary hover:underline ${linkClass}`}>
          委員会一覧
        </Link>
        でご覧いただけます。出典：
        <a
          href="https://www.city.nobeoka.miyazaki.jp/uploaded/attachment/4386.pdf#page=192"
          target="_blank"
          rel="noopener noreferrer"
          className={`mx-1 text-primary hover:underline ${linkClass}`}
        >
          延岡市史（市制80周年記念10年史）第2編第9章第3節「議員と正副議長」
        </a>
        （延岡市公式ホームページ）。
      </p>

      <LastUpdated
        className="mt-2"
        dataAsOfLabel="歴代議長・副議長データの最終確認日"
        dataAsOf={latestVerifiedAt ? formatJapaneseDate(latestVerifiedAt) : undefined}
      />

      <CorrectionRequestButton pageName="歴代議長・副議長" />
    </div>
  );
}
