import type { CityGuideCategory } from "../../types/cityGuide";
import { CityGuideCategoryIcon } from "./CityGuideIcons";

interface CategorySelectorProps {
  categories: CityGuideCategory[];
  onSelect: (category: CityGuideCategory) => void;
}

export function CategorySelector({ categories, onSelect }: CategorySelectorProps) {
  const sorted = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div>
      <h2 className="text-sm font-semibold text-on-surface-variant">相談カテゴリを選んでください</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category)}
            className="tap-highlight-none flex items-start gap-3 rounded-xl bg-surface-container-low p-4 text-left shadow-e1 transition hover:bg-surface-container hover:shadow-e2 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container"
            >
              <CityGuideCategoryIcon icon={category.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-on-surface">{category.name}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">
                {category.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
