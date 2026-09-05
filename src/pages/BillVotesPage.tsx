import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useInitialSearchParams } from "../hooks/useHydratedSearchParams";
import billVotesData from "../data/billVotes.json";
import type { BillCategory, BillProposerType, BillVoteItem, BillVoteResult } from "../types";
import { SearchBar } from "../components/SearchBar";
import { FilterSelect } from "../components/FilterSelect";
import { GlossaryNote } from "../components/GlossaryNote";
import { SortIcon } from "../components/icons";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LastUpdated } from "../components/LastUpdated";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";
import { dataCoverage } from "../data/dataCoverage";
import { publicBills, reviewFlowSummaryLabel, verificationStatusOf, verificationStatusLabels } from "../lib/billVotes";
import { VerificationStatusBadge } from "../components/bills/VerificationStatusBadge";
import { CsvDownloadButton } from "../components/CsvDownloadButton";
import { Pagination } from "../components/Pagination";
import {
  BILL_SESSION_FISCAL_YEAR_DESCRIPTION,
  BILL_SESSION_FISCAL_YEAR_LABEL,
  displayFiscalYearLabel,
} from "../lib/billFiscalYear";
import type { CsvColumn } from "../lib/csv";
import { SITE_URL } from "../config/site";

const billVotes = publicBills(billVotesData as BillVoteItem[]);

// 議案は千件規模あり、1ページに全件表示するとスマートフォンで
// スクロールが極端に長くなるため、20件ずつページ分割して表示する。
const BILLS_PAGE_SIZE = 20;

const BILL_VOTES_CSV_COLUMNS: CsvColumn<BillVoteItem>[] = [
  // Phase220：この列は議案名に書かれた予算・決算の対象年度ではなく、会期年度（審議した会期の年度）。
  { header: BILL_SESSION_FISCAL_YEAR_LABEL, value: (b) => b.fiscalYear },
  { header: "定例会・臨時会", value: (b) => b.session },
  { header: "議案番号", value: (b) => b.billNumber },
  { header: "件名", value: (b) => b.billTitle },
  { header: "分類", value: (b) => b.category },
  { header: "提出者区分", value: (b) => b.proposerType },
  { header: "提出者", value: (b) => b.proposer },
  { header: "提出日", value: (b) => b.submittedDate },
  { header: "議決日", value: (b) => b.votingDate },
  { header: "議決結果", value: (b) => b.result },
  { header: "採決方法", value: (b) => b.voteMethod },
  { header: "付託委員会", value: (b) => b.committee },
  { header: "施行日", value: (b) => b.effectiveDate },
  { header: "議決結果PDF", value: (b) => b.resultDocumentUrl },
  { header: "会議録URL", value: (b) => b.transcriptUrl },
  { header: "詳細ページURL", value: (b) => `${SITE_URL}/bills/votes/${b.id}` },
];

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

const categoryOptions: { value: BillCategory; label: string }[] = [
  { value: "条例", label: "条例" },
  { value: "予算", label: "予算" },
  { value: "決算", label: "決算" },
  { value: "契約", label: "契約" },
  { value: "財産取得", label: "財産取得" },
  { value: "人事", label: "人事" },
  { value: "意見書", label: "意見書" },
  { value: "決議", label: "決議" },
  { value: "請願", label: "請願" },
  { value: "陳情", label: "陳情" },
  { value: "専決処分", label: "専決処分" },
  { value: "その他", label: "その他" },
  { value: "不明", label: "不明" },
];

const verificationOptions: { value: string; label: string }[] = [
  { value: "verified", label: verificationStatusLabels.verified },
  { value: "partially-verified", label: verificationStatusLabels["partially-verified"] },
  { value: "pending", label: verificationStatusLabels.pending },
  { value: "individual-votes-unavailable", label: verificationStatusLabels["individual-votes-unavailable"] },
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
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [, setSearchParams] = useSearchParams();

  // Phase240：絞り込み条件の初期値は既定値に固定する。プリレンダリング済みHTMLは常に
  // クエリなしの内容（静的ホスティングはクエリを無視して同じファイルを返す）のため、
  // 初回レンダリングでURLの条件を反映するとハイドレーション不一致になる。
  // アクセス時のURLに入っていた条件は、ハイドレーション完了後に一度だけ反映する。
  const [query, setQuery] = useState("");
  const [fiscalYear, setFiscalYear] = useState("all");
  const [session, setSession] = useState("all");
  const [category, setCategory] = useState("all");
  const [verification, setVerification] = useState("all");
  const [result, setResult] = useState("all");
  const [committee, setCommittee] = useState("all");
  const [proposerType, setProposerType] = useState("all");
  const [voteMethod, setVoteMethod] = useState("all");
  const [unanimity, setUnanimity] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);

  const initialParamsApplied = useInitialSearchParams((params) => {
    setQuery(params.get("q") ?? "");
    setFiscalYear(params.get("year") ?? "all");
    setSession(params.get("session") ?? "all");
    setCategory(params.get("category") ?? "all");
    setVerification(params.get("status") ?? "all");
    setResult(params.get("result") ?? "all");
    setCommittee(params.get("committee") ?? "all");
    setProposerType(params.get("proposer") ?? "all");
    setVoteMethod(params.get("method") ?? "all");
  });

  // 検索条件をURLクエリへ反映し、再読み込みや共有後も条件を維持できるようにする。
  // 反映前（＝ハイドレーション完了前）に書き戻すと、共有されたURLの条件を消してしまうため待つ。
  useEffect(() => {
    if (!initialParamsApplied) return;
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (fiscalYear !== "all") next.set("year", fiscalYear);
    if (session !== "all") next.set("session", session);
    if (category !== "all") next.set("category", category);
    if (verification !== "all") next.set("status", verification);
    if (result !== "all") next.set("result", result);
    if (committee !== "all") next.set("committee", committee);
    if (proposerType !== "all") next.set("proposer", proposerType);
    if (voteMethod !== "all") next.set("method", voteMethod);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialParamsApplied, query, fiscalYear, session, category, verification, result, committee, proposerType, voteMethod]);

  const fiscalYearOptions = useMemo(
    () =>
      Array.from(new Set(billVotes.map((b) => b.fiscalYear)))
        .sort((a, b) => b.localeCompare(a, "ja"))
        // 照合に使う value は記録どおりの文字列のまま、表示ラベルだけ表記をそろえる。
        .map((y) => ({ value: y, label: displayFiscalYearLabel(y) })),
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

  const voteMethodOptions = useMemo(
    () =>
      Array.from(new Set(billVotes.map((b) => b.voteMethod).filter((v): v is NonNullable<typeof v> => !!v)))
        .sort((a, b) => a.localeCompare(b, "ja"))
        .map((v) => ({ value: v as string, label: v as string })),
    [],
  );

  const hasActiveFilter =
    query !== "" ||
    fiscalYear !== "all" ||
    session !== "all" ||
    category !== "all" ||
    verification !== "all" ||
    result !== "all" ||
    committee !== "all" ||
    proposerType !== "all" ||
    voteMethod !== "all" ||
    unanimity !== "all";

  const clearFilters = () => {
    setQuery("");
    setFiscalYear("all");
    setSession("all");
    setCategory("all");
    setVerification("all");
    setResult("all");
    setCommittee("all");
    setProposerType("all");
    setVoteMethod("all");
    setUnanimity("all");
  };

  const filteredBills = useMemo(() => {
    const q = query.trim();
    const matched = billVotes.filter((b) => {
      const matchesQuery =
        q === "" || b.billNumber.includes(q) || b.billTitle.includes(q) || b.summary.includes(q);
      const matchesFiscalYear = fiscalYear === "all" || b.fiscalYear === fiscalYear;
      const matchesSession = session === "all" || b.session === session;
      const matchesCategory = category === "all" || b.category === category;
      const matchesVerification = verification === "all" || verificationStatusOf(b) === verification;
      const matchesResult = result === "all" || b.result === result;
      const matchesCommittee = committee === "all" || b.committee === committee;
      const matchesProposerType = proposerType === "all" || b.proposerType === proposerType;
      const matchesVoteMethod = voteMethod === "all" || b.voteMethod === voteMethod;
      const matchesUnanimity =
        unanimity === "all" ||
        (unanimity === "unanimous" ? isUnanimous(b) === true : isUnanimous(b) === false);
      return (
        matchesQuery &&
        matchesFiscalYear &&
        matchesSession &&
        matchesCategory &&
        matchesVerification &&
        matchesResult &&
        matchesCommittee &&
        matchesProposerType &&
        matchesVoteMethod &&
        matchesUnanimity
      );
    });
    return sortBills(matched, sort);
  }, [query, fiscalYear, session, category, verification, result, committee, proposerType, voteMethod, unanimity, sort]);

  // 検索条件が変わったら1ページ目に戻す（前の絞り込みでの途中ページのまま次の検索結果を
  // 見せてしまい、0件や範囲外ページに見えてしまう事故を防ぐ）。
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, fiscalYear, session, category, verification, result, committee, proposerType, voteMethod, unanimity, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / BILLS_PAGE_SIZE));
  const pagedBills = useMemo(
    () => filteredBills.slice((page - 1) * BILLS_PAGE_SIZE, page * BILLS_PAGE_SIZE),
    [filteredBills, page],
  );

  return (
    <div className="px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">議案ごとの賛否</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市議会で審議された議案について、公開資料で確認できる議員ごとの賛否を整理しています。賛否の人数のみで議員活動を評価するものではありません。
        </p>
      </div>

      <p className="mb-4 rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        本サイトでは、公式資料で確認できた議案を掲載しています。資料の表現が複雑な案件については、非掲載にせず「確認待ち」として公開しています。確認待ちの情報は、公式資料との照合作業後に更新します。
      </p>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <GlossaryNote
          term="議案"
          definition="市長や議員が議会に提出し、議決（可決・否決）を求める提案です。予算や条例の制定・改廃、契約の締結などが含まれます。"
        />
        <GlossaryNote
          term="賛否"
          definition="議案に対して、議員一人ひとりが賛成・反対の意思を示した記録です。賛否の数のみで議員の能力や政策の是非を評価するものではありません。"
        />
        {/* Phase220：絞り込みの「会期年度」が、議案名に入っている予算・決算の対象年度とは
            別のものであることを、一覧の時点で説明する。 */}
        <GlossaryNote
          term={BILL_SESSION_FISCAL_YEAR_LABEL}
          definition={BILL_SESSION_FISCAL_YEAR_DESCRIPTION}
        />
      </div>

      <div className="sticky top-[57px] z-10 -mx-4 space-y-3 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0 sm:py-2">
        <SearchBar value={query} onChange={setQuery} placeholder="議案番号、議案名、概要で検索" />
        {/* Phase192：絞り込み条件が10項目あるため、スマートフォン幅で折り返すと
            この固定表示（sticky）のバー自体が画面の大半を覆い、画面下部の
            ボトムナビゲーションとも重なっていた（320〜430pxで実測）。
            スマートフォンでは1行の横スクロール（既存の表・パンくずと同じ方式）にし、
            sm以上ではこれまでどおり折り返して全条件を一覧表示する。 */}
        <p className="text-xs text-on-surface-variant sm:hidden">絞り込み条件は横にスクロールできます（全9項目＋並び替え）</p>
        <div
          className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-x-visible sm:px-0 sm:pb-0"
          role="group"
          aria-label="議案の絞り込み条件"
        >
          {/* Phase220：「年度」だけでは、議案名に入っている予算・決算の対象年度と取り違えられる。
              この絞り込みは会期年度（議案を審議した会期が属する年度）で絞り込む。 */}
          <FilterSelect
            label={BILL_SESSION_FISCAL_YEAR_LABEL}
            value={fiscalYear}
            onChange={setFiscalYear}
            options={fiscalYearOptions}
          />
          <FilterSelect label="定例会" value={session} onChange={setSession} options={sessionOptions} />
          <FilterSelect label="分類" value={category} onChange={setCategory} options={categoryOptions} />
          <FilterSelect label="確認状況" value={verification} onChange={setVerification} options={verificationOptions} />
          <FilterSelect label="委員会" value={committee} onChange={setCommittee} options={committeeOptions} />
          <FilterSelect label="議決結果" value={result} onChange={setResult} options={resultOptions} />
          <FilterSelect label="提出者" value={proposerType} onChange={setProposerType} options={proposerTypeOptions} />
          <FilterSelect label="採決方法" value={voteMethod} onChange={setVoteMethod} options={voteMethodOptions} />
          <FilterSelect label="採決の傾向" value={unanimity} onChange={setUnanimity} options={unanimityOptions} />
          <label className="flex min-h-11 max-w-full shrink-0 items-stretch gap-2 rounded-full bg-surface-container-high px-4 text-sm text-on-surface-variant shadow-e1 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
            <SortIcon className="h-4 w-4 shrink-0 self-center" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="並び替え"
              className="min-w-0 max-w-full truncate bg-transparent text-on-surface focus:outline-none"
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

      <h2 id="bill-votes-list-heading" className="sr-only">議案一覧</h2>
      {billVotes.length === 0 ? (
        <p className="mt-3 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          {dataCoverage.billVotes.zeroCountNote}
        </p>
      ) : (
        <>
          <div className="mb-3 mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-on-surface-variant" aria-live="polite" aria-atomic="true">
              {filteredBills.length > 0
                ? `${filteredBills.length}件の議案が見つかりました（全${totalPages}ページ中${page}ページ目）`
                : "条件に一致する議案は見つかりませんでした。"}
            </p>
            {filteredBills.length > 0 && (
              <CsvDownloadButton filename="nobeoka-bill-votes.csv" rows={filteredBills} columns={BILL_VOTES_CSV_COLUMNS} />
            )}
          </div>
          {filteredBills.length > 0 && (
            <ul className="space-y-3">
              {pagedBills.map((bill) => {
                const { approve, oppose, departed, absent } = voteCounts(bill);
                return (
                  <li key={bill.id} className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span>{bill.billNumber}</span>
                          <span>{bill.session}</span>
                          {bill.category && (
                            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-on-surface-variant">
                              {bill.category}
                            </span>
                          )}
                          <VerificationStatusBadge bill={bill} />
                        </div>
                        <h2 className="mt-1 text-base font-semibold leading-snug text-on-surface">{bill.billTitle}</h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-on-surface-variant">{bill.summary}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          提出日：{safeFormatDate(bill.submittedDate)}／議決日：{safeFormatDate(bill.votingDate)}／提出者：
                          {bill.proposer ?? "確認中"}
                          {bill.submittingDepartment && `／担当課：${bill.submittingDepartment}`}
                        </p>
                        <p className="mt-1 text-sm font-medium text-on-surface">議決結果：{bill.result}</p>
                        <p className="mt-0.5 text-xs text-on-surface-variant">審査：{reviewFlowSummaryLabel(bill, billVotes)}</p>
                        {bill.memberVotes.length > 0 && (
                          <p className="mt-1 text-xs text-on-surface-variant">
                            賛成{approve}人／反対{oppose}人／退席{departed}人／欠席{absent}人
                          </p>
                        )}
                      </div>
                      <Link
                        to={`/bills/votes/${bill.id}`}
                        /* Phase197：一覧カードの主要操作。GeneralQuestionCard・VerifiedSpeechCardの
                           「詳細を見る」と同じ inline-flex＋min-h-11 に揃え、44pxのタップ領域を確保する。 */
                        className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        詳細を見る
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            scrollTargetId="bill-votes-list-heading"
          />
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
