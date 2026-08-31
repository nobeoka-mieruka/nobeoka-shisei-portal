/**
 * src/data/billVotes.json の既存レコードのうち、自動抽出由来（extractionSource: "automatic"）の
 * ものについて、summary（議案の概要）・summaryGeneratedAt・summarySourceを一括生成する。
 *
 * 人が確認・入力したデータ（extractionSourceが"automatic"以外）は対象外（絶対に上書きしない）。
 * 冪等：既にsummarySource: "template"で生成済みでも、元データ（billTitle/category/session/result等）
 * から再計算した内容と異なる場合のみ更新する（無駄な差分・再コミットを避けるため）。
 *
 * 使い方：
 *   node scripts/generate-bill-summaries.mjs [--dry-run]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDetailSummary } from "./lib/bill-summary.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const billVotesPath = join(root, "src", "data", "billVotes.json");

const isDryRun = process.argv.includes("--dry-run");

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  if (!existsSync(billVotesPath)) throw new Error("src/data/billVotes.json が見つかりません");
  const billVotes = JSON.parse(readFileSync(billVotesPath, "utf8"));
  if (!Array.isArray(billVotes)) throw new Error("billVotes.jsonが配列ではありません");

  let updated = 0;
  let skippedManual = 0;
  let unchanged = 0;
  const today = todayIso();

  for (const bill of billVotes) {
    if (bill.extractionSource !== "automatic") {
      skippedManual++;
      continue;
    }
    // Phase142：一次資料本文を人が確認して書いた市民向け要約（summarySource: "manual"）は、
    // extractionSourceが"automatic"のままでも（＝議決結果等の構造化データ自体は自動抽出由来でも）、
    // 定型文で上書きしない。
    if (bill.summarySource === "manual") {
      skippedManual++;
      continue;
    }
    const nextSummary = buildDetailSummary(bill);
    if (bill.summary === nextSummary && bill.summarySource === "template") {
      unchanged++;
      continue;
    }
    bill.summary = nextSummary;
    bill.summaryGeneratedAt = today;
    bill.summarySource = "template";
    updated++;
  }

  console.log(`[generate-bill-summaries] 対象: ${billVotes.length}件 / 更新: ${updated}件 / 変更なし: ${unchanged}件 / 手動データのため対象外: ${skippedManual}件`);

  if (!isDryRun && updated > 0) {
    writeFileSync(billVotesPath, `${JSON.stringify(billVotes, null, 2)}\n`, "utf8");
    console.log("[generate-bill-summaries] src/data/billVotes.json を更新しました。");
  } else if (isDryRun) {
    console.log("[generate-bill-summaries] --dry-run のため、ファイルは書き換えていません。");
  }
}

main();
