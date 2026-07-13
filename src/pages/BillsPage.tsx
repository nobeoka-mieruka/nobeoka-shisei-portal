import billsData from "../data/bills.json";
import type { Bill } from "../types";
import { SectionCard } from "../components/SectionCard";
import { EmptyState } from "../components/EmptyState";
import { usePageTitle } from "../hooks/usePageTitle";

const bills = billsData as Bill[];

export function BillsPage() {
  usePageTitle("議案・採決結果");

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">議案・採決結果</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          延岡市議会に提出された議案と、議員ごとの採決結果をまとめる予定のページです。
        </p>
      </div>

      <SectionCard title={`議案一覧（${bills.length}件）`}>
        {bills.length > 0 ? (
          <ul className="space-y-2">
            {bills.map((bill) => (
              <li key={bill.id} className="rounded-lg border border-outline-variant p-3 text-sm text-on-surface">
                {bill.billName}
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            <EmptyState message="議案・採決結果は準備中です。確認でき次第、公開資料をもとに掲載します。" />
            <p className="text-xs text-on-surface-variant">
              議案番号や賛否の記録がない状態で、架空の議案を掲載することはありません。
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
