import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import electionResultsData from "../data/electionResults.json";
import type { ArchiveMayor, ArchiveMayorTerm } from "../types/historicalArchive";
import type { ElectionResult } from "../types/election";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CompareTable } from "../components/compare/CompareTable";
import { CompareItemPicker } from "../components/compare/CompareItemPicker";
import { CompareSourceNotice } from "../components/compare/CompareSourceNotice";
import { FinanceBarChart } from "../components/finance/FinanceBarChart";
import { LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import {
  archiveVerificationStatusLabel,
  formatArchiveDateWithPrecision,
  isActingMayorTerm,
  mayorTermCountLabel,
  termsForMayor,
} from "../lib/archiveMayors";
import { parseCompareSelection, buildCompareSearchParams, MIN_COMPARE_ITEMS } from "../lib/archiveCompare";
import { buildPersonIndex, mayorSubmittedBillCount, policiesForPerson } from "../lib/people";
import { civicTimelineEventsForPerson } from "../lib/civicTimeline";

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const electionResults = electionResultsData as ElectionResult[];
const mayorIds = archiveMayors.map((m) => m.id);
const personIndex = buildPersonIndex();

/** この人物が当選人として確認できた選挙の件数（electionResults.json、linkedProfileIdで確認できたもののみ）。 */
function electionWinCount(mayorId: string): number {
  return electionResults.filter((e) => e.candidates.some((c) => c.linkedProfileId === mayorId && c.elected)).length;
}

/** 全任期が職務代理（acting/temporaryActing）のみの人物か。公選の市長と混同しないよう表記を分けるために使う。 */
function isActingOnlyMayor(mayor: ArchiveMayor, terms: ArchiveMayorTerm[]): boolean {
  const own = termsForMayor(terms, mayor.id);
  return own.length > 0 && own.every(isActingMayorTerm);
}

function latestTermLabel(mayor: ArchiveMayor, terms: ArchiveMayorTerm[]): string {
  const own = termsForMayor(terms, mayor.id);
  if (own.length === 0) return "確認中";
  return own
    .map(
      (t) =>
        `${formatArchiveDateWithPrecision(t.termStart, t.termStartPrecision, formatJapaneseDate)}〜${formatArchiveDateWithPrecision(t.termEnd, t.termEndPrecision, formatJapaneseDate)}`,
    )
    .join(" / ");
}

/** 任期の開始・終了年から算出した概算の在籍年数（暦年ベース、実日数ではない）。任期が未確認の場合はnull。 */
function tenureYearsOrNull(mayor: ArchiveMayor): number | null {
  const person = personIndex.find((p) => p.personType === "mayor" && p.id === mayor.id);
  if (!person || person.tenureYears.length === 0) return null;
  return person.tenureYears.length;
}

type CountMetricKey = "tenureYears" | "policyCount" | "documentCount" | "electionWinCount" | "civicEventCount";

const countMetrics: { key: CountMetricKey; label: string; unit: string }[] = [
  { key: "tenureYears", label: "在籍年数（概算）", unit: "年" },
  { key: "electionWinCount", label: "市長就任回数（選挙・選任、確認できた分）", unit: "回" },
  { key: "civicEventCount", label: "在任中の市政イベント件数", unit: "件" },
  { key: "policyCount", label: "関連政策件数", unit: "件" },
  { key: "documentCount", label: "関連議案・条例・請願・陳情件数", unit: "件" },
];

function countMetricValue(mayor: ArchiveMayor, key: CountMetricKey): number | null {
  switch (key) {
    case "tenureYears":
      return tenureYearsOrNull(mayor);
    case "policyCount":
      return policiesForPerson("mayor", mayor.id).length;
    case "electionWinCount":
      return electionWinCount(mayor.id);
    case "civicEventCount":
      return civicTimelineEventsForPerson(mayor.id).length;
    case "documentCount": {
      const { count, hasDataCoverage } = mayorSubmittedBillCount(mayor.id);
      return hasDataCoverage ? count : null;
    }
  }
}

export function CompareMayorsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();
  const [metricKey, setMetricKey] = useState<CountMetricKey>("tenureYears");

  const selected = parseCompareSelection(searchParams, mayorIds);
  const selectedMayors = selected.map((id) => archiveMayors.find((m) => m.id === id)).filter((m): m is ArchiveMayor => !!m);

  const handleChange = (ids: string[]) => {
    setSearchParams(buildCompareSearchParams(ids), { replace: true });
  };

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
          <LandmarkIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">歴代市長の比較</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          歴代市長を最大4名まで選んで、任期・就任回数・関連する政策や議案の件数を比較できます。市長個人への評価・採点は行っていません。件数は当サイトに登録済みのデータの範囲での集計であり、実際の全件数を保証するものではありません。
        </p>
      </div>

      <SectionCard title="比較する市長を選ぶ">
        <CompareItemPicker
          legend="市長"
          options={archiveMayors.map((m) => ({
            id: m.id,
            label: m.name,
            sublabel: m.isCurrentMayor ? "現職" : isActingOnlyMayor(m, archiveMayorTerms) ? "市長職務代理者" : undefined,
          }))}
          selected={selected}
          onChange={handleChange}
        />
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          現在登録されている歴代市長は{archiveMayors.length}名です。前任・歴代の市長は、公式資料で在任期間・経歴を確認できたものから順次追加します。
        </p>
      </SectionCard>

      {selectedMayors.length < MIN_COMPARE_ITEMS && (
        <p className="rounded-xl border border-primary/30 bg-primary-container/40 p-4 text-sm font-medium text-on-surface">
          {selectedMayors.length === 0
            ? `比較したい市長を${MIN_COMPARE_ITEMS}名以上選んでください（上の一覧をタップ）。`
            : `比較には${MIN_COMPARE_ITEMS}件以上の選択が必要です。もう${MIN_COMPARE_ITEMS - selectedMayors.length}件選んでください。`}
        </p>
      )}

      {selectedMayors.length >= MIN_COMPARE_ITEMS && (
        <>
          <SectionCard title="比較結果">
            <CompareTable
              caption="選択した市長の任期・就任回数・関連件数の比較"
              rows={selectedMayors}
              rowKey={(m) => m.id}
              columns={[
                { header: "氏名", render: (m) => m.name },
                {
                  header: "区分",
                  render: (m) => (m.isCurrentMayor ? "現職" : isActingOnlyMayor(m, archiveMayorTerms) ? "元職務代理者" : "元職"),
                },
                { header: "任期", render: (m) => latestTermLabel(m, archiveMayorTerms) },
                { header: "就任回数", render: (m) => mayorTermCountLabel(m, archiveMayorTerms) },
                {
                  header: "在籍年数（概算）",
                  align: "right",
                  render: (m) => {
                    const v = tenureYearsOrNull(m);
                    return v != null ? `約${v}年` : "確認中";
                  },
                },
                {
                  header: "市長就任回数（選挙・選任）",
                  align: "right",
                  render: (m) => `${electionWinCount(m.id)}回`,
                },
                {
                  header: "在任中の市政イベント件数",
                  align: "right",
                  render: (m) => {
                    const n = civicTimelineEventsForPerson(m.id).length;
                    return n > 0 ? `${n}件` : "0件（未収集の可能性があります）";
                  },
                },
                {
                  header: "関連政策件数",
                  align: "right",
                  render: (m) => {
                    const n = policiesForPerson("mayor", m.id).length;
                    if (n > 0) return `${n}件`;
                    return m.isCurrentMayor ? "0件（公約データ未登録）" : "0件（歴代市長の公約データは未収集）";
                  },
                },
                {
                  header: "関連議案・条例・請願・陳情件数",
                  align: "right",
                  render: (m) => {
                    const { count, hasDataCoverage } = mayorSubmittedBillCount(m.id);
                    if (!hasDataCoverage) return "収録期間外（未収録）";
                    // count===0はデータ収録期間内であることを確認済みの実数（confirmed zero）。
                    // 「未収録」の0件と混同されないよう明示する。
                    return count > 0 ? `${count}件` : "0件（収録期間内で確認済み）";
                  },
                },
                {
                  header: "確認状況",
                  render: (m) =>
                    m.sourceRefs[0] ? archiveVerificationStatusLabel(m.sourceRefs[0].verificationStatus) : "確認中",
                },
              ]}
            />

            <CompareSourceNotice
              items={selectedMayors.map((m) => ({ label: m.name, sourceRefs: m.sourceRefs }))}
            />
          </SectionCard>

          <SectionCard title="件数を選んで比較">
            <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
              在籍年数は任期開始・終了年から算出した概算（暦年ベース）であり、実日数ではありません。任期が未確認の市長は算出していません。
            </p>
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
                points={selectedMayors.map((m) => ({ label: m.name, value: countMetricValue(m, metricKey) }))}
                formatValue={(v) => (v != null ? `${v}${activeMetric.unit}` : "確認中")}
                ariaLabel={`選択した市長の${activeMetric.label}の比較棒グラフ。詳細は上の表を参照してください。`}
              />
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
