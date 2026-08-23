#!/usr/bin/env node
/**
 * missing sourceRefs カテゴリ別集計
 *
 * 【既存資産との重複回避】
 * scripts/validate-data.mjs / scripts/lib/validate-archive-common.mjs の checkValuesHaveSource 等は
 * 「特定のファイルの特定のフィールドに値があるのにsourceRefsが無い」を個別にエラー/警告化している。
 * 本スクリプトはピンポイントのエラー検出ではなく、src/data全体を横断して
 * 「レコード単位でsourceRefs/sourceUrl/sourceTitle等の出典情報を持っているか」を
 * ファイル別・カテゴリ別に集計し、出典カバレッジの低いファイルを可視化することが目的
 * （Phase79の出典網羅性調査と同種の手法だが、本スクリプトは待たずに独自設計。
 * reports/phase79-source-coverage-findings.json が存在すれば
 * 参考として突き合わせできるが、無くても単独で動作する）。
 *
 * 「出典が無いこと」自体は即エラーではない（例：分類マスター系のfactions.json等は
 * 元々出典を持たない設計）。本スクリプトは集計・可視化に徹し、is/isNotの二値判定はしない。
 * 読み取り専用。
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listDataJsonFiles, readJson, walk } from "./_lib.mjs";

// レコード内にこれらのキーのいずれかが（空でなく）存在すれば「出典あり」とみなす。
const SOURCE_KEYS = ["sourceRefs", "sourceUrl", "sourceTitle", "evidenceItems", "sourceDocumentId", "officialSessionUrl"];

/**
 * レコード（およびそのネストしたオブジェクト・配列全体、例: budget.sourceRefs / debt.balance.sourceRefs）
 * のどこかにSOURCE_KEYSの非空値があれば「出典あり」とみなす。archiveFiscalYears.jsonのように
 * 出典が2〜3階層下のサブオブジェクトにぶら下がる構造にも対応するため、トップレベルキーだけでなく
 * walk()で全体を再帰走査する。
 */
function hasSourceInfo(obj) {
  let found = false;
  walk(obj, (node) => {
    if (found) return;
    if (node === null || typeof node !== "object" || Array.isArray(node)) return;
    for (const k of SOURCE_KEYS) {
      const v = node[k];
      if (v === null || v === undefined) continue;
      if (Array.isArray(v)) {
        if (v.length > 0) found = true;
      } else if (typeof v === "string") {
        if (v.trim() !== "") found = true;
      } else {
        found = true;
      }
      if (found) break;
    }
  });
  return found;
}

const files = listDataJsonFiles();
const perFile = [];

for (const file of files) {
  let data;
  try {
    data = readJson(join("src", "data", file).replace(/\\/g, "/"));
  } catch {
    continue;
  }

  // トップレベル配列、またはトップレベルオブジェクト内の主要配列（.promises / .municipalities等）を対象にする。
  const candidateArrays = [];
  if (Array.isArray(data)) {
    candidateArrays.push({ path: "$", items: data });
  } else if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
        candidateArrays.push({ path: `$.${k}`, items: v });
      }
    }
  }

  for (const { path, items } of candidateArrays) {
    const withId = items.filter((x) => typeof x.id === "string" || typeof x.fiscalYear === "number");
    if (withId.length === 0) continue; // レコード集合とみなせないもの（例: keywords配列）は除外

    let withSource = 0;
    const missingIds = [];
    for (const item of items) {
      if (hasSourceInfo(item)) {
        withSource++;
      } else {
        const label = item.id ?? item.fiscalYear ?? item.municipality ?? "(id不明)";
        if (missingIds.length < 10) missingIds.push(label);
      }
    }
    const total = items.length;
    const coveragePercent = total > 0 ? Math.round((withSource / total) * 1000) / 10 : null;
    perFile.push({
      file,
      arrayPath: path,
      totalRecords: total,
      recordsWithSource: withSource,
      recordsWithoutSource: total - withSource,
      coveragePercent,
      sampleMissingIds: missingIds,
    });
  }
}

perFile.sort((a, b) => (a.coveragePercent ?? 100) - (b.coveragePercent ?? 100));

const lowCoverage = perFile.filter((r) => r.coveragePercent !== null && r.coveragePercent < 50 && r.totalRecords >= 3);

const findings = {
  generatedAt: new Date().toISOString(),
  filesScanned: files.length,
  arraysAnalyzed: perFile.length,
  lowCoverageCount: lowCoverage.length,
  perFile,
  lowCoverageHighlight: lowCoverage,
  note:
    "coveragePercentは『sourceRefs等の出典情報らしきフィールドを1件以上持つレコードの割合』の機械集計。" +
    "出典を持たない設計のマスターデータ（分類・カテゴリ等）も含まれるため、lowCoverageHighlightは" +
    "『出典が必要なはずなのに欠けている』ことの確定情報ではなく、人手レビューの優先順位付けに使うこと。",
};

const outPath = join(ROOT, "reports", "qa-checks", "_out-source-refs-coverage.json");
writeFileSync(outPath, JSON.stringify(findings, null, 2) + "\n", "utf8");

console.log(`[check-source-refs-coverage] arraysAnalyzed=${perFile.length} lowCoverageCount=${lowCoverage.length}`);
console.log("  最低カバレッジ5件:", perFile.slice(0, 5).map((r) => `${r.file}${r.arrayPath} ${r.coveragePercent}%`));

// Phase79の出典網羅性調査（存在すれば）との突き合わせ参考表示。
const phase79Path = join(ROOT, "reports", "phase79-source-coverage-findings.json");
if (existsSync(phase79Path)) {
  console.log("  参考: phase79-source-coverage-findings.jsonが存在します（突き合わせは人手で実施してください）");
}
process.exitCode = 0; // 集計スクリプトのため、常に正常終了（閾値判定は将来の拡張課題）
