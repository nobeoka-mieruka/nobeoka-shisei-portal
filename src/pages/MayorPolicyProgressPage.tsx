import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import policyProgressData from "../data/mayorPolicyProgress.json";
import mayorPromisesData from "../data/mayorPromises.json";
import type { MayorPolicyProgressData, MayorPromiseItem, MayorPromiseStatusLabel, MayorPromisesData } from "../types";
import { BackLink } from "../components/BackLink";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { PromiseCard } from "../components/mayor/PromiseCard";
import { GlobeIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate, toFiscalYearLabel } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const data = policyProgressData as MayorPolicyProgressData;
const promisesData = mayorPromisesData as MayorPromisesData;
const promises = promisesData.promises;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** 「進捗が動いている」区分を優先し、確認中・未着手を後ろに置く表示順。 */
const STATUS_DISPLAY_ORDER: MayorPromiseStatusLabel[] = [
  "達成",
  "実施済み",
  "進行中",
  "一部実施",
  "方針変更",
  "検討中",
  "未着手",
  "確認中",
];

type PresenceFilterValue = "yes" | "no";

const presenceOptions: { value: PresenceFilterValue; label: string }[] = [
  { value: "yes", label: "あり" },
  { value: "no", label: "なし" },
];

const documentByKey = new Map(promisesData.documents.map((d) => [d.key, d]));

function evidenceLabelsFor(promise: MayorPromiseItem): string[] {
  return promise.evidenceItems
    .map((ev) => documentByKey.get(ev.documentKey)?.label)
    .filter((l): l is string => !!l);
}

export function MayorPolicyProgressPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [evidence, setEvidence] = useState("all");
  const [hasBill, setHasBill] = useState("all");
  const [hasQuestion, setHasQuestion] = useState("all");
  const [fiscalYear, setFiscalYear] = useState("all");

  const statusOptions = useMemo(() => {
    const present = new Set(promises.map((p) => p.statusLabel));
    return STATUS_DISPLAY_ORDER.filter((s) => present.has(s)).map((s) => ({ value: s, label: s }));
  }, []);

  const categoryOptions = useMemo(
    () => promisesData.categories.map((c) => ({ value: c.id, label: c.title })),
    [],
  );

  const fiscalYearOptions = useMemo(
    () =>
      Array.from(new Set(promises.map((p) => toFiscalYearLabel(p.lastVerified))))
        .sort((a, b) => b.localeCompare(a, "ja"))
        .map((y) => ({ value: y, label: y })),
    [],
  );

  const hasActiveFilter =
    query !== "" ||
    status !== "all" ||
    categoryId !== "all" ||
    evidence !== "all" ||
    hasBill !== "all" ||
    hasQuestion !== "all" ||
    fiscalYear !== "all";

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setCategoryId("all");
    setEvidence("all");
    setHasBill("all");
    setHasQuestion("all");
    setFiscalYear("all");
  };

  const matchesPromise = useMemo(() => {
    const q = query.trim();
    return (p: MayorPromiseItem): boolean => {
      const matchesQuery =
        q === "" ||
        p.promiseText.includes(q) ||
        (p.citizenSummary ?? "").includes(q) ||
        p.categoryTitle.includes(q) ||
        p.progressSummary.some((s) => s.includes(q)) ||
        (p.notes ?? "").includes(q) ||
        evidenceLabelsFor(p).some((l) => l.includes(q));
      const matchesStatus = status === "all" || p.statusLabel === status;
      const matchesCategory = categoryId === "all" || p.categoryId === categoryId;
      const matchesEvidence =
        evidence === "all" || (evidence === "yes" ? p.evidenceItems.length > 0 : p.evidenceItems.length === 0);
      const matchesBill =
        hasBill === "all" ||
        (hasBill === "yes" ? (p.relatedBillVoteIds?.length ?? 0) > 0 : (p.relatedBillVoteIds?.length ?? 0) === 0);
      const matchesQuestion =
        hasQuestion === "all" ||
        (hasQuestion === "yes"
          ? (p.relatedQuestionIds?.length ?? 0) > 0
          : (p.relatedQuestionIds?.length ?? 0) === 0);
      const matchesFiscalYear = fiscalYear === "all" || toFiscalYearLabel(p.lastVerified) === fiscalYear;
      return (
        matchesQuery &&
        matchesStatus &&
        matchesCategory &&
        matchesEvidence &&
        matchesBill &&
        matchesQuestion &&
        matchesFiscalYear
      );
    };
  }, [query, status, categoryId, evidence, hasBill, hasQuestion, fiscalYear]);

  const filteredPromises = useMemo(() => promises.filter(matchesPromise), [matchesPromise]);

  const statusCounts = useMemo(() => {
    const counts = new Map<MayorPromiseStatusLabel, number>();
    for (const p of promises) {
      counts.set(p.statusLabel, (counts.get(p.statusLabel) ?? 0) + 1);
    }
    return counts;
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/mayor" label="市長情報に戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市長公約の進捗状況</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          市長の選挙公約、市長本人の進捗公表、延岡市の施政方針・予算書などの公開情報を整理しています。サイト独自の採点や達成率の算定は行っていません。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="全公約数" value={promises.length} unit="件" />
        {[...statusCounts.entries()]
          .sort((a, b) => STATUS_DISPLAY_ORDER.indexOf(a[0]) - STATUS_DISPLAY_ORDER.indexOf(b[0]))
          .map(([label, count]) => (
            <StatCard key={label} label={label} value={count} unit="件" />
          ))}
      </div>

      <div className="space-y-3 rounded-xl bg-surface-container-low p-4 sm:p-5">
        <SearchBar
          value={query}
          onChange={setQuery}
          label="公約をキーワードで検索"
          placeholder="子育て、医療、交通など"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="進捗状況" value={status} onChange={setStatus} options={statusOptions} />
          <FilterSelect label="政策分野" value={categoryId} onChange={setCategoryId} options={categoryOptions} />
          <FilterSelect label="根拠資料の有無" value={evidence} onChange={setEvidence} options={presenceOptions} />
          <FilterSelect label="関連議案の有無" value={hasBill} onChange={setHasBill} options={presenceOptions} />
          <FilterSelect
            label="関連一般質問の有無"
            value={hasQuestion}
            onChange={setHasQuestion}
            options={presenceOptions}
          />
          <FilterSelect label="確認年度" value={fiscalYear} onChange={setFiscalYear} options={fiscalYearOptions} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-on-surface-variant">
            {filteredPromises.length > 0
              ? `${filteredPromises.length}件の公約が見つかりました`
              : "条件に一致する公約は見つかりませんでした。"}
          </p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className={`shrink-0 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
            >
              条件をリセット
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-4">
        {data.policies.map((policy) => {
          const items = promises.filter((p) => p.categoryTitle === policy.title && matchesPromise(p));
          const anchor = promisesData.categories.find((c) => c.id === policy.id)?.anchor;
          if (hasActiveFilter && items.length === 0) return null;
          return (
            <li
              key={policy.id}
              id={anchor}
              className="scroll-mt-20 rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5"
            >
              <h2 className="text-base font-semibold text-on-surface">{policy.title}</h2>

              <p className="mt-3 text-xs font-medium text-on-surface-variant">現在の状況</p>
              <p className="mt-1 text-sm text-on-surface">{policy.currentStatus}</p>

              <p className="mt-3 text-xs font-medium text-on-surface-variant">根拠資料</p>
              <p className="mt-1 text-sm text-on-surface-variant">{policy.evidenceLabel}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {data.documents.map((doc) => (
                  <a
                    key={doc.url}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${doc.label}のPDFを新しいタブで開く`}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
                  >
                    <GlobeIcon className="h-3.5 w-3.5" />
                    PDFを見る（{doc.label}）
                  </a>
                ))}
              </div>

              {items.length > 0 ? (
                <ul className="mt-4 space-y-3 border-t border-outline-variant pt-4">
                  {items.map((p) => (
                    <PromiseCard key={p.id} promise={p} documents={promisesData.documents} />
                  ))}
                </ul>
              ) : (
                hasActiveFilter && (
                  <p className="mt-4 border-t border-outline-variant pt-4 text-sm text-on-surface-variant">
                    条件に一致する公約はありません。
                  </p>
                )
              )}
            </li>
          );
        })}
      </ul>

      <SectionCard title="参考資料">
        <a
          href={data.referenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${data.referenceLabel}を新しいタブで開く`}
          className={`inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
        >
          <GlobeIcon className="h-4 w-4" />
          {data.referenceLabel}
        </a>
      </SectionCard>

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        このページは、市長の公約、市長本人が公表した進捗資料、延岡市の施政方針、予算書などを基に公開情報を整理したものです。市長本人の自己評価と、延岡市が公表した事実は区別して表示しています。掲載内容は、特定の政治家を支持、推薦、批判することを目的としたものではありません。
      </p>

      <p className="px-1 text-xs text-on-surface-variant">最終確認：{formatJapaneseDate(data.referenceDate)}</p>

      <CorrectionRequestButton pageName="市長公約の進捗状況" />
    </div>
  );
}
