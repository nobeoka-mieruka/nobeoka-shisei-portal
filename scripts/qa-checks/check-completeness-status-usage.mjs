#!/usr/bin/env node
/**
 * invalid status（CompletenessStatus語彙外チェック）
 *
 * src/lib/completeness.ts の CompletenessStatus型は
 *   complete / partial / not_collected / not_available / unknown / under_review / confirmed_zero
 * の7値のみを許容する。ただし実装を確認したところ、この型は「実行時に計算されたメトリクス」の
 * 型であり、src/data配下のJSONファイルに文字通り "status": "complete" のような形で
 * 保存されているわけではない（simpleCompleteness()等の関数がcollected/totalKnownから都度算出する）。
 *
 * 一方、src/data配下には "status" という名前の似て非なるフィールドが多数のファイルに存在し
 * （billVotes.publicationStatus、councilSessions.status＝"確認済み/要確認/自動取得" 等）、
 * それぞれ独自の語彙を持つ。これらはvalidate-data.mjs側で個別にVALID_*_STATUSESとして
 * 検証済みのため、本スクリプトで二重に語彙チェックはしない。
 *
 * 本スクリプトが行うのは以下の2点：
 *  (1) "status"を含む名前のフィールドをsrc/data全体から機械的に洗い出し、ファイルごとに
 *      出現する値の一覧（語彙インベントリ）を作る。将来新しいstatus系フィールドが増えた際に、
 *      「validate-data.mjs側の検証が追いついているか」をレビューする起点にする。
 *  (2) CompletenessStatusの7値のいずれかと完全一致する値が、completeness.tsの想定外の文脈
 *      （＝src/data JSON側）に紛れ込んでいないかを検出する。CompletenessStatusはJSONに
 *      保存される設計ではないため、もし出現したら「本来ランタイム計算されるべき値が
 *      誤って静的データとして書き込まれていないか」を人手で確認する着眼点として報告する。
 * 読み取り専用。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listDataJsonFiles, readJson, walk } from "./_lib.mjs";

const COMPLETENESS_STATUS_VALUES = new Set([
  "complete",
  "partial",
  "not_collected",
  "not_available",
  "unknown",
  "under_review",
  "confirmed_zero",
]);

const files = listDataJsonFiles();
const inventory = new Map(); // `${file}::${fieldName}` -> { file, field, values: Map<value, count> }
const suspiciousCompletenessStatusHits = [];

for (const file of files) {
  let data;
  try {
    data = readJson(join("src", "data", file).replace(/\\/g, "/"));
  } catch {
    continue;
  }

  walk(data, (node, path) => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (!/status/i.test(key)) continue;
      if (typeof value !== "string" || value.trim() === "") continue;

      const invKey = `${file}::${key}`;
      if (!inventory.has(invKey)) inventory.set(invKey, { file, field: key, values: new Map() });
      const entry = inventory.get(invKey);
      entry.values.set(value, (entry.values.get(value) ?? 0) + 1);

      if (COMPLETENESS_STATUS_VALUES.has(value)) {
        suspiciousCompletenessStatusHits.push({ file, path: `${path}.${key}`, field: key, value });
      }
    }
  });
}

const inventoryList = [...inventory.values()]
  .map((e) => ({ file: e.file, field: e.field, distinctValues: [...e.values.entries()].map(([v, c]) => ({ value: v, count: c })) }))
  .sort((a, b) => a.file.localeCompare(b.file) || a.field.localeCompare(b.field));

const findings = {
  generatedAt: new Date().toISOString(),
  filesScanned: files.length,
  statusLikeFieldCount: inventoryList.length,
  completenessStatusVocabulary: [...COMPLETENESS_STATUS_VALUES],
  suspiciousCompletenessStatusHitCount: suspiciousCompletenessStatusHits.length,
  suspiciousCompletenessStatusHits,
  inventory: inventoryList,
  note:
    "suspiciousCompletenessStatusHitsは『CompletenessStatusの語彙と完全一致する値がsrc/data JSON内の" +
    "statusフィールドに存在する』という事実のみを示す。CompletenessStatus自体は本来JSONへ保存されない" +
    "設計のため、ヒットが0件でも問題ない。ヒットがある場合は、そのフィールドが本当にCompletenessMetric由来か、" +
    "単なる語の偶然一致（例：billVotesのverificationStatusに\"pending\"はあるが\"unknown\"等はない想定）かを" +
    "人手で確認すること。inventoryは全statusフィールドの値台帳であり、新規フィールド追加時の" +
    "validate-data.mjs側チェック漏れをレビューする資料として使う。",
};

const outPath = join(ROOT, "reports", "qa-checks", "_out-completeness-status-usage.json");
writeFileSync(outPath, JSON.stringify(findings, null, 2) + "\n", "utf8");

console.log(
  `[check-completeness-status-usage] statusLikeFields=${inventoryList.length} suspiciousHits=${suspiciousCompletenessStatusHits.length}`,
);
if (suspiciousCompletenessStatusHits.length > 0) {
  console.log("  例:", suspiciousCompletenessStatusHits.slice(0, 10));
}
process.exitCode = 0; // インベントリ・監査ツールのため常に正常終了
