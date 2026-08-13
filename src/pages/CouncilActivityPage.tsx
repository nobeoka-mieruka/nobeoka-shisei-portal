import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { FactionChip } from "../components/FactionChip";
import { Avatar } from "../components/Avatar";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { getFaction, allFactions } from "../lib/factions";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  activityTargetPeriodLabel,
  getAllCurrentMemberActivity,
  getIndicatorCoverage,
  metricByKey,
  topByMetric,
  type MemberActivityEntry,
} from "../lib/councilActivityBarometer";
import { ActivityRadarChart } from "../components/council/ActivityRadarChart";
import { sortedCommittees, committeesForMember } from "../lib/committees";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

type SortKey = "name" | "question" | "speech" | "voting" | "disclosure";

const SORTABLE_COLUMNS: { key: SortKey; label: string; metricKey?: string }[] = [
  { key: "name", label: "氏名" },
  { key: "question", label: "一般質問実施率", metricKey: "question" },
  { key: "speech", label: "議会内発言", metricKey: "speech" },
  { key: "voting", label: "議案等の意思表示", metricKey: "voting" },
  { key: "disclosure", label: "情報発信・プロフィール充足度", metricKey: "disclosure" },
];

const NOT_SCORED_COLUMNS: { key: string; label: string }[] = [
  { key: "attendance", label: "出席状況" },
  { key: "proposal", label: "請願・提案等" },
];

function sortEntries(entries: MemberActivityEntry[], sortKey: SortKey, dir: "asc" | "desc"): MemberActivityEntry[] {
  const sorted = [...entries];
  if (sortKey === "name") {
    sorted.sort((a, b) => a.member.nameKana.localeCompare(b.member.nameKana, "ja"));
  } else {
    sorted.sort((a, b) => {
      const av = metricByKey(a.metrics, sortKey)?.value;
      const bv = metricByKey(b.metrics, sortKey)?.value;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return bv - av;
    });
  }
  if (dir === "asc") sorted.reverse();
  return sorted;
}

function MetricBar({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-on-surface-variant">評価対象外</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-surface-container-high sm:w-24">
        <div className="h-full rounded-full bg-secondary" style={{ width: `${Math.round(value)}%` }} />
      </div>
      <span className="tabular-nums text-xs text-on-surface-variant">{Math.round(value)}</span>
    </div>
  );
}

export function CouncilActivityPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const [searchParams, setSearchParams] = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [nameQuery, setNameQuery] = useState("");
  const [factionFilter, setFactionFilter] = useState("all");
  const [committeeFilter, setCommitteeFilter] = useState("all");
  // 比較状態はURLクエリ（?compare=m01,m02,m03）と同期し、URLを共有すれば同じ比較結果を再現できる。
  // 新規ルート・prerender対象は増やさず、既存の/council-activityへのクエリ文字列のみで表現する。
  const [compareIds, setCompareIds] = useState<string[]>(() => {
    const raw = searchParams.get("compare");
    return raw ? raw.split(",").filter(Boolean).slice(0, 3) : [];
  });

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (compareIds.length > 0) next.set("compare", compareIds.join(","));
    else next.delete("compare");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareIds]);

  const allEntries = useMemo(() => getAllCurrentMemberActivity(), []);
  const targetPeriod = useMemo(() => activityTargetPeriodLabel(), []);
  const coverage = useMemo(() => getIndicatorCoverage(), []);

  const filteredEntries = useMemo(() => {
    return allEntries.filter((e) => {
      if (factionFilter !== "all" && e.member.factionId !== factionFilter) return false;
      if (committeeFilter !== "all" && !committeesForMember(e.member.id).some((c) => c.id === committeeFilter)) return false;
      if (nameQuery.trim() && !e.member.name.includes(nameQuery.trim()) && !e.member.nameKana.includes(nameQuery.trim())) {
        return false;
      }
      return true;
    });
  }, [allEntries, factionFilter, committeeFilter, nameQuery]);

  const sorted = useMemo(() => sortEntries(filteredEntries, sortKey, sortDir), [filteredEntries, sortKey, sortDir]);

  const speechTop3 = useMemo(() => topByMetric(allEntries, "speech", 3), [allEntries]);
  const questionFull = useMemo(
    () => allEntries.filter((e) => metricByKey(e.metrics, "question")?.value === 100),
    [allEntries],
  );
  const disclosureTop3 = useMemo(() => topByMetric(allEntries, "disclosure", 3), [allEntries]);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const compareEntries = allEntries.filter((e) => compareIds.includes(e.member.id));
  const committeeOptions = sortedCommittees().map((c) => ({ value: c.id, label: c.name }));
  const factionOptions = allFactions.map((f) => ({ value: f.id, label: f.name }));

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold leading-snug text-on-primary-container sm:text-2xl">
          延岡市議会 議員活動バロメーター
        </h1>
        <p className="mt-2 text-sm text-on-primary-container/80">公開資料から見える5つの指標</p>
        <p className="mt-1 text-xs text-on-primary-container/70">対象期間：{targetPeriod}</p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        本ページは、公開資料から確認できる活動を一定の基準で整理したものです。議員の能力、政策の質、政治的立場、人物評価を示すものではありません。発言数が多いこと自体を政策成果として評価するものではありません。資料の公開状況によって確認可能な情報量に差があります。詳しい算定方法は
        <Link to="/methodology/activity-radar" className={`font-medium text-primary hover:underline ${linkClass}`}>
          こちら
        </Link>
        、出典は各項目のリンク先でご確認いただけます。
      </p>

      <SectionCard title="データ充足状況">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          「データ充足率」は、対象議員{coverage[0]?.totalCount ?? 26}名のうち何名分の指標を算定できたかの割合です。「議員活動点」（右側のレーダーチャート・実数）とは別物であり、充足率が低い指標は議員の活動が少ないという意味ではなく、本サイトがまだ一次資料を収録できていないことを示します。
        </p>
        <ul className="space-y-2">
          {coverage.map((c) => (
            <li key={c.indicatorKey}>
              <div className="flex items-center justify-between gap-2 text-xs text-on-surface">
                <span>{c.indicatorLabel}</span>
                <span className="text-on-surface-variant">
                  {c.coveragePercent === 0 ? "未収録" : `${c.completeCount}／${c.totalCount}名（${c.coveragePercent}%）`}
                </span>
              </div>
              <div
                className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high"
                role="img"
                aria-label={`${c.indicatorLabel}：対象${c.totalCount}名中${c.completeCount}名分のデータを収録済み（${c.coveragePercent}%）`}
              >
                <div
                  className={`h-full rounded-full ${c.coveragePercent === 0 ? "bg-outline-variant" : "bg-primary"}`}
                  style={{ width: `${Math.max(c.coveragePercent, c.coveragePercent === 0 ? 0 : 4)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="5つの指標について">
        <ul className="space-y-2 text-sm leading-relaxed text-on-surface">
          <li>
            <span className="font-medium">一般質問</span>：定例会で一般質問を実施した割合。
          </li>
          <li>
            <span className="font-medium">議会内発言</span>：公開会議録から確認できた発言。
          </li>
          <li>
            <span className="font-medium">請願・提案等</span>：公開資料から確認できる紹介議員・提出等への関与（現在、議員別に確認できる一次資料が未収録のため全議員「評価対象外」）。
          </li>
          <li>
            <span className="font-medium">情報発信</span>：本人公式と確認できたWeb/SNS媒体を含む、プロフィール情報の充足状況。
          </li>
          <li>
            <span className="font-medium">出席状況</span>：公開資料から確認可能な本会議・委員会等の出席状況（現在、個別の出席記録が未収録のため全議員「評価対象外」）。
          </li>
        </ul>
        <Link
          to="/methodology/activity-radar"
          className={`mt-3 inline-block text-sm font-medium text-primary hover:underline ${linkClass}`}
        >
          算定方法・計算式・出典を見る →
        </Link>
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SectionCard title="議会内発言 TOP3">
          {speechTop3.length === 0 ? (
            <p className="text-sm text-on-surface-variant">確認できるデータがまだありません。</p>
          ) : (
            <ol className="space-y-1.5 text-sm text-on-surface">
              {speechTop3.map((e, i) => (
                <li key={e.member.id} className="flex items-center justify-between gap-2">
                  <Link to={`/council-activity/${e.member.id}`} className={`hover:underline ${linkClass}`}>
                    {i + 1}位　{e.member.name}
                  </Link>
                  <span className="tabular-nums text-xs text-on-surface-variant">
                    {Math.round(metricByKey(e.metrics, "speech")!.value!)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
        <SectionCard title="一般質問実施率100%">
          <p className="text-sm text-on-surface">{questionFull.length}名</p>
          {questionFull.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-on-surface-variant">
              {questionFull.map((e) => (
                <li key={e.member.id}>
                  <Link to={`/council-activity/${e.member.id}`} className={`hover:underline ${linkClass}`}>
                    {e.member.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="情報発信・プロフィール充足度 TOP3">
          {disclosureTop3.length === 0 ? (
            <p className="text-sm text-on-surface-variant">確認できるデータがまだありません。</p>
          ) : (
            <ol className="space-y-1.5 text-sm text-on-surface">
              {disclosureTop3.map((e, i) => (
                <li key={e.member.id} className="flex items-center justify-between gap-2">
                  <Link to={`/council-activity/${e.member.id}`} className={`hover:underline ${linkClass}`}>
                    {i + 1}位　{e.member.name}
                  </Link>
                  <span className="tabular-nums text-xs text-on-surface-variant">
                    {Math.round(metricByKey(e.metrics, "disclosure")!.value!)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>

      <SectionCard title={`全議員比較（${sorted.length}／${allEntries.length}名）`}>
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          列見出しをクリックすると並べ替えできます。「出席状況」「請願・提案等」は、本サイトが議員別の一次資料をまだ収録できていないため、全議員「評価対象外」として区別表示しています（0点ではありません）。合算した「総合順位」は、単一の数値だけで議員の活動全体を評価してしまう誤解を避けるため、掲載していません。現職議員は全員同一の選挙日（令和5年4月23日執行）から在職しているため、対象期間・在職期間の差による不公平は生じていません。
        </p>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="sm:w-56">
            <SearchBar value={nameQuery} onChange={setNameQuery} placeholder="氏名で検索" />
          </div>
          <FilterSelect label="会派" value={factionFilter} onChange={setFactionFilter} options={factionOptions} />
          <FilterSelect label="委員会" value={committeeFilter} onChange={setCommitteeFilter} options={committeeOptions} />
          {(nameQuery || factionFilter !== "all" || committeeFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setNameQuery("");
                setFactionFilter("all");
                setCommitteeFilter("all");
              }}
              className={`self-start rounded-full px-3 py-2 text-xs text-on-surface-variant underline ${linkClass}`}
            >
              絞り込みをクリア
            </button>
          )}
        </div>

        {sorted.length === 0 && (
          <p className="rounded-lg bg-surface-container-high p-4 text-sm text-on-surface-variant">
            条件に一致する議員が見つかりませんでした。検索語や絞り込み条件をご確認ください。
          </p>
        )}

        {/* PC: 表形式 */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
                <th className="w-8 py-2 pr-2">比較</th>
                {SORTABLE_COLUMNS.map((col) => (
                  <th key={col.key} className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={`inline-flex items-center gap-1 font-semibold hover:underline ${linkClass}`}
                      aria-label={`${col.label}で並べ替え`}
                    >
                      {col.label}
                      {sortKey === col.key && <span aria-hidden="true">{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                ))}
                {NOT_SCORED_COLUMNS.map((col) => (
                  <th key={col.key} className="py-2 pr-3 font-semibold">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const faction = getFaction(e.member.factionId);
                return (
                  <tr key={e.member.id} className="border-b border-outline-variant/60 align-middle">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(e.member.id)}
                        onChange={() => toggleCompare(e.member.id)}
                        disabled={!compareIds.includes(e.member.id) && compareIds.length >= 3}
                        aria-label={`${e.member.name}を比較対象に選ぶ`}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Link
                        to={`/council-activity/${e.member.id}`}
                        className={`font-medium text-on-surface hover:underline ${linkClass}`}
                      >
                        {e.member.name}
                      </Link>
                      {faction && <FactionChip faction={faction} className="ml-2" />}
                    </td>
                    <td className="py-2 pr-3">
                      <MetricBar value={metricByKey(e.metrics, "question")!.value} />
                    </td>
                    <td className="py-2 pr-3">
                      <MetricBar value={metricByKey(e.metrics, "speech")!.value} />
                    </td>
                    <td className="py-2 pr-3">
                      <MetricBar value={metricByKey(e.metrics, "voting")!.value} />
                    </td>
                    <td className="py-2 pr-3">
                      <MetricBar value={metricByKey(e.metrics, "disclosure")!.value} />
                    </td>
                    <td className="py-2 pr-3 text-xs text-on-surface-variant">評価対象外</td>
                    <td className="py-2 pr-3 text-xs text-on-surface-variant">評価対象外</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* スマホ：カード形式 */}
        <div className="space-y-3 sm:hidden">
          <div className="flex flex-wrap gap-2 text-xs">
            {(["name", "question", "speech", "voting", "disclosure"] as SortKey[]).map((k) => {
              const col = SORTABLE_COLUMNS.find((c) => c.key === k)!;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleSort(k)}
                  className={`rounded-full border px-2.5 py-1 ${
                    sortKey === k ? "border-primary bg-primary-container text-on-primary-container" : "border-outline-variant text-on-surface-variant"
                  } ${linkClass}`}
                >
                  {col.label}
                  {sortKey === k && (sortDir === "asc" ? "▲" : "▼")}
                </button>
              );
            })}
          </div>
          <ul className="space-y-2">
            {sorted.map((e) => {
              const faction = getFaction(e.member.factionId);
              return (
                <li key={e.member.id} className="rounded-lg border border-outline-variant p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/council-activity/${e.member.id}`} className={`font-medium text-on-surface hover:underline ${linkClass}`}>
                      {e.member.name}
                    </Link>
                    <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(e.member.id)}
                        onChange={() => toggleCompare(e.member.id)}
                        disabled={!compareIds.includes(e.member.id) && compareIds.length >= 3}
                        aria-label={`${e.member.name}を比較対象に選ぶ`}
                        className="h-4 w-4"
                      />
                      比較
                    </label>
                  </div>
                  {faction && <FactionChip faction={faction} className="mt-1" />}
                  <dl className="mt-2 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-on-surface-variant">一般質問</dt>
                      <dd>
                        <MetricBar value={metricByKey(e.metrics, "question")!.value} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-on-surface-variant">議会内発言</dt>
                      <dd>
                        <MetricBar value={metricByKey(e.metrics, "speech")!.value} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-on-surface-variant">議案等の意思表示</dt>
                      <dd>
                        <MetricBar value={metricByKey(e.metrics, "voting")!.value} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-on-surface-variant">情報発信</dt>
                      <dd>
                        <MetricBar value={metricByKey(e.metrics, "disclosure")!.value} />
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      </SectionCard>

      {compareEntries.length > 0 && (
        <SectionCard title={`比較（${compareEntries.length}名選択中）`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {compareEntries.map((e) => (
              <div key={e.member.id} className="rounded-lg border border-outline-variant p-3 text-center">
                <Avatar name={e.member.name} photoUrl={e.member.photoUrl} size="sm" className="mx-auto" />
                <p className="mt-1.5 text-sm font-medium text-on-surface">{e.member.name}</p>
                <ActivityRadarChart metrics={e.metrics} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCompareIds([])}
            className={`mt-3 text-xs font-medium text-primary hover:underline ${linkClass}`}
          >
            比較をクリア
          </button>
        </SectionCard>
      )}

      <p className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        このページは、延岡市政見える化ポータルの編集方針（特定の政党・会派・議員・候補者・政治団体を支持、推薦、批判しない）に基づいて作成しています。数値の算定に誤りや改善の余地があるとお気づきの場合は、下記からお知らせください。
      </p>

      <CorrectionRequestButton pageName="議員活動バロメーター" />

      <LastUpdated className="mt-2" />
    </div>
  );
}
