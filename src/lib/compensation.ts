import type { CompensationComparisonEntry, CompensationRole } from "../types";
import { rankGeneric } from "./ranking";

export const COMPENSATION_ROLES: { key: CompensationRole; label: string }[] = [
  { key: "mayor", label: "市長" },
  { key: "chair", label: "議長" },
  { key: "viceChair", label: "副議長" },
  { key: "member", label: "議員" },
];

const roleMonthlyKey: Record<CompensationRole, "mayorMonthly" | "chairMonthly" | "viceChairMonthly" | "memberMonthly"> = {
  mayor: "mayorMonthly",
  chair: "chairMonthly",
  viceChair: "viceChairMonthly",
  member: "memberMonthly",
};

export function getMonthly(entry: CompensationComparisonEntry, role: CompensationRole): number {
  return entry[roleMonthlyKey[role]];
}

function getBonusMonths(entry: CompensationComparisonEntry, role: CompensationRole): number | null {
  return role === "mayor" ? entry.mayorBonusMonths : entry.councilBonusMonths;
}

export interface AnnualEstimate {
  /** 支給月数が公式資料で確認できない場合は null（＝算定不可）。 */
  amount: number | null;
  /** 役職加算率などが公式資料で確認できておらず、概算表示にすべきかどうか。 */
  isApproximate: boolean;
}

/**
 * 年間支給見込額＝月額報酬×（12＋期末手当支給月数）。
 * 支給月数が確認できない自治体は算定せず null を返す（不完全なデータから推定しない）。
 * 役職加算率（bonusAdjustmentRate）が確認できない場合は、算定はするが概算として扱う。
 */
export function calcAnnualEstimate(entry: CompensationComparisonEntry, role: CompensationRole): AnnualEstimate {
  const monthly = getMonthly(entry, role);
  const bonusMonths = getBonusMonths(entry, role);
  if (bonusMonths === null) {
    return { amount: null, isApproximate: false };
  }
  const amount = Math.round(monthly * (12 + bonusMonths));
  return { amount, isApproximate: entry.bonusAdjustmentRate === null };
}

export function formatYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

export interface RankedEntry {
  entry: CompensationComparisonEntry;
  monthly: number;
  rank: number;
}

/**
 * 月額報酬の高い順に自治体を順位付けする。同額は同順位（1, 2, 2, 4方式）とする。
 * 返り値は必ず金額の高い順（＝順位の昇順）に並べる。
 */
export function rankByRole(entries: CompensationComparisonEntry[], role: CompensationRole): RankedEntry[] {
  return rankGeneric(entries, (entry) => getMonthly(entry, role))
    .filter((r): r is { item: CompensationComparisonEntry; value: number; rank: number } => r.rank !== null)
    .map((r) => ({ entry: r.item, monthly: r.value, rank: r.rank }))
    .sort((a, b) => a.rank - b.rank);
}

export function findRank(ranked: RankedEntry[], municipality: string): number | null {
  return ranked.find((r) => r.entry.municipality === municipality)?.rank ?? null;
}

/**
 * 最高額・最低額の範囲内で、value がどの位置（0〜100%）にあるかを返す。
 * これは順位ではなく、範囲内での相対位置を示すためだけの値。
 */
export function calcRangePosition(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  const ratio = ((value - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, ratio));
}
