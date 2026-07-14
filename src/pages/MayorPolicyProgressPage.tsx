import { useMemo } from "react";
import policyProgressData from "../data/mayorPolicyProgress.json";
import mayorPromisesData from "../data/mayorPromises.json";
import type { MayorPolicyProgressData, MayorPromiseStatusLabel, MayorPromisesData } from "../types";
import { BackLink } from "../components/BackLink";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { PromiseCard } from "../components/mayor/PromiseCard";
import { GlobeIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";

const data = policyProgressData as MayorPolicyProgressData;
const promisesData = mayorPromisesData as MayorPromisesData;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const STATUS_ORDER: MayorPromiseStatusLabel[] = ["進行中", "検討中", "実施済み", "確認中"];

export function MayorPolicyProgressPage() {
  usePageTitle("市長公約の進捗状況");

  const statusCounts = useMemo(() => {
    const counts: Record<MayorPromiseStatusLabel, number> = { 進行中: 0, 検討中: 0, 実施済み: 0, 確認中: 0 };
    for (const p of promisesData.promises) {
      counts[p.statusLabel] += 1;
    }
    return counts;
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <BackLink to="/mayor" label="市長情報に戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市長公約の進捗状況</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          市長の選挙公約、市長本人の進捗公表、延岡市の施政方針・予算書などの公開情報を整理しています。サイト独自の採点や達成率の算定は行っていません。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="全公約" value={promisesData.promises.length} unit="件" />
        {STATUS_ORDER.map((label) => (
          <StatCard key={label} label={label} value={statusCounts[label]} unit="件" />
        ))}
      </div>

      <ul className="space-y-4">
        {data.policies.map((policy) => {
          const items = promisesData.promises.filter((p) => p.categoryTitle === policy.title);
          return (
            <li key={policy.id} className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
              <h2 className="text-base font-semibold text-on-surface">{policy.title}</h2>

              <p className="mt-3 text-xs font-medium text-on-surface-variant">現在の状況</p>
              <p className="mt-1 text-sm text-on-surface">{policy.currentStatus}</p>

              <p className="mt-3 text-xs font-medium text-on-surface-variant">根拠資料</p>
              <p className="mt-1 text-sm text-on-surface-variant">{policy.evidenceLabel}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {data.documents.map((doc) => (
                  <a
                    key={doc.url}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${doc.label}のPDFを新しいタブで開く`}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-high ${linkClass}`}
                  >
                    <GlobeIcon className="h-3.5 w-3.5" />
                    PDFを見る（{doc.label}）
                  </a>
                ))}
              </div>

              {items.length > 0 && (
                <ul className="mt-4 space-y-3 border-t border-outline-variant pt-4">
                  {items.map((p) => (
                    <PromiseCard key={p.id} promise={p} documents={promisesData.documents} />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <SectionCard title="参考資料">
        <a
          href={data.referenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${data.referenceLabel}を新しいタブで開く`}
          className={`inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
        >
          <GlobeIcon className="h-4 w-4" />
          {data.referenceLabel}
        </a>
      </SectionCard>

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        このページは、市長の公約、市長本人が公表した進捗資料、延岡市の施政方針、予算書などを基に公開情報を整理したものです。市長本人の自己評価と、延岡市が公表した事実は区別して表示しています。掲載内容は、特定の政治家を支持、推薦、批判することを目的としたものではありません。
      </p>

      <p className="px-1 text-xs text-on-surface-variant">最終確認：{formatJapaneseDate(data.referenceDate)}</p>

      <CorrectionRequestButton pageName="市長公約の進捗状況" />
    </div>
  );
}
