import { Link, useLocation, useParams } from "react-router-dom";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import archiveMemberTermsData from "../data/archiveMemberTerms.json";
import generalQuestionsData from "../data/generalQuestions.json";
import archiveCouncilDocumentsData from "../data/archiveCouncilDocuments.json";
import archivePoliciesData from "../data/archivePolicies.json";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import factionsData from "../data/factions.json";
import type {
  ArchiveMayor,
  ArchiveMayorTerm,
  ArchiveFiscalYear,
  ArchiveMemberProfile,
  ArchiveMemberTerm,
  ArchiveCouncilDocument,
  ArchivePolicy,
} from "../types/historicalArchive";
import type { CouncilMember, FormerMember, GeneralQuestionItem } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { CompareTable } from "../components/compare/CompareTable";
import { CompareSourceNotice } from "../components/compare/CompareSourceNotice";
import { ClockIcon, LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { fiscalYearLabel } from "../lib/archiveFinance";
import { mayorTermsInFiscalYear, memberTermsInFiscalYear, fiscalYearOfIsoDate } from "../lib/archiveTimeline";
import { isActingMayorTerm, mayorRoleLabel } from "../lib/archiveMayors";
import { FINANCE_METRICS } from "../lib/archiveFinanceMetrics";
import { documentPath, documentTypeLabel, documentResultLabel } from "../lib/archiveCouncilDocuments";
import { policyOwnerName, policyOwnerLinkTo, type PolicyOwnerLookup } from "../lib/archivePolicies";
import { civicTimelineEventsInFiscalYear } from "../lib/civicTimeline";

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const archiveFiscalYears = archiveFiscalYearsData as ArchiveFiscalYear[];
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];
const archiveMemberTerms = archiveMemberTermsData as ArchiveMemberTerm[];
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const archiveCouncilDocuments = archiveCouncilDocumentsData as ArchiveCouncilDocument[];
const archivePolicies = archivePoliciesData as ArchivePolicy[];
const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const factions = factionsData as { id: string; name: string }[];
const ownerLookup: PolicyOwnerLookup = { members, formerMembers, mayors: archiveMayors, factions };

export function TimelineYearPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const params = useParams<{ year: string }>();

  const fiscalYear = Number(params.year);
  const isValidYear = Number.isInteger(fiscalYear) && String(fiscalYear) === params.year;

  const mayorTerms = isValidYear ? mayorTermsInFiscalYear(archiveMayorTerms, fiscalYear) : [];
  const memberTerms = isValidYear ? memberTermsInFiscalYear(archiveMemberTerms, fiscalYear) : [];
  const fiscalYearEntry = isValidYear ? archiveFiscalYears.find((y) => y.fiscalYear === fiscalYear) : undefined;
  const questions = isValidYear
    ? generalQuestions.filter((q) => fiscalYearOfIsoDate(q.questionDate) === fiscalYear).sort((a, b) => a.questionDate.localeCompare(b.questionDate))
    : [];
  const documents = isValidYear ? archiveCouncilDocuments.filter((d) => d.fiscalYear === fiscalYear) : [];
  const policies = isValidYear
    ? archivePolicies.filter(
        (p) => (p.relatedFiscalYears ?? []).includes(fiscalYear) || (p.announcedDate && fiscalYearOfIsoDate(p.announcedDate) === fiscalYear),
      )
    : [];
  // Phase188：市政年表（civicTimelineEvents.json）側からも、この年度に対応する出来事を
  // 自動フィルタで逆引きする（日付は年月まで判読できた場合のみ会計年度換算、それ以外は
  // 年フィールドをそのまま近似値として使う。手作業でのイベント文章の複製登録はしない）。
  const civicEvents = isValidYear ? civicTimelineEventsInFiscalYear(fiscalYear) : [];

  const hasAnyData =
    mayorTerms.length > 0 ||
    memberTerms.length > 0 ||
    fiscalYearEntry != null ||
    questions.length > 0 ||
    documents.length > 0 ||
    policies.length > 0 ||
    civicEvents.length > 0;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/timeline" label="年表トップに戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">
            {isValidYear ? `${fiscalYear}年度の年表` : "年度の年表"}
          </h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          市長任期・議員在籍・一般質問・議案条例請願陳情・政策・財政データを、公式資料で確認できた範囲で一覧表示します。点数化や評価は行っていません。
        </p>
      </div>

      {!isValidYear ? (
        <SectionCard title="年度の形式を確認できません">
          <p className="text-sm text-on-surface-variant">
            URLの年度（{params.year}）を数値として認識できませんでした。
            <Link to="/timeline" className="mx-1 text-primary hover:underline">
              年表トップ
            </Link>
            から年度をお選びください。
          </p>
        </SectionCard>
      ) : !hasAnyData ? (
        <SectionCard title="該当データなし">
          <p className="text-sm text-on-surface-variant">
            {fiscalYearLabel(fiscalYear)}について、現在確認できているデータはありません。公式資料で確認でき次第、順次追加します。
          </p>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="市長任期">
            {mayorTerms.length === 0 ? (
              <p className="text-sm text-on-surface-variant">確認できたデータはまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {mayorTerms.map((term) => {
                  const mayor = archiveMayors.find((m) => m.id === term.mayorId);
                  if (!mayor) return null;
                  return (
                    <li key={term.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <LandmarkIcon className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
                        <Link to={`/mayors/${mayor.slug}`} className="font-semibold text-primary hover:underline">
                          {mayor.name}
                        </Link>
                        {isActingMayorTerm(term) && (
                          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                            {mayorRoleLabel(term.mayorRole)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        任期：{formatJapaneseDate(term.termStart)}〜{term.termEnd ? formatJapaneseDate(term.termEnd) : "現在"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="議員在籍・会派・役職">
            {memberTerms.length === 0 ? (
              <p className="text-sm text-on-surface-variant">確認できたデータはまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {memberTerms.map((term) => {
                  const profile = archiveMemberProfiles.find((p) => p.id === term.memberProfileId);
                  return (
                    <li key={term.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                      {profile?.name ?? "確認中"}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="財政・人口データ">
            {!fiscalYearEntry ? (
              <p className="text-sm text-on-surface-variant">この年度の財政・人口データは確認できていません。</p>
            ) : (
              <>
                <CompareTable
                  caption={`${fiscalYearLabel(fiscalYear)}の財政・人口指標`}
                  rows={FINANCE_METRICS}
                  rowKey={(m) => m.key}
                  columns={[
                    { header: "指標", render: (m) => m.label },
                    { header: "値", align: "right", render: (m) => m.formatValue(m.getPoint(fiscalYearEntry).value) },
                    {
                      header: "確認状況",
                      render: (m) => {
                        const point = m.getPoint(fiscalYearEntry);
                        return point.sourceRefs[0] ? "出典あり" : point.value == null ? "確認中" : "出典未登録";
                      },
                    },
                  ]}
                />
                <p className="mt-2 text-xs text-on-surface-variant">
                  詳細な出典・定義は
                  <Link to={`/compare/finance?years=${fiscalYear}`} className="mx-1 text-primary hover:underline">
                    年度別財政の比較
                  </Link>
                  でも確認できます。
                </p>
              </>
            )}
          </SectionCard>

          <SectionCard title="市政年表（この年度の主な出来事）">
            {civicEvents.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                この年度に対応することが確認できた市政年表の出来事はありません（市政年表は市庁舎・行政組織・災害・公共事業・教育福祉産業等を対象としており、網羅を保証するものではありません）。
              </p>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  出来事の日付（年、判読できれば月まで）から会計年度を近似して対応付けています。日付が年単位までしか判明していない出来事は、前後1年度分ずれる可能性があります。
                </p>
                <ul className="mt-2 space-y-2">
                  {civicEvents.map((ev) => (
                    <li key={ev.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                        <span className="font-medium text-on-surface">{ev.dateLabel}</span>
                        <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-semibold text-on-surface-variant">
                          {ev.category}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-on-surface">{ev.title}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{ev.summary}</p>
                    </li>
                  ))}
                </ul>
                <Link to="/history" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                  市政年表（全期間）で確認する
                </Link>
              </>
            )}
          </SectionCard>

          <SectionCard title="一般質問">
            {questions.length === 0 ? (
              <p className="text-sm text-on-surface-variant">確認できたデータはまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {questions.map((q) => (
                  <li key={q.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                    <Link to={`/questions/${q.id}`} className="font-semibold text-primary hover:underline">
                      {q.title}
                    </Link>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {formatJapaneseDate(q.questionDate)}／{q.memberName}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="議案・条例・請願・陳情">
            {documents.length === 0 ? (
              <p className="text-sm text-on-surface-variant">確認できたデータはまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((d) => (
                  <li key={d.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                    <Link to={documentPath(d)} className="font-semibold text-primary hover:underline">
                      {d.title}
                    </Link>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {documentTypeLabel(d.documentType)}／{documentResultLabel(d.result)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="政策">
            {policies.length === 0 ? (
              <p className="text-sm text-on-surface-variant">確認できたデータはまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {policies.map((p) => {
                  const ownerLinkTo = policyOwnerLinkTo(p, ownerLookup);
                  return (
                    <li key={p.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                      <Link to={`/policies/${p.slug}`} className="font-semibold text-primary hover:underline">
                        {p.title}
                      </Link>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {ownerLinkTo ? (
                          <Link to={ownerLinkTo} className="hover:underline">
                            {policyOwnerName(p, ownerLookup)}
                          </Link>
                        ) : (
                          policyOwnerName(p, ownerLookup)
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {mayorTerms.length > 0 && (
            <SectionCard title="出典（市長任期）">
              <CompareSourceNotice
                items={mayorTerms.map((term) => {
                  const mayor = archiveMayors.find((m) => m.id === term.mayorId);
                  return { label: mayor?.name ?? term.id, sourceRefs: term.sourceRefs };
                })}
              />
            </SectionCard>
          )}
        </>
      )}

      <LastUpdated className="mt-4" />
    </div>
  );
}
