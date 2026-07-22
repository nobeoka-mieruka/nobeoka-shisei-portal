import type { CityGuideCategory, CityGuideEntry } from "../../types/cityGuide";
import { cityGuideConfig, toTelHref } from "../../lib/cityGuide";
import { ClockIcon, GlobeIcon, MapPinIcon, PhoneIcon } from "../icons";

interface DepartmentListProps {
  categories: CityGuideCategory[];
  entries: CityGuideEntry[];
}

export function DepartmentList({ categories, entries }: DepartmentListProps) {
  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant shadow-e1">
        <ClockIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p>
            受付時間：<span className="font-medium text-on-surface">{cityGuideConfig.officeHours}</span>
          </p>
          {cityGuideConfig.note && <p className="mt-0.5 text-xs">※{cityGuideConfig.note}</p>}
        </div>
      </div>

      {sortedCategories.map((category) => {
        const items = uniqueByDepartment(entries.filter((e) => e.category === category.id));
        if (items.length === 0) return null;

        return (
          <div key={category.id}>
            <h3 className="text-sm font-semibold text-on-surface-variant">{category.name}</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((entry) => {
                const telHref = toTelHref(entry.phone);
                return (
                  <div key={entry.id} className="min-w-0 rounded-xl bg-surface-container-low p-4 shadow-e1">
                    <p className="text-base font-semibold break-words text-on-surface">{entry.department}</p>
                    {entry.description && (
                      <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{entry.description}</p>
                    )}
                    {entry.location && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-on-surface-variant">
                        <MapPinIcon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {entry.location}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {telHref ? (
                        <a
                          href={telHref}
                          aria-label={`${cityGuideConfig.officeName}${entry.department}へ電話する（${entry.phone}）`}
                          className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <PhoneIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                          {entry.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-on-surface-variant">電話番号：確認中</span>
                      )}

                      {entry.officialUrl && (
                        <a
                          href={entry.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${entry.department}の延岡市公式ページを新しいタブで開く`}
                          className="inline-flex items-center gap-1.5 rounded text-sm font-medium break-all text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <GlobeIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                          公式ページ
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 同じカテゴリ内で同じ担当課が複数エントリにまたがる場合、一覧表示では1件にまとめる。 */
function uniqueByDepartment(entries: CityGuideEntry[]): CityGuideEntry[] {
  const seen = new Set<string>();
  const result: CityGuideEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.department)) continue;
    seen.add(entry.department);
    result.push(entry);
  }
  return result;
}
