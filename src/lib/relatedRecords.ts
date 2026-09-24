/**
 * 詳細ページの「つながり（確認できる関連）」を組み立てる。
 * データは scripts/generate-related-records.mjs がビルド時に生成する（src/data/relatedRecordsIndex.json）。
 * 関連として扱うのは、IDや会議録の同じ位置で確認できるものだけ（キーワード一致は含めない）。
 */
import relatedRecordsIndexData from "../data/relatedRecordsIndex.json";
import type { RelatedRecordLink } from "../components/RelatedRecords";

interface RelatedRecordsIndex {
  questionToSession: Record<string, { sessionId: string; title: string }>;
  questionToMeetingDay: Record<string, { sessionId: string; date: string; meetingNumber: string | null; minutesUrl: string | null }>;
  questionToSpeech: Record<string, { memberId: string; speechId: string }>;
  speechToQuestion: Record<string, { questionId: string; title: string }>;
  questionToPolicies: Record<string, { slug: string; title: string }[]>;
  sessionQuestions: Record<string, { id: string; title: string; memberName: string; date: string | null }[]>;
  billSubmitters: Record<string, { personId: string; personName: string; recordType: string; date: string | null; sourceUrl: string | null }[]>;
  billDocuments: Record<string, { title: string; path: string; documentType: string }[]>;
  billBudgetProjects: Record<string, { revisionId: string; projectId: string; name: string; promiseIds: string[] }[]>;
}

export const relatedRecordsIndex = relatedRecordsIndexData as RelatedRecordsIndex;

const DOCUMENT_KIND: Record<string, string> = {
  bill: "議案のページ",
  ordinance: "条例のページ",
  petition: "請願のページ",
  request: "陳情のページ",
};

function jpDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** 一般質問の詳細ページ用。 */
export function relatedLinksForQuestion(questionId: string): RelatedRecordLink[] {
  const links: RelatedRecordLink[] = [];
  const session = relatedRecordsIndex.questionToSession[questionId];
  if (session) {
    links.push({
      key: "session",
      kind: "会期",
      label: `${session.title}（議案・会議録・日程）`,
      to: `/council-documents/${session.sessionId}`,
      basis: "この一般質問が行われた会期",
    });
  }
  const day = relatedRecordsIndex.questionToMeetingDay[questionId];
  if (day?.minutesUrl) {
    links.push({
      key: "meeting-day",
      kind: "会議録（本会議の日）",
      label: `${jpDate(day.date)}の本会議${day.meetingNumber ? `（${day.meetingNumber}）` : ""}の会議録`,
      href: day.minutesUrl,
      basis: "この一般質問の会議録と同じ日の本会議",
    });
  }
  const speech = relatedRecordsIndex.questionToSpeech[questionId];
  if (speech) {
    links.push({
      key: "speech",
      kind: "質問・答弁（会議録）",
      label: "会議録にもとづく質問と答弁の要約",
      to: `/members/${speech.memberId}/questions/${speech.speechId}`,
      basis: "会議録の同じ発言位置",
    });
  }
  for (const p of relatedRecordsIndex.questionToPolicies[questionId] ?? []) {
    links.push({ key: `policy-${p.slug}`, kind: "政策", label: p.title, to: `/policies/${p.slug}`, basis: "この一般質問で提案された政策として登録（確認済み）" });
  }
  return links;
}

/** 会議録の発言ページ用。 */
export function relatedLinksForSpeech(speechId: string): RelatedRecordLink[] {
  const q = relatedRecordsIndex.speechToQuestion[speechId];
  if (!q) return [];
  return [
    {
      key: "question",
      kind: "一般質問",
      label: q.title,
      to: `/questions/${q.questionId}`,
      basis: "会議録の同じ発言位置",
    },
  ];
}

/** 議案・議決結果の詳細ページ用。promiseLabel は市長公約IDの表示名を返す関数。 */
export function relatedLinksForBill(billId: string, promiseLabel: (id: string) => string): RelatedRecordLink[] {
  const links: RelatedRecordLink[] = [];
  for (const s of relatedRecordsIndex.billSubmitters[billId] ?? []) {
    links.push({
      key: `submitter-${s.personId}`,
      kind: `${s.recordType}の提出者`,
      label: `${s.personName}議員`,
      to: `/members/${s.personId}`,
      basis: "会議録の提案理由説明で確認（確認済み）",
    });
  }
  for (const d of relatedRecordsIndex.billDocuments[billId] ?? []) {
    links.push({ key: `doc-${d.path}`, kind: DOCUMENT_KIND[d.documentType] ?? "資料のページ", label: d.title, to: d.path, basis: "同じ議案として登録" });
  }
  for (const p of relatedRecordsIndex.billBudgetProjects[billId] ?? []) {
    links.push({
      key: `project-${p.projectId}`,
      kind: "予算の事業",
      label: p.name,
      to: `/finance#budget-revision-${p.revisionId}`,
      basis: "この補正予算案に含まれる事業（予算の概要資料）",
    });
    for (const pid of p.promiseIds) {
      links.push({
        key: `promise-${p.projectId}-${pid}`,
        kind: "市長公約",
        label: `${promiseLabel(pid)}（事業「${p.name}」）`,
        to: `/mayor/policy-progress/${pid}`,
        basis: "予算の概要資料で、この事業と公約の関連が明記されている",
      });
    }
  }
  return links;
}

/** 会期ページ用：この会期に行われた一般質問。 */
export function questionsForSession(sessionId: string) {
  return relatedRecordsIndex.sessionQuestions[sessionId] ?? [];
}
