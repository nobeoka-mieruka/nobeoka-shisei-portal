#!/usr/bin/env node
/**
 * (a) search index漏れチェック + (b) updates日付順チェック
 *
 * 【既存資産との重複回避】
 * scripts/validate-data.mjsは searchIndex.json の id重複・type語彙・sourceId参照整合性
 * （存在する参照が正しいか）は既にチェック済み。また updateHistory.json の id重複・category語彙・
 * date形式も既にチェック済み。
 * 本スクリプトが追加するのは、validate-data.mjsが行っていない2点のみ：
 *  (a) 「主要マスターの各レコードに対応するsearchIndexエントリが存在するか」という
 *      カバレッジ（母数対比）チェック（validate-data.mjsは逆方向＝searchIndex→参照先の存在確認のみ）。
 *  (b) updateHistory.jsonが日付の降順（新しい順）で並んでいるか（サイトの更新履歴ページは
 *      配列の並び順をそのまま表示するため、降順を維持する運用ルールがある）。
 * 読み取り専用。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJson } from "./_lib.mjs";

const findings = { generatedAt: new Date().toISOString() };

// --- (a) search index漏れ ---
try {
  const searchIndex = readJson("src/data/searchIndex.json");
  const sourceIdsByType = new Map();
  for (const s of searchIndex) {
    if (!s.type || !s.sourceId) continue;
    if (!sourceIdsByType.has(s.type)) sourceIdsByType.set(s.type, new Set());
    sourceIdsByType.get(s.type).add(s.sourceId);
  }

  // type名 → 母数を取れる元データファイルの対応表。publicationStatus等で除外すべきものはfilterで反映。
  const MASTER_SOURCES = [
    { type: "member", file: "src/data/members.json", ids: (d) => d.map((x) => x.id) },
    // former-memberのsearchIndex.sourceIdはformerMembers.json自身のid（fm01等）ではなく、
    // archiveMemberProfiles.jsonのstatus="former"の拡張id（archive-fm01等）を指している
    // （status="current"側は別途type="member"で現職議員として索引化される想定、実データで確認済み）。
    {
      type: "former-member",
      file: "src/data/archiveMemberProfiles.json",
      ids: (d) => d.filter((x) => x.status === "former").map((x) => x.id),
    },
    {
      type: "bill",
      file: "src/data/billVotes.json",
      ids: (d) => d.filter((x) => x.publicationStatus !== "rejected" && x.publicationStatus !== "error").map((x) => x.id),
    },
    { type: "question", file: "src/data/generalQuestions.json", ids: (d) => d.map((x) => x.id) },
    { type: "promise", file: "src/data/mayorPromises.json", ids: (d) => (d.promises ?? []).map((x) => x.id) },
    { type: "committee", file: "src/data/committees.json", ids: (d) => d.map((x) => x.id) },
    { type: "election", file: "src/data/electionResults.json", ids: (d) => d.map((x) => x.id) },
  ];

  const coverage = [];
  for (const m of MASTER_SOURCES) {
    let data;
    try {
      data = readJson(m.file);
    } catch {
      continue;
    }
    const masterIds = new Set(m.ids(data));
    const indexed = sourceIdsByType.get(m.type) ?? new Set();
    const missing = [...masterIds].filter((id) => !indexed.has(id));
    coverage.push({
      type: m.type,
      file: m.file,
      masterCount: masterIds.size,
      indexedCount: [...masterIds].filter((id) => indexed.has(id)).length,
      missingCount: missing.length,
      sampleMissingIds: missing.slice(0, 10),
    });
  }
  findings.searchIndexCoverage = coverage;
} catch (e) {
  findings.searchIndexCoverage = { error: e.message };
}

// --- (b) updateHistory日付降順チェック ---
try {
  const updateHistory = readJson("src/data/updateHistory.json");
  const outOfOrder = [];
  for (let i = 1; i < updateHistory.length; i++) {
    const prev = updateHistory[i - 1];
    const cur = updateHistory[i];
    if (typeof prev.date === "string" && typeof cur.date === "string" && prev.date < cur.date) {
      outOfOrder.push({ index: i, prevId: prev.id, prevDate: prev.date, curId: cur.id, curDate: cur.date });
    }
  }
  findings.updateHistoryOrder = {
    totalEntries: updateHistory.length,
    isDescending: outOfOrder.length === 0,
    outOfOrderCount: outOfOrder.length,
    outOfOrderSamples: outOfOrder.slice(0, 10),
  };
} catch (e) {
  findings.updateHistoryOrder = { error: e.message };
}

findings.note =
  "searchIndexCoverageのmissingCountは『検索インデックスに未登録の可能性があるレコード』の候補数。" +
  "検索対象外とする意図的な設計（下書き・非公開等）を含みうるため、要人手確認。" +
  "updateHistoryOrderは配列の並び順（表示順）そのものが降順かを見ている。";

const outPath = join(ROOT, "reports", "qa-checks", "_out-search-index-and-updates-order.json");
writeFileSync(outPath, JSON.stringify(findings, null, 2) + "\n", "utf8");

console.log("[check-search-index-and-updates-order] searchIndexCoverage:");
for (const c of findings.searchIndexCoverage ?? []) {
  console.log(`  ${c.type}: master=${c.masterCount} indexed=${c.indexedCount} missing=${c.missingCount}`);
}
console.log(
  `[check-search-index-and-updates-order] updateHistory isDescending=${findings.updateHistoryOrder.isDescending} outOfOrder=${findings.updateHistoryOrder.outOfOrderCount}`,
);
process.exitCode = findings.updateHistoryOrder.isDescending === false ? 1 : 0;
