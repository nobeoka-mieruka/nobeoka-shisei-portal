import type { FinanceAmountItem } from "../../types";

function formatThousandYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}千円`;
}

interface FinanceBarListProps {
  items: FinanceAmountItem[];
}

export function FinanceBarList({ items }: FinanceBarListProps) {
  const max = Math.max(...items.map((i) => i.amountThousandYen), 1);

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = Math.round((item.amountThousandYen / max) * 100);
        return (
          <li key={item.label}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-sm text-on-surface sm:w-28 sm:shrink-0">{item.label}</span>
              <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="relative h-3 min-w-[80px] flex-1 overflow-hidden rounded-full bg-surface-container-high">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="shrink-0 text-right text-sm font-semibold text-on-surface">
                  {formatThousandYen(item.amountThousandYen)}
                  {item.percentage !== undefined && (
                    <span className="ml-1.5 font-normal text-on-surface-variant">（{item.percentage}％）</span>
                  )}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
