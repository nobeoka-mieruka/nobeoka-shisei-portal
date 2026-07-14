import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import billVotesData from "../data/billVotes.json";
import type { BillVoteItem, BillVoteResult } from "../types";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
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

function safeFormatDate(iso?: string): string {
  return iso ? formatJapaneseDate(iso) : "確認中";
}

export function BillVotesPage() {
  usePageTitle("議案ごとの賛否");

  const [query, setQuery] = useState("");
  const [fiscalYear, setFiscalYear] = useState("all");
  const [session, setSession] = useState("all");
  const [result, setResult] = useState("all");
  const [committee, setCommittee] = useState("all");

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
    query !== "" || fiscalYear !== "all" || session !== "all" || result !== "all" || committee !== "all";

  const clearFilters = () => {
    setQuery("");
    setFiscalYear("all");
    setSession("all");
    setResult("all");
    setCommittee("all");
  };

  const filteredBills = useMemo(() => {
    const q = query.trim();
    return billVotes.filter((b) => {
      const matchesQuery =
        q === "" || b.billNumber.includes(q) || b.billTitle.includes(q) || b.summary.includes(q);
      const matchesFiscalYear = fiscalYear === "all" || b.fiscalYear === fiscalYear;
      const matchesSession = session === "all" || b.session === session;
      const matchesResult = result === "all" || b.result === result;
      const matchesCommittee = committee === "all" || b.committee === committee;
      return matchesQuery && matchesFiscalYear && matchesSession && matchesResult && matchesCommittee;
    });
  }, [query, fiscalYear, session, result, committee]);

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">議案ごとの賛否</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市議会で審議された議案について、公開資料で確認できる議員ごとの賛否を整理する予定のページです。賛否の人数のみで議員活動を評価するものではありません。
        </p>
      </div>

      <div className="sticky top-[57px] z-10 -mx-4 space-y-3 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0 sm:py-2">
        <SearchBar value={query} onChange={setQuery} placeholder="議案番号、議案名、概要で検索" />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="年度" value={fiscalYear} onChange={setFiscalYear} options={fiscalYearOptions} />
          <FilterSelect label="会議" value={session} onChange={setSession} options={sessionOptions} />
          <FilterSelect label="議決結果" value={result} onChange={setResult} options={resultOptions} />
          <FilterSelect label="委員会" value={committee} onChange={setCommittee} options={committeeOptions} />
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

      {billVotes.length === 0 ? (
        <p className="mt-3 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          議案・賛否データを準備中です。公式資料を確認しながら定例会ごとに追加します。
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
                const approve = bill.memberVotes.filter((v) => v.vote === "approve").length;
                const oppose = bill.memberVotes.filter((v) => v.vote === "oppose").length;
                const abstain = bill.memberVotes.filter((v) => v.vote === "abstain").length;
                const absent = bill.memberVotes.filter((v) => v.vote === "absent").length;
                return (
                  <li key={bill.id} className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span>{bill.billNumber}</span>
                          <span>{bill.session}</span>
                        </div>
                        <h3 className="mt-1 text-base font-semibold leading-snug text-on-surface">{bill.billTitle}</h3>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          提出日：{safeFormatDate(bill.submittedDate)}／議決日：{safeFormatDate(bill.votingDate)}／提出者：
                          {bill.proposer ?? "確認中"}
                        </p>
                        <p className="mt-1 text-sm font-medium text-on-surface">議決結果：{bill.result}</p>
                        {bill.memberVotes.length > 0 && (
                          <p className="mt-1 text-xs text-on-surface-variant">
                            賛成{approve}人／反対{oppose}人／退席{abstain}人／欠席{absent}人
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

      <div className="mt-4">
        <CorrectionRequestButton pageName="議案ごとの賛否" />
      </div>
    </div>
  );
}
