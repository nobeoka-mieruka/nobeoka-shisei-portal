#!/usr/bin/env node
/**
 * Phase131: src/data/billVotes.json (1,177件) へ trustLevel を機械的ルールで付与するスクリプト。
 *
 * 目的：
 *   Phase128で SourceMeta（BillVote が継承）へ追加された `trustLevel?: ArchiveSourceTrustLevel`
 *   フィールドを、billVotes.json の実データへ大規模展開する。
 *
 * 方針（CLAUDE.md準拠）：
 *   - 推測でtrustLevelを付与しない。既存フィールド（sourceFilePath / resultDocumentUrl /
 *     verificationStatus / publicationStatus）の実際の値から客観的に判定できる場合のみ付与する。
 *   - ルールに合致しないレコードは trustLevel を付与しない（未設定のまま残す）。
 *   - 大規模JSONを人手で1件ずつ編集しない。本スクリプトで機械的に処理する。
 *   - trustLevel以外の既存フィールドは一切変更しない。
 *
 * 使い方：
 *   node scripts/assign-billvotes-trustlevel.mjs            # dry-run（書き込みなし。集計をreportsへ出力）
 *   node scripts/assign-billvotes-trustlevel.mjs --apply     # 実書き込み（billVotes.jsonを更新）
 *
 * 判定ルール（Phase128の判定基準を踏襲）：
 *   ルールA（OFFICIAL_ARCHIVE）：以下すべてを満たす場合。
 *     1. resultDocumentUrl が延岡市公式ドメイン（https://www.city.nobeoka.miyazaki.jp/…）のPDFである
 *        （議決結果を市が公式サイトへ掲載したPDF＝公的機関が公表・保管する記録）
 *     2. sourceFilePath が /council-documents/ 配下（当サイトがアーカイブした議会文書のローカル参照）である
 *     3. verificationStatus が "verified"（記載内容の事実確認済み）
 *     4. publicationStatus が "published"（公開済みレコード）
 *   上記いずれか1つでも欠ける・条件外の値を持つレコードは、ルール不一致として trustLevel を付与しない
 *   （＝未設定のまま残す。強制付与はしない）。
 *
 *   注：これらのPDFは市が公表した「採決結果」等の記録であり、Phase128で financeDashboard.json の
 *   「財政状況資料集」等（原本ではなく市公式サイト上の公表資料）を OFFICIAL_ARCHIVE と分類した基準と
 *   同じ考え方を踏襲し、PRIMARY（原本そのもの）とはあえて区別している。
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "src/data/billVotes.json");
const REPORT_DIR = path.join(ROOT, "reports/phase130-134-staging");
const DRYRUN_SUMMARY_PATH = path.join(REPORT_DIR, "phase131-dryrun-summary.json");

const OFFICIAL_DOMAIN_HOST = "www.city.nobeoka.miyazaki.jp";
const OFFICIAL_DOMAIN_PREFIX = `https://${OFFICIAL_DOMAIN_HOST}/`;
const ARCHIVE_PATH_PREFIX = "/council-documents/";

/**
 * レコード1件を判定し、{ ruleId, trustLevel } または { ruleId: "UNMATCHED", trustLevel: null } を返す。
 * 判定基準はすべて既存フィールドの実値の機械的チェックのみ。推測は行わない。
 */
function classify(record) {
  const url = record.resultDocumentUrl;
  const filePath = record.sourceFilePath;

  const reasons = [];

  let urlOk = false;
  if (typeof url === "string" && url.startsWith(OFFICIAL_DOMAIN_PREFIX)) {
    try {
      const parsed = new URL(url);
      urlOk =
        parsed.hostname === OFFICIAL_DOMAIN_HOST &&
        parsed.protocol === "https:" &&
        /\.pdf$/i.test(parsed.pathname);
    } catch {
      urlOk = false;
    }
  }
  if (!urlOk) reasons.push("resultDocumentUrlが公式ドメインPDFでない");

  const pathOk = typeof filePath === "string" && filePath.startsWith(ARCHIVE_PATH_PREFIX);
  if (!pathOk) reasons.push("sourceFilePathが/council-documents/配下でない");

  const verifiedOk = record.verificationStatus === "verified";
  if (!verifiedOk) reasons.push("verificationStatusがverifiedでない");

  const publishedOk = record.publicationStatus === "published";
  if (!publishedOk) reasons.push("publicationStatusがpublishedでない");

  if (urlOk && pathOk && verifiedOk && publishedOk) {
    return { ruleId: "A_OFFICIAL_ARCHIVE", trustLevel: "OFFICIAL_ARCHIVE", reasons: [] };
  }

  return { ruleId: "UNMATCHED", trustLevel: null, reasons };
}

function loadData() {
  const raw = readFileSync(DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("billVotes.jsonの想定形式（配列）と異なります");
  }
  return { raw, data };
}

function summarize(data) {
  const results = data.map((record) => ({ id: record.id, ...classify(record) }));

  const byRule = new Map();
  const byExistingTrustLevel = new Map();
  for (const r of results) {
    byRule.set(r.ruleId, (byRule.get(r.ruleId) || 0) + 1);
  }
  for (const record of data) {
    const key = record.trustLevel ?? "(missing)";
    byExistingTrustLevel.set(key, (byExistingTrustLevel.get(key) || 0) + 1);
  }

  const unmatchedSamples = results.filter((r) => r.ruleId === "UNMATCHED").slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    totalRecords: data.length,
    existingTrustLevelDistribution: Object.fromEntries(byExistingTrustLevel),
    ruleCounts: Object.fromEntries(byRule),
    proposedTrustLevelCounts: Object.fromEntries(
      results.reduce((m, r) => {
        const key = r.trustLevel ?? "(unset)";
        m.set(key, (m.get(key) || 0) + 1);
        return m;
      }, new Map()),
    ),
    unmatchedSampleIds: unmatchedSamples.map((r) => ({ id: r.id, reasons: r.reasons })),
    results,
  };
}

function main() {
  const apply = process.argv.includes("--apply");
  const { raw, data } = loadData();
  const summary = summarize(data);

  mkdirSync(REPORT_DIR, { recursive: true });

  if (!apply) {
    writeFileSync(DRYRUN_SUMMARY_PATH, JSON.stringify(summary, null, 2) + "\n", "utf8");
    console.log("[dry-run] 対象件数:", summary.totalRecords);
    console.log("[dry-run] ルール別件数:", summary.ruleCounts);
    console.log("[dry-run] 提案trustLevel件数:", summary.proposedTrustLevelCounts);
    console.log("[dry-run] 既存trustLevel分布:", summary.existingTrustLevelDistribution);
    console.log("[dry-run] 集計結果を書き出しました:", path.relative(ROOT, DRYRUN_SUMMARY_PATH));
    console.log("[dry-run] 書き込みは行っていません（--apply で本適用）。");
    return;
  }

  // 本適用：results配列の判定に基づき、trustLevelが既に設定されていないレコードにのみ付与する。
  // 既存フィールドは一切変更しない。ルール不一致のレコードは触らない（未設定のまま）。
  const byId = new Map(summary.results.map((r) => [r.id, r]));
  let appliedCount = 0;
  let skippedAlreadySet = 0;
  let skippedUnmatched = 0;

  const nextData = data.map((record) => {
    const decision = byId.get(record.id);
    if (!decision) return record; // 想定外（発生しない想定）。念のため無変更。

    if (Object.prototype.hasOwnProperty.call(record, "trustLevel") && record.trustLevel != null) {
      skippedAlreadySet += 1;
      return record;
    }

    if (decision.trustLevel == null) {
      skippedUnmatched += 1;
      return record;
    }

    appliedCount += 1;
    // 既存キー順を保ったまま末尾にtrustLevelを追加する（他フィールドは一切変更しない）。
    return { ...record, trustLevel: decision.trustLevel };
  });

  const nextRaw = JSON.stringify(nextData, null, 2) + "\n";
  writeFileSync(DATA_PATH, nextRaw, "utf8");

  console.log("[apply] 付与件数:", appliedCount);
  console.log("[apply] 既存trustLevelがあり変更しなかった件数:", skippedAlreadySet);
  console.log("[apply] ルール不一致のため未設定のまま残した件数:", skippedUnmatched);
  console.log("[apply] billVotes.jsonを更新しました。");

  if (raw === nextRaw) {
    console.log("[apply] 警告: 内容に変化がありませんでした。");
  }
}

main();
