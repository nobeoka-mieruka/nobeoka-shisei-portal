/**
 * Phase261：延岡市「令和N年度予算」ページ（財政課、例：soshiki/18/48542.html）の資料リンクを段階ごとに整理する。
 *
 * リンク文言は「9月補正（2次分）（概要書） [PDFファイル／302KB]」の形式。末尾のファイル情報を除き、
 * 段階名「9月補正（2次分）」と資料種別「概要書」に分ける。9月補正と9月補正（2次分）のように
 * 同じ月に複数の補正があっても、段階名で区別するため取り違えない。
 *
 * scripts/auto-update/finance/update-finance.mjs（定期巡回）と
 * scripts/test-budget-revisions.mjs（回帰テスト）から使う。本番データは読み書きしない。
 */

/** 「○○（予算書）」「○○（概要書）」形式のリンク文言を分解する。該当しなければnull。 */
export function parseBudgetListingLink(text) {
  const normalized = text
    .replace(/\[PDFファイル[^\]]*\]/g, "")
    .replace(/\s+/g, "")
    .trim();
  const m = normalized.match(/^(.+?)（(予算書|概要書)）$/);
  if (!m) return null;
  return { stageLabel: m[1], sourceType: m[2] };
}

/**
 * 段階名から種類を判定する（報告用。判定できない名前も「その他」として検知対象に含める）。
 * 例：「当初予算」「1号補正」「9月補正（2次分）」「12月補正（3次分）」「専決処分」「6月補正（企業会計）」。
 */
export function classifyStageLabel(stageLabel) {
  const accountScope = /企業会計/.test(stageLabel) ? "企業会計" : /特別会計/.test(stageLabel) ? "特別会計" : "全会計または一般会計";
  let kind = "その他";
  if (/専決/.test(stageLabel)) kind = "専決処分";
  else if (/当初/.test(stageLabel)) kind = "当初予算";
  else if (/補正/.test(stageLabel)) kind = "補正予算";
  const round = stageLabel.match(/[（(]\s*(\d+)\s*次分\s*[)）]/);
  return { kind, round: round ? Number(round[1]) : 1, accountScope };
}

/**
 * 資料リンクを段階ごとにまとめ、登録済みURL（budgetRevisions.json の sources）と照合する。
 * 段階のいずれかの資料URLが登録済みなら「登録済みの段階」とみなす
 * （概要書・予算書の片方だけを出典にしている段階があるため）。
 * @param {{ text: string, url: string }[]} links 絶対URLに解決済みのリンク
 * @param {Set<string>} registeredUrls
 */
export function classifyBudgetListing(links, registeredUrls) {
  const stages = new Map();
  for (const link of links) {
    const parsed = parseBudgetListingLink(link.text);
    if (!parsed) continue;
    const entry = stages.get(parsed.stageLabel) ?? { stageLabel: parsed.stageLabel, documents: [] };
    if (!entry.documents.some((d) => d.url === link.url)) entry.documents.push({ sourceType: parsed.sourceType, url: link.url });
    stages.set(parsed.stageLabel, entry);
  }
  const all = [...stages.values()].map((s) => ({ ...s, ...classifyStageLabel(s.stageLabel) }));
  return {
    stages: all,
    unregistered: all.filter((s) => !s.documents.some((d) => registeredUrls.has(d.url))),
    // 同じ段階・同じ資料種別に別々のPDFが2つ以上ある＝差し替え・重複掲載の疑い（自動では判断しない）。
    duplicates: all.filter((s) => {
      const byType = new Map();
      for (const d of s.documents) byType.set(d.sourceType, (byType.get(d.sourceType) ?? 0) + 1);
      return [...byType.values()].some((n) => n > 1);
    }),
  };
}
