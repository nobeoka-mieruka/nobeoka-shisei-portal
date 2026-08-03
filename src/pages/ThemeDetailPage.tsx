import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import themesData from "../data/themes.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import councilSessionsData from "../data/councilSessions.json";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import type { CouncilMember, CouncilSession, CouncilSpeechSummaryData, FormerMember, Theme } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { BackLink } from "../components/BackLink";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { SpeechSummaryStatusBadge } from "../components/council/SpeechSummaryStatusBadge";
import { findSpeechesByThemeSlug, resolveMemberDisplayName } from "../lib/councilSpeeches";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const themes = themesData as Theme[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const councilSessions = councilSessionsData as CouncilSession[];
const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];

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
        <BackLink to="/themes" label="テーマから探すに戻る" />
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

  // 年度別の質問件数（新しい年から表示）。
  const yearCounts = Array.from(new Set(matches.map((m) => m.speech.sessionId.slice(0, 4))))
    .sort((a, b) => b.localeCompare(a))
    .map((y) => ({ year: y, count: matches.filter((m) => m.speech.sessionId.startsWith(y)).length }));
  const maxYearCount = Math.max(...yearCounts.map((y) => y.count), 1);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/themes" label="テーマから探すに戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">{theme.name}</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">{theme.description}</p>
        <p className="mt-2 text-xs text-on-primary-container/80">
          このテーマに関する質問件数：{matches.length}件（{memberCounts.length}名の議員）
        </p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        件数は会議録上の質問をテーマ別に分類した集計です。質問内容の質、政策への貢献度、議員活動全体を評価するものではありません。「テーマ別質問件数」「議員別の質問件数」は事実集計であり、順位付けではありません。
      </p>

      {yearCounts.length > 0 && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">年度別の質問件数</h2>
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
              <li key={member.id} className="flex items-center justify-between gap-2 py-2">
                <Link to={`/members/${member.id}`} className={`text-primary hover:underline ${linkClass}`}>
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
        <h2 className="text-base font-semibold text-on-surface">質問と答弁の一覧</h2>
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
                  {speech.shortSummary && <p className="mt-1 text-sm text-on-surface">{speech.shortSummary}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {matchedTopics.map((t) => (
                      <span key={t} className="rounded-full bg-surface-container-lowest px-2 py-0.5 text-xs text-on-surface-variant">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={`/members/${mId}/questions/${speech.id}`}
                    className={`mt-2 inline-block text-sm font-medium text-primary hover:underline ${linkClass}`}
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
