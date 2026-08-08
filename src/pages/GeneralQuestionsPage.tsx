import { useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import generalQuestionsData from "../data/generalQuestions.json";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import councilSessionsData from "../data/councilSessions.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import type {
  CouncilMember,
  CouncilSession,
  CouncilSpeech,
  CouncilSpeechSummaryData,
  FormerMember,
  GeneralQuestionItem,
} from "../types";
import type { ArchiveMemberProfile } from "../types/historicalArchive";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { StatCard } from "../components/StatCard";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LastUpdated } from "../components/LastUpdated";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { GeneralQuestionCard } from "../components/questions/GeneralQuestionCard";
import { VerifiedSpeechCard } from "../components/questions/VerifiedSpeechCard";
import { usePageTitle } from "../hooks/usePageTitle";
import { GlobeIcon } from "../components/icons";
import { getSeoForPath } from "../lib/seo";
import { allPublicSpeeches, findMemberOrFormerLink, questionLikeSpeeches, resolveMemberDisplayName } from "../lib/councilSpeeches";
import { CsvDownloadButton } from "../components/CsvDownloadButton";
import type { CsvColumn } from "../lib/csv";
import { SITE_URL } from "../config/site";

const questions = generalQuestionsData as GeneralQuestionItem[];
const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];
const councilSessions = councilSessionsData as CouncilSession[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;

const verifiedSpeeches: CouncilSpeech[] = questionLikeSpeeches(allPublicSpeeches(speechSummaryData.members)).sort(
  (a, b) => (b.date ?? "").localeCompare(a.date ?? ""),
);

const REGULAR_SESSION_TYPES = new Set(["定例会"]);

type QuestionSortKey = "dateDesc" | "dateAsc" | "memberName";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const questionTypeOptions = [
  { value: "一般質問", label: "一般質問" },
  { value: "代表質問", label: "代表質問" },
];

const sortOptions: { value: QuestionSortKey; label: string }[] = [
  { value: "dateDesc", label: "新しい順" },
  { value: "dateAsc", label: "古い順" },
  { value: "memberName", label: "議員名順" },
];

const QUESTIONS_CSV_COLUMNS: CsvColumn<GeneralQuestionItem>[] = [
  { header: "年度", value: (q) => q.fiscalYear },
  { header: "定例会・臨時会", value: (q) => q.sessionName },
  { header: "質問日", value: (q) => q.questionDate },
  { header: "議員", value: (q) => q.memberName },
  { header: "質問区分", value: (q) => q.questionType },
  { header: "件名", value: (q) => q.title },
  { header: "テーマ", value: (q) => q.topics },
  { header: "質問項目", value: (q) => q.questionItems },
  { header: "質問通告書URL", value: (q) => q.noticePdf ?? q.noticeUrl },
  { header: "会議録URL", value: (q) => q.transcriptUrl },
  { header: "詳細ページURL", value: (q) => `${SITE_URL}/questions/${q.id}` },
];

const PRIMARY_SOURCES = [
  {
    label: "質問通告書",
    title: "延岡市議会 質問通告書",
    url: "https://www.city.nobeoka.miyazaki.jp/site/gikai/1402.html",
  },
  {
    label: "会議録検索システム",
    title: "延岡市議会 会議録検索システム",
    url: "http://kensakusystem.jp/nobeoka/cgi-bin3/Search2.exe?Code=48o046ot0cia1xvtw7",
  },
  {
    label: "議会映像",
    title: "延岡市議会 公式YouTubeチャンネル",
    url: "https://www.youtube.com/@%E5%BB%B6%E5%B2%A1%E5%B8%82%E8%AD%B0%E4%BC%9A",
  },
];

export function GeneralQuestionsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [memberId, setMemberId] = useState(searchParams.get("member") ?? "all");
  const [theme, setTheme] = useState("all");
  const [fiscalYear, setFiscalYear] = useState("all");
  const [session, setSession] = useState("all");
  const [questionType, setQuestionType] = useState("all");
  const [sortKey, setSortKey] = useState<QuestionSortKey>("dateDesc");

  const memberOptions = useMemo(
    () => members.map((m) => ({ value: m.id, label: m.name })),
    [],
  );

  const themeOptions = useMemo(
    () =>
      Array.from(new Set(questions.flatMap((q) => q.topics)))
        .sort((a, b) => a.localeCompare(b, "ja"))
        .map((t) => ({ value: t, label: t })),
    [],
  );

  const fiscalYearOptions = useMemo(
    () =>
      Array.from(new Set(questions.map((q) => q.fiscalYear)))
        .sort((a, b) => b.localeCompare(a, "ja"))
        .map((y) => ({ value: y, label: y })),
    [],
  );

  const sessionOptions = useMemo(
    () =>
      Array.from(new Set(questions.map((q) => q.sessionName)))
        .sort((a, b) => b.localeCompare(a, "ja"))
        .map((s) => ({ value: s, label: s })),
    [],
  );

  const hasActiveFilter =
    query !== "" ||
    memberId !== "all" ||
    theme !== "all" ||
    fiscalYear !== "all" ||
    session !== "all" ||
    questionType !== "all";

  const clearFilters = () => {
    setQuery("");
    setMemberId("all");
    setTheme("all");
    setFiscalYear("all");
    setSession("all");
    setQuestionType("all");
  };

  const filteredQuestions = useMemo(() => {
    const q = query.trim();
    let list = questions.filter((item) => {
      const matchesQuery =
        q === "" ||
        item.title.includes(q) ||
        item.summary.includes(q) ||
        item.memberName.includes(q) ||
        item.topics.some((t) => t.includes(q)) ||
        item.questionItems.some((qi) => qi.includes(q));
      const matchesMember = memberId === "all" || item.memberId === memberId;
      const matchesTheme = theme === "all" || item.topics.includes(theme);
      const matchesFiscalYear = fiscalYear === "all" || item.fiscalYear === fiscalYear;
      const matchesSession = session === "all" || item.sessionName === session;
      const matchesQuestionType = questionType === "all" || item.questionType === questionType;
      return (
        matchesQuery && matchesMember && matchesTheme && matchesFiscalYear && matchesSession && matchesQuestionType
      );
    });

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "dateAsc":
          return a.questionDate.localeCompare(b.questionDate);
        case "memberName":
          return a.memberName.localeCompare(b.memberName, "ja");
        case "dateDesc":
        default:
          return b.questionDate.localeCompare(a.questionDate);
      }
    });

    return list;
  }, [query, memberId, theme, fiscalYear, session, questionType, sortKey]);

  const registeredMemberCount = useMemo(() => new Set(questions.map((q) => q.memberId)).size, []);
  const registeredThemeCount = useMemo(() => new Set(questions.flatMap((q) => q.topics)).size, []);
  const fiscalYearCount = useMemo(() => new Set(questions.map((q) => q.fiscalYear)).size, []);

  // --- 確認済み一般質問アーカイブ（councilSpeechSummaries.json、公式会議録ベース） ---
  const [vQuery, setVQuery] = useState("");
  const [vMemberId, setVMemberId] = useState("all");
  const [vTheme, setVTheme] = useState("all");
  const [vYear, setVYear] = useState("all");
  const [vSessionId, setVSessionId] = useState("all");

  const verifiedMemberOptions = useMemo(() => {
    const ids = new Set(verifiedSpeeches.map((s) => s.memberId));
    return [...ids]
      .map((id) => ({ value: id, label: resolveMemberDisplayName(id, members, formerMembers) }))
      .sort((a, b) => a.label.localeCompare(b.label, "ja"));
  }, []);

  const verifiedThemeOptions = useMemo(
    () =>
      Array.from(new Set(verifiedSpeeches.flatMap((s) => s.topics)))
        .sort((a, b) => a.localeCompare(b, "ja"))
        .map((t) => ({ value: t, label: t })),
    [],
  );

  const verifiedYearOptions = useMemo(
    () =>
      Array.from(new Set(verifiedSpeeches.map((s) => s.sessionId.slice(0, 4))))
        .sort((a, b) => b.localeCompare(a))
        .map((y) => ({ value: y, label: `${y}年` })),
    [],
  );

  const verifiedSessionOptions = useMemo(() => {
    const ids = new Set(verifiedSpeeches.map((s) => s.sessionId));
    return councilSessions
      .filter((s) => ids.has(s.id))
      .map((s) => ({ value: s.id, label: s.title }))
      .sort((a, b) => b.value.localeCompare(a.value));
  }, []);

  const hasVerifiedFilter = vQuery !== "" || vMemberId !== "all" || vTheme !== "all" || vYear !== "all" || vSessionId !== "all";
  const clearVerifiedFilters = () => {
    setVQuery("");
    setVMemberId("all");
    setVTheme("all");
    setVYear("all");
    setVSessionId("all");
  };

  const filteredVerifiedSpeeches = useMemo(() => {
    const q = vQuery.trim();
    return verifiedSpeeches.filter((s) => {
      const memberName = resolveMemberDisplayName(s.memberId, members, formerMembers);
      const matchesQuery =
        q === "" ||
        memberName.includes(q) ||
        s.topics.some((t) => t.includes(q)) ||
        (s.shortSummary ?? "").includes(q) ||
        s.questionItems.some((qi) => qi.title.includes(q) || qi.questionSummary.includes(q));
      const matchesMember = vMemberId === "all" || s.memberId === vMemberId;
      const matchesTheme = vTheme === "all" || s.topics.includes(vTheme);
      const matchesYear = vYear === "all" || s.sessionId.startsWith(vYear);
      const matchesSession = vSessionId === "all" || s.sessionId === vSessionId;
      return matchesQuery && matchesMember && matchesTheme && matchesYear && matchesSession;
    });
  }, [vQuery, vMemberId, vTheme, vYear, vSessionId]);

  // 収録状況：対象期間内の定例会（一般質問が行われる会議区分）のうち、確認済み発言が1件以上ある会期の割合。
  const regularSessionsInPeriod = useMemo(
    () => councilSessions.filter((s) => REGULAR_SESSION_TYPES.has(s.sessionType)),
    [],
  );
  const coveredSessionIds = useMemo(() => new Set(verifiedSpeeches.map((s) => s.sessionId)), []);
  const coveredRegularSessionCount = regularSessionsInPeriod.filter((s) => coveredSessionIds.has(s.id)).length;
  const uncoveredRegularSessions = regularSessionsInPeriod.filter((s) => !coveredSessionIds.has(s.id));
  const verifiedQuestionItemCount = useMemo(
    () => verifiedSpeeches.reduce((sum, s) => sum + s.questionItems.length, 0),
    [],
  );
  const verifiedDates = verifiedSpeeches.map((s) => s.date).filter((d): d is string => !!d).sort();
  const verifiedEarliestDate = verifiedDates[0];
  const verifiedLatestDate = verifiedDates[verifiedDates.length - 1];

  return (
    <div className="px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">一般質問データベース</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市議会の一般質問・代表質問を、議員別、テーマ別、年度別に整理しています。質問回数や質問項目数のみで議員活動を評価するものではありません。このページには2種類のデータがあります。（1）直近会期の「質問通告書」に基づく予定質問項目（会議録公開前の暫定情報）、（2）公式会議録本文で実際の質問・答弁まで確認できた過去会期のアーカイブです。
        </p>
      </div>

      <div className="mb-5 rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        <p className="font-medium text-on-surface">このデータベースの一次資料</p>
        <ul className="mt-2 space-y-1.5">
          {PRIMARY_SOURCES.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.title}を新しいタブで開く`}
                className={`inline-flex items-center gap-1 text-primary hover:underline ${linkClass}`}
              >
                <GlobeIcon className="h-3.5 w-3.5" />
                {s.label}（{s.title}）
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2">
          質問項目・質問日・議員名は質問通告書と会議録の双方で確認し、内容が異なる場合は会議録を正式な内容として扱っています。会議録で実際に確認できた内容のみを掲載し、全文転載は行っていません。
        </p>
      </div>

      <h2 className="mb-2 px-1 text-base font-semibold text-on-surface">
        1. 最新会期の予定質問項目（質問通告書ベース・会議録公開前）
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="登録済み質問数" value={questions.length} unit="件" />
        <StatCard label="登録済み議員数" value={registeredMemberCount} unit="名" />
        <StatCard label="登録済みテーマ数" value={registeredThemeCount} unit="件" />
        <StatCard label="対象年度数" value={fiscalYearCount} unit="件" />
      </div>

      <div className="sticky top-[57px] z-10 -mx-4 space-y-3 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0 sm:py-2">
        <SearchBar value={query} onChange={setQuery} placeholder="質問内容、議員名、テーマで検索" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="議員" value={memberId} onChange={setMemberId} options={memberOptions} />
          <FilterSelect label="テーマ" value={theme} onChange={setTheme} options={themeOptions} />
          <FilterSelect label="年度" value={fiscalYear} onChange={setFiscalYear} options={fiscalYearOptions} />
          <FilterSelect label="会議" value={session} onChange={setSession} options={sessionOptions} />
          <FilterSelect label="質問区分" value={questionType} onChange={setQuestionType} options={questionTypeOptions} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex shrink-0 items-center gap-2 rounded-full bg-surface-container-high px-4 py-2.5 text-sm text-on-surface-variant shadow-e1 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            <span className="sr-only">並び替え</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as QuestionSortKey)}
              aria-label="並び替え"
              className="bg-transparent text-on-surface focus:outline-none"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
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
      </div>

      {questions.length === 0 ? (
        <p className="mt-3 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          一般質問データを準備中です。公開資料を確認しながら順次追加します。
        </p>
      ) : (
        <>
          <div className="mb-3 mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-on-surface-variant">
              {filteredQuestions.length > 0
                ? `${filteredQuestions.length}件の質問が見つかりました`
                : "条件に一致する一般質問は見つかりませんでした。"}
            </p>
            {filteredQuestions.length > 0 && (
              <CsvDownloadButton filename="nobeoka-general-questions.csv" rows={filteredQuestions} columns={QUESTIONS_CSV_COLUMNS} />
            )}
          </div>
          {filteredQuestions.length > 0 && (
            <ul className="space-y-3">
              {filteredQuestions.map((item) => (
                <GeneralQuestionCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </>
      )}

      <hr className="my-8 border-outline-variant" />

      <h2 className="mb-2 px-1 text-base font-semibold text-on-surface">
        2. 確認済み一般質問アーカイブ（公式会議録ベース）
      </h2>
      <p className="mb-4 px-1 text-xs leading-relaxed text-on-surface-variant">
        延岡市議会の公式会議録本文で、実際の質問・答弁まで確認できた記録です。現在の議員任期（令和5年5月15日、令和5年第1回臨時会以降）に加え、旧任期（令和元年6月〜令和5年3月）の一般質問アーカイブも対象に含みます。要約はAIが作成し人が確認したものですが、正確な内容は必ず公式会議録原文をご確認ください。
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="全収録対象会期（現任期＋旧任期）"
          value={`${coveredRegularSessionCount}/${regularSessionsInPeriod.length}`}
          unit="会期"
          hint="現任期・旧任期を合わせた定例会のうち、確認済み発言が登録済みの会期数。トップページの「現任期対象会期」（現任期の定例会のみが対象）とは集計範囲が異なります。"
        />
        <StatCard label="確認済み発言数" value={verifiedSpeeches.length} unit="件" />
        <StatCard label="質問項目数" value={verifiedQuestionItemCount} unit="件" />
        <StatCard
          label="収録期間"
          value={verifiedEarliestDate && verifiedLatestDate ? `${verifiedEarliestDate.slice(0, 7)}〜${verifiedLatestDate.slice(0, 7)}` : "確認中"}
          compact
        />
      </div>

      {uncoveredRegularSessions.length > 0 && (
        <p className="mb-4 rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
          未収録・会議録未公開の定例会：
          {uncoveredRegularSessions.map((s) => s.title).join("、")}
          （公式会議録の公開を確認でき次第、追加します。「質問なし」ではなく「未確認」です。）
        </p>
      )}

      <div className="sticky top-[57px] z-10 -mx-4 space-y-3 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0 sm:py-2">
        <SearchBar value={vQuery} onChange={setVQuery} placeholder="質問内容、議員名、テーマで検索" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="議員" value={vMemberId} onChange={setVMemberId} options={verifiedMemberOptions} />
          <FilterSelect label="テーマ" value={vTheme} onChange={setVTheme} options={verifiedThemeOptions} />
          <FilterSelect label="年" value={vYear} onChange={setVYear} options={verifiedYearOptions} />
          <FilterSelect label="会議" value={vSessionId} onChange={setVSessionId} options={verifiedSessionOptions} />
          {hasVerifiedFilter && (
            <button
              type="button"
              onClick={clearVerifiedFilters}
              className="shrink-0 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              条件をリセット
            </button>
          )}
        </div>
      </div>

      {verifiedSpeeches.length === 0 ? (
        <p className="mt-3 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          確認済みの会議録ベース一般質問データを準備中です。
        </p>
      ) : (
        <>
          <p className="mb-3 mt-3 text-sm text-on-surface-variant">
            {filteredVerifiedSpeeches.length > 0
              ? `${filteredVerifiedSpeeches.length}件の質問が見つかりました`
              : "条件に一致する一般質問は見つかりませんでした。"}
          </p>
          {filteredVerifiedSpeeches.length > 0 && (
            <ul className="space-y-3">
              {filteredVerifiedSpeeches.map((speech) => {
                const memberLink = findMemberOrFormerLink(speech.memberId, members, formerMembers, archiveMemberProfiles);
                const session = councilSessions.find((s) => s.id === speech.sessionId);
                return (
                  <VerifiedSpeechCard
                    key={speech.id}
                    speech={speech}
                    memberName={memberLink?.name ?? speech.memberId}
                    memberHref={memberLink?.href ?? "/members"}
                    sessionTitle={session?.title ?? speech.sessionId}
                  />
                );
              })}
            </ul>
          )}
        </>
      )}

      <p className="mt-6 px-1 text-xs leading-relaxed text-on-surface-variant">
        このページは、延岡市議会が公開する会議録、一般質問資料、議会映像等を基に整理しています。質問回数、質問項目数、発言時間などの数値のみで議員活動の内容や質を評価できるものではありません。公開資料で確認できない内容は掲載していません。
      </p>

      <a
        href="https://www.youtube.com/@%E5%BB%B6%E5%B2%A1%E5%B8%82%E8%AD%B0%E4%BC%9A"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="延岡市議会の公式YouTubeチャンネルを新しいタブで開く"
        className={`mt-4 flex items-center justify-center gap-1.5 rounded-full bg-surface-container-low px-4 py-3 text-sm font-medium text-on-surface shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
      >
        <GlobeIcon className="h-4 w-4" />
        延岡市議会の公式YouTubeチャンネルを見る
      </a>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="一般質問データベース" />
      </div>
    </div>
  );
}
