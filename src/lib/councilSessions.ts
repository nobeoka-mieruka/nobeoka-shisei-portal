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

// ---------------------------------------------------------------------------
// Phase203：「直近の確認済み会期」と「次回・開催予定の会期」を別物として扱うための状態定義。
//
// データ側へ新しい状態フィールドは追加しない。判定に使うのは既存の単一情報源だけ：
//   1. councilSessions.json           … 議案等審議結果などの公式資料を確認・登録できた会期
//   2. questionCollectionStatus.json  … 一般質問の収録対象として登録済みの会期と会議録公開状況
//   3. generalQuestions.json          … 質問通告書ベースの予定質問（会期名・質問予定日）
//
// 過去データの再分類は行わない（councilSessions.jsonにある会期はすべて"completed"）。
// 「開催中」と「開催前」をさらに分ける判定は実行日（今日）に依存する。本サイトはプリレンダ
// リング済みHTMLをhydrateする構成のため、実行日に依存した文言はビルド時と閲覧時で食い違う。
// そのため内部状態は日付に依存しない2つに限定し、開催予定日そのもの（generalQuestions.jsonの
// questionDateの実値）を併記して利用者が判断できるようにする。
// ---------------------------------------------------------------------------

/**
 * 会期の進行状態。
 * - "completed"：会期が終了し、当サイトの収録対象として登録済み（公式資料の確認段階に入っている）
 * - "upcoming"：これから開催される、または開催中。議決結果・会議録のいずれもまだ確認できていない
 */
export type CouncilSessionPhase = "completed" | "upcoming";

/** 内部状態を市民向けの日本語へ変換する。表示側でこの表以外の言い回しを作らない。 */
export const councilSessionPhaseLabels: Record<CouncilSessionPhase, string> = {
  completed: "開催済み",
  upcoming: "開催予定・開催中",
};

/** 「直近の確認済み会期」欄の見出し（ページ間で言い回しを揃えるための単一情報源）。 */
export const LATEST_CONFIRMED_SESSION_HEADING = "直近の確認済み会期";
/** 「次回・開催予定の会期」欄の見出し（同上）。 */
export const UPCOMING_SESSION_HEADING = "次回・開催予定の会期";

/** 令和元年（2019年）を基準とした西暦換算の起点。 */
const REIWA_START_YEAR = 2019;

/**
 * 会期名（例："令和8年9月定例会"）から会期ID（例："2026-09"）を導出する。
 * councilSessions.jsonのid規則（"YYYY-MM" / "YYYY-MM-extraordinary"）に合わせる。
 * 想定した表記に一致しない場合はnullを返す（推測で会期IDを作らない）。
 */
export function councilSessionIdFromSessionName(sessionName: string): string | null {
  const m = sessionName.match(/^令和(\d+)年(\d{1,2})月(定例会|臨時会)$/);
  if (!m) return null;
  const year = REIWA_START_YEAR + Number(m[1]) - 1;
  return `${year}-${String(Number(m[2])).padStart(2, "0")}${m[3] === "臨時会" ? "-extraordinary" : ""}`;
}

/**
 * 公式資料を確認できている直近の会期（＝councilSessions.jsonの最新レコード）。
 * idは"YYYY-MM"／"YYYY-MM-extraordinary"形式で常に開催年月の昇順に並ぶため、文字列の降順
 * ソートで直近を取得できる（startDateは未確認の会期が多く、日付では並べ替えられない）。
 */
export function latestConfirmedCouncilSession<T extends { id: string }>(sessions: T[]): T | undefined {
  return [...sessions].sort((a, b) => b.id.localeCompare(a.id))[0];
}

/**
 * 会期名の一覧を「〜と〜」の形ではなく読点区切りで並べる（会期が1件でも複数でも同じ書式）。
 * 会期名・件数は必ず呼び出し側が実データから渡す。
 */
export function joinSessionNames(sessionNames: string[]): string {
  return sessionNames.join("、");
}
