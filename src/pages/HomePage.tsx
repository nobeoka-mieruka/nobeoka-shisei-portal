import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import membersData from "../data/members.json";
import billVotesData from "../data/billVotes.json";
import mayorData from "../data/mayor.json";
import generalQuestionsData from "../data/generalQuestions.json";
import type { CouncilMember, Gender, BillVoteItem, Mayor, GeneralQuestionItem } from "../types";
import { allFactions, getFaction } from "../lib/factions";
import { COUNCIL_STATUTORY_SEATS } from "../lib/constants";
import { MemberCard } from "../components/MemberCard";
import { SearchBar } from "../components/SearchBar";
import { FactionFilter } from "../components/FactionFilter";
import { FilterSelect } from "../components/FilterSelect";
import { SortSelect, type SortKey } from "../components/SortSelect";
import { StatCard } from "../components/StatCard";
import { SiteAnalyticsSummary } from "../components/SiteAnalyticsSummary";
import { usePageTitle } from "../hooks/usePageTitle";
import { getLastUpdatedText } from "../lib/lastUpdated";

const members = membersData as CouncilMember[];
const billVotes = billVotesData as BillVoteItem[];
const mayor = mayorData as Mayor;
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const vacantSeats = Math.max(COUNCIL_STATUTORY_SEATS - members.length, 0);
const registeredQuestionCount = generalQuestions.length;

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

const navLinks: { label: string; to?: string; ready: boolean }[] = [
  { label: "市議会議員を見る", to: "/", ready: true },
  { label: "市長情報を見る", to: "/mayor", ready: true },
  { label: "市長公約の進捗を見る", to: "/mayor/policy-progress", ready: true },
  { label: "一般質問を調べる", to: "/questions", ready: true },
  { label: "議案ごとの賛否を見る", to: "/bills/votes", ready: true },
  { label: "延岡市の財政を見る", to: "/finance", ready: true },
  { label: "サイト内を検索する", to: "/search", ready: true },
  { label: "編集方針を見る", to: "/editorial-policy", ready: true },
  { label: "情報提供・訂正依頼を送る", to: "/contact", ready: true },
];

export function HomePage() {
  usePageTitle({
    title: "市長・市議会・議案を分かりやすく",
    description:
      "延岡市長、市議会議員、議案、採決結果、一般質問、報酬などの公開情報を、市民向けに分かりやすく整理した非公式データベースです。",
    path: "/",
  });
  const [searchParams] = useSearchParams();
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
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">
          延岡市政を、もっと分かりやすく
        </h1>
        <p className="mt-2 text-base leading-relaxed text-on-primary-container/80">
          延岡市政見える化ポータルでは、宮崎県延岡市の市長、市議会議員、議案、採決結果、一般質問、報酬などの公開情報を、市民がスマートフォンから確認しやすい形に整理しています。
        </p>
      </div>

      <p className="mb-5 rounded-xl bg-surface-container-low p-3 text-base leading-relaxed text-on-surface-variant">
        このサイトは、公開資料を市民向けに整理した非公式の情報サイトです。正式な情報は、延岡市および延岡市議会の公式資料をご確認ください。
      </p>

      <section aria-labelledby="city-data-summary-heading" className="mb-6">
        <h2 id="city-data-summary-heading" className="mb-2 text-base font-semibold text-on-surface">
          市政データ概要
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="議員定数" value={COUNCIL_STATUTORY_SEATS} unit="名" />
          <StatCard label="市議会議員数" value={members.length} unit="名" />
          <StatCard label="欠員" value={vacantSeats} unit="名" />
          <StatCard label="登録済み議案数" value={billVotes.length} unit="件" />
          <StatCard label="登録済み一般質問数" value={registeredQuestionCount} unit="件" />
          <StatCard label="登録済み市長公約数" value={mayor.pledges.length} unit="件" />
          <StatCard label="最終更新日" value={getLastUpdatedText()} compact />
        </div>
        <Link
          to="/dashboard"
          className="mt-3 flex items-center justify-center rounded-full bg-primary-container px-4 py-3 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          市政ダッシュボードを詳しく見る
        </Link>
      </section>

      <nav aria-label="サイト内のページ" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {navLinks.map((link) =>
          link.ready && link.to ? (
            <Link
              key={link.label}
              to={link.to}
              className="flex items-center justify-center rounded-xl bg-surface-container-low px-3 py-3 text-center text-sm font-medium text-on-surface shadow-e1 transition hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {link.label}
            </Link>
          ) : (
            <span
              key={link.label}
              aria-disabled="true"
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant px-3 py-3 text-center text-sm font-medium text-on-surface-variant"
            >
              {link.label}
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold">
                準備中
              </span>
            </span>
          ),
        )}
      </nav>

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
              className="shrink-0 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              絞り込みを解除
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 mt-3 text-sm text-on-surface-variant">
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
