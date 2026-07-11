import factionsData from "../data/factions.json";
import type { Faction } from "../types";

export const allFactions: Faction[] = factionsData;

const factionMap = new Map<string, Faction>(allFactions.map((f) => [f.id, f]));

const fallbackColors = ["#375ca8", "#79536e", "#3a6b5c", "#8a6d1f", "#585e71", "#ba1a1a"];

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function getFaction(factionId: string): Faction {
  const found = factionMap.get(factionId);
  if (found) return found;
  const color = fallbackColors[Math.abs(hashCode(factionId)) % fallbackColors.length];
  return { id: factionId, name: "無所属", color };
}
