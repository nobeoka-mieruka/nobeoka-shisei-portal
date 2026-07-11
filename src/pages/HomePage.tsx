import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import membersData from "../data/members.json";
import type { CouncilMember } from "../types";
import { allFactions, getFaction } from "../lib/factions";
import { COUNCIL_STATUTORY_SEATS } from "../lib/constants";
import { MemberCard } from "../components/MemberCard";
import { SearchBar } from "../components/SearchBar";
import { FactionFilter } from "../components/FactionFilter";
import { SortSelect, type SortKey } from "../components/SortSelect";

const members = membersData as CouncilMember[];
const vacantSeats = Math.max(COUNCIL_STATUTORY_SEATS - members.length, 0);

export function HomePage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [factionId, setFactionId] = useState<string | "all">(searchParams.get("faction") ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>("kana");

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
      return matchesQuery && matchesFaction;
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
  }, [query, factionId, sortKey]);

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">
          市議会議員{members.length}名
        </h1>
        <p className="mt-1 text-xs text-on-primary-container/70">
          定数{COUNCIL_STATUTORY_SEATS}名／現員{members.length}名／欠員{vacantSeats}名
        </p>
        <p className="mt-2 text-sm text-on-primary-container/80">
          市長・市議会・議案・政治資金・財政など、市政情報を分かりやすく公開する市民向けデータベース
        </p>
      </div>

      <div className="sticky top-[57px] z-10 -mx-4 space-y-3 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0 sm:py-2">
        <SearchBar value={query} onChange={setQuery} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <FactionFilter factions={allFactions} selected={factionId} onChange={setFactionId} />
          <SortSelect value={sortKey} onChange={setSortKey} />
        </div>
      </div>

      <p className="mb-3 mt-3 text-sm text-on-surface-variant">{filteredMembers.length}名を表示中</p>

      {filteredMembers.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredMembers.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          該当する議員が見つかりませんでした。
        </p>
      )}
    </div>
  );
}
