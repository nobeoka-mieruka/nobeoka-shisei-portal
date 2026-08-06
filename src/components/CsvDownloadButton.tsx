import { useState } from "react";
import { rowsToCsv, downloadCsv, type CsvColumn } from "../lib/csv";
import { DownloadIcon } from "./icons";

interface CsvDownloadButtonProps<T> {
  /** ダウンロードするファイル名（例："nobeoka-council-members.csv"）。 */
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
  /** ボタンに表示するラベル。省略時は「CSVをダウンロード（N件）」。 */
  label?: string;
  className?: string;
}

/**
 * 一覧データをCSV（UTF-8 BOM付き）としてダウンロードするボタン。
 * クライアント側でのみCSVを生成する（プリレンダリングされたHTMLにはCSV本文を含めない）。
 */
export function CsvDownloadButton<T>({ filename, rows, columns, label, className = "" }: CsvDownloadButtonProps<T>) {
  const [generating, setGenerating] = useState(false);

  const handleClick = () => {
    setGenerating(true);
    try {
      const csv = rowsToCsv(rows, columns);
      downloadCsv(filename, csv);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={rows.length === 0 || generating}
      aria-label={`${filename} をダウンロード（${rows.length}件、CSV形式）`}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-surface-container-high px-3.5 py-2 text-xs font-medium text-on-surface transition hover:bg-surface-container-highest disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      <DownloadIcon className="h-4 w-4 shrink-0" aria-hidden />
      {label ?? `CSVをダウンロード（${rows.length}件）`}
    </button>
  );
}
