import { useState } from "react";
import type { CompensationComparisonEntry, CompensationRole } from "../../types";
import { COMPENSATION_ROLES, formatYen, rankByRole } from "../../lib/compensation";

const NOBEOKA = "延岡市";

interface CompensationBarChartProps {
  entries: CompensationComparisonEntry[];
}

export function CompensationBarChart({ entries }: CompensationBarChartProps) {
  const [role, setRole] = useState<CompensationRole>("member");
  const ranked = rankByRole(entries, role);
  const max = Math.max(...ranked.map((r) => r.monthly), 1);

  return (
    <div>
      <div role="group" aria-label="役職の切り替え" className="mb-4 flex flex-wrap gap-2">
        {COMPENSATION_ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRole(r.key)}
            aria-pressed={role === r.key}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              role === r.key
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {ranked.map(({ entry, monthly, rank }) => {
          const pct = Math.round((monthly / max) * 100);
          const isNobeoka = entry.municipality === NOBEOKA;
          return (
            <li key={entry.municipality}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="break-words text-sm text-on-surface sm:w-24 sm:shrink-0">
                  {rank}位　{entry.municipality}
                </span>
                <span className="flex flex-1 items-center gap-3">
                  <span className="relative h-4 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full transition-[width]"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: isNobeoka ? "var(--color-primary)" : "var(--color-outline-variant)",
                      }}
                    />
                  </span>
                  <span className="w-28 shrink-0 text-right text-sm font-semibold text-on-surface">
                    {formatYen(monthly)}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
