import { useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import billVotesData from "../data/billVotes.json";
import type { BillVoteItem } from "../types";
import { publicBills } from "../lib/billVotes";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { SectionCard } from "../components/SectionCard";
import { JsonLd } from "../components/JsonLd";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const billVotes = publicBills(billVotesData as BillVoteItem[]);
const billsById = new Map(billVotes.map((b) => [b.id, b]));

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function safeDate(iso?: string | null): string {
  return iso ? formatJapaneseDate(iso) : "確認中";
}

function BillPicker({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  const sorted = useMemo(
    () => [...billVotes].sort((a, b) => (b.votingDate ?? "").localeCompare(a.votingDate ?? "")),
    [],
  );
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-on-surface">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full min-w-0 max-w-full rounded-lg border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface ${linkClass}`}
      >
        <option value="">議案を選択してください</option>
        {sorted.map((b) => (
          <option key={b.id} value={b.id}>
            {b.billNumber}　{b.billTitle}（{b.session}）
          </option>
        ))}
      </select>
    </label>
  );
}

function BillSummaryColumn({ bill }: { bill: BillVoteItem }) {
  return (
    <div className="min-w-0 flex-1 space-y-2 rounded-xl bg-surface-container-low p-4 shadow-e1">
      <p className="text-xs text-on-surface-variant">{bill.billNumber}</p>
      <h3 className="break-words text-base font-semibold text-on-surface">{bill.billTitle}</h3>
      <dl className="space-y-1 text-xs text-on-surface-variant">
        <div>
          <dt className="inline">定例会：</dt>
          <dd className="inline text-on-surface">{bill.session}</dd>
        </div>
        <div>
          <dt className="inline">提出日：</dt>
          <dd className="inline text-on-surface">{safeDate(bill.submittedDate)}</dd>
        </div>
        <div>
          <dt className="inline">議決日：</dt>
          <dd className="inline text-on-surface">{safeDate(bill.votingDate)}</dd>
        </div>
        <div>
          <dt className="inline">結果：</dt>
          <dd className="inline font-medium text-on-surface">{bill.result}</dd>
        </div>
      </dl>
      <Link to={`/bills/votes/${bill.id}`} className={`inline-block text-sm text-primary underline ${linkClass}`}>
        議案詳細を見る
      </Link>
    </div>
  );
}

export function BillComparePage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const [searchParams, setSearchParams] = useSearchParams();

  const leftId = searchParams.get("left") ?? "";
  const rightId = searchParams.get("right") ?? "";
  const [pickLeft, setPickLeft] = useState(leftId);
  const [pickRight, setPickRight] = useState(rightId);

  const leftBill = billsById.get(leftId);
  const rightBill = billsById.get(rightId);

  const applyPicker = () => {
    const next = new URLSearchParams();
    if (pickLeft) next.set("left", pickLeft);
    if (pickRight) next.set("right", pickRight);
    setSearchParams(next);
  };

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/bills/votes" label="議案・賛否一覧に戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">議案の比較</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          2つの議案を選んで、定例会・提出日・議決日・結果を比較できます。名称が似ているだけで同一の条例改正と断定はしていません。関連の候補は「未確認」「確認済み」を区別して表示します。
        </p>
      </div>

      <SectionCard title="比較する議案を選ぶ">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <BillPicker label="議案A" value={pickLeft} onChange={setPickLeft} />
          <BillPicker label="議案B" value={pickRight} onChange={setPickRight} />
        </div>
        <button
          type="button"
          onClick={applyPicker}
          className={`mt-3 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${linkClass}`}
        >
          比較する
        </button>
      </SectionCard>

      {leftId && rightId && (!leftBill || !rightBill) && (
        <p className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された議案が見つかりませんでした。確認待ちの議案は比較対象にできません。
        </p>
      )}

      {leftBill && rightBill && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <BillSummaryColumn bill={leftBill} />
            <BillSummaryColumn bill={rightBill} />
          </div>

          <SectionCard title="本文の比較">
            <p className="text-sm leading-relaxed text-on-surface-variant">
              比較可能な議案本文が登録されていません。現在掲載している審議結果PDFには、議案の本文（改正条文）は含まれていません。議案名・結果・議決日などのメタデータのみを比較として表示しています。
            </p>
          </SectionCard>
        </>
      )}
    </div>
  );
}
