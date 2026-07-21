import { useMemo, useState } from "react";
import type { MiyazakiMunicipalityCompensation } from "../../types";
import { formatYen } from "../../lib/compensation";

const NOBEOKA = "延岡市";

type SortKey = "municipality" | "mayorMonthly" | "chairMonthly" | "viceChairMonthly" | "memberMonthly";

const columns: { key: SortKey; label: string }[] = [
  { key: "municipality", label: "自治体名" },
  { key: "mayorMonthly", label: "市長" },
  { key: "chairMonthly", label: "議長" },
  { key: "viceChairMonthly", label: "副議長" },
  { key: "memberMonthly", label: "議員" },
];

interface MiyazakiComparisonTableProps {
  municipalities: MiyazakiMunicipalityCompensation[];
}

export function MiyazakiComparisonTable({ municipalities }: MiyazakiComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("mayorMonthly");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const list = [...municipalities];
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "ja");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [municipalities, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "municipality" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null;
    return <span aria-hidden>{sortDir === "asc" ? " ▲" : " ▼"}</span>;
  }

  return (
    <div>
      <div
        className="hidden overflow-x-auto sm:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        role="region"
        aria-label="宮崎県9市の比較（月額）の表"
        tabIndex={0}
      >
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
              {columns.map((col) => (
                <th key={col.key} className={col.key === "municipality" ? "py-2 pr-3 font-medium" : "px-3 py-2 text-right font-medium"}>
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    aria-label={`${col.label}で並び替え`}
                    className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {col.label}
                    {sortIndicator(col.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const isNobeoka = m.municipality === NOBEOKA;
              return (
                <tr
                  key={m.municipality}
                  className={`border-b border-outline-variant last:border-0 ${
                    isNobeoka ? "border-l-4 border-l-primary bg-primary-container/30" : ""
                  }`}
                >
                  <td className="py-3 pr-3 font-medium text-on-surface">
                    {m.municipality}
                    {isNobeoka && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-on-primary">
                        延岡市
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-on-surface">{formatYen(m.mayorMonthly)}</td>
                  <td className="px-3 py-3 text-right text-on-surface">{formatYen(m.chairMonthly)}</td>
                  <td className="px-3 py-3 text-right text-on-surface">{formatYen(m.viceChairMonthly)}</td>
                  <td className="px-3 py-3 text-right text-on-surface">{formatYen(m.memberMonthly)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        <div className="flex flex-wrap gap-2">
          {columns.map((col) => (
            <button
              key={col.key}
              type="button"
              onClick={() => handleSort(col.key)}
              aria-pressed={sortKey === col.key}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                sortKey === col.key
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              {col.label}
              {sortIndicator(col.key)}
            </button>
          ))}
        </div>
        {sorted.map((m) => {
          const isNobeoka = m.municipality === NOBEOKA;
          return (
            <div
              key={m.municipality}
              className={`rounded-xl border border-outline-variant p-4 ${
                isNobeoka ? "border-l-4 border-l-primary bg-primary-container/30" : "bg-surface-container-low"
              }`}
            >
              <p className="font-semibold text-on-surface">
                {m.municipality}
                {isNobeoka && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-on-primary">
                    延岡市
                  </span>
                )}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-on-surface-variant">市長</dt>
                <dd className="text-right text-on-surface">{formatYen(m.mayorMonthly)}</dd>
                <dt className="text-on-surface-variant">議長</dt>
                <dd className="text-right text-on-surface">{formatYen(m.chairMonthly)}</dd>
                <dt className="text-on-surface-variant">副議長</dt>
                <dd className="text-right text-on-surface">{formatYen(m.viceChairMonthly)}</dd>
                <dt className="text-on-surface-variant">議員</dt>
                <dd className="text-right text-on-surface">{formatYen(m.memberMonthly)}</dd>
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
