import type { CityGuideQuestion } from "../../types/cityGuide";
import { ChevronLeftIcon } from "../icons";

interface QuestionCardProps {
  categoryName: string;
  question: CityGuideQuestion;
  stepNumber: number;
  onAnswer: (choiceIndex: number) => void;
  onBackToCategories: () => void;
}

export function QuestionCard({ categoryName, question, stepNumber, onAnswer, onBackToCategories }: QuestionCardProps) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBackToCategories}
        className="tap-highlight-none inline-flex items-center gap-1 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ChevronLeftIcon className="h-5 w-5" />
        カテゴリ選択に戻る
      </button>

      <div className="rounded-xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <p className="text-xs font-medium text-on-surface-variant">
          {categoryName}／質問 {stepNumber}
        </p>
        <h2 className="mt-2 text-lg font-semibold leading-snug text-on-surface sm:text-xl">{question.text}</h2>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {question.choices.map((choice, index) => (
            <button
              key={`${question.id}-${index}`}
              type="button"
              onClick={() => onAnswer(index)}
              className="tap-highlight-none flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-4 text-center text-base font-medium text-on-surface transition hover:border-primary hover:bg-primary-container hover:text-on-primary-container active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
