import { useLocation, useSearchParams } from "react-router-dom";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import type { ArchiveMayor, ArchiveMayorTerm } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { FinanceTable } from "../components/finance/FinanceTable";
import { CompareItemPicker } from "../components/compare/CompareItemPicker";
import { CompareSourceNotice } from "../components/compare/CompareSourceNotice";
import { LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { archiveVerificationStatusLabel, mayorTermCountLabel, termsForMayor } from "../lib/archiveMayors";
import { parseCompareSelection, buildCompareSearchParams, MIN_COMPARE_ITEMS } from "../lib/archiveCompare";

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const mayorIds = archiveMayors.map((m) => m.id);

function latestTermLabel(mayor: ArchiveMayor, terms: ArchiveMayorTerm[]): string {
  const own = termsForMayor(terms, mayor.id);
  if (own.length === 0) return "確認中";
  return own
    .map((t) => `${formatJapaneseDate(t.termStart)}〜${t.termEnd ? formatJapaneseDate(t.termEnd) : "現在"}`)
    .join(" / ");
}

export function CompareMayorsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();

  const selected = parseCompareSelection(searchParams, mayorIds);
  const selectedMayors = selected.map((id) => archiveMayors.find((m) => m.id === id)).filter((m): m is ArchiveMayor => !!m);

  const handleChange = (ids: string[]) => {
    setSearchParams(buildCompareSearchParams(ids), { replace: true });
  };

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
          歴代市長を最大4名まで選んで、任期・就任回数を比較できます。市長個人への評価・採点は行っていません。
        </p>
      </div>

      <SectionCard title="比較する市長を選ぶ">
        <CompareItemPicker
          legend="市長"
          options={archiveMayors.map((m) => ({ id: m.id, label: m.name, sublabel: m.isCurrentMayor ? "現職" : undefined }))}
          selected={selected}
          onChange={handleChange}
        />
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          現在登録されている歴代市長は{archiveMayors.length}名です。前任・歴代の市長は、公式資料で在任期間・経歴を確認できたものから順次追加します。
        </p>
      </SectionCard>

      {selectedMayors.length > 0 && selectedMayors.length < MIN_COMPARE_ITEMS && (
        <p className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
          比較には{MIN_COMPARE_ITEMS}件以上の選択が必要です。もう{MIN_COMPARE_ITEMS - selectedMayors.length}件選んでください。
        </p>
      )}

      {selectedMayors.length >= MIN_COMPARE_ITEMS && (
        <SectionCard title="比較結果">
          <FinanceTable
            caption="選択した市長の任期・就任回数の比較"
            rows={selectedMayors}
            rowKey={(m) => m.id}
            columns={[
              { header: "氏名", render: (m) => m.name },
              { header: "区分", render: (m) => (m.isCurrentMayor ? "現職" : "元職") },
              { header: "任期", render: (m) => latestTermLabel(m, archiveMayorTerms) },
              { header: "就任回数", render: (m) => mayorTermCountLabel(m, archiveMayorTerms) },
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
      )}
    </div>
  );
}
