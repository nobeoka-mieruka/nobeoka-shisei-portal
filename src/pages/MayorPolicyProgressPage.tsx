import policyProgressData from "../data/mayorPolicyProgress.json";
import type { MayorPolicyProgressData } from "../types";
import { BackLink } from "../components/BackLink";
import { SectionCard } from "../components/SectionCard";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { GlobeIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";

const data = policyProgressData as MayorPolicyProgressData;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MayorPolicyProgressPage() {
  usePageTitle("市長公約の進捗状況");

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <BackLink to="/mayor" label="市長情報に戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市長公約の進捗状況</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          4つの政策について、現在の状況と根拠資料をまとめています。詳細な判定や個別事業ごとの予算額の紐付けは今後の更新で対応予定です。
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.policies.map((p) => (
          <li key={p.id} className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
            <h2 className="text-base font-semibold text-on-surface">{p.title}</h2>

            <p className="mt-3 text-xs font-medium text-on-surface-variant">現在の状況</p>
            <p className="mt-1 text-sm text-on-surface">{p.currentStatus}</p>

            <p className="mt-3 text-xs font-medium text-on-surface-variant">根拠資料</p>
            <p className="mt-1 text-sm text-on-surface-variant">{p.evidenceLabel}</p>

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
          </li>
        ))}
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

      <p className="px-1 text-xs text-on-surface-variant">最終確認：{formatJapaneseDate(data.referenceDate)}</p>

      <CorrectionRequestButton pageName="市長公約の進捗状況" />
    </div>
  );
}
