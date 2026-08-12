import blockedTaskClassificationData from "../data/blockedTaskClassification.json";
import type { BlockedTaskClassificationEntry, BlockedTaskStatus } from "../types/blockedTaskClassification";

export const blockedTaskClassification = blockedTaskClassificationData as BlockedTaskClassificationEntry[];

export function blockedTaskStatusCounts(): Record<BlockedTaskStatus, number> {
  const counts: Record<BlockedTaskStatus, number> = {
    WAITING_EXTERNAL: 0,
    BLOCKED_TECHNICAL: 0,
    MANUAL_REVIEW: 0,
    RESEARCH_EXHAUSTED: 0,
    NOT_APPLICABLE: 0,
    COMPLETED: 0,
  };
  for (const c of blockedTaskClassification) counts[c.status]++;
  return counts;
}
