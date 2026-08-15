/**
 * TASK-078：トップページに表示する「データ整備状況」の抜粋。
 *
 * /data-status の「データ完全性ダッシュボード」と同じ入力データ・同じ
 * simpleCompleteness()（src/lib/completeness.ts）の式で算出することで、
 * トップページと/data-statusの数字が食い違わないようにする。「サイト完成率○%」の
 * ような単一の総合スコアは作らず、項目ごとの分子／分母を個別に見せる方針を維持する。
 */
import billVotesData from "../data/billVotes.json";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import type { BillVoteItem } from "../types";
import type { ArchiveFiscalYear, ArchiveMayor, ArchiveMayorTerm } from "../types/historicalArchive";
import { simpleCompleteness, type CompletenessMetric } from "./completeness";
import type { GeneralQuestionStats } from "./generalQuestionStats";

const billVotes = billVotesData as BillVoteItem[];
const archiveFiscalYears = archiveFiscalYearsData as ArchiveFiscalYear[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];

export type HomeDataCoverageItem =
  | { kind: "ratio"; label: string; metric: CompletenessMetric; linkTo: string }
  | { kind: "count"; label: string; value: number; unit: string; linkTo: string };

/** questionStatsは呼び出し側（既にcalculateGeneralQuestionStatsを実行済みのページ）から受け取る
 * ことで、同じ集計を二重計算しない。 */
export function homeDataCoverageItems(questionStats: GeneralQuestionStats): HomeDataCoverageItem[] {
  const billVotesProposerTypeKnown = billVotes.filter((b) => b.proposerType).length;
  const fiscalYearsWithFund = archiveFiscalYears.filter((f) => !!f.fund).length;
  const fiscalYearsWithDebt = archiveFiscalYears.filter((f) => !!f.debt).length;
  const dayPreciseTerms = archiveMayorTerms.filter((t) => (t.termStartPrecision ?? "day") === "day");

  return [
    {
      kind: "ratio",
      label: "一般質問（現任期の対象会期・会議録収録済み）",
      metric: simpleCompleteness(questionStats.collectedSessionCount, questionStats.targetSessionCount),
      linkTo: "/data-status",
    },
    {
      kind: "ratio",
      label: "議案：提出者区分の確認",
      metric: simpleCompleteness(billVotesProposerTypeKnown, billVotes.length),
      linkTo: "/data-status",
    },
    {
      kind: "ratio",
      label: "財政：基金残高の年度確認",
      metric: simpleCompleteness(fiscalYearsWithFund, archiveFiscalYears.length),
      linkTo: "/finance",
    },
    {
      kind: "ratio",
      label: "財政：市債残高の年度確認",
      metric: simpleCompleteness(fiscalYearsWithDebt, archiveFiscalYears.length),
      linkTo: "/finance",
    },
    {
      kind: "count",
      label: "歴代市長：登録人数",
      value: archiveMayors.length,
      unit: "名登録",
      linkTo: "/mayors",
    },
    {
      kind: "ratio",
      label: "歴代市長：任期の日単位確認",
      metric: simpleCompleteness(dayPreciseTerms.length, archiveMayorTerms.length),
      linkTo: "/mayors",
    },
  ];
}
