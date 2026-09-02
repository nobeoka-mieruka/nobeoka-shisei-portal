import { Link, useLocation } from "react-router-dom";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import archiveMemberTermsData from "../data/archiveMemberTerms.json";
import archiveMemberAffiliationsData from "../data/archiveMemberAffiliations.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import type { ArchiveMemberAffiliation, ArchiveMemberProfile, ArchiveMemberTerm } from "../types/historicalArchive";
import type { CouncilSpeechSummaryData } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LandmarkIcon, ClockIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { archiveVerificationStatusLabel } from "../lib/archiveMayors";
import {
  affiliationsForMemberProfileByType,
  archiveMemberStatusLabel,
  speechesForProfile,
  termsForMemberProfile,
} from "../lib/archiveMembers";

// archiveMemberProfiles.jsonは現職・元議員の両方を収録する（Phase35で現職分を追加）。
// このページは元議員一覧専用のため、legacyMemberId（現職）が設定されたプロフィールは除外する
// （現職議員をこのページに掲載しない）。
const profiles = (archiveMemberProfilesData as ArchiveMemberProfile[]).filter((p) => !p.legacyMemberId);
const terms = archiveMemberTermsData as ArchiveMemberTerm[];
const affiliations = archiveMemberAffiliationsData as ArchiveMemberAffiliation[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MembersFormerPage() {
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
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">元議員（延岡市政アーカイブ）</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          現職ではない過去の市議会議員について、公式資料で確認できた在職・活動の記録を整理しています。現職議員の一覧・比較・集計には含めていません。
        </p>
      </div>

      <div className="mb-5 rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        現在登録しているのは、既存の会議録調査で在職・発言が確認できた人物のみです。他にも元議員は存在しますが、公式資料（市議会だより・議員名簿等）で在職期間等を確認できたものから順次追加します。未登録であることは、情報が「無い」ことを意味しません。
      </div>

      {profiles.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          現在登録している元議員はいません。
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {profiles.map((profile) => {
            const own = termsForMemberProfile(terms, profile.id);
            const speeches = speechesForProfile(profile, speechSummaryData);
            const questionCount = speeches.length;
            const statementCount = speeches.reduce((sum, s) => sum + s.questionItems.length, 0);
            const factionHistory = affiliationsForMemberProfileByType(affiliations, profile.id, "faction");
            const committeeHistory = affiliationsForMemberProfileByType(affiliations, profile.id, "committee");
            return (
              <li key={profile.id}>
                <Link
                  to={`/members/former/${profile.slug}`}
                  className={`block h-full rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-on-surface">{profile.name}</p>
                    <span className="rounded-full bg-surface-container-lowest px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                      {archiveMemberStatusLabel(profile.status)}
                    </span>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-xs text-on-surface-variant">
                    <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {own.length > 0
                      ? own
                          .map(
                            (t) =>
                              `${formatJapaneseDate(t.termStart)}〜${t.termEnd ? formatJapaneseDate(t.termEnd) : "現在"}`,
                          )
                          .join("、")
                      : "在籍期間：確認中"}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    会派履歴：{factionHistory.length > 0 ? `${factionHistory.length}件` : "確認中"}／委員会履歴：
                    {committeeHistory.length > 0 ? `${committeeHistory.length}件` : "確認中"}／一般質問：{questionCount}件
                    ／発言：{statementCount}件
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    出典確認状況：
                    {profile.sourceRefs.length > 0
                      ? [...new Set(profile.sourceRefs.map((r) => archiveVerificationStatusLabel(r.verificationStatus)))].join(
                          "／",
                        )
                      : "資料未確認"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 px-1 text-xs leading-relaxed text-on-surface-variant">
        現職議員の一覧は
        <Link to="/" className={`mx-1 text-primary underline ${linkClass}`}>
          議員一覧
        </Link>
        、会期ごとの在籍構成は
        <Link to="/members/history" className={`mx-1 text-primary underline ${linkClass}`}>
          在籍履歴
        </Link>
        でも確認できます。
      </p>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="元議員" />
      </div>
    </div>
  );
}
