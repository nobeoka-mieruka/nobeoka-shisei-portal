import { Link, useLocation } from "react-router-dom";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import archiveMemberTermsData from "../data/archiveMemberTerms.json";
import councilSessionsData from "../data/councilSessions.json";
import type { ArchiveMemberProfile, ArchiveMemberTerm } from "../types/historicalArchive";
import type { CouncilMember, CouncilSession, FormerMember } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { sessionMembershipStatus } from "../lib/archiveMembers";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
// archiveMemberProfiles.jsonは現職・元議員の両方を収録する（Phase35で現職分を追加）。
// このページは元議員の会期別在籍履歴専用のため、legacyMemberId（現職）が設定された
// プロフィールは除外する（現職議員の任期が「元議員の在籍確認」として誤表示されるのを防ぐ）。
const profiles = (archiveMemberProfilesData as ArchiveMemberProfile[]).filter((p) => !p.legacyMemberId);
const terms = archiveMemberTermsData as ArchiveMemberTerm[];
const councilSessions = [...(councilSessionsData as CouncilSession[])].sort((a, b) => a.id.localeCompare(b.id));

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MembersHistoryPage() {
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
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">議員在籍履歴（延岡市政アーカイブ）</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          会期ごとに、公式資料で在籍が確認できた元議員を表示します。現在の所属を過去の会期へ遡って適用していません。
        </p>
      </div>

      <div className="mb-5 rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        現職議員{members.length}名については、会期ごとの在籍・会派・委員会の異動を個別には収録しておらず、現行データ上は全会期で同一の構成として扱っています（現職議員の会派・委員会の異動履歴はフェーズ5時点では未収集です）。元議員については、在職を確認できた会期のみ「在籍確認済み」として表示します。表示がない会期は「在籍不明」であり、不在を意味しません。
      </div>

      <ul className="space-y-2">
        {councilSessions.map((session) => {
          const confirmedFormerProfiles = profiles.filter((profile) => {
            const legacyId = profile.legacyFormerMemberId;
            const legacyServed = legacyId
              ? new Set(formerMembers.find((fm) => fm.id === legacyId)?.servedSessions ?? [])
              : undefined;
            return sessionMembershipStatus(profile, session.id, terms, legacyServed) === "confirmed";
          });
          return (
            <li key={session.id} className="rounded-xl bg-surface-container-low p-4 shadow-e1">
              <Link
                to={`/council-documents/${session.id}`}
                className={`text-sm font-semibold text-primary underline ${linkClass}`}
              >
                {session.title}
              </Link>
              <p className="mt-1 text-xs text-on-surface-variant">現職議員（現行名簿基準）：{members.length}名</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                在籍確認済みの元議員：
                {confirmedFormerProfiles.length > 0 ? (
                  confirmedFormerProfiles.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && "、"}
                      <Link to={`/members/former/${p.slug}`} className={`text-primary underline ${linkClass}`}>
                        {p.name}
                      </Link>
                    </span>
                  ))
                ) : (
                  <span>なし（在籍不明を含む）</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 px-1 text-xs leading-relaxed text-on-surface-variant">
        元議員の詳細は
        <Link to="/members/former" className={`mx-1 text-primary underline ${linkClass}`}>
          元議員一覧
        </Link>
        でも確認できます。
      </p>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="議員在籍履歴" />
      </div>
    </div>
  );
}
