import type { BillVoteItem, CouncilSession, SessionSummaryStatus } from "../types";

export const sessionSummaryStatusLabels: Record<SessionSummaryStatus, string> = {
  verified: "確認済み",
  "partially-verified": "一部確認済み",
  pending: "確認待ち・暫定掲載",
  unavailable: "要約作成に必要な資料が不足",
};

/** この会期に属する議案（sessionIdまたはsession名で一致するもの）。 */
export function billsForSession(bills: BillVoteItem[], session: CouncilSession): BillVoteItem[] {
  return bills.filter((b) => b.sessionId === session.id || b.session === session.title);
}

export interface SessionBillStats {
  registered: number;
  byResult: { result: string; count: number }[];
}

/** 議決結果が確認できている件数だけを集計する（「確認中」は含めない）。 */
export function sessionBillStats(bills: BillVoteItem[]): SessionBillStats | undefined {
  if (bills.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const b of bills) {
    if (!b.result || b.result === "確認中") continue;
    counts.set(b.result, (counts.get(b.result) ?? 0) + 1);
  }
  const byResult = [...counts.entries()]
    .map(([result, count]) => ({ result, count }))
    .sort((a, b) => b.count - a.count);
  return { registered: bills.length, byResult };
}
