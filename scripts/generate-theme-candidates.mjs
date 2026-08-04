/**
 * フェーズ8：政策テーママスタ（archivePolicyCategories.json）に対する分類候補・関連候補を、
 * 既存データのキーワード一致（ルールベース）のみで機械的に生成する。
 *
 * 外部AI APIは一切呼び出さない。生成される候補はすべてstatus="candidate"のままとし、
 * 人が確認するまで確定分類・確定関連として扱わない（confirmedCategoryIds等とは別ファイル）。
 * 既存の archivePolicies.json（confirmed categoryIds）・archiveCouncilDocuments.json は
 * 一切変更しない（読み取り専用、候補ファイルへの出力のみ）。
 *
 * 生成ロジック本体は scripts/lib/theme-candidates-generator.mjs（フェーズ10Cで切り出し、
 * scripts/run-archive-ai-processor.mjsと共用）。このファイルはファイルIOのみを担う薄いCLI。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateThemeCandidates } from "./lib/theme-candidates-generator.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

const categories = readJson("src/data/archivePolicyCategories.json");
const policies = readJson("src/data/archivePolicies.json");
const councilDocuments = readJson("src/data/archiveCouncilDocuments.json");

const { categoryCandidates, relationCandidates } = generateThemeCandidates({ categories, policies, councilDocuments });

writeFileSync(join(root, "src/data/archiveAiCategoryCandidates.json"), `${JSON.stringify(categoryCandidates, null, 2)}\n`);
writeFileSync(join(root, "src/data/archiveRelationCandidates.json"), `${JSON.stringify(relationCandidates, null, 2)}\n`);

console.log(
  `[generate-theme-candidates] archiveAiCategoryCandidates=${categoryCandidates.length}件 archiveRelationCandidates=${relationCandidates.length}件`,
);
