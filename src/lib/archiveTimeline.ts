import type {
  ArchiveCouncilDocument,
  ArchiveFiscalYear,
  ArchiveMayor,
  ArchiveMayorTerm,
  ArchiveMemberProfile,
  ArchiveMemberTerm,
  ArchivePolicy,
  ArchiveSourceRef,
} from "../types/historicalArchive";
import type { ArchiveTimelineEvent, ArchiveTimelineYearGroup } from "../types/timeline";
import type { GeneralQuestionItem } from "../types";
import { formatJapaneseDate } from "../config/site";
import { fiscalYearLabel } from "./archiveFinance";
import { FINANCE_METRICS } from "./archiveFinanceMetrics";
import { documentPath, documentTypeLabel } from "./archiveCouncilDocuments";

/** 会計年度は4月始まり。1〜3月は前年度扱いにする（config/site.tsのtoFiscalYearLabelと同じ定義）。 */
export function fiscalYearOfIsoDate(iso: string): number {
  const [year, month] = iso.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

/** 任期（start〜end）が指定した会計年度（4月始まり）と重なっているかを判定する。 */
function termOverlapsFiscalYear(termStart: string, termEnd: string | null, fiscalYear: number): boolean {
  const yearStart = `${fiscalYear}-04-01`;
  const yearEnd = `${fiscalYear + 1}-03-31`;
  return termStart <= yearEnd && (termEnd === null || termEnd >= yearStart);
}

/** 指定した会計年度に在職していた（任期が重なる）市長任期を返す。 */
export function mayorTermsInFiscalYear(terms: ArchiveMayorTerm[], fiscalYear: number): ArchiveMayorTerm[] {
  return terms.filter((t) => termOverlapsFiscalYear(t.termStart, t.termEnd, fiscalYear));
}

/** 指定した会計年度に在職していた（任期が重なる）議員任期を返す。 */
export function memberTermsInFiscalYear(terms: ArchiveMemberTerm[], fiscalYear: number): ArchiveMemberTerm[] {
  return terms.filter((t) => termOverlapsFiscalYear(t.termStart, t.termEnd, fiscalYear));
}

/**
 * 歴代市長の任期（就任・退任）を年表イベントに変換する。
 * 前任・後任が確認できていない場合や退任日が未確認（現職）の場合は退任イベントを作らない。
 */
export function buildMayorTermEvents(mayors: ArchiveMayor[], terms: ArchiveMayorTerm[]): ArchiveTimelineEvent[] {
  const events: ArchiveTimelineEvent[] = [];
  for (const term of terms) {
    const mayor = mayors.find((m) => m.id === term.mayorId);
    if (!mayor) continue;
    const relatedPath = `/mayors/${mayor.slug}`;

    events.push({
      id: `${term.id}-start`,
      category: "mayorTerm",
      date: term.termStart,
      dateLabel: formatJapaneseDate(term.termStart),
      fiscalYear: fiscalYearOfIsoDate(term.termStart),
      title: `${mayor.name}氏が市長に就任`,
      description: term.termNumber != null ? `${term.termNumber}期目` : undefined,
      relatedPath,
      sourceRefs: term.sourceRefs,
    });

    if (term.termEnd) {
      events.push({
        id: `${term.id}-end`,
        category: "mayorTerm",
        date: term.termEnd,
        dateLabel: formatJapaneseDate(term.termEnd),
        fiscalYear: fiscalYearOfIsoDate(term.termEnd),
        title: `${mayor.name}氏が市長を退任`,
        relatedPath,
        sourceRefs: term.sourceRefs,
      });
    }
  }
  return events;
}

/**
 * 議員の任期（会派・委員会・役職ではなく、選挙単位の在籍期間）を年表イベントに変換する。
 * archiveMemberTerms.jsonが未整備（0件）の間は空配列を返すのみで、推測では埋めない。
 * データが追加され次第、コード変更なしで反映される。
 */
export function buildMemberTermEvents(profiles: ArchiveMemberProfile[], terms: ArchiveMemberTerm[]): ArchiveTimelineEvent[] {
  const events: ArchiveTimelineEvent[] = [];
  for (const term of terms) {
    const profile = profiles.find((p) => p.id === term.memberProfileId);
    if (!profile) continue;
    // 現職は/members/:id、元議員は/members/former/:slugへ誘導する（既存のfindMemberOrFormerLinkと
    // 同じ経路。/people/:slugはpersonSlug()でtype別プレフィックスを付けたslugを要求するため、
    // ArchiveMemberProfile.slug（プレフィックス無し）をそのまま渡すと不整合になる）。
    const relatedPath = profile.legacyMemberId
      ? `/members/${profile.legacyMemberId}`
      : `/members/former/${profile.slug}`;

    events.push({
      id: `${term.id}-start`,
      category: "memberTerm",
      date: term.termStart,
      dateLabel: formatJapaneseDate(term.termStart),
      fiscalYear: fiscalYearOfIsoDate(term.termStart),
      title: `${profile.name}氏が議員に就任`,
      description: term.termNumber != null ? `${term.termNumber}期目` : undefined,
      relatedPath,
      sourceRefs: term.sourceRefs,
    });

    if (term.termEnd) {
      events.push({
        id: `${term.id}-end`,
        category: "memberTerm",
        date: term.termEnd,
        dateLabel: formatJapaneseDate(term.termEnd),
        fiscalYear: fiscalYearOfIsoDate(term.termEnd),
        title: `${profile.name}氏が議員を退任`,
        relatedPath,
        sourceRefs: term.sourceRefs,
      });
    }
  }
  return events;
}

/**
 * 年度別財政データ（人口・世帯数・予算・市債・基金・財政指標）を、指標ごとに個別の年表イベントへ
 * 変換する。既存の財政指標レジストリ（archiveFinanceMetrics.ts、フェーズ9Bで実装済み）をそのまま
 * 再利用し、値の取得・単位・定義注記のロジックを複製しない。値が未確認（null）の指標は
 * イベントを作らない（0や「確認中」の空イベントで埋めない）。
 */
export function buildFinanceMetricEvents(fiscalYears: ArchiveFiscalYear[]): ArchiveTimelineEvent[] {
  const events: ArchiveTimelineEvent[] = [];
  for (const y of fiscalYears) {
    for (const metric of FINANCE_METRICS) {
      const point = metric.getPoint(y);
      if (point.value == null) continue;
      events.push({
        id: `finance-${metric.key}-${y.fiscalYear}`,
        category: "finance",
        date: null,
        dateLabel: fiscalYearLabel(y.fiscalYear),
        fiscalYear: y.fiscalYear,
        title: `${metric.label}：${metric.formatValue(point.value)}`,
        description: point.definitionNoteOverride ?? metric.definitionNote,
        relatedPath: `/compare/finance?years=${y.fiscalYear}`,
        sourceRefs: point.sourceRefs,
      });
    }
  }
  return events;
}

/**
 * Phase204：一般質問1件が既に持っている一次資料参照（会議録・質問通告書・市議会だより）を、
 * 年表イベント用のArchiveSourceRefへ「そのまま継承」する。
 *
 * 原則：
 * - 元データ（generalQuestions.json）に存在するURL・タイトル・機関名・信頼レベル・確認日だけを
 *   詰め替える。存在しない項目は推測で補わず、フィールドごと省略する
 *   （出典が1件も無い一般質問は、年表でも「出典未登録」のまま表示する）。
 * - 同じURLを指す参照は1件にまとめる（generalQuestions.jsonではsourceUrlとnoticeUrlが
 *   同一PDFを指す場合があり、そのまま並べると同じ出典が二重表示されるため）。
 * - verificationStatusは資料の種類に応じて決める。会議録は正式な発言記録のため"verified"、
 *   質問通告書は「通告時点の予定」であり実際の発言は会議録での確認が必要なため
 *   会議録が未確認の間は"partiallyVerified"、市議会だよりは号の目次・見出しレベルの
 *   確認にとどまるため"partiallyVerified"とする（GeneralQuestionItemの型注記に準拠）。
 */
export function generalQuestionSourceRefs(q: GeneralQuestionItem): ArchiveSourceRef[] {
  const refs: ArchiveSourceRef[] = [];
  const seenUrls = new Set<string>();
  const push = (ref: ArchiveSourceRef) => {
    if (ref.sourceUrl) {
      if (seenUrls.has(ref.sourceUrl)) return;
      seenUrls.add(ref.sourceUrl);
    }
    refs.push(ref);
  };

  // 会議録が確認できている場合は、その記載内容が確認済みであることを示す。
  const transcriptVerified = Boolean(q.transcriptUrl || q.transcriptPdfUrl);

  const organization = q.sourceOrganization ? { sourceOrganization: q.sourceOrganization } : {};
  const accessed = q.lastVerified ? { accessedAt: q.lastVerified } : {};

  // 1. レコードが宣言している主たる出典（質問通告書または会議録）。
  if (q.sourceUrl) {
    push({
      sourceUrl: q.sourceUrl,
      ...(q.sourceTitle ? { sourceTitle: q.sourceTitle } : {}),
      ...organization,
      ...(q.trustLevel ? { trustLevel: q.trustLevel } : {}),
      ...accessed,
      verificationStatus: transcriptVerified ? "verified" : "partiallyVerified",
    });
  }

  // 2. 質問通告書（主たる出典と同一URLの場合は1でまとめ済み）。
  for (const url of [q.noticeUrl, q.noticePdf]) {
    if (!url) continue;
    push({
      sourceUrl: url,
      ...(q.noticeTitle ? { sourceTitle: q.noticeTitle } : {}),
      ...organization,
      ...accessed,
      verificationStatus: transcriptVerified ? "verified" : "partiallyVerified",
    });
  }

  // 3. 会議録（公開され次第、generalQuestions.jsonへ登録される）。
  for (const url of [q.transcriptUrl, q.transcriptPdfUrl]) {
    if (!url) continue;
    push({
      sourceUrl: url,
      ...(q.transcriptReference ? { sourceTitle: q.transcriptReference } : {}),
      ...organization,
      ...accessed,
      verificationStatus: "verified",
    });
  }

  // 4. のべおか市議会だより（会議録公開前の中間確認資料）。
  if (q.newsletterUrl) {
    push({
      sourceUrl: q.newsletterUrl,
      ...(q.newsletterTitle ? { sourceTitle: q.newsletterTitle } : {}),
      ...(q.newsletterCheckedAt ? { accessedAt: q.newsletterCheckedAt } : {}),
      verificationStatus: "partiallyVerified",
    });
  }

  return refs;
}

/**
 * 一般質問を年表イベントに変換する。出典は元データ（generalQuestions.json）が既に持っている
 * 一次資料参照をgeneralQuestionSourceRefs()で継承する。元データに出典が無い質問は
 * 年表側でも0件のままとし、「出典未登録」と表示する（推測でURLを補わない）。
 */
export function buildGeneralQuestionEvents(questions: GeneralQuestionItem[]): ArchiveTimelineEvent[] {
  return questions.map((q) => ({
    id: `question-${q.id}`,
    category: "generalQuestion",
    date: q.questionDate,
    dateLabel: formatJapaneseDate(q.questionDate),
    fiscalYear: fiscalYearOfIsoDate(q.questionDate),
    title: `${q.memberName}の一般質問：${q.title}`,
    relatedPath: `/questions/${q.id}`,
    sourceRefs: generalQuestionSourceRefs(q),
  }));
}

/** 議案・条例・請願・陳情を年表イベントに変換する。決定日が未確認の場合は年度のみのイベントとする。 */
export function buildCouncilDocumentEvents(documents: ArchiveCouncilDocument[]): ArchiveTimelineEvent[] {
  return documents.map((d) => {
    const date = d.decisionDate ?? null;
    return {
      id: `document-${d.id}`,
      category: "councilDocument",
      date,
      dateLabel: date ? formatJapaneseDate(date) : fiscalYearLabel(d.fiscalYear),
      fiscalYear: d.fiscalYear,
      title: `${documentTypeLabel(d.documentType)}：${d.title}`,
      relatedPath: documentPath(d),
      sourceRefs: d.sourceRefs,
    } satisfies ArchiveTimelineEvent;
  });
}

/**
 * 政策を年表イベントに変換する。発表時期（announcedDate）が確認できる場合はその日付、
 * 確認できず関連財政年度（relatedFiscalYears）のみ確認できる場合は該当年度ごとに
 * イベントを作る（複数年度に関連する政策は複数イベントになる）。いずれも無い場合は
 * 時点が確認できないため年表には含めない（推測で日付を割り当てない）。
 */
export function buildPolicyEvents(policies: ArchivePolicy[]): ArchiveTimelineEvent[] {
  const events: ArchiveTimelineEvent[] = [];
  for (const p of policies) {
    const relatedPath = `/policies/${p.slug}`;
    if (p.announcedDate) {
      events.push({
        id: `policy-${p.id}-announced`,
        category: "policy",
        date: p.announcedDate,
        dateLabel: formatJapaneseDate(p.announcedDate),
        fiscalYear: fiscalYearOfIsoDate(p.announcedDate),
        title: p.title,
        relatedPath,
        sourceRefs: p.sourceRefs,
      });
    } else if (p.relatedFiscalYears && p.relatedFiscalYears.length > 0) {
      for (const fy of p.relatedFiscalYears) {
        events.push({
          id: `policy-${p.id}-fy${fy}`,
          category: "policy",
          date: null,
          dateLabel: fiscalYearLabel(fy),
          fiscalYear: fy,
          title: p.title,
          relatedPath,
          sourceRefs: p.sourceRefs,
        });
      }
    }
  }
  return events;
}

/** 年表イベントを会計年度単位でまとめ、新しい年度が先に来るよう並べる。 */
export function groupEventsByFiscalYear(events: ArchiveTimelineEvent[]): ArchiveTimelineYearGroup[] {
  const byYear = new Map<number, ArchiveTimelineEvent[]>();
  for (const event of events) {
    const list = byYear.get(event.fiscalYear) ?? [];
    list.push(event);
    byYear.set(event.fiscalYear, list);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([fiscalYear, yearEvents]) => ({
      fiscalYear,
      events: [...yearEvents].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    }));
}
