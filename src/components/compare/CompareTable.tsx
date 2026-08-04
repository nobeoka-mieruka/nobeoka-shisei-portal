/**
 * 比較表の共通コンポーネント。
 * 既存の`FinanceTable`（財政比較ページ群で使用中、ジェネリックで財政専用ではない）を
 * そのまま再エクスポートする。市長・政策・年度など比較対象の種類によらず同じ表組みを
 * 使うため、実装を複製せずcompare配下からも同じ名前で参照できるようにする。
 */
export { FinanceTable as CompareTable } from "../finance/FinanceTable";
export type { FinanceTableColumn as CompareTableColumn } from "../finance/FinanceTable";
