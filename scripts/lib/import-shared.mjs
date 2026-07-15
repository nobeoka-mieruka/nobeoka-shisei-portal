import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** 変換前に、元JSONを backups/ へタイムスタンプ付きでバックアップする。 */
export function backupJson(relJsonPath) {
  const src = join(root, relJsonPath);
  if (!existsSync(src)) return null;
  const dir = join(root, "backups", timestamp());
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, basename(relJsonPath));
  copyFileSync(src, dest);
  return dest;
}

/** .xlsx または .csv を、ヘッダー行をキーとするオブジェクトの配列として読み込む。 */
export async function readTable(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".csv") {
    return readCsv(filePath);
  }
  if (ext === ".xlsx" || ext === ".xls") {
    const XLSX = await import("xlsx");
    const buf = readFileSync(filePath);
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }
  throw new Error(`未対応のファイル形式です（.xlsx / .csv のみ対応）: ${filePath}`);
}

function readCsv(filePath) {
  let text = readFileSync(filePath, "utf8");
  // 文字化け防止：UTF-8 BOMを除去する
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cells.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

export function writePreview(relOutPath, data) {
  const outPath = join(root, relOutPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return outPath;
}

export function writeDiffReport(relOutPath, lines) {
  const outPath = join(root, relOutPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  return outPath;
}

export function readExistingJson(relPath) {
  const p = join(root, relPath);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, "utf8"));
}
