/**
 * Phase273：市長公約の「変更してはいけない部分」のスナップショットを生成する。
 *
 * ■ なぜ必要か
 * 出典（evidenceItems）の追加のような安全な作業の副作用で、公約の本文・件数・ID、
 * および一次資料から転記した指標の値が意図せず書き換わっていないことを、
 * 機械的に確認できるようにする。
 *
 * スナップショットに含めるのは「変えてはいけない値」だけで、出典の追加など
 * 意図的に増やしてよい項目（evidenceItems・sources・relatedBillVoteIds 等）は含めない。
 *
 * 公約本文や指標の値を正当な理由で変更する場合は、変更の根拠（一次資料）を
 * コミットメッセージに記録したうえで、このスクリプトを再実行してスナップショットを
 * 更新すること（＝変更が必ず人の判断を通るようにする）。
 *
 * 使い方：node scripts/generate-mayor-promise-protection-snapshot.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relPath) => JSON.parse(readFileSync(join(root, relPath), "utf8"));

const promisesData = readJson("src/data/mayorPromises.json");
const measures = readJson("src/data/mayorPromiseMeasures.json");

const snapshot = {
  _comment:
    "Phase273：市長公約の変更禁止項目のスナップショット。scripts/test-mayor-promise-protection.mjs が現行データと突き合わせる。" +
    "公約本文・ID・件数・指標の値を正当な理由で変更した場合のみ、scripts/generate-mayor-promise-protection-snapshot.mjs で更新すること。",
  generatedAt: new Date().toISOString().slice(0, 10),
  categoryCount: promisesData.categories.length,
  promiseCount: promisesData.promises.length,
  promises: promisesData.promises.map((p) => ({
    id: p.id,
    categoryId: p.categoryId,
    promiseText: p.promiseText,
    statusLabel: p.statusLabel,
  })),
  measureCount: measures.length,
  indicatorValues: measures
    .flatMap((m) =>
      (m.indicators ?? []).flatMap((indicator) =>
        indicator.values.map((v) => ({
          measureId: m.measureId,
          indicatorId: indicator.id,
          label: indicator.label,
          unit: indicator.unit,
          fiscalYear: v.fiscalYear,
          value: v.value,
          kind: v.kind,
        })),
      ),
    )
    .sort((a, b) => a.indicatorId.localeCompare(b.indicatorId) || a.fiscalYear.localeCompare(b.fiscalYear)),
};

writeFileSync(join(root, "reports", "mayor-promise-protection-snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `[protection-snapshot] 公約${snapshot.promiseCount}件・施策${snapshot.measureCount}件・指標の値${snapshot.indicatorValues.length}件を記録しました。`,
);
