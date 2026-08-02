/**
 * 定例会・臨時会の「概要」を、確認済みの構造化データ（登録済みの議案・資料・一般質問の件数等）
 * だけから機械的に組み立てる。
 *
 * 重要な制約：
 * 現在のデータ基盤には、本会議日ごとの発言議員・論点や、会期の開催目的そのものを説明する本文は
 * 含まれていない（審議結果一覧PDF等、構造化された一覧データのみ）。そのため、この要約は
 * 「登録されている議案の分類・件数・議決結果」「登録されている資料の種類」「一般質問・委員会審査の
 * 有無」といった、確認できる事実の組み合わせのみで構成する。開催目的や論点の要約、独自のトピック
 * 分類は行わない（推測・評価を含めない）。
 */
import { eraYearFor } from "./council-shared.mjs";

function formatEraDate(isoDate) {
  if (!isoDate) return undefined;
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return `${eraYearFor(y)}${m}月${d}日`;
}

const CATEGORY_LABELS_ORDER = [
  "予算",
  "決算",
  "条例",
  "契約",
  "人事",
  "財産取得",
  "意見書",
  "決議",
  "請願",
  "陳情",
  "専決処分",
  "その他",
  "不明",
];

function sortByOrderThenCount(entries) {
  return [...entries].sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return CATEGORY_LABELS_ORDER.indexOf(a[0]) - CATEGORY_LABELS_ORDER.indexOf(b[0]);
  });
}

function summarizeCategories(bills) {
  const counts = new Map();
  for (const b of bills) {
    if (!b.category) continue;
    counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
  }
  return sortByOrderThenCount([...counts.entries()]).map(([category]) => category);
}

function summarizeResults(bills) {
  const counts = new Map();
  for (const b of bills) {
    if (!b.result || b.result === "確認中") continue;
    counts.set(b.result, (counts.get(b.result) ?? 0) + 1);
  }
  return sortByOrderThenCount([...counts.entries()]);
}

function categoryListPhrase(categories, max) {
  const shown = categories.slice(0, max);
  const suffix = categories.length > max ? "など" : "";
  return `${shown.join("、")}${suffix}`;
}

function hasDocumentCategory(documents, category) {
  return documents.some((d) => d.category === category);
}

/**
 * @param {object} session councilSessions.jsonの1件
 * @param {object[]} bills このsessionに属するbillVotes（フィルタ済み）
 * @param {number} generalQuestionCount このsessionの一般質問件数
 * @returns {{shortSummary: string, summary: string, summaryStatus: string, sources: object[]}}
 */
export function buildSessionSummary(session, bills, generalQuestionCount) {
  const visibleDocuments = (session.documents ?? []).filter(
    (d) => d.publicationStatus === undefined || d.publicationStatus === "published",
  );
  const hasAnyData = bills.length > 0 || visibleDocuments.length > 0;

  if (!hasAnyData) {
    return {
      shortSummary: undefined,
      summary: undefined,
      summaryStatus: "unavailable",
      sources: [],
    };
  }

  const categories = summarizeCategories(bills);
  const results = summarizeResults(bills);
  const hasUnresolvedResult = bills.some((b) => !b.result || b.result === "確認中");
  const hasCommitteeReview = bills.some((b) => !!b.committee);
  const hasMinutes = hasDocumentCategory(visibleDocuments, "minutes");
  const hasResultsDoc = hasDocumentCategory(visibleDocuments, "results");
  const hasPetitions = hasDocumentCategory(visibleDocuments, "petitions") || categories.includes("請願") || categories.includes("陳情");

  const categoryPhrase = categories.length > 0 ? categoryListPhrase(categories, 4) : undefined;
  const resultPhrase =
    results.length > 0
      ? results
          .slice(0, 4)
          .map(([result, count]) => `${result}${count}件`)
          .join("、")
      : undefined;

  // --- 一覧カード用の短い要約（80〜160字目安） ---
  const shortParts = [];
  shortParts.push(`${session.title}では、`);
  shortParts.push(categoryPhrase ? `${categoryPhrase}に関する議案が審議されました。` : "議案の審議が行われました。");
  if (resultPhrase) {
    shortParts.push(`議決結果は${resultPhrase}などです。`);
  } else if (bills.length > 0) {
    shortParts.push("議決結果は現在確認中です。");
  }
  const shortSummary = shortParts.join("");

  // --- 会期全体の要約（200〜500字目安） ---
  const parts = [];
  if (formatEraDate(session.startDate) && formatEraDate(session.endDate)) {
    parts.push(`${session.title}は、${formatEraDate(session.startDate)}から${formatEraDate(session.endDate)}まで開催されました。`);
    parts.push(categoryPhrase ? `${categoryPhrase}に関する議案が審議されました。` : "議案の審議が行われました。");
  } else {
    parts.push(`${session.title}では、`);
    parts.push(categoryPhrase ? `${categoryPhrase}に関する議案が審議されました。` : "議案の審議が行われました。");
  }

  const activityNotes = [];
  if (generalQuestionCount > 0) activityNotes.push("一般質問");
  if (hasCommitteeReview) activityNotes.push("委員会審査");
  if (activityNotes.length > 0) {
    parts.push(`会期中には${activityNotes.join("・")}も行われました。`);
  }
  if (hasPetitions) {
    parts.push("請願・陳情の審査も行われました。");
  }

  if (bills.length > 0) {
    parts.push(`登録議案数は${bills.length}件です。`);
  }
  if (resultPhrase) {
    parts.push(`主な審議結果は、${resultPhrase}などです。`);
  }
  if (hasUnresolvedResult) {
    parts.push("一部の議案は議決結果を確認中です。");
  }

  const pageContents = ["議案一覧", "審議結果"];
  if (generalQuestionCount > 0) pageContents.push("一般質問");
  if (hasMinutes) pageContents.push("会議録");
  pageContents.push("関連する公式資料");
  parts.push(`このページでは、${pageContents.join("、")}を掲載しています。`);

  const summary = parts.join("");

  const allVerified = bills.every((b) => (b.verificationStatus ?? "verified") === "verified");
  const summaryStatus = bills.length === 0 ? "partially-verified" : allVerified ? "verified" : "partially-verified";

  const sources = [];
  const resultsDoc = visibleDocuments.find((d) => d.category === "results");
  if (resultsDoc) {
    sources.push({
      documentId: resultsDoc.id,
      title: resultsDoc.title,
      filePath: resultsDoc.filePath,
      sourceUrl: resultsDoc.sourceUrl,
    });
  }
  const minutesDoc = visibleDocuments.find((d) => d.category === "minutes");
  if (minutesDoc) {
    sources.push({
      documentId: minutesDoc.id,
      title: minutesDoc.title,
      filePath: minutesDoc.filePath,
      sourceUrl: minutesDoc.sourceUrl,
    });
  }
  if (sources.length === 0 && hasResultsDoc === false && bills.length > 0) {
    // 議案データはあるが対応する審議結果PDFが未登録の場合でも、議案側の出典URLがあれば1件だけ補う。
    const withUrl = bills.find((b) => b.resultDocumentUrl);
    if (withUrl) {
      sources.push({ title: "審議結果（議案データ経由）", sourceUrl: withUrl.resultDocumentUrl });
    }
  }

  return { shortSummary, summary, summaryStatus, sources };
}
