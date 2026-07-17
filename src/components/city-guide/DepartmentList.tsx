import type { CityGuideCategory, CityGuideDepartment } from "../../types/cityGuide";
import { GlobeIcon } from "../icons";

interface DepartmentListProps {
  categories: CityGuideCategory[];
  departments: CityGuideDepartment[];
}

export function DepartmentList({ categories, departments }: DepartmentListProps) {
  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {sortedCategories.map((category) => {
        const items = departments.filter((d) => d.categoryIds.includes(category.id));
        if (items.length === 0) return null;

        return (
          <div key={category.id}>
            <h3 className="text-sm font-semibold text-on-surface-variant">{category.name}</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((department) => (
                <div key={department.id} className="rounded-xl bg-surface-container-low p-4 shadow-e1">
                  <p className="text-base font-semibold text-on-surface">{department.name}</p>
                  {department.mainTasks.length > 0 && (
                    <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                      {department.mainTasks.join("、")}
                    </p>
                  )}
                  {department.officialUrl && (
                    <a
                      href={department.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${department.name}の公式ページを新しいタブで開く`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <GlobeIcon className="h-3.5 w-3.5" />
                      公式ページ
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
