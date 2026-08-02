/**
 * 議案の「概要」を、確認できた事実（議案名・案件分類・定例会・議決結果等）だけから
 * 自然文で生成する。
 *
 * 重要な制約：
 * 現在の情報源（審議結果PDF）には、議案の提案理由・目的・改正内容といった本文は
 * 含まれていない（議案番号・件名・結果・議決日のみの一覧表）。そのため、この要約は
 * 「議案書」等のより詳細な本文PDFが取得できるようになるまでの間、確認済みの構造化データ
 * から機械的に文章を組み立てるものであり、内容を推測して補うことはしない。
 * summarySource: "template" として区別する（"pdf"は将来、本文PDFを解析できた場合用）。
 */

const CATEGORY_PHRASES = {
  条例: "条例議案",
  予算: "予算議案",
  決算: "決算議案",
  契約: "契約議案",
  財産取得: "財産取得に関する議案",
  人事: "人事議案",
  意見書: "意見書",
  決議: "決議",
  請願: "請願",
  陳情: "陳情",
  専決処分: "専決処分の承認議案",
  その他: "議案",
  不明: "案件",
};

function categoryPhraseFor(category) {
  return CATEGORY_PHRASES[category] ?? "議案";
}

function hasConfirmedResult(bill) {
  const isVerified = (bill.verificationStatus ?? "verified") === "verified";
  if (isVerified) return true;
  return !bill.unresolvedFields?.includes("result");
}

/** 一覧カード用（80〜150字程度を目安とする短い要約）。 */
export function buildShortSummary(bill) {
  const categoryPhrase = categoryPhraseFor(bill.category);
  const resultPhrase = hasConfirmedResult(bill) ? `議決結果は「${bill.result}」です。` : "結果区分は現在確認中です。";
  return `${bill.session}に提出された${categoryPhrase}「${bill.billTitle}」です。${resultPhrase}`;
}

/** 詳細ページ用。確認できた付随情報（付託委員会・提出者区分）があれば補い、出典を明記する。 */
export function buildDetailSummary(bill) {
  const parts = [buildShortSummary(bill)];
  if (bill.committee) parts.push(`付託委員会は${bill.committee}です。`);
  const proposerTypeLabel = { mayor: "市長提出", member: "議員提出", committee: "委員会提出" }[bill.proposerType ?? ""];
  if (proposerTypeLabel) parts.push(`${proposerTypeLabel}の案件です。`);
  parts.push("詳細な内容は出典PDFでご確認ください。");
  return parts.join("");
}

/** billVotes.jsonの1件に、summary・summaryGeneratedAt・summarySourceを設定する（副作用あり）。 */
export function applyGeneratedSummary(bill, todayIso) {
  bill.summary = buildDetailSummary(bill);
  bill.summaryGeneratedAt = todayIso;
  bill.summarySource = "template";
}
