import type { Faction } from "../types";

interface FactionChipProps {
  faction: Faction;
  size?: "sm" | "md";
  className?: string;
}

export function FactionChip({ faction, size = "sm", className = "" }: FactionChipProps) {
  const color = faction.color ?? "#585e71";
  const sizeClass = size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-block max-w-full break-words rounded-full border font-medium text-white align-middle ${sizeClass} ${className}`}
      style={{ backgroundColor: color, borderColor: color }}
    >
      {faction.name}
    </span>
  );
}
