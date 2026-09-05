import factionsData from "../data/factions.json";
import type { Faction, FactionOfficer } from "../types";

// factions.json の `officers[].role` はJSON上ただの string になるため、他のデータ読み込み
// （members.json 等）と同じく型アサーションで読み込む。実際の値が想定どおりかは
// scripts/validate-data.mjs の会派役員チェックが error として固定している。
export const allFactions: Faction[] = factionsData as Faction[];

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

/**
 * 会派役員の並び順。延岡市議会「会派役員及び所属議員名簿」の記載順に合わせる
 * （名簿の順序を並べ替えると、役職の上下関係を当サイトが判定したように読めてしまうため、
 * 独自の序列は作らず名簿どおりの順序を再現するだけにとどめる）。
 */
const OFFICER_ROLE_ORDER = ["団長", "副団長", "幹事長", "副幹事長", "顧問"];

/**
 * ある議員の会派内の役職を返す。名簿に役職の記載が無い議員は `null`
 * （「役職なし」と断定せず、表示側でも役職欄を出さない）。
 */
export function getFactionOfficerRole(factionId: string, memberId: string): string | null {
  const faction = factionMap.get(factionId);
  const officer = faction?.officers?.find((o) => o.memberId === memberId);
  return officer ? officer.role : null;
}

/** 会派役員を名簿の記載順に並べて返す。未確認の会派は空配列。 */
export function sortedFactionOfficers(faction: Faction): FactionOfficer[] {
  return [...(faction.officers ?? [])].sort(
    (a, b) => OFFICER_ROLE_ORDER.indexOf(a.role) - OFFICER_ROLE_ORDER.indexOf(b.role),
  );
}
