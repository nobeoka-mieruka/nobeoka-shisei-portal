/**
 * 運用者向け・非公開のデータ鮮度レポートを reports/freshness-report.json へ生成する。
 *
 * 公開ページからはリンクしない内部向けレポート。src/data配下の全JSONを走査し、
 * 既存データが実際に持っている「確認日」系フィールド（accessedAt・confirmedDate・
 * lastCheckedAt・lastVerified・lastVerifiedAt・summaryVerifiedAt・verifiedAt）と、
 * 「要確認」系ステータス値（under_review・pending・blocked・needsReview・
 * unconfirmed・not_collected・unavailable）の出現箇所を機械的に集計する。
 * 新しい判定ロジックや推測は行わず、既存データが既に持っている値をそのまま集計する。
 *
 * 使い方：node scripts/generate-freshness-report.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "src", "data");

const DATE_FIELD_NAMES = new Set([
  "accessedAt",
  "confirmedDate",
  "lastCheckedAt",
  "lastVerified",
  "lastVerifiedAt",
  "summaryVerifiedAt",
  "verifiedAt",
]);

const REVIEW_STATUS_VALUES = new Set([
  "under_review",
  "pending",
  "blocked",
  "needsReview",
  "unconfirmed",
  "not_collected",
  "unavailable",
]);

const STALE_DAYS = 90;
const now = new Date();

function daysAgo(isoLike) {
  const t = new Date(isoLike).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** JSON構造を再帰的に歩き、日付系フィールドとステータス値の出現をfileごとに集計する。 */
function walk(node, dateHits, statusHits) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, dateHits, statusHits);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (DATE_FIELD_NAMES.has(key) && typeof value === "string") {
        const age = daysAgo(value);
        if (age !== null) dateHits.push({ field: key, value, ageDays: age });
      }
      if (typeof value === "string" && REVIEW_STATUS_VALUES.has(value)) {
        statusHits.set(value, (statusHits.get(value) ?? 0) + 1);
      }
      walk(value, dateHits, statusHits);
    }
  }
}

const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
const perFile = [];

for (const file of files) {
  let json;
  try {
    json = JSON.parse(readFileSync(join(dataDir, file), "utf8"));
  } catch {
    continue;
  }
  const dateHits = [];
  const statusHits = new Map();
  walk(json, dateHits, statusHits);
  if (dateHits.length === 0 && statusHits.size === 0) continue;

  const stale = dateHits.filter((h) => h.ageDays > STALE_DAYS);
  const oldestFirst = [...dateHits].sort((a, b) => b.ageDays - a.ageDays);

  perFile.push({
    file,
    dateFieldCount: dateHits.length,
    staleCount: stale.length,
    oldestEntries: oldestFirst.slice(0, 5).map((h) => ({ field: h.field, value: h.value, ageDays: h.ageDays })),
    reviewStatusCounts: Object.fromEntries(statusHits),
  });
}

perFile.sort((a, b) => b.staleCount - a.staleCount);

const report = {
  generatedAt: now.toISOString(),
  staleThresholdDays: STALE_DAYS,
  note:
    "既存データが持つ確認日・ステータス値をそのまま集計した運用者向けレポート。公開ページからはリンクしない。" +
    "staleCountは確認日から90日以上経過した件数（内容が誤っているという意味ではなく、再確認の優先度づけ用）。",
  filesWithStaleEntries: perFile.filter((f) => f.staleCount > 0).length,
  totalStaleEntries: perFile.reduce((sum, f) => sum + f.staleCount, 0),
  files: perFile,
};

writeFileSync(join(root, "reports", "freshness-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  `[freshness-report] ${report.filesWithStaleEntries}ファイルに90日超の未再確認エントリあり（合計${report.totalStaleEntries}件）`,
);
for (const f of perFile.filter((x) => x.staleCount > 0).slice(0, 10)) {
  console.log(`  - ${f.file}: stale=${f.staleCount}/${f.dateFieldCount}`);
}
