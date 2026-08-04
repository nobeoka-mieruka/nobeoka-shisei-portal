import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import factionsData from "../data/factions.json";
import type { CouncilMember, FormerMember } from "../types";
import type { ArchiveSourceRef } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CompareTable } from "../components/compare/CompareTable";
import { CompareItemPicker } from "../components/compare/CompareItemPicker";
import { CompareSourceNotice } from "../components/compare/CompareSourceNotice";
import { FinanceBarChart } from "../components/finance/FinanceBarChart";
import { BriefcaseIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { archiveVerificationStatusLabel } from "../lib/archiveMayors";
import { parseCompareSelection, buildCompareSearchParams, MIN_COMPARE_ITEMS } from "../lib/archiveCompare";
import {
  buildPersonIndex,
  councilDocumentsForPerson,
  personTypeLabel,
  policiesForPerson,
  voteCountForPerson,
  type PersonSummary,
} from "../lib/people";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const factions = factionsData as { id: string; name: string }[];

const memberPeople = buildPersonIndex().filter((p) => p.personType === "member" || p.personType === "former-member");
const memberIds = memberPeople.map((p) => p.slug);

function factionName(id?: string): string | undefined {
  return factions.find((f) => f.id === id)?.name;
}

/** 議員本人の公式プロフィール・出典を、CompareSourceNotice向けのArchiveSourceRef形式に変換する。 */
function sourceRefsForPerson(person: PersonSummary): { sourceRefs: ArchiveSourceRef[]; definitionNote?: string } {
  if (person.personType === "member") {
    const m = members.find((x) => x.id === person.id);
    const refs: ArchiveSourceRef[] = [];
    if (m?.profileUrl) {
      refs.push({ sourceUrl: m.profileUrl, sourceTitle: "延岡市議会 議員プロフィール", verificationStatus: "needsReview" });
    }
    for (const s of m?.sources ?? []) {
      refs.push({ sourceUrl: s.url, sourceTitle: s.label, verificationStatus: "needsReview" });
    }
    return { sourceRefs: refs };
  }
  const fm = formerMembers.find((x) => x.id === person.id);
  return { sourceRefs: [], definitionNote: fm?.sourceNote };
}

type CountMetricKey = "policyCount" | "documentCount" | "voteCount";

const countMetrics: { key: CountMetricKey; label: string; unit: string }[] = [
  { key: "policyCount", label: "関連政策件数", unit: "件" },
  { key: "documentCount", label: "関連議案・条例・請願・陳情件数", unit: "件" },
  { key: "voteCount", label: "議案賛否記録件数", unit: "件" },
];

function countMetricValue(personId: string, key: CountMetricKey): number {
  switch (key) {
    case "policyCount":
      return policiesForPerson("member", personId).length + policiesForPerson("former-member", personId).length;
    case "documentCount":
      return councilDocumentsForPerson(personId).length;
    case "voteCount":
      return voteCountForPerson(personId);
  }
}

export function CompareMembersPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();
  const [metricKey, setMetricKey] = useState<CountMetricKey>("voteCount");

  const selected = parseCompareSelection(searchParams, memberIds);
  const selectedPeople = selected
    .map((slug) => memberPeople.find((p) => p.slug === slug))
    .filter((p): p is PersonSummary => !!p);

  const handleChange = (ids: string[]) => setSearchParams(buildCompareSearchParams(ids), { replace: true });
  const activeMetric = countMetrics.find((m) => m.key === metricKey)!;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/compare" label="比較トップに戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <BriefcaseIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">議員の比較</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          現職議員・元議員を横断して最大4名まで選び、会派・在籍状況・関連する政策や議案の件数を比較できます。議員個人への評価・採点や優劣判定は行っていません。件数は当サイトに登録済みのデータの範囲での集計です。
        </p>
      </div>

      <SectionCard title="比較する議員を選ぶ">
        <CompareItemPicker
          legend="議員"
          options={memberPeople.map((p) => ({
            id: p.slug,
            label: p.name,
            sublabel: `${personTypeLabel(p.personType)}${p.factionId ? `・${factionName(p.factionId) ?? p.factionId}` : ""}`,
          }))}
          selected={selected}
          onChange={handleChange}
        />
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          現在登録されているのは現職議員{members.length}名・元議員{formerMembers.length}名です。元議員は在職を確認できた会期のみを在籍状況として表示しています。
        </p>
      </SectionCard>

      {selectedPeople.length > 0 && selectedPeople.length < MIN_COMPARE_ITEMS && (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
          比較には{MIN_COMPARE_ITEMS}件以上の選択が必要です。もう{MIN_COMPARE_ITEMS - selectedPeople.length}件選んでください。
        </p>
      )}

      {selectedPeople.length >= MIN_COMPARE_ITEMS && (
        <>
          <SectionCard title="比較結果">
            <CompareTable
              caption="選択した議員の会派・在籍状況・関連件数の比較"
              rows={selectedPeople}
              rowKey={(p) => p.slug}
              columns={[
                {
                  header: "氏名",
                  render: (p) => (
                    <Link to={`/people/${p.slug}`} className="text-primary hover:underline">
                      {p.name}
                    </Link>
                  ),
                },
                { header: "区分", render: (p) => personTypeLabel(p.personType) },
                { header: "会派", render: (p) => (p.factionId ? (factionName(p.factionId) ?? "確認中") : "確認中") },
                { header: "在籍", render: (p) => p.tenureLabel },
                {
                  header: "関連政策件数",
                  align: "right",
                  render: (p) => `${policiesForPerson("member", p.id).length + policiesForPerson("former-member", p.id).length}件`,
                },
                { header: "関連議案等件数", align: "right", render: (p) => `${councilDocumentsForPerson(p.id).length}件` },
                { header: "議案賛否記録件数", align: "right", render: (p) => `${voteCountForPerson(p.id)}件` },
                { header: "確認状況", render: (p) => archiveVerificationStatusLabel(p.verificationStatus) },
              ]}
            />

            <CompareSourceNotice
              items={selectedPeople.map((p) => ({ label: p.name, ...sourceRefsForPerson(p) }))}
            />
          </SectionCard>

          <SectionCard title="件数を選んで比較">
            <div className="flex flex-wrap gap-2" role="group" aria-label="比較する件数の切り替え">
              {countMetrics.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetricKey(m.key)}
                  aria-pressed={metricKey === m.key}
                  className={`min-h-[36px] rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    metricKey === m.key
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <FinanceBarChart
                points={selectedPeople.map((p) => ({ label: p.name, value: countMetricValue(p.id, metricKey) }))}
                formatValue={(v) => (v != null ? `${v}${activeMetric.unit}` : "確認中")}
                ariaLabel={`選択した議員の${activeMetric.label}の比較棒グラフ。詳細は上の表を参照してください。`}
              />
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
