/**
 * 「広報のべおか」バックナンバー索引（src/data/kohoNobeokaIssues.json）の共通ヘルパー。
 * 索引データ自体はカタログ（号とPDF URLの対応）のみを持ち、記事内容の引用表示は
 * このファイルの関数を使って各データのnotes・出典欄と組み合わせて生成する。
 */
import kohoNobeokaIssuesData from "../data/kohoNobeokaIssues.json";
import type { KohoNobeokaIssue } from "../types/kohoNobeoka";

export const kohoNobeokaIssues = kohoNobeokaIssuesData as KohoNobeokaIssue[];

export function kohoNobeokaIssueByYearMonth(issueYearMonth: string): KohoNobeokaIssue | undefined {
  return kohoNobeokaIssues.find((i) => i.issueYearMonth === issueYearMonth);
}

/**
 * 市民向けの出典表示文字列を生成する。例:「広報のべおか2020年6月号」
 * 「広報のべおか2020年6月号 p.10」（pageを指定した場合）。
 * 該当号が索引に無い場合はissueYearMonthをそのまま使った簡易表記にフォールバックする
 * （号自体を推測で作らないが、表示自体は落とさない）。
 */
export function formatKohoCitation(issueYearMonth: string, page?: number): string {
  const issue = kohoNobeokaIssueByYearMonth(issueYearMonth);
  const label = issue?.title ?? `広報のべおか${issueYearMonth.replace("-", "年")}月号`;
  return page ? `${label} p.${page}` : label;
}
