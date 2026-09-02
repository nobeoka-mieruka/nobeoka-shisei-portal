import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import councilSessionsData from "../data/councilSessions.json";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import type { AnswererRole, CouncilMember, CouncilSession, CouncilSpeechSummaryData, FormerMember } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { StatCard } from "../components/StatCard";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { GlobeIcon } from "../components/icons";
import { answererRoleLabels, collectExecutiveAnswers, resolveMemberDisplayName } from "../lib/councilSpeeches";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const councilSessions = councilSessionsData as CouncilSession[];
const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const roleOptions: { value: AnswererRole; label: string }[] = (
  Object.keys(answererRoleLabels) as AnswererRole[]
).map((role) => ({ value: role, label: answererRoleLabels[role] }));

/** 検索・絞り込みロジック本体。将来データ量が増えた際、コンポーネントを変えずに外部検索へ差し替えやすいよう分離している。 */
function filterEntries(
  entries: ReturnType<typeof collectExecutiveAnswers>,
  { query, role, year, memberId, sessionId }: { query: string; role: string; year: string; memberId: string; sessionId: string },
) {
  const q = query.trim();
  return entries.filter((e) => {
    const matchesQuery =
      q === "" || e.summary.includes(q) || e.questionTitle.includes(q) || e.answererName.includes(q) || e.topics.some((t) => t.includes(q));
    const matchesRole = role === "all" || e.answererRole === role;
    const matchesYear = year === "all" || e.sessionId.startsWith(year);
    const matchesMember = memberId === "all" || e.memberId === memberId;
    const matchesSession = sessionId === "all" || e.sessionId === sessionId;
    return matchesQuery && matchesRole && matchesYear && matchesMember && matchesSession;
  });
}

export function ExecutiveAnswersPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [year, setYear] = useState("all");
  const [memberId, setMemberId] = useState("all");
  const [sessionId, setSessionId] = useState("all");

  const entries = useMemo(() => collectExecutiveAnswers(speechSummaryData.members), []);

  const yearOptions = useMemo(
    () =>
      Array.from(new Set(entries.map((e) => e.sessionId.slice(0, 4))))
        .sort((a, b) => b.localeCompare(a))
        .map((y) => ({ value: y, label: `${y}年` })),
    [entries],
  );
  const memberOptions = useMemo(() => {
    const ids = new Set(entries.map((e) => e.memberId));
    return members.filter((m) => ids.has(m.id)).map((m) => ({ value: m.id, label: m.name }));
  }, [entries]);
  const sessionOptions = useMemo(() => {
    const ids = new Set(entries.map((e) => e.sessionId));
    return councilSessions.filter((s) => ids.has(s.id)).map((s) => ({ value: s.id, label: s.title }));
  }, [entries]);

  const filtered = filterEntries(entries, { query, role, year, memberId, sessionId });

  const hasActiveFilter = query !== "" || role !== "all" || year !== "all" || memberId !== "all" || sessionId !== "all";
  const clearFilters = () => {
    setQuery("");
    setRole("all");
    setYear("all");
    setMemberId("all");
    setSessionId("all");
  };

  return (
    <div className="px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市長・執行部答弁の検索（試験公開中）</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          市長、副市長、教育長、部長などが行った答弁を、公式会議録本文から確認できた範囲で横断検索できます。表示している要約はAIによる要約です。正確な内容は公式会議録原文をご確認ください。
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="登録済み答弁数" value={entries.length} unit="件" />
        <StatCard label="登録済み議員数" value={memberOptions.length} unit="名" />
        <StatCard label="対象会期数" value={sessionOptions.length} unit="会期" />
        <StatCard label="対象年数" value={yearOptions.length} unit="年" />
      </div>

      <div className="sticky top-[57px] z-10 -mx-4 space-y-3 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0 sm:py-2">
        <SearchBar value={query} onChange={setQuery} placeholder="答弁内容、答弁者名、テーマで検索" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="役職" value={role} onChange={setRole} options={roleOptions} />
          <FilterSelect label="年度" value={year} onChange={setYear} options={yearOptions} />
          <FilterSelect label="質問議員" value={memberId} onChange={setMemberId} options={memberOptions} />
          <FilterSelect label="会議" value={sessionId} onChange={setSessionId} options={sessionOptions} />
        </div>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            条件をリセット
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          答弁データを準備中です。公式会議録を確認しながら順次追加します。
        </p>
      ) : (
        <>
          <p className="mb-3 mt-3 text-sm text-on-surface-variant">
            {filtered.length > 0 ? `${filtered.length}件の答弁が見つかりました` : "条件に一致する答弁は見つかりませんでした。"}
          </p>
          {filtered.length > 0 && (
            <ul className="space-y-3">
              {filtered.map((e) => {
                const memberName = resolveMemberDisplayName(e.memberId, members, formerMembers);
                const session = councilSessions.find((s) => s.id === e.sessionId);
                return (
                  <li key={e.id} className="rounded-lg border border-outline-variant p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-surface-container-lowest px-2.5 py-0.5 text-xs font-semibold text-on-surface">
                        {e.answererName}（{answererRoleLabels[e.answererRole]}）
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {session?.title ?? e.sessionId}
                        {e.date && `／${formatJapaneseDate(e.date)}`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      質問議員：{memberName}／質問「{e.questionTitle}」
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-on-surface">{e.summary}</p>
                    <p className="mt-1 text-[11px] text-on-surface-variant">この要約はAIを利用して作成しています。正確な内容は会議録原文をご確認ください。</p>
                    {e.topics.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {e.topics.map((t) => (
                          <span key={t} className="rounded-full bg-surface-container-lowest px-2 py-0.5 text-xs text-on-surface-variant">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Link to={`/members/${e.memberId}/questions/${e.speechId}`} className={`text-sm font-medium text-primary underline ${linkClass}`}>
                        詳細を見る
                      </Link>
                      {e.sourceUrl && (
                        <a
                          href={e.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="原本（公式会議録）を新しいタブで開く"
                          className={`inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline ${linkClass}`}
                        >
                          <GlobeIcon className="h-3.5 w-3.5" />
                          原本を見る
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <p className="mt-6 px-1 text-xs leading-relaxed text-on-surface-variant">
        このページは、延岡市議会が公開する公式会議録を基に、市長・執行部の答弁を整理しています。答弁の要約はAIを利用して作成しており、原文のすべての文脈や表現を再現するものではありません。答弁の質や対応の良し悪しを評価するものではありません。
      </p>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="市長・執行部答弁の検索" />
      </div>
    </div>
  );
}
