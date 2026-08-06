/**
 * データ再利用のためのCSVダウンロード機能（TASK-017）。
 *
 * - 日本語版Excelで文字化けしないよう、UTF-8 BOM付きで出力する。
 * - カンマ・ダブルクォート・改行を含む値はダブルクォートで囲み、内部の"は""へエスケープする
 *   （RFC 4180準拠）。
 * - null/undefinedは空文字列として出力する（"null"/"undefined"という文字列を出力しない）。
 * - 配列値は "; " で連結する（カンマ区切りのCSV内でカンマと混同しないための区切り文字）。
 */

export interface CsvColumn<T> {
  /** CSVヘッダー行に出力する列名（日本語表示名）。 */
  header: string;
  /** 行データから値を取り出す関数。文字列・数値・null・undefined・配列を返せる。 */
  value: (row: T) => string | number | null | undefined | string[];
}

function escapeCsvField(raw: string): string {
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function formatValue(value: string | number | null | undefined | string[]): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("; ");
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  return value;
}

/** 行データ配列と列定義から、UTF-8 BOM付きCSV文字列を生成する。 */
export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeCsvField(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvField(formatValue(c.value(row)))).join(","),
  );
  const BOM = "﻿";
  return BOM + [headerLine, ...lines].join("\r\n") + "\r\n";
}

/** 生成済みのCSV文字列を、指定したファイル名でブラウザにダウンロードさせる（クライアント側のみ）。 */
export function downloadCsv(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
