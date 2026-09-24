import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useInitialSearchParams } from "../hooks/useHydratedSearchParams";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { FactionChip } from "../components/FactionChip";
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
  getIndicatorCoverageDetail,
  getEvidenceAvailabilitySummary,
  get156CellMatrix,
  metricByKey,
  decisionSubmitterCountFor,
  informationChannelCount,
  getMemberActivityRecord,
  type MemberActivityEntry,
} from "../lib/councilActivityBarometer";
import { sortedCommittees, committeesForMember } from "../lib/committees";
import { ACTIVITY_AVAILABILITY_LABELS_JA, type ActivityRecordAvailability } from "../lib/councilActivityRecord";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** 「白背景・薄いグレー罫線・グラデーション無し」で統一するための、この2ページ専用のカードスタイル。 */
const flatCardClass = "border border-gray-200 bg-white shadow-none dark:border-outline-variant dark:bg-surface-container-low";

/**
 * 比較カードで、値が無いときに出す言葉。
 * 「確認した結果0件」以外を0として見せないため、状態ごとに別の言葉を割り当てている。
 * 個人ページと同じ表（ACTIVITY_AVAILABILITY_LABELS_JA）を使い、画面ごとに言葉を変えない。
 */
const COMPARE_AVAILABILITY_LABEL: Record<ActivityRecordAvailability, string> = {
  ...ACTIVITY_AVAILABILITY_LABELS_JA,
  available: "―",
};

type SortKey = "name" | "speechCount" | "questionRate" | "submitterCount" | "channelCount";

interface BarometerRow {
  entry: MemberActivityEntry;
  /** 発言件数（確認できた質問項目数の実数）。会議録を取得できた会期が無い場合はnull（0件ではない）。 */
  speechCount: number | null;
  /** 一般質問実施率（0〜100）。算定できない場合はnull。 */
  questionRate: number | null;
  /** 実施率がnullの理由が「制度上の対象外」（議長など）かどうか。未取得と区別して表示する。 */
  questionNotApplicable: boolean;
  /** 決議の提出者として確認できた件数（限定あり、confirmed_zeroを含む実数）。 */
  submitterCount: number;
  /** 情報発信媒体数（本人確認済みSNS＋公式プロフィールページの実数）。 */
  channelCount: number;
}

const TABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "氏名" },
  { key: "speechCount", label: "発言件数" },
  { key: "questionRate", label: "実施率" },
  { key: "submitterCount", label: "提出者件数" },
  { key: "channelCount", label: "情報発信媒体数" },
];

function sortRows(rows: BarometerRow[], sortKey: SortKey, dir: "asc" | "desc"): BarometerRow[] {
  const sorted = [...rows];
  if (sortKey === "name") {
    sorted.sort((a, b) => a.entry.member.nameKana.localeCompare(b.entry.member.nameKana, "ja"));
  } else {
    sorted.sort((a, b) => {
      const av = sortKey === "questionRate" ? a.questionRate : a[sortKey];
      const bv = sortKey === "questionRate" ? b.questionRate : b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (bv as number) - (av as number);
    });
  }
  if (dir === "asc") sorted.reverse();
  return sorted;
}

/** 固定の基準値でバー長を決める横棒グラフ（強調色は呼び出し側で指定）。 */
function ValueBar({ value, max, colorClass }: { value: number | null; max: number; colorClass: string }) {
  // 値が無いのは0件ではない。バーを長さ0で描かず、言葉で状態を出す。
  if (value === null) {
    return <span className="text-xs text-on-surface-variant">未確認</span>;
  }
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-surface-container-high sm:w-24">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }} />
      </div>
      <span className="tabular-nums text-xs text-on-surface-variant">{value}</span>
    </div>
  );
}

function RateBar({ value, notApplicable }: { value: number | null; notApplicable?: boolean }) {
  // 「制度上の対象外（議長など）」を「まだ調べていない」と同じ言葉にしない。
  if (value === null) {
    return (
      <span className="text-xs text-on-surface-variant">{notApplicable ? "対象外" : "未確認"}</span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-surface-container-high sm:w-24">
        <div className="h-full rounded-full bg-secondary" style={{ width: `${Math.round(value)}%` }} />
      </div>
      <span className="tabular-nums text-xs text-on-surface-variant">{Math.round(value)}%</span>
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
  // Phase240：初期値は「未選択」に固定する。プリレンダリング済みHTMLは常にクエリなしの内容
  // （静的ホスティングはクエリを無視して同じファイルを返す）のため、初回レンダリングで
  // クエリを反映するとハイドレーション不一致になる。アクセス時のクエリは完了後に反映する。
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const initialParamsApplied = useInitialSearchParams((params) => {
    const raw = params.get("compare");
    setCompareIds(raw ? raw.split(",").filter(Boolean).slice(0, 3) : []);
  });

  useEffect(() => {
    // アクセス時のクエリを反映する前に書き戻すと、共有されたURLの比較対象を消してしまう。
    if (!initialParamsApplied) return;
    const next = new URLSearchParams(searchParams);
    if (compareIds.length > 0) next.set("compare", compareIds.join(","));
    else next.delete("compare");
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareIds, initialParamsApplied]);

  // 対象議員は members.json の件数をそのまま使う（人数を固定値へ書き換えない。任期交代等で
  // 人数が変わってもコード変更は不要）。
  const allEntries = useMemo(() => getAllCurrentMemberActivity(), []);
  const targetPeriod = useMemo(() => activityTargetPeriodLabel(), []);
  const coverage = useMemo(() => getIndicatorCoverage(), []);
  const coverageDetail = useMemo(() => getIndicatorCoverageDetail(), []);
  const evidenceSummary = useMemo(() => getEvidenceAvailabilitySummary(), []);
  const matrix = useMemo(() => get156CellMatrix(), []);
  const [matrixExpanded, setMatrixExpanded] = useState(false);

  const allRows: BarometerRow[] = useMemo(
    () =>
      allEntries.map((entry) => ({
        entry,
        // rawValue が無いのは「会議録を取得できた会期が無い」状態で、0件ではない。
        // ?? 0 にすると、会議録の取得が途切れた瞬間に全議員が0件表示になる。
        speechCount: metricByKey(entry.metrics, "speech")?.rawValue ?? null,
        questionRate: metricByKey(entry.metrics, "question")?.value ?? null,
        questionNotApplicable: metricByKey(entry.metrics, "question")?.dataStatus === "not-applicable",
        submitterCount: decisionSubmitterCountFor(entry.member.id),
        channelCount: informationChannelCount(entry.member),
      })),
    [allEntries],
  );

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      const m = row.entry.member;
      if (factionFilter !== "all" && m.factionId !== factionFilter) return false;
      if (committeeFilter !== "all" && !committeesForMember(m.id).some((c) => c.id === committeeFilter)) return false;
      if (nameQuery.trim() && !m.name.includes(nameQuery.trim()) && !m.nameKana.includes(nameQuery.trim())) return false;
      return true;
    });
  }, [allRows, factionFilter, committeeFilter, nameQuery]);

  const sortedRows = useMemo(() => sortRows(filteredRows, sortKey, sortDir), [filteredRows, sortKey, sortDir]);

  // 横棒グラフの長さは、表示中の他の議員に左右されない固定の基準で決める。
  //
  // 以前は「表示中の列内最大値」で正規化していたため、会派で絞り込んだり氏名で検索したり
  // すると、同じ議員の棒の長さが変わっていた。数値そのものは実数表示なので値は動かないが、
  // 見た目は完全な相対比較で、「他の議員の活動によって本人の数値が上下しない」という
  // 公開している説明と食い違っていた。
  //
  // 基準は、その項目が取りうる上限をデータから決め打ちせず、キリのよい固定値に置く。
  // 上限を超える値は棒が振り切れた状態になるが、実数を併記しているため誤読は生じない。
  const SPEECH_BAR_MAX = 150;
  const SUBMITTER_BAR_MAX = 10;
  const CHANNEL_BAR_MAX = 6;

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
  // 比較は「同じ定義の記録を横に並べる」だけにする。行＝項目、列＝議員。
  // 値そのものは各議員の記録から取るため、誰を並べても表示値は変わらない。
  const compareRecords = compareEntries.map((e) => ({ member: e.member, record: getMemberActivityRecord(e.member) }));
  // 件数だけを並べると在任期間の長さの影響を受けるため、算定対象の会期数を必ず併記する。
  const compareEligibleCounts = compareRecords.map(
    (c) => c.record.sessions.filter((x) => x.countedInDenominator).length,
  );
  // 対象期間が違う議員どうしを、同じ条件で比べたように見せない。
  const comparePeriodDiffers = new Set(compareEligibleCounts).size > 1;
  const compareRows =
    compareRecords.length > 0
      ? [
          {
            key: "eligible-sessions",
            label: "算定対象の会期数",
            cells: compareEligibleCounts.map((n) => ({
              text: `${n.toLocaleString("ja-JP")}会期`,
              stateLabel: null,
              fraction: null,
            })),
          },
          ...compareRecords[0].record.values.map((template) => ({
          key: template.key,
          label: template.label,
          cells: compareRecords.map(({ record }) => {
            const v = record.values.find((x) => x.key === template.key);
            if (!v) return { text: null, stateLabel: "―", fraction: null };
            if (v.kind === "list") {
              const count = v.items?.length ?? 0;
              return count > 0 && v.availability !== "not-applicable"
                ? { text: `${count.toLocaleString("ja-JP")}件`, stateLabel: null, fraction: null }
                : { text: null, stateLabel: COMPARE_AVAILABILITY_LABEL[v.availability], fraction: null };
            }
            if (v.value === null) {
              return { text: null, stateLabel: COMPARE_AVAILABILITY_LABEL[v.availability], fraction: null };
            }
            return {
              text: `${v.value.toLocaleString("ja-JP")}${v.unit}`,
              stateLabel: null,
              fraction:
                v.numerator != null && v.denominator != null ? `${v.numerator}／${v.denominator}` : null,
            };
          }),
          })),
        ]
      : [];
  const committeeOptions = sortedCommittees().map((c) => ({ value: c.id, label: c.name }));
  const factionOptions = allFactions.map((f) => ({ value: f.id, label: f.name }));

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      {/* ページ上部：大見出し・サブ見出し・対象期間・注意書き（白背景・薄いグレー罫線） */}
      <div className={`rounded-2xl p-5 sm:p-6 ${flatCardClass}`}>
        <h1 className="text-xl font-semibold leading-snug text-on-surface sm:text-2xl">
          延岡市議会 議員活動バロメーター
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">公開資料から見える5つの指標</p>
        <p className="mt-1 text-xs text-on-surface-variant">対象期間：{targetPeriod}</p>
        <p className="mt-3 border-t border-gray-200 pt-3 text-xs leading-relaxed text-on-surface-variant dark:border-outline-variant">
          件数や実施率は、公開資料上で確認できた記録の数と割合です（活動記録の可視化）。政策の内容や質、議員の能力・優劣、政治的立場を示すものではありません。資料の公開状況によって確認できる記録の範囲に差があります。詳しくは
          <Link to="/methodology/council-activity" className={`font-medium text-primary underline ${linkClass}`}>
            活動指標の算定方法
          </Link>
          をご覧ください。出典は各項目のリンク先でご確認いただけます。
        </p>
      </div>

      {/* 全議員比較表 */}
      <SectionCard title={`全議員比較（${sortedRows.length}／${allEntries.length}名）`} className={flatCardClass}>
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          列見出しで並べ替えできますが、並び順は順位ではありません（複数の項目を合算した総合点・順位は作っていません）。「紹介議員件数」は、紹介議員を載せる請願文書表がウェブ公開されていないため全員「未公開」、「出席状況」は議員別の出席・欠席名簿がウェブ公開の資料に掲載されていないため全員「未公開」です（いずれも0件という意味ではありません）。現職議員は全員同一の選挙日（令和5年4月23日執行）から在職しているため、対象期間・在職期間の差による不公平は生じていません。
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

        {sortedRows.length === 0 && (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-on-surface-variant dark:bg-surface-container-high">
            条件に一致する議員が見つかりませんでした。検索語や絞り込み条件をご確認ください。
          </p>
        )}

        {/* PC: 表形式 */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-on-surface-variant dark:border-outline-variant">
                <th className="w-8 whitespace-nowrap py-2 pr-2">比較</th>
                {TABLE_COLUMNS.map((col) => (
                  <th key={col.key} className="whitespace-nowrap py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      /* Phase197：高さはPhase192で44pxを確保済み。短い列名では幅が36〜40pxに
                         なるため、min-w-11で当たり判定の幅も44pxにする（文字は左寄せのまま）。 */
                      className={`inline-flex min-h-11 min-w-11 items-center gap-1 font-semibold hover:underline ${linkClass}`}
                      aria-label={`${col.label}で並べ替え`}
                    >
                      {col.label}
                      {sortKey === col.key && <span aria-hidden="true">{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                ))}
                <th className="whitespace-nowrap py-2 pr-3 font-semibold">紹介議員件数</th>
                <th className="whitespace-nowrap py-2 pr-3 font-semibold">出席状況</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const m = row.entry.member;
                const faction = getFaction(m.factionId);
                return (
                  <tr key={m.id} data-member-id={m.id} className="border-b border-gray-100 align-middle dark:border-outline-variant/60">
                    <td className="whitespace-nowrap py-2 pr-2">
                      {/* Phase197：裸のチェックボックスは実効タップ領域が16x16pxしかなかったため、
                          <label>で包んで44x44pxの当たり判定を確保する（チェックボックス自体の
                          見た目の大きさは変えない。アクセシブルな名前はinputのaria-labelのまま）。 */}
                      <label className="flex min-h-11 w-11 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={compareIds.includes(m.id)}
                          onChange={() => toggleCompare(m.id)}
                          disabled={!compareIds.includes(m.id) && compareIds.length >= 3}
                          aria-label={`${m.name}を比較対象に選ぶ`}
                          className="h-4 w-4"
                        />
                      </label>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      {/* Phase197：表セル内に単独で置かれた議員名リンク。44pxのタップ領域を確保する。 */}
                      <Link
                        to={`/council-activity/${m.id}`}
                        className={`inline-flex min-h-11 items-center font-medium text-on-surface hover:underline ${linkClass}`}
                      >
                        {m.name}
                      </Link>
                      {faction && <FactionChip faction={faction} className="ml-2" />}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <ValueBar value={row.speechCount} max={SPEECH_BAR_MAX} colorClass="bg-orange-500" />
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <RateBar value={row.questionRate} notApplicable={row.questionNotApplicable} />
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <ValueBar value={row.submitterCount} max={SUBMITTER_BAR_MAX} colorClass="bg-orange-500" />
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <ValueBar value={row.channelCount} max={CHANNEL_BAR_MAX} colorClass="bg-secondary" />
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-xs text-on-surface-variant">未公開</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-xs text-on-surface-variant">未公開</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* スマホ：議員ごとのカード形式 */}
        <div className="space-y-3 sm:hidden">
          <div className="flex flex-wrap gap-2 text-xs">
            {TABLE_COLUMNS.map((col) => (
              <button
                key={col.key}
                type="button"
                onClick={() => handleSort(col.key)}
                className={`inline-flex min-h-11 items-center rounded-full border px-2.5 py-1 ${
                  sortKey === col.key
                    ? "border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-950/30 dark:text-orange-300"
                    : "border-gray-200 text-on-surface-variant dark:border-outline-variant"
                } ${linkClass}`}
              >
                {col.label}
                {sortKey === col.key && (sortDir === "asc" ? "▲" : "▼")}
              </button>
            ))}
          </div>
          <ul className="space-y-2">
            {sortedRows.map((row) => {
              const m = row.entry.member;
              const faction = getFaction(m.factionId);
              return (
                <li key={m.id} className={`rounded-lg p-3 ${flatCardClass}`}>
                  <div className="flex items-center justify-end gap-2">
                    {/* Phase197：<label>で包まれているため実効タップ領域は46x16px（横は充足、
                        縦が不足）だった。min-h-11で縦44pxを確保する。 */}
                    <label className="flex min-h-11 items-center gap-1.5 text-xs text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={compareIds.includes(m.id)}
                        onChange={() => toggleCompare(m.id)}
                        disabled={!compareIds.includes(m.id) && compareIds.length >= 3}
                        aria-label={`${m.name}を比較対象に選ぶ`}
                        className="h-4 w-4"
                      />
                      比較
                    </label>
                  </div>
                  {/* Phase197：スマートフォン用一覧カードの議員名リンク。44pxのタップ領域を確保する。 */}
                  <Link
                    to={`/council-activity/${m.id}`}
                    className={`inline-flex min-h-11 items-center font-medium text-on-surface hover:underline ${linkClass}`}
                  >
                    {m.name}
                  </Link>
                  {faction && <FactionChip faction={faction} className="ml-2" />}
                  <dl className="mt-2 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-on-surface-variant">発言件数</dt>
                      <dd>
                        <ValueBar value={row.speechCount} max={SPEECH_BAR_MAX} colorClass="bg-orange-500" />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-on-surface-variant">実施率</dt>
                      <dd>
                        <RateBar value={row.questionRate} notApplicable={row.questionNotApplicable} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-on-surface-variant">紹介議員件数</dt>
                      <dd className="text-on-surface-variant">未公開</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-on-surface-variant">提出者件数</dt>
                      <dd>
                        <ValueBar value={row.submitterCount} max={SUBMITTER_BAR_MAX} colorClass="bg-orange-500" />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-on-surface-variant">情報発信媒体数</dt>
                      <dd>
                        <ValueBar value={row.channelCount} max={CHANNEL_BAR_MAX} colorClass="bg-secondary" />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-on-surface-variant">出席状況</dt>
                      <dd className="text-on-surface-variant">未公開</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      </SectionCard>

      <SectionCard title="データ充足状況">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          「データ充足率」は、対象議員{coverage[0]?.totalCount ?? allEntries.length}名のうち何名分の指標を算定できたかの割合です。個人ページに表示している活動の記録（実施率・実数）とは別物であり、充足率が低い項目は議員の活動が少ないという意味ではなく、本サイトがまだ一次資料を収録できていないことを示します。
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
                aria-label={
                  c.coveragePercent === 0
                    ? `${c.indicatorLabel}：この項目を確認できた議員はいません（対象${c.totalCount}名、未収録）`
                    : `${c.indicatorLabel}：対象${c.totalCount}名中${c.completeCount}名分のデータを収録済み（${c.coveragePercent}%）`
                }
              >
                <div
                  className={`h-full rounded-full ${c.coveragePercent === 0 ? "bg-outline-variant" : "bg-primary"}`}
                  style={{ width: `${Math.max(c.coveragePercent, c.coveragePercent === 0 ? 0 : 4)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg bg-tertiary-container px-3 py-2 text-xs leading-relaxed text-on-tertiary-container">
          注意：ここでの「データ充足率」は資料の網羅度（何人分・何件確認できたか）を示すものであり、議員ごとの活動の記録（実施率・実数）とは別のものです。充足率が高いこと自体を「活動が優れている」という評価として読まないでください。
        </p>

        <p className="mb-2 mt-4 text-xs font-medium text-on-surface-variant">指標別の詳しい内訳</p>
        <ul className="space-y-3">
          {coverageDetail.map((d) => (
            <li key={d.indicatorKey} className="rounded-lg border border-outline-variant p-3">
              <p className="text-sm font-semibold text-on-surface">{d.indicatorLabel}</p>
              <dl className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium text-on-surface">確認できた人数：</dt>
                  <dd className="inline">
                    {d.confirmedMemberCount === 0
                      ? `この項目を確認できた議員はいません（対象${d.totalMemberCount}名）`
                      : `${d.confirmedMemberCount}／${d.totalMemberCount}名`}
                  </dd>
                </div>
                {d.confirmedSessionCount !== null && (
                  <div>
                    <dt className="inline font-medium text-on-surface">会議録を確認できた会期数：</dt>
                    <dd className="inline">{d.confirmedSessionCount}会期</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="inline font-medium text-on-surface">根拠となる一次資料：</dt>
                  <dd className="inline">{d.sourceRecordUnit}</dd>
                </div>
              </dl>
              <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">{d.missingDescription}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="確認状況（何が公開資料から分かるか）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          6指標の値とは別に、活動データベース全体で「何を、どこまで確認できているか」をまとめたものです。「公開資料未確認」は0件・存在しないという意味ではなく、複数の資料経路を調査しても確認できていないことを示します。
        </p>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {evidenceSummary.map((item) => (
            // Phase194（WCAG）：<dl>直下のグループ<div>にはdt/dd以外を置けないため、
            // 見た目を変えずにgridで「項目名／状況バッジ／説明」を配置する。
            <div
              key={item.key}
              className="grid grid-cols-[1fr_auto] items-center gap-x-2 rounded-lg bg-surface-container-low p-3"
            >
              <dt className="text-sm font-medium text-on-surface">{item.label}</dt>
              <dd
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  item.code === "confirmed"
                    ? "bg-primary-container text-on-primary-container"
                    : item.code === "waiting_external"
                      ? "bg-tertiary-container text-on-tertiary-container"
                      : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {item.statusText}
              </dd>
              <dd className="col-span-2 mt-1 text-xs leading-relaxed text-on-surface-variant">{item.detail}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title={`${matrix.length}名×6指標の確認状況一覧`}>
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          対象議員{matrix.length}名それぞれについて、6指標が確認できたかどうかを一覧化したものです。○△―は活動の「点数」ではなく、公開資料からの確認状況を示す記号です（凡例参照）。「0件」という意味の表示はありません。
        </p>
        <ul className="mb-3 flex flex-wrap gap-3 text-xs text-on-surface-variant">
          <li>
            <span aria-hidden="true">○</span> 確認済み
          </li>
          <li>
            <span aria-hidden="true">△</span> 一部確認
          </li>
          <li>
            <span aria-hidden="true">―</span> 公開資料から確認できず
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setMatrixExpanded((v) => !v)}
          className={`mb-3 inline-flex min-h-11 items-center rounded-full border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-high ${linkClass}`}
          aria-expanded={matrixExpanded}
        >
          {matrixExpanded ? "一覧を閉じる" : `一覧を開く（${matrix.length}名）`}
        </button>
        {matrixExpanded && (
          <>
            {/* PC・タブレット：表形式 */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                <caption className="sr-only">議員別・指標別のデータ確認状況一覧</caption>
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant">
                    <th scope="col" className="whitespace-nowrap py-1.5 pr-2 font-medium">
                      氏名
                    </th>
                    {MATRIX_INDICATOR_LABELS.map((c) => (
                      <th key={c.key} scope="col" className="whitespace-nowrap py-1.5 pr-2 font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.memberId} className="border-b border-outline-variant/60">
                      <th scope="row" className="whitespace-nowrap py-1.5 pr-2 font-normal text-on-surface">
                        <Link to={`/council-activity/${row.memberId}`} className={`hover:underline ${linkClass}`}>
                          {row.memberName}
                        </Link>
                      </th>
                      {row.cells.map((cell) => (
                        // Phase194（WCAG）：aria-labelでセル内容を置き換えるのではなく、
                        // 記号は装飾扱いにしてスクリーンリーダー用テキストを併記する。
                        <td key={cell.indicatorKey} className="py-1.5 pr-2 text-on-surface">
                          <span aria-hidden="true">{cell.symbol}</span>
                          <span className="sr-only">{cell.label}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* スマホ：議員ごとのカード */}
            <ul className="space-y-2 sm:hidden">
              {matrix.map((row) => (
                <li key={row.memberId} className="rounded-lg border border-outline-variant p-3">
                  <Link
                    to={`/council-activity/${row.memberId}`}
                    className={`text-sm font-medium text-on-surface hover:underline ${linkClass}`}
                  >
                    {row.memberName}
                  </Link>
                  <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                    {row.cells.map((cell) => (
                      <li key={cell.indicatorKey} className="flex items-center justify-between gap-1">
                        <span>{MATRIX_INDICATOR_LABELS.find((c) => c.key === cell.indicatorKey)?.label ?? cell.indicatorKey}</span>
                        <span aria-hidden="true">{cell.symbol}</span>
                        <span className="sr-only">{cell.label}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionCard>

      <SectionCard title="5つの指標について">
        <ul className="space-y-2 text-sm leading-relaxed text-on-surface">
          <li>
            <span className="font-medium">一般質問</span>：定例会で一般質問を実施した割合。
          </li>
          <li>
            <span className="font-medium">議会内発言</span>：公開会議録から確認できた発言（発言件数＝確認できた質問項目数）。
          </li>
          <li>
            <span className="font-medium">請願・提案等</span>：本会議での決議提出者として確認できた件数（限定あり）。請願・陳情の紹介議員は公開資料から確認できていません。
          </li>
          <li>
            <span className="font-medium">情報発信</span>：本人公式と確認できたWeb/SNS媒体数を含む、プロフィール情報の充足状況。
          </li>
          <li>
            <span className="font-medium">出席状況</span>：公開資料から確認可能な本会議・委員会等の出席状況（議員別の出席・欠席名簿がウェブ公開の会議録等に掲載されていないため、全議員「未公開」）。
          </li>
        </ul>
        <Link
          to="/methodology/council-activity"
          className={`mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline ${linkClass}`}
        >
          算定方法・計算式・出典を見る →
        </Link>
      </SectionCard>

      {compareEntries.length > 0 && (
        <SectionCard title={`比較（${compareEntries.length}名選択中）`}>
          {comparePeriodDiffers && (
            <p className="mb-3 rounded-lg border border-tertiary/40 bg-tertiary-container/40 px-3 py-2 text-xs font-medium leading-relaxed text-on-surface">
              対象期間が異なります。算定対象の会期数が議員によって違うため、件数をそのまま比べることはできません。
              割合（一般質問実施率・再質問確認率）と、各行の分子・分母をあわせてご覧ください。
            </p>
          )}
          <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
            同じ定義の公開記録を、そのまま横に並べています。順位・総合点・優劣の判定は行いません。
            ここに出る値は誰と並べても変わりません（他の議員の数値で割ったり正規化したりしていないためです）。
            件数は、会期ごとに会議録から要約を取り込めた量に左右されるため、多い少ないをそのまま活動量の差とは読めません。
            最終的な判断は、各行の根拠から一次資料をご確認ください。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] border-collapse text-sm">
              <caption className="sr-only">選択した議員の、公開記録による議会活動の比較（順位付けは行っていません）</caption>
              <thead>
                <tr className="border-b border-outline-variant">
                  <th scope="col" className="py-2 pr-2 text-left text-xs font-medium text-on-surface-variant">
                    項目
                  </th>
                  {compareRecords.map((c) => (
                    <th key={c.member.id} scope="col" className="py-2 px-2 text-left text-xs font-medium text-on-surface">
                      <Link to={`/council-activity/${c.member.id}`} className={`text-primary underline ${linkClass}`}>
                        {c.member.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row.key} className="border-b border-outline-variant/60 align-top">
                    <th scope="row" className="py-2 pr-2 text-left text-xs font-normal text-on-surface-variant">
                      {row.label}
                    </th>
                    {row.cells.map((cell, i) => (
                      <td key={compareRecords[i].member.id} className="py-2 px-2 text-sm text-on-surface">
                        {cell.text === null ? (
                          <span className="text-xs text-on-surface-variant">{cell.stateLabel}</span>
                        ) : (
                          <>
                            <span className="font-semibold tabular-nums">{cell.text}</span>
                            {cell.fraction && (
                              <span className="ml-1 text-xs font-normal text-on-surface-variant">（{cell.fraction}）</span>
                            )}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
            「0件（資料を確認済み）」は一次資料を確認したうえで0件だったものです。「未確認」は当サイトがまだ取り込めていないもの、
            「未公開」は必要な一次資料が公開されていないもの、「個人単位で確認不可」は誰の行為か分かる形で公開されていないもの、
            「対象外」は制度上その議員に当てはまらない項目です。この4つは0件とは異なります。
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {compareRecords.map((c) => (
              <Link
                key={c.member.id}
                to={`/council-activity/${c.member.id}`}
                className={`inline-flex min-h-11 items-center text-xs font-medium text-primary underline ${linkClass}`}
              >
                {c.member.name}の根拠を見る →
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCompareIds([])}
            className={`mt-3 text-xs font-medium text-primary underline ${linkClass}`}
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

/** 156セル一覧の列順。`getMemberActivityMetrics`が返すmetrics配列の実際の並び順と一致させる
 * （question/speech/attendance/voting/proposal/disclosure）。 */
const MATRIX_INDICATOR_LABELS: { key: string; label: string }[] = [
  { key: "question", label: "一般質問" },
  { key: "speech", label: "議会内発言" },
  { key: "attendance", label: "出席状況" },
  { key: "voting", label: "議案等の意思表示" },
  { key: "proposal", label: "請願・提案等" },
  { key: "disclosure", label: "情報発信" },
];
