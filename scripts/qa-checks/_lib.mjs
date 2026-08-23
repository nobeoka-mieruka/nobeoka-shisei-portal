// scripts/qa-checks/配下の横断監査スクリプト群の共通ヘルパー。
// scripts/lib/validate-archive-common.mjs等の既存libとは独立している（将来的な統合は検討課題）。
//
// すべて読み取り専用（fs.readFileSync / readdirSync のみ）。書き込みは一切行わない。
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const ROOT = resolve(__dirname, "..", "..");
export const DATA_DIR = join(ROOT, "src", "data");

export function readJson(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), "utf8"));
}

/** src/data直下（サブディレクトリを除く）の.jsonファイル名一覧を返す。 */
export function listDataJsonFiles() {
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !f.startsWith("_")) // _archive-crawler-sync-state.json等の内部状態ファイルを除外
    .sort();
}

/** 値がオブジェクトの配列であればtrue（プリミティブ配列やnullは除く）。 */
export function isArrayOfObjects(v) {
  return Array.isArray(v) && v.length > 0 && v.every((x) => x !== null && typeof x === "object" && !Array.isArray(x));
}

/**
 * JSON構造を再帰的に走査し、条件に一致するノードごとにvisitorを呼び出す。
 * path文字列（例: "promises[3].evidenceItems[0]"）を各ノードに付与する。
 */
export function walk(value, visitor, path = "$") {
  visitor(value, path);
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, visitor, `${path}[${i}]`));
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      walk(v, visitor, `${path}.${k}`);
    }
  }
}

/** 出力用ヘルパー：JSON findingsをreports/phase78-88-staging配下へ書き出す（呼び出し側でファイル名指定）。 */
export function nowIso() {
  return new Date().toISOString();
}
