import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { CategorySelector } from "../components/city-guide/CategorySelector";
import { QuestionCard } from "../components/city-guide/QuestionCard";
import { ResultCard } from "../components/city-guide/ResultCard";
import { DepartmentList } from "../components/city-guide/DepartmentList";
import {
  GENERAL_INFO_ENTRY_ID,
  cityGuideCategories,
  cityGuideEntries,
  getCategory,
  getEntriesForCategory,
  getEntry,
  isDirectResultCategory,
} from "../lib/cityGuide";
import type { CityGuideCategory } from "../types/cityGuide";

type ViewMode = "diagnosis" | "list";
type DiagnosisStep = "category" | "question" | "result";

export function CityGuidePage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const [mode, setMode] = useState<ViewMode>("diagnosis");
  const [step, setStep] = useState<DiagnosisStep>("category");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [currentEntryIndex, setCurrentEntryIndex] = useState(0);
  const [resultEntryId, setResultEntryId] = useState<string | null>(null);

  const categoryEntries = useMemo(
    () => (selectedCategoryId ? getEntriesForCategory(selectedCategoryId) : []),
    [selectedCategoryId],
  );

  function resetToCategories() {
    setMode("diagnosis");
    setStep("category");
    setSelectedCategoryId(null);
    setCurrentEntryIndex(0);
    setResultEntryId(null);
  }

  function handleSelectCategory(category: CityGuideCategory) {
    setSelectedCategoryId(category.id);
    if (isDirectResultCategory(category.id)) {
      const entries = getEntriesForCategory(category.id);
      setResultEntryId(entries[0]?.id ?? GENERAL_INFO_ENTRY_ID);
      setStep("result");
      return;
    }
    setCurrentEntryIndex(0);
    setStep("question");
  }

  function handleYes() {
    const entry = categoryEntries[currentEntryIndex];
    if (!entry) return;
    setResultEntryId(entry.id);
    setStep("result");
  }

  function handleNo() {
    const nextIndex = currentEntryIndex + 1;
    if (nextIndex < categoryEntries.length) {
      setCurrentEntryIndex(nextIndex);
      return;
    }
    setResultEntryId(GENERAL_INFO_ENTRY_ID);
    setStep("result");
  }

  function handleShowGeneralInfo() {
    setMode("diagnosis");
    setSelectedCategoryId(null);
    setCurrentEntryIndex(0);
    setResultEntryId(GENERAL_INFO_ENTRY_ID);
    setStep("result");
  }

  const currentEntry = step === "question" ? categoryEntries[currentEntryIndex] : undefined;
  const selectedCategory = selectedCategoryId ? getCategory(selectedCategoryId) : undefined;
  const resultEntry = resultEntryId ? getEntry(resultEntryId) : undefined;
  const resultCategory = resultEntry ? getCategory(resultEntry.category) : undefined;

  const showFloatingButton = mode === "diagnosis" && (step === "category" || step === "question");

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <p className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        本ページは、延岡市民の皆さまが相談先を探す際の参考情報として、独自に作成した非公式案内です。最新の情報や正式な手続きについては、延岡市公式ホームページまたは各担当窓口へご確認ください。
      </p>

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">
          延岡市役所 どこに行けばいい？診断
        </h1>
        <p className="mt-1 text-sm text-on-primary-container/80">質問に答えるだけで、相談先の課が分かります</p>
      </div>

      <SectionCard title="このページについて">
        <p className="text-sm leading-relaxed text-on-surface">
          住民票、税金、子育て、介護、ごみ、道路など、市役所のどこに相談すればよいかを簡単に確認できます。
        </p>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          ※ 実際の担当は内容によって異なる場合があります。最終的には公式案内もご確認ください。
        </p>
      </SectionCard>

      <div className="flex flex-wrap items-center gap-2">
        <ModeToggleButton active={mode === "diagnosis"} onClick={() => setMode("diagnosis")}>
          診断で探す
        </ModeToggleButton>
        <ModeToggleButton active={mode === "list"} onClick={() => setMode("list")}>
          課を一覧で見る
        </ModeToggleButton>
        <button
          type="button"
          onClick={handleShowGeneralInfo}
          className="hidden rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex"
        >
          相談内容が分からない場合は総合案内へ
        </button>
      </div>

      {mode === "diagnosis" && step === "category" && (
        <CategorySelector categories={cityGuideCategories} onSelect={handleSelectCategory} />
      )}

      {mode === "diagnosis" && step === "question" && currentEntry?.question && selectedCategory && (
        <QuestionCard
          categoryName={selectedCategory.name}
          questionText={currentEntry.question}
          stepNumber={currentEntryIndex + 1}
          onYes={handleYes}
          onNo={handleNo}
          onBackToCategories={resetToCategories}
        />
      )}

      {mode === "diagnosis" && step === "result" && resultEntry && resultCategory && (
        <ResultCard
          entry={resultEntry}
          categoryName={resultCategory.name}
          onRestart={resetToCategories}
          onShowList={() => setMode("list")}
        />
      )}

      {mode === "list" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMode("diagnosis")}
            className="rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            診断へ戻る
          </button>
          <DepartmentList categories={cityGuideCategories} entries={cityGuideEntries} />
          <button
            type="button"
            onClick={() => setMode("diagnosis")}
            className="rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            診断へ戻る
          </button>
        </div>
      )}

      {showFloatingButton && (
        <div className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 sm:hidden print:hidden">
          <button
            type="button"
            onClick={handleShowGeneralInfo}
            className="flex items-center gap-1.5 rounded-full bg-tertiary px-4 py-3 text-sm font-semibold text-on-tertiary shadow-e2 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            困ったときは総合案内へ
          </button>
        </div>
      )}
    </div>
  );
}

function ModeToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "bg-secondary-container text-on-secondary-container"
          : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      {children}
    </button>
  );
}
