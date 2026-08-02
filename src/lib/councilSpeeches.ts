import type { CouncilMemberSpeechRecord, CouncilSpeech, CouncilSpeechSummaryData, SpeechSummaryStatus } from "../types";

export const speechSummaryStatusLabels: Record<SpeechSummaryStatus, string> = {
  "minutes-not-fetched": "会議録本文未取得",
  "source-unavailable": "公式資料不足",
  pending: "AI要約・確認待ち・暫定掲載",
  "partially-verified": "AI要約・一部確認済み",
  verified: "AI要約・内容確認済み",
  "speaker-identification-pending": "発言者確認中",
  "question-answer-link-pending": "質問と答弁の対応確認中",
};

/** 未設定時のフォールバック（このデータ形式では常にsummaryStatusを持つ想定）。 */
export function speechSummaryStatusLabel(status: SpeechSummaryStatus): string {
  return speechSummaryStatusLabels[status] ?? status;
}

export function findMemberSpeechRecord(
  data: CouncilMemberSpeechRecord[],
  memberId: string,
): CouncilMemberSpeechRecord | undefined {
  return data.find((m) => m.memberId === memberId);
}

/** 一般公開してよい発言だけを返す（isPublished:trueのみ）。 */
export function publicSpeeches(record: CouncilMemberSpeechRecord | undefined): CouncilSpeech[] {
  return record ? record.speeches.filter((s) => s.isPublished) : [];
}

export function findPublishedSpeech(
  data: CouncilSpeechSummaryData,
  memberId: string,
  speechId: string,
): CouncilSpeech | undefined {
  const record = findMemberSpeechRecord(data.members, memberId);
  return record?.speeches.find((s) => s.id === speechId && s.isPublished);
}
