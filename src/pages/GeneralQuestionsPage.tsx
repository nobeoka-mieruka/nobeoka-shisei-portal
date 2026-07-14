import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import generalQuestionsData from "../data/generalQuestions.json";
import membersData from "../data/members.json";
import type { CouncilMember, GeneralQuestionItem } from "../types";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { StatCard } from "../components/StatCard";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LastUpdated } from "../components/LastUpdated";
import { GeneralQuestionCard } from "../components/questions/GeneralQuestionCard";
import { usePageTitle } from "../hooks/usePageTitle";
import { GlobeIcon } from "../components/icons";

const questions = generalQuestionsData as GeneralQuestionItem[];
const members = membersData as CouncilMember[];

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
  usePageTitle("一般質問データベース");
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

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">一般質問データベース</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市議会の一般質問・代表質問を、議員別、テーマ別、年度別に整理しています。質問回数や質問項目数のみで議員活動を評価するものではありません。
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
          <p className="mb-3 mt-3 text-sm text-on-surface-variant">
            {filteredQuestions.length > 0
              ? `${filteredQuestions.length}件の質問が見つかりました`
              : "条件に一致する一般質問は見つかりませんでした。"}
          </p>
          {filteredQuestions.length > 0 && (
            <ul className="space-y-3">
              {filteredQuestions.map((item) => (
                <GeneralQuestionCard key={item.id} item={item} />
              ))}
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
