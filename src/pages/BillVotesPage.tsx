import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import billVotesData from "../data/billVotes.json";
import type { BillProposerType, BillVoteItem, BillVoteResult } from "../types";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { SortIcon } from "../components/icons";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LastUpdated } from "../components/LastUpdated";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";

const billVotes = billVotesData as BillVoteItem[];

const resultOptions: { value: BillVoteResult; label: string }[] = [
  { value: "原案可決", label: "原案可決" },
  { value: "修正可決", label: "修正可決" },
  { value: "否決", label: "否決" },
  { value: "承認", label: "承認" },
  { value: "認定", label: "認定" },
  { value: "同意", label: "同意" },
  { value: "採択", label: "採択" },
  { value: "不採択", label: "不採択" },
  { value: "継続審査", label: "継続審査" },
  { value: "撤回", label: "撤回" },
  { value: "その他", label: "その他" },
  { value: "確認中", label: "確認中" },
];

const proposerTypeOptions: { value: BillProposerType; label: string }[] = [
  { value: "mayor", label: "市長提出" },
  { value: "member", label: "議員提出" },
  { value: "committee", label: "委員会提出" },
  { value: "other", label: "その他" },
];

type UnanimityFilter = "unanimous" | "split";

const unanimityOptions: { value: UnanimityFilter; label: string }[] = [
  { value: "unanimous", label: "全会一致" },
  { value: "split", label: "賛否が分かれた議案" },
];

type SortKey = "newest" | "oldest" | "billNumber" | "approvalRate";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "newest", label: "新しい順" },
  { value: "oldest", label: "古い順" },
  { value: "billNumber", label: "議案番号順" },
  { value: "approvalRate", label: "賛成率順" },
];

function safeFormatDate(iso?: string): string {
  return iso ? formatJapaneseDate(iso) : "確認中";
}

function voteCounts(bill: BillVoteItem) {
  const approve = bill.memberVotes.filter((v) => v.vote === "approve").length;
  const oppose = bill.memberVotes.filter((v) => v.vote === "oppose").length;
  const departed = bill.memberVotes.filter((v) => v.vote === "departed").length;
  const absent = bill.memberVotes.filter((v) => v.vote === "absent").length;
  return { approve, oppose, departed, absent };
}

/** 賛成率（賛成÷（賛成＋反対））。反対が0で賛成が1件以上あれば全会一致とみなす。賛否データが無い場合はnull。 */
function approvalRate(bill: BillVoteItem): number | null {
  const { approve, oppose } = voteCounts(bill);
  if (approve + oppose === 0) return null;
  return approve / (approve + oppose);
}

function isUnanimous(bill: BillVoteItem): boolean | null {
  const { approve, oppose } = voteCounts(bill);
  if (approve + oppose === 0) return null;
  return oppose === 0;
}

/** 議案番号から先頭の数値を取り出す（例："議案第45号" → 45）。数値が見つからない場合はnull。 */
function extractBillNumberValue(billNumber: string): number | null {
  const match = billNumber.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function compareBillNumber(a: BillVoteItem, b: BillVoteItem): number {
  const av = extractBillNumberValue(a.billNumber);
  const bv = extractBillNumberValue(b.billNumber);
  if (av === null && bv === null) return a.billNumber.localeCompare(b.billNumber, "ja");
  if (av === null) return 1;
  if (bv === null) return -1;
  return av - bv;
}

function sortBills(items: BillVoteItem[], sort: SortKey): BillVoteItem[] {
  const sorted = [...items];
  if (sort === "billNumber") {
    return sorted.sort(compareBillNumber);
  }
  if (sort === "approvalRate") {
    return sorted.sort((a, b) => {
      const ar = approvalRate(a);
      const br = approvalRate(b);
      if (ar === null && br === null) return 0;
      if (ar === null) return 1;
      if (br === null) return -1;
      return br - ar;
    });
  }
  return sorted.sort((a, b) => {
    const ad = a.votingDate ?? a.submittedDate;
    const bd = b.votingDate ?? b.submittedDate;
    if (!ad && !bd) return 0;
    if (!ad) return 1;
    if (!bd) return -1;
    return sort === "newest" ? bd.localeCompare(ad) : ad.localeCompare(bd);
  });
}

export function BillVotesPage() {
  usePageTitle();

  const [query, setQuery] = useState("");
  const [fiscalYear, setFiscalYear] = useState("all");
  const [session, setSession] = useState("all");
  const [result, setResult] = useState("all");
  const [committee, setCommittee] = useState("all");
  const [proposerType, setProposerType] = useState("all");
  const [unanimity, setUnanimity] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const fiscalYearOptions = useMemo(
    () =>
      Array.from(new Set(billVotes.map((b) => b.fiscalYear)))
        .sort((a, b) => b.localeCompare(a, "ja"))
        .map((y) => ({ value: y, label: y })),
    [],
  );

  const sessionOptions = useMemo(
    () =>
      Array.from(new Set(billVotes.map((b) => b.session)))
        .sort((a, b) => b.localeCompare(a, "ja"))
        .map((s) => ({ value: s, label: s })),
    [],
  );

  const committeeOptions = useMemo(
    () =>
      Array.from(new Set(billVotes.map((b) => b.committee).filter((c): c is string => !!c)))
        .sort((a, b) => a.localeCompare(b, "ja"))
        .map((c) => ({ value: c, label: c })),
    [],
  );

  const hasActiveFilter =
    query !== "" ||
    fiscalYear !== "all" ||
    session !== "all" ||
    result !== "all" ||
    committee !== "all" ||
    proposerType !== "all" ||
    unanimity !== "all";

  const clearFilters = () => {
    setQuery("");
    setFiscalYear("all");
    setSession("all");
    setResult("all");
    setCommittee("all");
    setProposerType("all");
    setUnanimity("all");
  };

  const filteredBills = useMemo(() => {
    const q = query.trim();
    const matched = billVotes.filter((b) => {
      const matchesQuery =
        q === "" || b.billNumber.includes(q) || b.billTitle.includes(q) || b.summary.includes(q);
      const matchesFiscalYear = fiscalYear === "all" || b.fiscalYear === fiscalYear;
      const matchesSession = session === "all" || b.session === session;
      const matchesResult = result === "all" || b.result === result;
      const matchesCommittee = committee === "all" || b.committee === committee;
      const matchesProposerType = proposerType === "all" || b.proposerType === proposerType;
      const matchesUnanimity =
        unanimity === "all" ||
        (unanimity === "unanimous" ? isUnanimous(b) === true : isUnanimous(b) === false);
      return (
        matchesQuery &&
        matchesFiscalYear &&
        matchesSession &&
        matchesResult &&
        matchesCommittee &&
        matchesProposerType &&
        matchesUnanimity
      );
    });
    return sortBills(matched, sort);
  }, [query, fiscalYear, session, result, committee, proposerType, unanimity, sort]);

  return (
    <div className="px-4 py-4 sm:px-6">
      <Breadcrumbs items={[{ label: "ホーム", to: "/" }, { label: "議案ごとの賛否" }]} />
      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">議案ごとの賛否</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市議会で審議された議案について、公開資料で確認できる議員ごとの賛否を整理しています。賛否の人数のみで議員活動を評価するものではありません。
        </p>
      </div>

      <div className="sticky top-[57px] z-10 -mx-4 space-y-3 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0 sm:py-2">
        <SearchBar value={query} onChange={setQuery} placeholder="議案番号、議案名、概要で検索" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="年度" value={fiscalYear} onChange={setFiscalYear} options={fiscalYearOptions} />
          <FilterSelect label="定例会" value={session} onChange={setSession} options={sessionOptions} />
          <FilterSelect label="委員会" value={committee} onChange={setCommittee} options={committeeOptions} />
          <FilterSelect label="議決結果" value={result} onChange={setResult} options={resultOptions} />
          <FilterSelect label="提出者" value={proposerType} onChange={setProposerType} options={proposerTypeOptions} />
          <FilterSelect label="採決の傾向" value={unanimity} onChange={setUnanimity} options={unanimityOptions} />
          <label className="flex shrink-0 items-center gap-2 rounded-full bg-surface-container-high px-4 py-2.5 text-sm text-on-surface-variant shadow-e1 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            <SortIcon className="h-4 w-4 shrink-0" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="並び替え"
              className="bg-transparent text-on-surface focus:outline-none"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {hasActiveFilter && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              条件をリセット
            </button>
          </div>
        )}
      </div>

      <h2 className="sr-only">議案一覧</h2>
      {billVotes.length === 0 ? (
        <p className="mt-3 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          現在、公開資料を確認しながら順次追加しています。
        </p>
      ) : (
        <>
          <p className="mb-3 mt-3 text-sm text-on-surface-variant">
            {filteredBills.length > 0
              ? `${filteredBills.length}件の議案が見つかりました`
              : "条件に一致する議案は見つかりませんでした。"}
          </p>
          {filteredBills.length > 0 && (
            <ul className="space-y-3">
              {filteredBills.map((bill) => {
                const { approve, oppose, departed, absent } = voteCounts(bill);
                return (
                  <li key={bill.id} className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span>{bill.billNumber}</span>
                          <span>{bill.session}</span>
                        </div>
                        <h2 className="mt-1 text-base font-semibold leading-snug text-on-surface">{bill.billTitle}</h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-on-surface-variant">{bill.summary}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          提出日：{safeFormatDate(bill.submittedDate)}／議決日：{safeFormatDate(bill.votingDate)}／提出者：
                          {bill.proposer ?? "確認中"}
                          {bill.submittingDepartment && `／担当課：${bill.submittingDepartment}`}
                        </p>
                        <p className="mt-1 text-sm font-medium text-on-surface">議決結果：{bill.result}</p>
                        {bill.memberVotes.length > 0 && (
                          <p className="mt-1 text-xs text-on-surface-variant">
                            賛成{approve}人／反対{oppose}人／退席{departed}人／欠席{absent}人
                          </p>
                        )}
                      </div>
                      <Link
                        to={`/bills/votes/${bill.id}`}
                        className="shrink-0 rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        詳細を見る
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <p className="mt-6 px-1 text-xs leading-relaxed text-on-surface-variant">
        このページは、延岡市議会が公開する議案書、議決結果、会議録などを基に整理しています。議員個人の賛否は、氏名別の公式記録を確認できた場合のみ掲載します。賛否のみで議員活動や議案の内容を評価できるものではありません。
      </p>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="議案ごとの賛否" />
      </div>
    </div>
  );
}
