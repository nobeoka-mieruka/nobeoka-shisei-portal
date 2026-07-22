import { useEffect, useId, useRef } from "react";
import { ChevronLeftIcon } from "../icons";

interface QuestionCardProps {
  categoryName: string;
  questionText: string;
  stepNumber: number;
  onYes: () => void;
  onNo: () => void;
  onBackToCategories: () => void;
}

export function QuestionCard({ categoryName, questionText, stepNumber, onYes, onNo, onBackToCategories }: QuestionCardProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [questionText]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBackToCategories}
        className="tap-highlight-none inline-flex items-center gap-1 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ChevronLeftIcon aria-hidden="true" className="h-5 w-5" />
        カテゴリ選択に戻る
      </button>

      <div className="rounded-xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <p className="text-xs font-medium text-on-surface-variant">
          {categoryName}／質問 {stepNumber}
        </p>
        <h2
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className="mt-2 rounded text-lg font-semibold leading-snug text-on-surface focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary sm:text-xl"
        >
          {questionText}
        </h2>

        <div role="group" aria-labelledby={headingId} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onYes}
            className="tap-highlight-none min-h-11 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-4 text-center text-base font-medium text-on-surface transition hover:border-primary hover:bg-primary-container hover:text-on-primary-container active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            はい
          </button>
          <button
            type="button"
            onClick={onNo}
            className="tap-highlight-none min-h-11 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-4 text-center text-base font-medium text-on-surface transition hover:border-primary hover:bg-primary-container hover:text-on-primary-container active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            いいえ
          </button>
        </div>
      </div>
    </div>
  );
}
