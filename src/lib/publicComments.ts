import type { PublicCommentDataset } from "../types/publicComment";

/**
 * パブリックコメントの確認日の表示区分。
 *
 * dataset.lastVerifiedAt は「運用状況一覧ページを確認した日」であり、各案件ページの確認日
 * （entries[].lastVerifiedAt）とは別物である。一覧だけを再確認した日や、一部の案件だけを
 * 再確認した日をページ全体の「最終確認日」として表示すると、個別欄の日付と食い違って見える
 * （2026-10-20時点で、全体10月9日・教育大綱10月20日と表示された不整合の原因）。
 * 全案件が一覧の確認日以降に確認済みの場合だけ「掲載データ全体の最終確認日」と表示する。
 */
export interface PublicCommentVerificationSummary {
  /** 全案件が一覧の確認日以降に確認済みか。 */
  allEntriesVerified: boolean;
  /** 日付に添える見出し。 */
  label: string;
  /** 日付（ISO形式）。 */
  date: string;
  /** 全案件を確認していない場合の補足（個別欄を見るよう案内する）。 */
  note: string | null;
}

export function publicCommentVerificationSummary(dataset: PublicCommentDataset): PublicCommentVerificationSummary {
  const allEntriesVerified = dataset.entries.every((e) => e.lastVerifiedAt >= dataset.lastVerifiedAt);
  return allEntriesVerified
    ? {
        allEntriesVerified,
        label: `掲載データ（全${dataset.entries.length}件）の最終確認日`,
        date: dataset.lastVerifiedAt,
        note: null,
      }
    : {
        allEntriesVerified,
        label: "運用状況一覧の確認日",
        date: dataset.lastVerifiedAt,
        note: "各案件の最終確認日は、それぞれの案件の欄に表示しています。",
      };
}
