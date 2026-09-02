import type { Faction } from "../types";
import { getReadableTextColor } from "../lib/contrastColor";

interface FactionChipProps {
  faction: Faction;
  size?: "sm" | "md";
  className?: string;
}

export function FactionChip({ faction, size = "sm", className = "" }: FactionChipProps) {
  const color = faction.color ?? "#585e71";
  const sizeClass = size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm";
  // Phase194（WCAG 1.4.3）：会派の色は公表資料に基づく識別色でデータ側では変更しないため、
  // 背景色の明るさから読みやすい文字色（白／黒）を自動選択してコントラスト比を確保する。
  const textColor = getReadableTextColor(color);

  return (
    <span
      className={`inline-block max-w-full break-words rounded-full border font-medium align-middle ${sizeClass} ${className}`}
      style={{ backgroundColor: color, borderColor: color, color: textColor }}
    >
      {faction.name}
    </span>
  );
}
