import type { Faction } from "../types";

interface FactionFilterProps {
  factions: Faction[];
  selected: string | "all";
  onChange: (value: string | "all") => void;
}

export function FactionFilter({ factions, selected, onChange }: FactionFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterChip label="すべて" active={selected === "all"} onClick={() => onChange("all")} />
      {factions.map((faction) => (
        <FilterChip
          key={faction.id}
          label={faction.name}
          active={selected === faction.id}
          color={faction.color}
          onClick={() => onChange(faction.id)}
        />
      ))}
    </div>
  );
}

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "border-transparent bg-secondary-container text-on-secondary-container"
          : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
      }`}
      style={active && color ? { backgroundColor: color, borderColor: color, color: "#FFFFFF" } : undefined}
    >
      {label}
    </button>
  );
}
