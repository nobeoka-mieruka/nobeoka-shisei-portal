/**
 * 選挙結果データ（src/data/electionResults.json）の共通ヘルパー。
 */
import electionResultsData from "../data/electionResults.json";
import type { ElectionResult } from "../types/election";

export const electionResults = electionResultsData as ElectionResult[];

export function electionResultById(id: string): ElectionResult | undefined {
  return electionResults.find((e) => e.id === id);
}

export function electionResultsByType(electionType: "mayor" | "councilMember"): ElectionResult[] {
  return electionResults.filter((e) => e.electionType === electionType).sort((a, b) => a.electionDate.localeCompare(b.electionDate));
}

/** 指定した人物ID（現職議員/元議員/歴代市長のID）が候補者として登場した選挙を新しい順に返す。 */
export function electionResultsForPerson(personId: string): ElectionResult[] {
  return electionResults
    .filter((e) => e.candidates.some((c) => c.linkedProfileId === personId))
    .sort((a, b) => b.electionDate.localeCompare(a.electionDate));
}
