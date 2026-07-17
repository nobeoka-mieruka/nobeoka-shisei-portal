import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { SectionCard } from "../components/SectionCard";
import { usePageTitle } from "../hooks/usePageTitle";
import { CategorySelector } from "../components/city-guide/CategorySelector";
import { QuestionCard } from "../components/city-guide/QuestionCard";
import { ResultCard } from "../components/city-guide/ResultCard";
import { DepartmentList } from "../components/city-guide/DepartmentList";
import { cityGuideCategories, cityGuideDepartments, cityGuideQuestions } from "../data/cityGuideData";
import type { CityGuideCategory } from "../types/cityGuide";

type ViewMode = "diagnosis" | "list";
type DiagnosisStep = "category" | "question" | "result";

const GENERAL_INFO_DEPARTMENT_ID = "general-info";

export function CityGuidePage() {
  usePageTitle({
    title: "延岡市役所 どこに行けばいい？診断",
    description:
      "質問に答えるだけで、住民票・税金・子育て・介護・ごみ・道路など、延岡市役所のどの課に相談すればよいかが分かる診断ページです。",
  });

  const [mode, setMode] = useState<ViewMode>("diagnosis");
  const [step, setStep] = useState<DiagnosisStep>("category");
  const [selectedCategory, setSelectedCategory] = useState<CityGuideCategory | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [resultDepartmentId, setResultDepartmentId] = useState<string | null>(null);

  const questionMap = useMemo(() => new Map(cityGuideQuestions.map((q) => [q.id, q])), []);
  const departmentMap = useMemo(() => new Map(cityGuideDepartments.map((d) => [d.id, d])), []);

  function resetToCategories() {
    setMode("diagnosis");
    setStep("category");
    setSelectedCategory(null);
    setCurrentQuestionId(null);
    setQuestionCount(0);
    setResultDepartmentId(null);
  }

  function handleSelectCategory(category: CityGuideCategory) {
    setSelectedCategory(category);
    if (category.firstQuestionId === null) {
      setResultDepartmentId(category.directResultDepartmentId ?? GENERAL_INFO_DEPARTMENT_ID);
      setCurrentQuestionId(null);
      setStep("result");
      return;
    }
    setCurrentQuestionId(category.firstQuestionId);
    setQuestionCount(1);
    setStep("question");
  }

  function handleAnswer(choiceIndex: number) {
    if (!currentQuestionId) return;
    const question = questionMap.get(currentQuestionId);
    const choice = question?.choices[choiceIndex];
    if (!choice) return;

    if (choice.resultDepartmentId) {
      setResultDepartmentId(choice.resultDepartmentId);
      setStep("result");
      return;
    }
    if (choice.nextQuestionId) {
      setCurrentQuestionId(choice.nextQuestionId);
      setQuestionCount((n) => n + 1);
    }
  }

  function handleShowGeneralInfo() {
    setMode("diagnosis");
    setSelectedCategory(null);
    setCurrentQuestionId(null);
    setResultDepartmentId(GENERAL_INFO_DEPARTMENT_ID);
    setStep("result");
  }

  const currentQuestion = currentQuestionId ? questionMap.get(currentQuestionId) : undefined;
  const resultDepartment = resultDepartmentId ? departmentMap.get(resultDepartmentId) : undefined;

  const showFloatingButton = mode === "diagnosis" && (step === "category" || step === "question");

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <Breadcrumbs items={[{ label: "ホーム", to: "/" }, { label: "市役所案内" }]} />

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

      {mode === "diagnosis" && step === "question" && currentQuestion && selectedCategory && (
        <QuestionCard
          categoryName={selectedCategory.name}
          question={currentQuestion}
          stepNumber={questionCount}
          onAnswer={handleAnswer}
          onBackToCategories={resetToCategories}
        />
      )}

      {mode === "diagnosis" && step === "result" && resultDepartment && (
        <ResultCard department={resultDepartment} onRestart={resetToCategories} onShowList={() => setMode("list")} />
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
          <DepartmentList categories={cityGuideCategories} departments={cityGuideDepartments} />
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
