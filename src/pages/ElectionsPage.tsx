import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { StatCard } from "../components/StatCard";
import { EmptyState } from "../components/EmptyState";
import { GlossaryNote } from "../components/GlossaryNote";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { electionResults } from "../lib/elections";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

type TypeFilter = "all" | "mayor" | "councilMember";
type SortOrder = "newest" | "oldest";

const TYPE_LABEL: Record<"mayor" | "councilMember", string> = {
  mayor: "市長選挙",
  councilMember: "市議会議員選挙",
};

export function ElectionsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [nameQuery, setNameQuery] = useState("");

  const sortedAll = useMemo(() => [...electionResults].sort((a, b) => b.electionDate.localeCompare(a.electionDate)), []);
  const sorted = sortOrder === "newest" ? sortedAll : [...sortedAll].reverse();
  const normalizedQuery = nameQuery.trim();
  const filtered = sorted
    .filter((e) => typeFilter === "all" || e.electionType === typeFilter)
    .filter((e) => !normalizedQuery || e.candidates.some((c) => c.name.includes(normalizedQuery) || (c.nameKana ?? "").includes(normalizedQuery)));

  const mayorCount = sortedAll.filter((e) => e.electionType === "mayor").length;
  const councilCount = sortedAll.filter((e) => e.electionType === "councilMember").length;
  const totalCandidates = sortedAll.reduce((n, e) => n + e.candidates.length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">選挙結果一覧</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市長選挙・延岡市議会議員選挙の候補者名・党派・得票数・当落・投票率を、延岡市選挙管理委員会・宮崎県選挙管理委員会等の公表資料に基づいて整理しています。当サイトは公式サイトではなく、候補者・当選者の評価や推薦は行っていません。
        </p>
      </div>

      <GlossaryNote
        term="選挙結果データについて"
        definition="取得できた範囲の選挙のみ収録しています。取得できていない年代の選挙が存在しないという意味ではありません。同姓同名の候補者は、得票数の一致など確実な根拠がある場合のみ、議員・元議員・市長のページへリンクしています。"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="収録選挙数" value={sorted.length} unit="回" />
        <StatCard label="市長選挙" value={mayorCount} unit="回" />
        <StatCard label="市議会議員選挙" value={councilCount} unit="回" />
        <StatCard label="候補者延べ数" value={totalCandidates} unit="名" />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="選挙種別で絞り込み">
        {(
          [
            ["all", "すべて"],
            ["mayor", "市長選挙"],
            ["councilMember", "市議会議員選挙"],
          ] as [TypeFilter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={typeFilter === value}
            onClick={() => setTypeFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${linkClass} ${
              typeFilter === value
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="election-name-search" className="sr-only">
          候補者名で検索
        </label>
        <input
          id="election-name-search"
          type="search"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder="候補者名で検索（例：稲田）"
          className={`min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant ${linkClass}`}
        />
        <button
          type="button"
          onClick={() => setSortOrder((s) => (s === "newest" ? "oldest" : "newest"))}
          className={`shrink-0 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container ${linkClass}`}
        >
          {sortOrder === "newest" ? "新しい順" : "古い順"}（切替）
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="該当する選挙データはありません" />
      ) : (
        <ul className="space-y-3">
          {filtered.map((e) => {
            const electedCount = e.candidates.filter((c) => c.elected).length;
            return (
              <li key={e.id}>
                <Link
                  to={`/elections/${e.id}`}
                  className={`block rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high sm:p-5 ${linkClass}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-on-surface">{e.electionName}</p>
                    <span className="shrink-0 rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
                      {TYPE_LABEL[e.electionType]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">投票日：{e.electionDate}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    定数：{e.seats ?? "確認中"}／候補者数：{e.candidateCount ?? e.candidates.length}／当選者数：{electedCount}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    投票率：{e.turnoutPercent != null ? `${e.turnoutPercent}%` : "確認中"}
                  </p>
                  <p className="mt-2 border-t border-outline-variant pt-2 text-sm text-primary">候補者一覧・得票数を見る</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <LastUpdated className="mt-4" />
      <CorrectionRequestButton pageName="選挙結果一覧" />
    </div>
  );
}
