import { Link } from "react-router-dom";

export interface BarListItem {
  key: string;
  label: string;
  count: number;
  color?: string;
  to?: string;
}

interface BarListProps {
  items: BarListItem[];
  unit?: string;
  emptyLabel?: string;
}

const DEFAULT_COLOR = "#585e71";

export function BarList({ items, unit = "人", emptyLabel = "データがありません" }: BarListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-on-surface-variant">{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = Math.round((item.count / max) * 100);
        const color = item.color ?? DEFAULT_COLOR;
        const content = (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="break-words text-sm text-on-surface sm:w-40 sm:shrink-0">{item.label}</span>
            <span className="flex flex-1 items-center gap-3">
              <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-[width]"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </span>
              <span className="w-14 shrink-0 text-right text-sm font-semibold text-on-surface">
                {item.count}
                {unit}
              </span>
            </span>
          </div>
        );

        return (
          <li key={item.key}>
            {item.to ? (
              <Link
                to={item.to}
                className="tap-highlight-none block rounded-lg px-1.5 py-1 transition hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {content}
              </Link>
            ) : (
              <div className="px-1.5 py-1">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
