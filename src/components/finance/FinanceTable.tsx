import type { ReactNode } from "react";

export interface FinanceTableColumn<T> {
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

interface FinanceTableProps<T> {
  /** スクリーンリーダー・印刷向けの表題。同じ内容を示すグラフ・見出しと重複する場合はsrOnlyをtrueにする。 */
  caption: string;
  srOnlyCaption?: boolean;
  columns: FinanceTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
}

/**
 * グラフと同じ内容を、スクリーンリーダー・印刷利用者も確認できる表として表示する共通コンポーネント。
 * 数値列はtabular-numsで桁を揃え、横幅が狭い画面では表自体を横スクロールさせる（ページ全体は横スクロールさせない）。
 */
export function FinanceTable<T>({ caption, srOnlyCaption = true, columns, rows, rowKey }: FinanceTableProps<T>) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-outline-variant">
      <table className="w-full min-w-[360px] border-collapse text-sm">
        <caption className={srOnlyCaption ? "sr-only" : "px-3 py-2 text-left text-xs text-on-surface-variant"}>
          {caption}
        </caption>
        <thead>
          <tr className="bg-surface-container-high">
            {columns.map((col) => (
              <th
                key={col.header}
                scope="col"
                className={`px-3 py-2 text-xs font-semibold text-on-surface-variant ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-t border-outline-variant">
              {columns.map((col) => (
                <td
                  key={col.header}
                  className={`px-3 py-2 text-on-surface [font-variant-numeric:tabular-nums] ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
