import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import membersData from "../data/members.json";
// Phase193：トップページで使うのは「公開議案の件数」と「一般質問の件数」だけのため、
// 本文を含む billVotes.json（約2.6MB）・councilSpeechSummaries.json（約6.0MB）ではなく、
// 同じデータから項目を絞って生成した軽量インデックスを読み込む（件数は元データと同一）。
// トップページはエントリチャンクに含まれるため、ここでのimportが初期ロード量を直接左右する。
import billVotesIndexData from "../data/billVotesIndex.json";
import mayorData from "../data/mayor.json";
import generalQuestionsData from "../data/generalQuestions.json";
import councilSpeechIndexData from "../data/councilSpeechIndex.json";
import updateHistoryData from "../data/updateHistory.json";
import type {
  CouncilMember,
  Gender,
  BillVoteIndexItem,
  Mayor,
  GeneralQuestionItem,
  CouncilSpeechSummaryData,
  UpdateHistoryEntry,
} from "../types";
import { allFactions, getFaction } from "../lib/factions";
import { COUNCIL_STATUTORY_SEATS } from "../lib/constants";
import { COUNCIL_GLOSSARY } from "../lib/councilGlossary";
import { MemberCard } from "../components/MemberCard";
import { SearchBar } from "../components/SearchBar";
import { FactionFilter } from "../components/FactionFilter";
import { GlossaryNote } from "../components/GlossaryNote";
import { FilterSelect } from "../components/FilterSelect";
import { SortSelect, type SortKey } from "../components/SortSelect";
import { StatCard } from "../components/StatCard";
import { SiteAnalyticsSummary } from "../components/SiteAnalyticsSummary";
import { JsonLd } from "../components/JsonLd";
import {
  BriefcaseIcon,
  LandmarkIcon,
  BuildingIcon,
  ChartBarIcon,
  SearchIcon,
  QuestionMarkCircleIcon,
  DocumentIcon,
  YenIcon,
  CompassIcon,
} from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getLastUpdatedText } from "../lib/lastUpdated";
import { getSeoForPath } from "../lib/seo";
import { coverageHint } from "../data/dataCoverage";
import { publicBills } from "../lib/billVotes";
import { calculateGeneralQuestionStats } from "../lib/generalQuestionStats";
import { UPDATE_HISTORY_CATEGORY_CLASS, sortUpdateHistoryByDateDesc } from "../lib/updateHistory";
import { formatJapaneseDate } from "../config/site";
import { homeDataCoverageItems } from "../lib/dataCompletenessSummary";
import { formatCoverageRate, COMPLETENESS_STATUS_LABELS } from "../lib/completeness";

const members = membersData as CouncilMember[];
const billVotes = publicBills(billVotesIndexData as BillVoteIndexItem[]);
const mayor = mayorData as Mayor;
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const speechSummaryData = councilSpeechIndexData as unknown as CouncilSpeechSummaryData;
const vacantSeats = Math.max(COUNCIL_STATUTORY_SEATS - members.length, 0);
const questionStats = calculateGeneralQuestionStats(speechSummaryData.members, generalQuestions);
// TASK-077：更新履歴（updateHistory.json）は手動キュレーションされた既存データを
// そのまま再利用する。トップページ専用の別データを新設しない（二重管理を避ける）。
const recentUpdates = sortUpdateHistoryByDateDesc(updateHistoryData as UpdateHistoryEntry[]).slice(0, 4);
// TASK-078：/data-statusと同じsimpleCompleteness()の式・同じ入力データで算出するため、
// トップページと/data-statusの数字が食い違わない（単一の「完成率○%」スコアは作らない）。
const dataCoverageItems = homeDataCoverageItems(questionStats);

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

interface QuickLink {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
}

// TASK-Phase123：トップページ最上部の主導線を「議員／一般質問／議案／市長／財政／市役所の相談先」に
// 絞ったショートカットとして追加する。既存の「目的から探す」カード群（下部）は変更・削除せず、
// スマホでまず押されやすい代表的な入口だけをヒーロー直下にまとめる（重複導線だが誘導を明確化するため許容）。
const quickLinks: QuickLink[] = [
  { icon: BriefcaseIcon, label: "議員を調べる", to: "/people?type=member" },
  { icon: QuestionMarkCircleIcon, label: "一般質問を調べる", to: "/questions" },
  { icon: DocumentIcon, label: "議案を見る", to: "/bills/votes" },
  { icon: LandmarkIcon, label: "市長を調べる", to: "/mayor" },
  { icon: YenIcon, label: "財政を見る", to: "/finance" },
  { icon: CompassIcon, label: "市役所の相談先を見る", to: "/city-guide" },
];

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
      { label: "選挙結果", to: "/elections" },
      { label: "市役所どこに行けばいい？診断", to: "/city-guide" },
      { label: "市役所の組織一覧", to: "/city-organization" },
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
          <label className="flex min-h-11 items-stretch gap-3 rounded-full bg-surface px-4 py-3.5 shadow-e2 transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary sm:py-4">
            <SearchIcon className="h-6 w-6 shrink-0 self-center text-on-surface-variant" aria-hidden="true" />
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
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 ${focusRing}`}
            >
              検索
            </button>
          </label>
        </form>
      </div>

      {/* よく使われる主要導線（ヒーロー直下・最上部） */}
      <nav aria-label="よく使われるページへのショートカット" className="mb-5">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl bg-surface-container-low px-1.5 py-2.5 text-center shadow-e1 transition hover:bg-surface-container ${focusRing}`}
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-xs font-medium leading-tight text-on-surface">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

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
        <Link to="/about" className={`inline-flex min-h-11 items-center rounded text-primary underline-offset-2 hover:underline ${focusRing}`}>
          このサイトについて
        </Link>
        <Link to="/editorial-policy" className={`inline-flex min-h-11 items-center rounded text-primary underline-offset-2 hover:underline ${focusRing}`}>
          編集方針・情報源
        </Link>
        <Link to="/contact" className={`inline-flex min-h-11 items-center rounded text-primary underline-offset-2 hover:underline ${focusRing}`}>
          情報提供・訂正依頼
        </Link>
        <Link to="/updates" className={`inline-flex min-h-11 items-center rounded text-primary underline-offset-2 hover:underline ${focusRing}`}>
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
            label="一般質問（登壇・確認済み件数）"
            value={questionStats.confirmedCount}
            unit="件"
            hint={`議員1名が1回の登壇で行った質問・答弁のやり取り1回分を1件と数えています。現任期対象会期：収録済み${questionStats.collectedSessionCount}／${questionStats.targetSessionCount}会期（現任期＋旧任期の全期間の会期数は一般質問データベースに別掲）`}
          />
          <StatCard
            label="質問項目数"
            value={questionStats.totalQuestionItemCount}
            unit="件"
            hint="1回の登壇（上記「登壇・確認済み件数」）で複数のテーマを質問することが多いため、内訳である質問項目数の方が多くなります。"
          />
          {questionStats.scheduledCount > 0 && (
            <StatCard
              label="会議録未公開会期の予定質問"
              value={questionStats.scheduledCount}
              unit="件"
              hint={questionStats.scheduledSessions
                .map((s) => `${s.sessionName}：${s.count}件／質問通告書ベース${s.newsletterConfirmed ? "（市議会だよりで開催確認済み）" : ""}`)
                .join("　")}
            />
          )}
          <StatCard
            label="登録済み市長公約数"
            value={mayor.pledges.length}
            unit="件"
            hint={`現職市長（${mayor.name}）の公約のみの件数です。歴代の政策・公約アーカイブ全体の件数はデータ収録状況ページに別掲しています。`}
          />
          <StatCard
            label="サイトの最終更新（ビルド日時）"
            value={getLastUpdatedText()}
            compact
            hint="各データの確認日は、それぞれの詳細ページでご確認ください"
          />
        </div>
        <Link
          to="/dashboard"
          className={`mt-3 flex min-h-[44px] items-center justify-center rounded-full bg-primary-container px-4 py-3 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 ${focusRing}`}
        >
          市政ダッシュボードを詳しく見る
        </Link>
      </section>

      {/* TASK-077：/updatesの更新履歴（既存データ）から最新分のみを抜粋表示する。
          トップページ専用の別データは新設しない（二重管理の回避）。 */}
      <section aria-labelledby="recent-updates-heading" className="mb-6">
        <h2 id="recent-updates-heading" className="mb-2 text-base font-semibold text-on-surface">
          最近の更新
        </h2>
        <ul className="space-y-2">
          {recentUpdates.map((entry) => {
            const content = (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                  <span>{formatJapaneseDate(entry.date)}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${UPDATE_HISTORY_CATEGORY_CLASS[entry.category]}`}
                  >
                    {entry.category}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-on-surface">{entry.title}</p>
              </>
            );
            return (
              <li key={entry.id} className="rounded-xl bg-surface-container-low p-3.5 shadow-e1 sm:p-4">
                {entry.linkUrl ? (
                  <Link to={entry.linkUrl} className={`block rounded-lg ${focusRing}`}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
        <Link
          to="/updates"
          className={`mt-3 flex min-h-[44px] items-center justify-center rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-high ${focusRing}`}
        >
          すべての更新を見る
        </Link>
      </section>

      {/* TASK-078：単一の「完成率○%」のような曖昧なスコアは作らず、項目ごとの分子／分母を
          個別に見せる。/data-statusと同じ計算式（simpleCompleteness）・同じ入力データを使う。 */}
      <section aria-labelledby="data-coverage-heading" className="mb-6">
        <h2 id="data-coverage-heading" className="mb-2 text-base font-semibold text-on-surface">
          データ整備状況
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {dataCoverageItems.map((item) => (
            <li key={item.label} className="rounded-xl bg-surface-container-low p-3.5 shadow-e1">
              <p className="text-xs text-on-surface-variant">{item.label}</p>
              {item.kind === "ratio" ? (
                <p className="mt-0.5 text-sm font-semibold text-on-surface">
                  {item.metric.collected}／{item.metric.totalKnown ?? "？"}
                  <span className="ml-1 text-xs font-normal text-on-surface-variant">
                    （{formatCoverageRate(item.metric)}・{COMPLETENESS_STATUS_LABELS[item.metric.status]}）
                  </span>
                </p>
              ) : (
                <p className="mt-0.5 text-sm font-semibold text-on-surface">
                  {item.value}
                  {item.unit}
                </p>
              )}
            </li>
          ))}
        </ul>
        <Link
          to="/data-status"
          className={`mt-3 flex min-h-[44px] items-center justify-center rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-high ${focusRing}`}
        >
          詳細を見る
        </Link>
      </section>

      {/* TASK-076：トップページを「入口」にするための議員一覧への簡易導線。
          特定の議員をおすすめとして目立たせず、名前検索・五十音順・一覧を見る、という
          中立的な入口のみを提示する（絞り込みツール本体は下の折りたたみ、またはpeople側）。 */}
      <section aria-labelledby="member-nav-heading" className="mb-6 rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 id="member-nav-heading" className="text-base font-semibold text-on-surface">
          議員を探す
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          全{members.length}名を五十音順で掲載しています。特定の議員を優先表示することはありません。
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link
            to="/search"
            className={`flex min-h-[44px] items-center justify-center rounded-lg bg-surface-container-high px-3.5 py-2.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${focusRing}`}
          >
            名前で探す
          </Link>
          <Link
            to="/people?type=member"
            className={`flex min-h-[44px] items-center justify-center rounded-lg bg-surface-container-high px-3.5 py-2.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${focusRing}`}
          >
            五十音順で見る
          </Link>
          <Link
            to="/people?type=member"
            className={`flex min-h-[44px] items-center justify-center rounded-lg bg-primary-container px-3.5 py-2.5 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${focusRing}`}
          >
            議員一覧を見る
          </Link>
        </div>
      </section>

      <details className="group mb-2 rounded-xl bg-surface-container-low shadow-e1">
        <summary
          className={`flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3.5 text-lg font-semibold text-on-surface transition hover:bg-surface-container-high ${focusRing}`}
        >
          <span>
            議員を詳しく絞り込む
            <span className="ml-2 text-sm font-normal text-on-surface-variant">（性別・委員会・当選回数等、{members.length}名）</span>
          </span>
          <span aria-hidden className="shrink-0 text-on-surface-variant transition group-open:rotate-180">
            ▼
          </span>
        </summary>

        <div className="px-4 pb-4 sm:px-5">
          <GlossaryNote term="会派" definition={COUNCIL_GLOSSARY["会派"]} className="mb-3" />
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
        </div>
      </details>

      <div className="mt-6">
        <SiteAnalyticsSummary />
      </div>
    </div>
  );
}
