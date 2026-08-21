import type { ReactNode } from "react";

export interface FinanceTableColumn<T> {
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  /**
   * 定義文・出典名など、1セルの中身が長文になり得る列にtrueを指定する。
   * 既定（false／未指定）は「1行で収まる短い値・ラベル」を想定してwhitespace-nowrapとし、
   * 日本語が1文字ずつ縦に折り返される表示（列が極端に狭くなったときに発生する）を防ぐ。
   * trueを指定した列は、代わりに読みやすい最小幅（min-width）を確保したうえで
   * 通常の折り返しを許可し、極端な横幅にならないようにする。
   */
  wrap?: boolean;
  /** 最初の列（通常は「年度」等の行見出し）をtrueにすると、横スクロール時も左端に固定表示する。 */
  sticky?: boolean;
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
 *
 * 既定では各セルにwhitespace-nowrapを適用する。表の列幅が画面幅より狭くなった場合、
 * table-layout: auto（既定）のtable要素は日本語テキストの行内どこでも改行できる特性のせいで、
 * 列幅が1文字分まで縮み「確認中」「円（億円表示）」等の短い語が1文字ずつ縦に並ぶ深刻な可読性
 * バグを起こしていた（Phase31で発見）。nowrapにより各列の最小幅は常に中身の全角文字列分を
 * 確保し、収まらない場合は表自体を（外側のoverflow-x-autoで）横スクロールさせる。
 * 定義文・出典等の長文セルはwrap:trueを指定し、読みやすい最小幅を確保したうえで通常改行させる。
 */
export function FinanceTable<T>({ caption, srOnlyCaption = true, columns, rows, rowKey }: FinanceTableProps<T>) {
  return (
    <div
      className="mt-3 overflow-x-auto rounded-lg border border-outline-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="w-full min-w-[360px] border-collapse text-sm">
        <caption className={srOnlyCaption ? "sr-only" : "px-3 py-2 text-left text-xs text-on-surface-variant"}>
          {caption}
        </caption>
        <thead>
          <tr className="bg-surface-container-high">
            {columns.map((col, colIndex) => (
              <th
                key={col.header}
                scope="col"
                className={`px-3 py-2.5 text-xs font-semibold text-on-surface-variant ${
                  col.align === "right" ? "text-right" : "text-left"
                } ${col.wrap ? "min-w-[9rem] whitespace-normal break-words" : "whitespace-nowrap"} ${
                  col.sticky || colIndex === 0 ? "sticky left-0 z-10 bg-surface-container-high" : ""
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
              {columns.map((col, colIndex) => (
                <td
                  key={col.header}
                  className={`px-3 py-2.5 text-on-surface [font-variant-numeric:tabular-nums] ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${col.wrap ? "min-w-[9rem] whitespace-normal break-words align-top" : "whitespace-nowrap"} ${
                    col.sticky || colIndex === 0 ? "sticky left-0 z-10 bg-surface-container-low" : ""
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
