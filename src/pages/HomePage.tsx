import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import membersData from "../data/members.json";
import billVotesData from "../data/billVotes.json";
import mayorData from "../data/mayor.json";
import generalQuestionsData from "../data/generalQuestions.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import type {
  CouncilMember,
  Gender,
  BillVoteItem,
  Mayor,
  GeneralQuestionItem,
  CouncilSpeechSummaryData,
} from "../types";
import { allFactions, getFaction } from "../lib/factions";
import { COUNCIL_STATUTORY_SEATS } from "../lib/constants";
import { MemberCard } from "../components/MemberCard";
import { SearchBar } from "../components/SearchBar";
import { FactionFilter } from "../components/FactionFilter";
import { FilterSelect } from "../components/FilterSelect";
import { SortSelect, type SortKey } from "../components/SortSelect";
import { StatCard } from "../components/StatCard";
import { SiteAnalyticsSummary } from "../components/SiteAnalyticsSummary";
import { JsonLd } from "../components/JsonLd";
import { BriefcaseIcon, LandmarkIcon, BuildingIcon, ChartBarIcon, SearchIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getLastUpdatedText } from "../lib/lastUpdated";
import { getSeoForPath } from "../lib/seo";
import { coverageHint } from "../data/dataCoverage";
import { publicBills } from "../lib/billVotes";
import { calculateGeneralQuestionStats } from "../lib/generalQuestionStats";

const members = membersData as CouncilMember[];
const billVotes = publicBills(billVotesData as BillVoteItem[]);
const mayor = mayorData as Mayor;
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const vacantSeats = Math.max(COUNCIL_STATUTORY_SEATS - members.length, 0);
const questionStats = calculateGeneralQuestionStats(speechSummaryData.members, generalQuestions);

const genderLabels: Record<Gender, string> = {
  male: "男性",
  female: "女性",
  other: "その他",
  undisclosed: "非公開",
  unknown: "不明",
};

const genderOptions = Array.from(new Set(members.map((m) => m.gender)))
  .sort()
  .map((g) => ({ value: g, label: genderLabels[g] }));

const committeeOptions = Array.from(new Set(members.flatMap((m) => m.committees)))
  .sort((a, b) => a.localeCompare(b, "ja"))
  .map((c) => ({ value: c, label: c }));

const termCountOptions = Array.from(new Set(members.map((m) => m.termCount).filter((t): t is number => !!t)))
  .sort((a, b) => a - b)
  .map((t) => ({ value: String(t), label: `当選${t}回` }));

const snsOptions = [
  { value: "has", label: "SNS登録あり" },
  { value: "none", label: "SNS未登録" },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

interface CategoryCard {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  title: string;
  description: string;
  links: { label: string; to: string }[];
}

const categoryCards: CategoryCard[] = [
  {
    icon: BriefcaseIcon,
    iconBg: "bg-primary-container text-on-primary-container",
    title: "人物を調べる",
    description: "議員・市長・特別職を、現職・元職を問わず確認できます。",
    links: [
      { label: "現職議員", to: "/people?type=member" },
      { label: "歴代議員", to: "/members/former" },
      { label: "市長", to: "/mayor" },
      { label: "歴代市長", to: "/mayors" },
      { label: "副市長・教育長・行政委員会", to: "/city-officials" },
    ],
  },
  {
    icon: LandmarkIcon,
    iconBg: "bg-secondary-container text-on-secondary-container",
    title: "市議会を調べる",
    description: "一般質問、議案、委員会、採決結果を確認できます。",
    links: [
      { label: "一般質問", to: "/questions" },
      { label: "議案ごとの賛否", to: "/bills/votes" },
      { label: "委員会", to: "/committees" },
      { label: "定例会・議会資料", to: "/council-documents" },
      { label: "テーマから探す", to: "/themes" },
    ],
  },
  {
    icon: BuildingIcon,
    iconBg: "bg-tertiary-container text-on-tertiary-container",
    title: "市政を調べる",
    description: "条例、請願・陳情、財政、公約、市役所の相談先を確認できます。",
    links: [
      { label: "条例", to: "/ordinances" },
      { label: "請願・陳情", to: "/petitions" },
      { label: "延岡市の財政", to: "/finance" },
      { label: "市長公約の進捗", to: "/mayor/policy-progress" },
      { label: "市政年表", to: "/history" },
      { label: "市役所どこに行けばいい？診断", to: "/city-guide" },
    ],
  },
  {
    icon: ChartBarIcon,
    iconBg: "bg-primary-container text-on-primary-container",
    title: "データを見る",
    description: "件数の推移、比較、報酬、データの収録状況を確認できます。",
    links: [
      { label: "市政ダッシュボード", to: "/dashboard" },
      { label: "比較する", to: "/compare" },
      { label: "報酬を見る", to: "/compensation" },
      { label: "政治資金収支報告書", to: "/political-funds" },
      { label: "データ収録状況", to: "/data-status" },
    ],
  },
];

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams] = useSearchParams();
  const [heroQuery, setHeroQuery] = useState("");
  const [query, setQuery] = useState("");
  const [factionId, setFactionId] = useState<string | "all">(searchParams.get("faction") ?? "all");
  const [gender, setGender] = useState<string>("all");
  const [committee, setCommittee] = useState<string>("all");
  const [termCount, setTermCount] = useState<string>("all");
  const [sns, setSns] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("kana");

  const hasActiveFilter =
    query !== "" ||
    factionId !== "all" ||
    gender !== "all" ||
    committee !== "all" ||
    termCount !== "all" ||
    sns !== "all";

  const clearFilters = () => {
    setQuery("");
    setFactionId("all");
    setGender("all");
    setCommittee("all");
    setTermCount("all");
    setSns("all");
  };

  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = heroQuery.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const filteredMembers = useMemo(() => {
    const q = query.trim();
    let list = members.filter((m) => {
      const matchesQuery =
        q === "" ||
        m.name.includes(q) ||
        m.nameKana.includes(q) ||
        getFaction(m.factionId).name.includes(q) ||
        m.committees.some((c) => c.includes(q));
      const matchesFaction = factionId === "all" || m.factionId === factionId;
      const matchesGender = gender === "all" || m.gender === gender;
      const matchesCommittee = committee === "all" || m.committees.includes(committee);
      const matchesTermCount = termCount === "all" || String(m.termCount ?? "") === termCount;
      const matchesSns = sns === "all" || (sns === "has" ? m.sns.length > 0 : m.sns.length === 0);
      return matchesQuery && matchesFaction && matchesGender && matchesCommittee && matchesTermCount && matchesSns;
    });

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "ageAsc":
          return (a.age ?? Infinity) - (b.age ?? Infinity);
        case "ageDesc":
          return (b.age ?? -Infinity) - (a.age ?? -Infinity);
        case "termAsc":
          return (a.termCount ?? Infinity) - (b.termCount ?? Infinity);
        case "termDesc":
          return (b.termCount ?? -Infinity) - (a.termCount ?? -Infinity);
        case "faction": {
          const fa = getFaction(a.factionId).name;
          const fb = getFaction(b.factionId).name;
          return fa.localeCompare(fb, "ja") || a.nameKana.localeCompare(b.nameKana, "ja");
        }
        case "kana":
        default:
          return a.nameKana.localeCompare(b.nameKana, "ja");
      }
    });

    return list;
  }, [query, factionId, gender, committee, termCount, sns, sortKey]);

  return (
    <div className="px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}

      {/* ① ヒーロー */}
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-7">
        <h1 className="text-2xl font-bold leading-snug text-on-primary-container sm:text-3xl">
          延岡市政を、調べる・探す・比較する
        </h1>
        <p className="mt-3 text-base leading-relaxed text-on-primary-container/80">
          宮崎県延岡市の市長、市議会議員、議案、一般質問、財政、報酬などの公開情報を、スマートフォンからでも分かりやすく確認できる非公式サイトです。
        </p>
        <form onSubmit={handleHeroSearchSubmit} className="mt-4" role="search">
          <label className="flex items-center gap-3 rounded-full bg-surface px-4 py-3.5 shadow-e2 transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary sm:py-4">
            <SearchIcon className="h-6 w-6 shrink-0 text-on-surface-variant" aria-hidden="true" />
            <input
              type="search"
              value={heroQuery}
              onChange={(e) => setHeroQuery(e.target.value)}
              placeholder="人物名、議案、テーマなどでサイト内を検索"
              aria-label="サイト内検索"
              className="w-full min-w-0 bg-transparent text-base text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
            <button
              type="submit"
              className={`shrink-0 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 ${focusRing}`}
            >
              検索
            </button>
          </label>
        </form>
      </div>

      {/* ② サイト概要 */}
      <p className="mb-5 rounded-xl bg-surface-container-low p-3.5 text-sm leading-relaxed text-on-surface-variant">
        このサイトは、延岡市・延岡市議会が公表する資料をもとに整理した非公式の情報サイトです。特定の政党・会派・議員・候補者への支持や批判、独自の採点や順位付けは行っていません。正式な情報は、延岡市および延岡市議会の公式資料をご確認ください。
      </p>

      {/* ③ 目的から探す（カテゴリカード） */}
      <section aria-labelledby="purpose-nav-heading" className="mb-6">
        <h2 id="purpose-nav-heading" className="mb-3 px-1 text-lg font-semibold text-on-surface">
          目的から探す
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categoryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="flex flex-col rounded-2xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${card.iconBg}`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-base font-semibold text-on-surface sm:text-lg">{card.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">{card.description}</p>
                <ul className="mt-3 space-y-1.5">
                  {card.links.map((link) => (
                    <li key={link.to + link.label}>
                      <Link
                        to={link.to}
                        className={`flex min-h-[44px] items-center rounded-lg bg-surface-container-high px-3.5 py-2.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${focusRing}`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <Link
            to="/search"
            className={`flex flex-col justify-center rounded-2xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container sm:p-5 ${focusRing}`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
              <SearchIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-base font-semibold text-on-surface sm:text-lg">サイト内を検索する</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-on-surface-variant">
              議員名、議案名、テーマなど、サイト全体を横断して探せます。
            </p>
          </Link>
        </div>
      </section>

      {/* このサイトについて・編集方針等の信頼性情報 */}
      <nav aria-label="サイトの信頼性に関する情報" className="mb-6 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-sm">
        <Link to="/about" className={`rounded text-primary underline-offset-2 hover:underline ${focusRing}`}>
          このサイトについて
        </Link>
        <Link to="/editorial-policy" className={`rounded text-primary underline-offset-2 hover:underline ${focusRing}`}>
          編集方針・情報源
        </Link>
        <Link to="/contact" className={`rounded text-primary underline-offset-2 hover:underline ${focusRing}`}>
          情報提供・訂正依頼
        </Link>
        <Link to="/updates" className={`rounded text-primary underline-offset-2 hover:underline ${focusRing}`}>
          更新履歴
        </Link>
      </nav>

      <section aria-labelledby="city-data-summary-heading" className="mb-6">
        <h2 id="city-data-summary-heading" className="mb-2 text-base font-semibold text-on-surface">
          市政データ概要
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="議員定数" value={COUNCIL_STATUTORY_SEATS} unit="名" />
          <StatCard label="市議会議員数" value={members.length} unit="名" />
          <StatCard label="欠員" value={vacantSeats} unit="名" />
          <StatCard
            label="登録済み議案数"
            value={billVotes.length}
            unit="件"
            hint={coverageHint("billVotes", billVotes.length)}
          />
          <StatCard
            label="会議録確認済み一般質問"
            value={questionStats.confirmedCount}
            unit="件"
            hint={`現任期対象会期：収録済み${questionStats.collectedSessionCount}／${questionStats.targetSessionCount}会期（現任期＋旧任期の全期間の会期数は一般質問データベースに別掲）`}
          />
          {questionStats.scheduledCount > 0 && (
            <StatCard
              label="最新会期の予定質問"
              value={questionStats.scheduledCount}
              unit="件"
              hint={questionStats.scheduledSessionName ? `${questionStats.scheduledSessionName}／質問通告書ベース` : undefined}
            />
          )}
          <StatCard label="登録済み市長公約数" value={mayor.pledges.length} unit="件" />
          <StatCard label="最終更新日" value={getLastUpdatedText()} compact />
        </div>
        <Link
          to="/dashboard"
          className={`mt-3 flex min-h-[44px] items-center justify-center rounded-full bg-primary-container px-4 py-3 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 ${focusRing}`}
        >
          市政ダッシュボードを詳しく見る
        </Link>
      </section>

      <section aria-labelledby="current-members-heading" className="mb-2">
        <h2 id="current-members-heading" className="mb-2 px-1 text-lg font-semibold text-on-surface">
          現職議員を探す
        </h2>
      </section>

      <div className="sticky top-[57px] z-10 -mx-4 space-y-3 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0 sm:py-2">
        <SearchBar value={query} onChange={setQuery} />
        <FactionFilter factions={allFactions} selected={factionId} onChange={setFactionId} />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="性別" value={gender} onChange={setGender} options={genderOptions} />
          <FilterSelect label="委員会" value={committee} onChange={setCommittee} options={committeeOptions} />
          <FilterSelect label="当選回数" value={termCount} onChange={setTermCount} options={termCountOptions} />
          <FilterSelect label="SNS" value={sns} onChange={setSns} options={snsOptions} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SortSelect value={sortKey} onChange={setSortKey} />
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className={`shrink-0 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high ${focusRing}`}
            >
              絞り込みを解除
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 mt-3 text-sm text-on-surface-variant" aria-live="polite" aria-atomic="true">
        {members.length}名中{filteredMembers.length}名を表示
      </p>

      {filteredMembers.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {filteredMembers.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          条件に一致する議員が見つかりませんでした。検索条件を変更してください。
        </p>
      )}

      <div className="mt-6">
        <SiteAnalyticsSummary />
      </div>
    </div>
  );
}
