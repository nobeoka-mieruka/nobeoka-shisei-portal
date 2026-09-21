/**
 * Phase261：当初予算・補正予算の段階別データ（src/data/budgetRevisions.json）の表示用ヘルパー。
 *
 * 予算→事業→議案→議決→議員別賛否を1本でたどれるよう、予算データは議案ID（billId）だけを持ち、
 * 議決結果・議決日・議員別賛否は billVotes.json の射影（budgetRevisionBillsIndex.json、
 * scripts/generate-data-indexes.mjs が生成）から引く。予算データ側に議決結果を複製しない。
 */
import budgetRevisionsData from "../data/budgetRevisions.json";
import budgetRevisionBillsData from "../data/budgetRevisionBillsIndex.json";
import policyCategoriesData from "../data/archivePolicyCategories.json";
import mayorPromisesIndex from "../data/mayorPromisesIndex.json";
import type { BudgetFunding, BudgetRevision, BudgetRevisionAccount, BudgetRevisionProject } from "../types/budgetRevision";

export interface BudgetRevisionBill {
  id: string;
  billNumber: string;
  billTitle: string;
  session?: string;
  result?: string;
  votingDate?: string;
  publicationStatus?: string;
  verificationStatus?: string;
  memberVoteCount: number;
  memberVoteSummary: Record<string, number>;
  individualVoteDisclosureStatus?: "disclosed" | "notDisclosed" | "unconfirmed";
  voteMethod?: string;
}

export const BUDGET_REVISIONS = budgetRevisionsData as BudgetRevision[];
const MAYOR_PROMISES_INDEX = mayorPromisesIndex as { promises: { id: string; promiseText: string }[] };
const BILLS = new Map((budgetRevisionBillsData as BudgetRevisionBill[]).map((b) => [b.id, b]));
const CATEGORY_LABELS = new Map((policyCategoriesData as { id: string; label: string }[]).map((c) => [c.id, c.label]));

/** 年度内の段階を時系列（当初予算→補正の提出順）に並べる。 */
export function budgetRevisionsForYear(fiscalYear: number): BudgetRevision[] {
  return BUDGET_REVISIONS.filter((r) => r.fiscalYear === fiscalYear).sort((a, b) => a.sequence - b.sequence);
}

export function budgetBill(billId: string): BudgetRevisionBill | undefined {
  return BILLS.get(billId);
}

/** 議案詳細ページから、その議案に対応する予算段階・会計を引く。 */
export function budgetRevisionForBill(billId: string): { revision: BudgetRevision; account: BudgetRevisionAccount } | undefined {
  for (const revision of BUDGET_REVISIONS) {
    const account = revision.accounts.find((a) => a.billId === billId);
    if (account) return { revision, account };
  }
  return undefined;
}

export function policyCategoryLabel(id: string): string {
  return CATEGORY_LABELS.get(id) ?? id;
}

/** 金額は財政ページの既存表記（千円単位＋必要に応じて億円の概数）に合わせる。 */
export function formatThousandYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}千円`;
}

export function formatOkuFromThousand(value: number): string {
  return `約${(value / 100000).toFixed(1)}億円`;
}

/** 財源内訳を「国・県支出金 18,382千円」のような行に変換する（空欄の区分は出さない）。 */
export function fundingRows(funding: BudgetFunding): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, v: number | null, note: string | null) => {
    if (v === null) return;
    rows.push({ label: note ? `${label}（${note}）` : label, value: formatThousandYen(v) });
  };
  push("国・県支出金", funding.nationalPrefecturalThousandYen, null);
  push("地方債", funding.localBondThousandYen, null);
  push("その他", funding.otherThousandYen, funding.otherNote);
  push("一般財源", funding.generalRevenueThousandYen, funding.generalRevenueNote);
  return rows;
}

/**
 * 議員別賛否の表示文。0件の場合は議案データの individualVoteDisclosureStatus で
 * 「公表なし（会議録で確認済み：起立採決等で個人の賛否が記録されていない）」と
 * 「未確認（会議録で未確認・未公開）」を区別し、全会一致等から個人の賛否を推測しない。
 */
export function memberVoteText(bill: BudgetRevisionBill | undefined): string {
  if (!bill) return "議案データ未登録";
  if (bill.memberVoteCount === 0) {
    if (bill.individualVoteDisclosureStatus === "notDisclosed") {
      return `公表なし：会議録で確認した結果、${bill.voteMethod ? `${bill.voteMethod}で` : "起立採決等で"}議決されており、公式資料に議員個人の賛成・反対は記録されていません。`;
    }
    return "未確認：延岡市議会の審議結果資料には議決結果のみが記載されています。会議録等の公式資料で確認でき次第登録します（推測では登録しません）。";
  }
  // 表示ラベルは BillMemberVoteStatus（src/types/index.ts）の定義に合わせる。
  const labels: Record<string, string> = {
    approve: "賛成",
    oppose: "反対",
    departed: "退席",
    absent: "欠席",
    recused: "除斥",
    notVoting: "採決なし",
    abstained: "棄権",
    unconfirmed: "確認不能",
  };
  const parts = Object.entries(bill.memberVoteSummary).map(([vote, n]) => `${labels[vote] ?? vote}${n}人`);
  return `${bill.memberVoteCount}人分を登録済み${parts.length > 0 ? `（${parts.join("・")}）` : ""}`;
}

/**
 * Phase274：ある市長公約に紐づけられた予算事業を返す。
 *
 * 紐づけは予算側（budgetRevisions.json の projects[].relatedPromiseIds）にだけ持たせており、
 * 公約側はIDを持たない（参照を片方向にして循環を作らないため）。この関数は公約詳細ページから
 * 予算事業・その議案・議決結果まで辿れるようにするための逆引き。
 */
export function budgetProjectsForPromise(promiseId: string): {
  revisionId: string;
  revisionLabel: string;
  fiscalYear: number;
  project: BudgetRevisionProject;
  bill: BudgetRevisionBill | undefined;
}[] {
  const results: {
    revisionId: string;
    revisionLabel: string;
    fiscalYear: number;
    project: BudgetRevisionProject;
    bill: BudgetRevisionBill | undefined;
  }[] = [];
  for (const revision of BUDGET_REVISIONS) {
    for (const project of revision.projects ?? []) {
      if (!(project.relatedPromiseIds ?? []).includes(promiseId)) continue;
      const account = revision.accounts.find((a) => a.accountName === project.accountName) ?? revision.accounts[0];
      results.push({
        revisionId: revision.id,
        revisionLabel: revision.label,
        fiscalYear: revision.fiscalYear,
        project,
        bill: account ? budgetBill(account.billId) : undefined,
      });
    }
  }
  return results;
}

/**
 * Phase274：公約IDを、市民が読んで分かる短い名前にする。
 * 全ページが読み込む軽量インデックス（mayorPromisesIndex.json）を使い、
 * 本文を含む mayorPromises.json（約75KB）を財政ページへ持ち込まない。
 */
export function promiseLabel(promiseId: string): string {
  const promise = MAYOR_PROMISES_INDEX.promises.find((p) => p.id === promiseId);
  if (!promise) return `公約${promiseId}`;
  const text = promise.promiseText;
  return text.length > 28 ? `${text.slice(0, 28)}…` : text;
}
