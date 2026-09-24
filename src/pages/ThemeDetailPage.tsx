import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import themesData from "../data/themes.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import councilSessionsData from "../data/councilSessions.json";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archivePoliciesData from "../data/archivePolicies.json";
import archivePolicyCategoriesData from "../data/archivePolicyCategories.json";
import archiveCouncilDocumentsData from "../data/archiveCouncilDocuments.json";
import archiveAiCategoryCandidatesData from "../data/archiveAiCategoryCandidates.json";
import archiveMayorsData from "../data/archiveMayors.json";
import themeKeywordMatchesData from "../data/themeKeywordMatches.json";
import themeCrossLinksData from "../data/themeCrossLinks.json";
import financeDashboardData from "../data/financeDashboard.json";
import { KEYWORD_MATCH_DISCLAIMER, KeywordMatchList } from "../components/themes/ThemeKeywordMatches";
import { citizenStatusLabel } from "../lib/citizenStatusLabels";
import type { CouncilMember, CouncilSession, CouncilSpeechSummaryData, FormerMember, Theme } from "../types";
import type {
  ArchiveAiCategoryCandidate,
  ArchiveCouncilDocument,
  ArchiveMayor,
  ArchivePolicy,
  ArchivePolicyCategory,
} from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { BackLink } from "../components/BackLink";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { SpeechSummaryStatusBadge } from "../components/council/SpeechSummaryStatusBadge";
import { findSpeechesByThemeSlug, resolveMemberDisplayName } from "../lib/councilSpeeches";
import { THEME_TO_POLICY_CATEGORY_IDS } from "../lib/themeClassification";
import { categoryLabel, policyStatusLabel } from "../lib/archivePolicies";
import { documentResultLabel, documentTypeLabel } from "../lib/archiveCouncilDocuments";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";
import { humanizeDataNote } from "../lib/citizenTermLabels";

const themes = themesData as Theme[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const councilSessions = councilSessionsData as CouncilSession[];
const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const archivePolicies = archivePoliciesData as ArchivePolicy[];
const archivePolicyCategories = archivePolicyCategoriesData as ArchivePolicyCategory[];
const archiveCouncilDocuments = archiveCouncilDocumentsData as ArchiveCouncilDocument[];
const archiveAiCategoryCandidates = archiveAiCategoryCandidatesData as ArchiveAiCategoryCandidate[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];

interface ThemeKeywordMatchSet {
  generalQuestions: { id: string; title: string; date: string; matched: string }[];
  bills: { id: string; title: string; billNumber: string; result: string | null; date: string | null; matched: string }[];
  promises: { id: string; title: string; matched: string }[];
  committeeReports: { id: string; title: string; committeeId: string; sourceUrl: string | null; matched: string }[];
  budgetProjects: { id: string; revisionId: string; title: string; matched: string }[];
}
const themeKeywordMatches = themeKeywordMatchesData as Record<string, ThemeKeywordMatchSet>;

interface ThemeCrossLink {
  expenditurePurposeLabels: string[];
  committees: { id: string; name: string; basis: string }[];
}
const themeCrossLinks = (themeCrossLinksData as { themes: Record<string, ThemeCrossLink> }).themes;
const expenditureByPurpose = financeDashboardData.expenditureByPurpose as { label: string; amountThousandYen: number; percentage: number }[];

const COUNCIL_DOCUMENT_BASE_PATHS: Record<string, string> = {
  bill: "/bills",
  ordinance: "/ordinances",
  petition: "/petitions",
  request: "/requests",
};

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function ThemeDetailPage() {
  const { themeSlug } = useParams<{ themeSlug: string }>();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [memberId, setMemberId] = useState("all");

  const theme = themes.find((t) => t.slug === themeSlug);
  const matches = useMemo(() => (theme ? findSpeechesByThemeSlug(speechSummaryData.members, theme.slug) : []), [theme]);

  const yearOptions = useMemo(
    () =>
      Array.from(new Set(matches.map((m) => m.speech.sessionId.slice(0, 4))))
        .sort((a, b) => b.localeCompare(a))
        .map((y) => ({ value: y, label: `${y}年` })),
    [matches],
  );

  const memberOptions = useMemo(() => {
    const ids = new Set(matches.map((m) => m.memberId));
    return members.filter((m) => ids.has(m.id)).map((m) => ({ value: m.id, label: m.name }));
  }, [matches]);

  const filteredMatches = useMemo(() => {
    const q = query.trim();
    return matches.filter((m) => {
      const matchesQuery =
        q === "" ||
        m.speech.questionItems.some((item) => item.title.includes(q) || item.questionSummary.includes(q)) ||
        m.matchedTopics.some((t) => t.includes(q));
      const matchesYear = year === "all" || m.speech.sessionId.startsWith(year);
      const matchesMember = memberId === "all" || m.memberId === memberId;
      return matchesQuery && matchesYear && matchesMember;
    });
  }, [matches, query, year, memberId]);

  if (!theme) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to="/themes" label="テーマ一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定されたテーマは見つかりませんでした。
        </p>
      </div>
    );
  }

  // 議員別の質問件数（五十音・議員一覧順。件数の多い順には並べず、順位付けと誤認されないようにする）。
  const memberCounts = members
    .map((m) => ({ member: m, count: matches.filter((x) => x.memberId === m.id).length }))
    .filter((mc) => mc.count > 0);
  const formerMemberCounts = formerMembers
    .map((m) => ({ member: m, count: matches.filter((x) => x.memberId === m.id).length }))
    .filter((mc) => mc.count > 0);

  // 年度別の質問件数（新しい年から表示）。
  const yearCounts = Array.from(new Set(matches.map((m) => m.speech.sessionId.slice(0, 4))))
    .sort((a, b) => b.localeCompare(a))
    .map((y) => ({ year: y, count: matches.filter((m) => m.speech.sessionId.startsWith(y)).length }));
  const maxYearCount = Math.max(...yearCounts.map((y) => y.count), 1);

  // フェーズ8：政策テーママスタ（archivePolicyCategories.json）との対応表を使って、
  // 確認済みの政策・その所有者（市長）を横断表示する。対応表自体は人による直接定義（推測ではない）。
  const relatedCategoryIds = THEME_TO_POLICY_CATEGORY_IDS[theme.id] ?? [];
  const confirmedPolicies = archivePolicies.filter((p) => p.categoryIds.some((c) => relatedCategoryIds.includes(c)));
  const confirmedMayors = archiveMayors.filter((m) =>
    confirmedPolicies.some((p) => p.ownerType === "mayor" && p.ownerId === m.id),
  );

  // 議案・条例・請願・陳情は現状テーマ分類が未確定のため、キーワード一致の候補
  // （archiveAiCategoryCandidates.json、status="candidate"。AIや人による確認はしていない）を
  // 「同じキーワードを含む資料」の中で区別して表示する。
  const candidateEntries = archiveAiCategoryCandidates
    .filter((c) => relatedCategoryIds.includes(c.categoryId))
    .map((c) => ({ candidate: c, document: archiveCouncilDocuments.find((d) => d.id === c.sourceEntityId) }))
    .filter((e): e is { candidate: ArchiveAiCategoryCandidate; document: ArchiveCouncilDocument } => Boolean(e.document));

  const kw: ThemeKeywordMatchSet = themeKeywordMatches[theme.slug] ?? {
    generalQuestions: [],
    bills: [],
    promises: [],
    committeeReports: [],
    budgetProjects: [],
  };
  const crossLink = themeCrossLinks[theme.slug];
  const purposeRows = (crossLink?.expenditurePurposeLabels ?? [])
    .map((label) => expenditureByPurpose.find((r) => r.label === label))
    .filter((r): r is { label: string; amountThousandYen: number; percentage: number } => Boolean(r));
  const keywordTotal =
    kw.generalQuestions.length +
    kw.bills.length +
    kw.promises.length +
    kw.committeeReports.length +
    kw.budgetProjects.length +
    candidateEntries.length +
    matches.length;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/themes" label="テーマ一覧に戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">{theme.name}</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">{theme.description}</p>
        <p className="mt-2 text-xs text-on-primary-container/80">
          確認できる関連資料：{confirmedPolicies.length}件／同じキーワードを含む資料：{keywordTotal}件
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/timeline"
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
          >
            年表で見る
          </Link>
          <Link
            to="/compare"
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
          >
            比較ページを見る
          </Link>
        </div>
      </div>

      <section aria-labelledby="theme-confirmed-heading" className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 id="theme-confirmed-heading" className="text-base font-semibold text-on-surface">
          【確認できる関連資料】
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          登録時に、このテーマの分類が人によって付けられた資料だけを表示しています（キーワードの一致だけでは載せません）。
        </p>
        {confirmedPolicies.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">該当資料なし（このテーマに分類した政策の登録はまだありません）</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2">
              {confirmedPolicies.map((p) => (
                <li key={p.id} className="rounded-lg border border-outline-variant p-3 text-sm">
                  <Link to={`/policies/${p.slug}`} className={`inline-flex min-h-11 items-center text-primary underline ${linkClass}`}>
                    {p.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                      {policyStatusLabel(p.status)}
                    </span>
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                      出典の確認：{citizenStatusLabel(p.sourceRefs?.[0]?.verificationStatus)}
                    </span>
                    {p.categoryIds.map((cid) => (
                      <span key={cid} className="rounded-full bg-primary-container px-2 py-0.5 text-xs text-on-primary-container">
                        {categoryLabel(archivePolicyCategories, cid)}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {confirmedMayors.length > 0 && (
              <p className="mt-3 text-xs text-on-surface-variant">
                関係する市長：
                {confirmedMayors.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && "、"}
                    <Link to={`/mayors/${m.slug}`} className={`text-primary underline ${linkClass}`}>
                      {m.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </>
        )}
      </section>

      {crossLink && (crossLink.committees.length > 0 || purposeRows.length > 0) && (
        <section aria-labelledby="theme-reference-heading" className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 id="theme-reference-heading" className="text-base font-semibold text-on-surface">
            参考：所管の委員会・予算の区分
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
            委員会の所管部局（延岡市議会委員会条例第2条）や予算の目的別の区分（款）の名称が、このテーマと直接対応するものを当サイトが示しています。個々の議案・事業がこのテーマに当たるかを確認したものではありません。
          </p>
          {crossLink.committees.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {crossLink.committees.map((c) => (
                <li key={c.id}>
                  <Link to={`/committees/${c.id}`} className={`inline-flex min-h-11 items-center text-primary underline ${linkClass}`}>
                    {c.name}
                  </Link>
                  <span className="text-xs text-on-surface-variant">（所管：{c.basis}）</span>
                </li>
              ))}
            </ul>
          )}
          {purposeRows.length > 0 && (
            <div className="mt-2 text-sm">
              <p className="text-xs text-on-surface-variant">
                {financeDashboardData.fiscalYearLabel}の一般会計（{financeDashboardData.supplementaryStageLabel}）の目的別歳出：
              </p>
              <ul className="mt-1 space-y-0.5">
                {purposeRows.map((r) => (
                  <li key={r.label}>
                    {r.label}：{Math.round(r.amountThousandYen / 100000) / 10}億円（歳出全体の{r.percentage}%）
                  </li>
                ))}
              </ul>
              <Link to="/finance" className={`inline-flex min-h-11 items-center text-xs text-primary underline ${linkClass}`}>
                財政ページで内訳と出典を見る
              </Link>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="theme-keyword-heading" className="space-y-4 rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <div>
          <h2 id="theme-keyword-heading" className="text-base font-semibold text-on-surface">
            【同じキーワードを含む資料】
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
            {KEYWORD_MATCH_DISCLAIMER}
            テーマのキーワード（{theme.keywords.join("、")}）を題名や本文に含む資料を、機械的に集めています（AIによる判定はしていません）。
          </p>
        </div>
        <KeywordMatchList
          heading="一般質問"
          items={kw.generalQuestions.map((q) => ({
            key: q.id,
            title: q.title,
            route: `/questions/${q.id}`,
            matched: q.matched,
            meta: q.date ? formatJapaneseDate(q.date) : undefined,
          }))}
        />
        <KeywordMatchList
          heading="議案・議決結果（人事・予算・決算の議案は除く）"
          items={kw.bills.map((b) => ({
            key: b.id,
            title: `${b.billNumber} ${b.title}`,
            route: `/bills/votes/${b.id}`,
            matched: b.matched,
            meta: [b.result, b.date ? formatJapaneseDate(b.date) : null].filter(Boolean).join("／") || undefined,
          }))}
          moreLink={{ to: `/search?q=${encodeURIComponent(theme.keywords[0])}&type=bill`, label: "サイト内検索で続きを見る" }}
        />
        <KeywordMatchList
          heading="市長公約"
          items={kw.promises.map((p) => ({
            key: p.id,
            title: p.title,
            route: `/mayor/policy-progress/${p.id}`,
            matched: p.matched,
          }))}
        />
        <KeywordMatchList
          heading="予算の事業（補正予算の概要）"
          items={kw.budgetProjects.map((p) => ({
            key: `${p.revisionId}-${p.id}`,
            title: p.title,
            route: `/finance#budget-revision-${p.revisionId}`,
            matched: p.matched,
          }))}
        />
        <KeywordMatchList
          heading="委員会の活動報告"
          items={kw.committeeReports.map((r) => ({
            key: r.id,
            title: r.title,
            route: `/committees/${r.committeeId}`,
            matched: r.matched,
            sourceUrl: r.sourceUrl,
          }))}
        />
        {candidateEntries.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-on-surface">議案・条例・請願・陳情（分類候補、{candidateEntries.length}件）</h3>
            <ul className="mt-1 space-y-1.5">
              {candidateEntries.map(({ candidate, document }) => {
                const basePath = COUNCIL_DOCUMENT_BASE_PATHS[document.documentType] ?? "/bills";
                return (
                  <li key={candidate.id} className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm">
                    <Link to={`${basePath}/${document.slug}`} className={`inline-flex min-h-11 items-center text-primary underline ${linkClass}`}>
                      {document.title}
                    </Link>
                    <p className="text-xs text-on-surface-variant">
                      {documentTypeLabel(document.documentType)}
                      {document.result ? `／結果：${documentResultLabel(document.result)}` : ""}／キーワード一致による分類候補（確認前）
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="text-xs leading-relaxed text-on-surface-variant">
          下の「会議録の質問・答弁」も、質問の見出しに含まれるキーワードで分類したものです。件数は質問内容の質、政策への貢献度、議員活動全体を評価するものではなく、順位付けでもありません。
        </p>
      </section>

      {yearCounts.length > 0 && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">年別の質問件数（定例会の開催年）</h2>
          <ul className="mt-2 space-y-2">
            {yearCounts.map((y) => (
              <li key={y.year}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-on-surface">{y.year}年</span>
                  <span className="shrink-0 text-xs text-on-surface-variant">{y.count}件</span>
                </div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${(y.count / maxYearCount) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {memberCounts.length > 0 && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">議員別の質問件数</h2>
          <p className="mt-1 text-xs text-on-surface-variant">五十音・議員一覧順に表示しています。順位ではありません。</p>
          <ul className="mt-2 divide-y divide-outline-variant text-sm">
            {memberCounts.map(({ member, count }) => (
              <li key={member.id} className="flex items-center justify-between gap-2">
                <Link to={`/members/${member.id}`} className={`inline-flex min-h-11 items-center text-primary underline ${linkClass}`}>
                  {member.name}
                </Link>
                <span className="text-xs text-on-surface-variant">{count}件</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {formerMemberCounts.length > 0 && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">元議員別の質問件数</h2>
          <ul className="mt-2 divide-y divide-outline-variant text-sm">
            {formerMemberCounts.map(({ member, count }) => (
              <li key={member.id} className="flex items-center justify-between gap-2">
                <Link to={`/members/former/${member.id}`} className={`inline-flex min-h-11 items-center text-primary underline ${linkClass}`}>
                  {member.name}
                </Link>
                <span className="text-xs text-on-surface-variant">{count}件</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="sticky top-[57px] z-10 -mx-4 space-y-3 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0 sm:py-2">
        <SearchBar value={query} onChange={setQuery} placeholder="質問内容・キーワードで検索" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="年度" value={year} onChange={setYear} options={yearOptions} />
          <FilterSelect label="議員" value={memberId} onChange={setMemberId} options={memberOptions} />
        </div>
      </div>

      <section>
        <h2 className="text-base font-semibold text-on-surface">【同じキーワードを含む資料】会議録の質問・答弁（見出しのキーワードで分類、{matches.length}件）</h2>
        {filteredMatches.length === 0 ? (
          <p className="mt-2 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
            条件に一致する質問は見つかりませんでした。
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {filteredMatches.map(({ memberId: mId, speech, matchedTopics }) => {
              const memberName = resolveMemberDisplayName(mId, members, formerMembers);
              const session = councilSessions.find((s) => s.id === speech.sessionId);
              return (
                <li key={speech.id} className="rounded-lg border border-outline-variant p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-on-surface-variant">
                      {memberName}／{session?.title ?? speech.sessionId}
                      {speech.date && `／${formatJapaneseDate(speech.date)}`}
                    </span>
                    <SpeechSummaryStatusBadge status={speech.summaryStatus} />
                  </div>
                  {speech.shortSummary && <p className="mt-1 text-sm text-on-surface">{humanizeDataNote(speech.shortSummary)}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {matchedTopics.map((t) => (
                      <span key={t} className="rounded-full bg-surface-container-lowest px-2 py-0.5 text-xs text-on-surface-variant">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={`/members/${mId}/questions/${speech.id}`}
                    className={`mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline ${linkClass}`}
                  >
                    質問・答弁の詳細を見る
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName={`テーマ「${theme.name}」`} />
      </div>
    </div>
  );
}
