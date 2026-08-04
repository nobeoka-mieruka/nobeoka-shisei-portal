/**
 * フェーズ8：政策テーマの分類候補・関連候補を、既存データのキーワード一致（ルールベース）
 * のみで機械的に生成する純粋関数。外部AI APIは一切呼び出さない。
 *
 * 元は scripts/generate-theme-candidates.mjs にファイルIO込みで実装されていたが、
 * フェーズ10C（scripts/run-archive-ai-processor.mjs）からも同じ生成ロジックが必要になったため、
 * ここへ切り出した（重複実装を避けるため）。scripts/generate-theme-candidates.mjs は
 * このモジュールを呼び出す薄いCLIラッパーとして維持している（既存のnpm run
 * generate:theme-candidates・npm run build の挙動は変更していない）。
 */
import { matchCategoriesForText } from "./theme-classification.mjs";

/**
 * @param {{categories: object[], policies: object[], councilDocuments: object[], now?: string}} input
 * @returns {{categoryCandidates: object[], relationCandidates: object[]}}
 */
export function generateThemeCandidates({ categories, policies, councilDocuments, now = new Date().toISOString() }) {
  const categoryCandidates = [];
  const relationCandidates = [];
  let categoryCandidateSeq = 1;
  let relationCandidateSeq = 1;

  // 議案・条例・請願・陳情アーカイブには現状テーマ分類が無いため、本文からの候補分類を生成する。
  for (const doc of councilDocuments) {
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
  for (const cand of categoryCandidates) {
    const relatedPolicies = policies.filter((p) => (p.categoryIds ?? []).includes(cand.categoryId));
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

  return { categoryCandidates, relationCandidates };
}
