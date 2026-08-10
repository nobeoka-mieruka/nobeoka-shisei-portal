/**
 * データ鮮度・確認日フィールドの形式検証。
 *
 * src/data配下の全JSONを走査し、既存データが持つ確認日系フィールド（accessedAt・
 * confirmedDate・lastCheckedAt・lastVerified・lastVerifiedAt・summaryVerifiedAt・
 * verifiedAt・referenceDate）について、以下をチェックする。
 *
 * error（ビルドを止めるべき明確な不整合）：
 *   - 日付として解釈できない値（形式不正）
 *   - 未来日（今日より後の日付。データ確認日が未来になることはあり得ない）
 *
 * warning（人が確認した方がよいが、ビルドは止めない）：
 *   - 365日を超えて再確認されていないエントリ（「古い＝間違っている」ではなく
 *     「優先的に再確認した方がよい」の意味。単純に古いというだけでerrorにはしない）
 *
 * 新しい判定ロジックや推測は行わず、既存データが既に持っている値をそのまま検証する。
 * reports/freshness-report.json（generate-freshness-report.mjs、非公開の集計レポート）
 * とは役割を分けている：あちらは運用者向けの一覧、こちらはCIで実行するpass/fail判定。
 *
 * 使い方：node scripts/validate-freshness.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "src", "data");

// 「確認日」系（この値が古いほど再確認が必要）と「基準日」系（対象期間そのものを表す値で、
// 過去年度のデータであれば古くて当然。例：referenceDateは「令和3年1月1日時点の人口」のように
// 対象期間自体を指すため、365日経過警告の対象には含めない）を区別する。
const CONFIRMATION_DATE_FIELDS = new Set([
  "accessedAt",
  "confirmedDate",
  "lastCheckedAt",
  "lastVerified",
  "lastVerifiedAt",
  "summaryVerifiedAt",
  "verifiedAt",
]);
const REFERENCE_PERIOD_FIELDS = new Set(["referenceDate"]);
const DATE_FIELD_NAMES = new Set([...CONFIRMATION_DATE_FIELDS, ...REFERENCE_PERIOD_FIELDS]);

const STALE_WARNING_DAYS = 365;
const now = new Date();
const todayIso = now.toISOString().slice(0, 10);

const errors = [];
const warnings = [];

function checkValue(file, path, field, value) {
  if (typeof value !== "string" || value.trim() === "") return;

  // "確認中"等、既存の非日付ステータス文字列はここでは対象外（別フィールドで管理されているため）。
  const looksLikeDate = /^\d{4}-\d{2}(-\d{2})?/.test(value);
  if (!looksLikeDate) return;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${file} [${path}] ${field}: 日付として解釈できません（値: "${value}"）`);
    return;
  }

  const isoDay = parsed.toISOString().slice(0, 10);
  if (isoDay > todayIso) {
    errors.push(`${file} [${path}] ${field}: 未来日になっています（値: "${value}"、本日: ${todayIso}）`);
    return;
  }

  if (!CONFIRMATION_DATE_FIELDS.has(field)) return; // referenceDate等の「対象期間」フィールドは古くて当然のため対象外。

  const ageDays = Math.floor((now.getTime() - parsed.getTime()) / 86_400_000);
  if (ageDays > STALE_WARNING_DAYS) {
    warnings.push(`${file} [${path}] ${field}: 確認から${ageDays}日経過しています（値: "${value}"）`);
  }
}

function walk(node, file, path) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, file, `${path}[${i}]`));
    return;
  }
  if (node && typeof node === "object") {
    const idHint = typeof node.id === "string" ? node.id : undefined;
    const label = idHint ? `${path}(id=${idHint})` : path;
    for (const [key, value] of Object.entries(node)) {
      if (DATE_FIELD_NAMES.has(key)) checkValue(file, label, key, value);
      walk(value, file, `${label}.${key}`);
    }
  }
}

const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
for (const file of files) {
  let json;
  try {
    json = JSON.parse(readFileSync(join(dataDir, file), "utf8"));
  } catch {
    continue;
  }
  walk(json, file, "$");
}

for (const w of warnings) console.log(`[WARN] ${w}`);
for (const e of errors) console.error(`[ERR] ${e}`);

console.log(`[validate-freshness] errors=${errors.length} warnings=${warnings.length}`);

if (errors.length > 0) process.exit(1);
