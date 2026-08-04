/**
 * フェーズ8：政策テーママスタ（archivePolicyCategories.json）に対する分類候補・関連候補を、
 * 既存データのキーワード一致（ルールベース）のみで機械的に生成する。
 *
 * 外部AI APIは一切呼び出さない。生成される候補はすべてstatus="candidate"のままとし、
 * 人が確認するまで確定分類・確定関連として扱わない（confirmedCategoryIds等とは別ファイル）。
 * 既存の archivePolicies.json（confirmed categoryIds）・archiveCouncilDocuments.json は
 * 一切変更しない（読み取り専用、候補ファイルへの出力のみ）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const found = haystack.indexOf(needle, from);
    if (found === -1) break;
    count += 1;
    from = found + needle.length;
  }
  return count;
}

/** src/lib/themeClassification.ts の matchPolicyCategoriesForText と同一ロジック（.mjsからは直接importできないため複製）。 */
function matchCategoriesForText(text, categories, maxResults = 5) {
  const normalized = text.normalize("NFKC");
  const matches = [];
  for (const category of categories) {
    const terms = [...(category.keywords ?? []), category.label];
    const matchedKeywords = [];
    let occurrences = 0;
    for (const term of terms) {
      if (!term) continue;
      const count = countOccurrences(normalized, term);
      if (count > 0) {
        matchedKeywords.push(term);
        occurrences += count;
      }
    }
    if (matchedKeywords.length === 0) continue;
    const confidence = Math.min(1, matchedKeywords.length * 0.25 + Math.min(occurrences, 5) * 0.05);
    matches.push({ categoryId: category.id, confidence, matchedKeywords });
  }
  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, maxResults);
}

const categories = readJson("src/data/archivePolicyCategories.json");
const archivePolicies = readJson("src/data/archivePolicies.json");
const archiveCouncilDocuments = readJson("src/data/archiveCouncilDocuments.json");

const now = new Date().toISOString();
const categoryCandidates = [];
const relationCandidates = [];
let categoryCandidateSeq = 1;
let relationCandidateSeq = 1;

// 議案・条例・請願・陳情アーカイブには現状テーマ分類が無いため、本文からの候補分類を生成する。
for (const doc of archiveCouncilDocuments) {
  const text = [doc.title, doc.summary].filter(Boolean).join(" ");
  const matches = matchCategoriesForText(text, categories, 2);
  for (const m of matches) {
    if (m.confidence < 0.25) continue; // 一致語1件のみ等、確信度が低すぎる候補は生成しない
    categoryCandidates.push({
      id: `catcand-${String(categoryCandidateSeq++).padStart(3, "0")}`,
      sourceEntityType: doc.documentType,
      sourceEntityId: doc.id,
      categoryId: m.categoryId,
      confidence: Math.round(m.confidence * 100) / 100,
      reason: `キーワード一致（ルールベース、AI不使用）: ${m.matchedKeywords.join("、")}`,
      evidenceText: m.matchedKeywords.join("、"),
      generatedAt: now,
      status: "candidate",
    });
  }
}

// 同一テーマ候補を持つ「政策（確定分類）」と「議案等（候補分類）」のペアを、関連候補として生成する。
// 政策側はconfirmed categoryIds、議案等側は上記で計算した候補分類のcategoryIdが一致する場合のみ。
for (const cand of categoryCandidates) {
  const relatedPolicies = archivePolicies.filter((p) => (p.categoryIds ?? []).includes(cand.categoryId));
  for (const policy of relatedPolicies) {
    relationCandidates.push({
      id: `relcand-${String(relationCandidateSeq++).padStart(3, "0")}`,
      sourceEntityType: cand.sourceEntityType,
      sourceEntityId: cand.sourceEntityId,
      targetEntityType: "policy",
      targetEntityId: policy.id,
      relationType: "sameTheme",
      confidence: cand.confidence,
      method: "keywordMatch",
      reason: `政策側の確定テーマ分類（${cand.categoryId}）と、議案等の本文キーワード一致による候補分類が一致`,
      evidenceText: cand.evidenceText,
      status: "candidate",
      createdAt: now,
    });
  }
}

writeFileSync(
  join(root, "src/data/archiveAiCategoryCandidates.json"),
  `${JSON.stringify(categoryCandidates, null, 2)}\n`,
);
writeFileSync(
  join(root, "src/data/archiveRelationCandidates.json"),
  `${JSON.stringify(relationCandidates, null, 2)}\n`,
);

console.log(
  `[generate-theme-candidates] archiveAiCategoryCandidates=${categoryCandidates.length}件 archiveRelationCandidates=${relationCandidates.length}件`,
);
