import type { ArchiveFiscalYear, ArchiveMayor, ArchiveMayorTerm } from "../types/historicalArchive";
import type { ArchiveTimelineEvent, ArchiveTimelineYearGroup } from "../types/timeline";
import { formatJapaneseDate } from "../config/site";
import { fiscalYearLabel } from "./archiveFinance";

/** 会計年度は4月始まり。1〜3月は前年度扱いにする（config/site.tsのtoFiscalYearLabelと同じ定義）。 */
function fiscalYearOfIsoDate(iso: string): number {
  const [year, month] = iso.split("-").map(Number);
  return month >= 4 ? year : year - 1;
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
 * 年度別財政データ（人口・予算・市債・基金・財政指標）を年表イベントに変換する。
 * 日単位の日付は資料上確認できないため、年度のみのイベントとして扱う（dateはnull）。
 */
export function buildFiscalYearEvents(fiscalYears: ArchiveFiscalYear[]): ArchiveTimelineEvent[] {
  return fiscalYears.map((y) => {
    const sourceRefs = [
      ...(y.population?.sourceRefs ?? []),
      ...(y.budget?.sourceRefs ?? []),
      ...(y.debt?.balance.sourceRefs ?? []),
      ...(y.fund?.balance.sourceRefs ?? []),
      ...(y.finance?.sourceRefs ?? []),
    ];

    const parts: string[] = [];
    if (y.population?.population != null) parts.push(`人口${y.population.population.toLocaleString("ja-JP")}人`);
    if (y.budget?.generalAccountSettlementYen != null) parts.push("予算・決算データあり");
    if (y.debt?.municipalBondIssuanceYen != null) parts.push("市債データあり");
    if (y.fund?.balance.totalYen != null || y.fund?.balance.fiscalAdjustmentFundYen != null) parts.push("基金データあり");
    if (y.finance?.financialStrengthIndex != null) parts.push("財政健全化判断比率あり");

    return {
      id: `fiscal-year-${y.fiscalYear}`,
      category: "fiscalYear",
      date: null,
      dateLabel: fiscalYearLabel(y.fiscalYear),
      fiscalYear: y.fiscalYear,
      title: `${fiscalYearLabel(y.fiscalYear)}の財政・人口データ`,
      description: parts.length > 0 ? parts.join("、") : "確認できたデータはまだありません",
      relatedPath: `/compare/finance?items=${y.fiscalYear}`,
      sourceRefs,
    } satisfies ArchiveTimelineEvent;
  });
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
