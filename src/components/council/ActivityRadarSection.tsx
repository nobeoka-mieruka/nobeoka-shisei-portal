import { useState } from "react";
import { Link } from "react-router-dom";
import type { RadarMetric } from "../../lib/activityRadar";
import { allMetricsMissing } from "../../lib/activityRadar";
import { ActivityRadarChart } from "./ActivityRadarChart";
import { SectionCard } from "../SectionCard";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const DATA_STATUS_LABEL: Record<RadarMetric["dataStatus"], string> = {
  complete: "データあり",
  partial: "一部データのみ収録",
  missing: "対象記録なし・データ整備中",
};

const DATA_STATUS_BADGE_CLASS: Record<RadarMetric["dataStatus"], string> = {
  complete: "bg-primary-container text-on-primary-container",
  partial: "bg-tertiary-container text-on-tertiary-container",
  missing: "bg-surface-container-high text-on-surface-variant",
};

function MetricCard({ metric }: { metric: RadarMetric }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-outline-variant p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full flex-wrap items-center justify-between gap-2 text-left ${linkClass}`}
      >
        <span className="text-sm font-semibold text-on-surface">{metric.label}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-on-surface">{metric.value !== null ? `${Math.round(metric.value)}` : "―"}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DATA_STATUS_BADGE_CLASS[metric.dataStatus]}`}>
            {DATA_STATUS_LABEL[metric.dataStatus]}
          </span>
        </span>
      </button>
      {metric.numerator != null && metric.denominator != null && (
        <p className="mt-1 text-xs text-on-surface-variant">
          {metric.numerator}／{metric.denominator}（対象のうち確認できた件数）
        </p>
      )}
      {metric.value === null && <p className="mt-1 text-xs text-on-surface-variant">集計対象データが不足しています。</p>}
      {open && (
        <div className="mt-2 space-y-1 border-t border-outline-variant pt-2 text-xs leading-relaxed text-on-surface-variant">
          <p>{metric.description}</p>
          <p>算定方法：{metric.methodNote}</p>
          <p>出典：{metric.sourceLabel}</p>
          {metric.updatedAt && <p>最終更新：{metric.updatedAt}</p>}
        </div>
      )}
    </li>
  );
}

export function ActivityRadarSection({
  metrics,
  targetPeriodLabel,
  updatedAt,
}: {
  metrics: RadarMetric[];
  /** 対象期間の表示用文字列（例："令和5年6月〜令和8年3月定例会"）。 */
  targetPeriodLabel: string;
  updatedAt?: string;
}) {
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  if (allMetricsMissing(metrics)) {
    return (
      <SectionCard title="議会活動データ">
        <p className="text-xs leading-relaxed text-on-surface-variant">
          公開されている議会資料を共通基準で指数化したものです。議員の能力、政策の良し悪し、優劣を評価するものではありません（
          <Link to="/methodology/activity-radar" className={`font-medium text-primary underline ${linkClass}`}>
            算定方法
          </Link>
          ）。
        </p>
        <p className="mt-3 rounded-lg bg-surface-container-high p-3 text-sm text-on-surface-variant">
          現在、この議員のレーダーチャートを作成できるだけの公開データがそろっていません。データは順次整備しています。
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="議会活動データ">
      <p className="text-xs leading-relaxed text-on-surface-variant">
        公開されている議会資料を共通基準で指数化したものです。議員の能力、政策の良し悪し、優劣を評価するものではありません（
        <Link to="/methodology/activity-radar" className={`font-medium text-primary underline ${linkClass}`}>
          算定方法
        </Link>
        ）。
      </p>

      <div className="mt-4">
        <ActivityRadarChart metrics={metrics} />
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-on-surface-variant">
        <div>
          <dt className="inline">対象期間：</dt>
          <dd className="inline">{targetPeriodLabel}</dd>
        </div>
        {updatedAt && (
          <div>
            <dt className="inline">最終更新：</dt>
            <dd className="inline">{updatedAt}</dd>
          </div>
        )}
      </dl>

      <h3 className="mb-2 mt-4 text-sm font-semibold text-on-surface">項目ごとの詳細</h3>
      <ul className="space-y-2">
        {metrics.map((m) => (
          <MetricCard key={m.key} metric={m} />
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setMethodologyOpen((v) => !v)}
        aria-expanded={methodologyOpen}
        className={`mt-3 text-sm font-medium text-primary underline ${linkClass}`}
      >
        {methodologyOpen ? "算定方法を閉じる" : "算定方法を見る"}
      </button>
      {methodologyOpen && (
        <div className="mt-2 space-y-2 rounded-lg bg-surface-container-high p-3 text-xs leading-relaxed text-on-surface-variant">
          <p>
            各項目は、既存の一次情報・公開データを共通の計算式で0〜100へ換算した指数です。データが確認できない項目は0点にせず「対象記録なし」として扱い、在職期間（在職中かつ会議録等が取得済みの会期）のみを集計対象にしています。
          </p>
          <p>詳しい定義・計算式・欠損データの扱い・出典の一覧は、算定方法ページでご確認いただけます。</p>
          <Link to="/methodology/activity-radar" className={`inline-block font-medium text-primary underline ${linkClass}`}>
            算定方法の詳細ページを見る →
          </Link>
        </div>
      )}
    </SectionCard>
  );
}
