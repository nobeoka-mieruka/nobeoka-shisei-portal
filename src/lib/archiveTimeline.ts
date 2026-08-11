import type {
  ArchiveCouncilDocument,
  ArchiveFiscalYear,
  ArchiveMayor,
  ArchiveMayorTerm,
  ArchiveMemberProfile,
  ArchiveMemberTerm,
  ArchivePolicy,
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

/** 一般質問を年表イベントに変換する。個別の出典URLは持たないため、詳細ページへのリンクで確認する。 */
export function buildGeneralQuestionEvents(questions: GeneralQuestionItem[]): ArchiveTimelineEvent[] {
  return questions.map((q) => ({
    id: `question-${q.id}`,
    category: "generalQuestion",
    date: q.questionDate,
    dateLabel: formatJapaneseDate(q.questionDate),
    fiscalYear: fiscalYearOfIsoDate(q.questionDate),
    title: `${q.memberName}の一般質問：${q.title}`,
    relatedPath: `/questions/${q.id}`,
    sourceRefs: [],
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
