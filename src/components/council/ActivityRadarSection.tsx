import { useState } from "react";
import { Link } from "react-router-dom";
import type { RadarMetric } from "../../lib/activityRadar";
import { allMetricsMissing } from "../../lib/activityRadar";
import { SectionCard } from "../SectionCard";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const DATA_STATUS_LABEL: Record<RadarMetric["dataStatus"], string> = {
  complete: "確認済み",
  partial: "一部のみ確認",
  missing: "資料を確認中",
  "not-applicable": "対象外",
};

const DATA_STATUS_BADGE_CLASS: Record<RadarMetric["dataStatus"], string> = {
  complete: "bg-primary-container text-on-primary-container",
  partial: "bg-tertiary-container text-on-tertiary-container",
  missing: "bg-surface-container-high text-on-surface-variant",
  "not-applicable": "bg-surface-container-high text-on-surface-variant",
};

function MetricCard({ metric }: { metric: RadarMetric }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-outline-variant p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex min-h-11 w-full flex-wrap items-center justify-between gap-2 text-left ${linkClass}`}
      >
        <span className="text-sm font-semibold text-on-surface">{metric.label}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold text-on-surface">
            {metric.value !== null
              ? `${Math.round(metric.value)}%`
              : metric.rawValue != null
                ? `${metric.rawValue.toLocaleString("ja-JP")}件`
                : "―"}
          </span>
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
      {metric.dataStatus === "not-applicable" && metric.notApplicableReason && (
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{metric.notApplicableReason}</p>
      )}
      {metric.value === null && metric.rawValue == null && metric.dataStatus === "missing" && (
        <p className="mt-1 text-xs text-on-surface-variant">
          公開資料をまだ確認できていません（活動が無かったという意味ではありません）。
        </p>
      )}
      {open && (
        <div className="mt-2 space-y-1 border-t border-outline-variant pt-2 text-xs leading-relaxed text-on-surface-variant">
          <p>{metric.description}</p>
          {metric.ordinanceBasis && <p>条例上の根拠：{metric.ordinanceBasis}</p>}
          <p>算定方法：{metric.methodNote}</p>
          <p>出典：{metric.sourceLabel}</p>
          {metric.updatedAt && <p>最終更新：{metric.updatedAt}</p>}
        </div>
      )}
    </li>
  );
}

/**
 * 議員1名分の議会活動データ。
 *
 * 割合として算定できる指標（延岡市議会基本条例に対応するもの）と、
 * 件数などの事実の記録とを分けて示す。
 * レーダー図は使わない。値を持つ指標が1つしかない状態で多角形を描くと、
 * 形の大小そのものが意味を持つように見えてしまうため。
 */
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
  // 割合として算定できたものだけを「指標」とし、残りは事実の記録として並べる。
  const scored = metrics.filter((m) => m.value !== null || m.dataStatus === "not-applicable");
  const facts = metrics.filter((m) => m.value === null && m.dataStatus !== "not-applicable");

  if (allMetricsMissing(metrics)) {
    return (
      <SectionCard title="議会活動データ">
        <p className="text-xs leading-relaxed text-on-surface-variant">
          延岡市議会が公開する一次資料から確認できる活動を、共通の基準で指標化・可視化しています。各指標の算出方法、対象期間、使用した一次資料は、数値の根拠として公開しています（
          <Link to="/methodology/council-activity" className={`font-medium text-primary underline ${linkClass}`}>
            算定方法
          </Link>
          ）。資料未公開・未確認の情報は、実績ゼロとしては扱いません。示しているのは公開された議会活動の記録であり、議員個人の能力や人物、政策の内容の良し悪しを判定するものではありません。
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
        延岡市議会が公開する一次資料から確認できる活動を、共通の基準で指標化・可視化しています。各指標の算出方法、対象期間、使用した一次資料は、数値の根拠として公開しています（
        <Link to="/methodology/council-activity" className={`font-medium text-primary underline ${linkClass}`}>
          算定方法
        </Link>
        ）。
      </p>


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

      <h3 className="mb-2 mt-4 text-sm font-semibold text-on-surface">
        指標（延岡市議会基本条例に対応するもの）
      </h3>
      {scored.length > 0 ? (
        <ul className="space-y-2">
          {scored.map((m) => (
            <MetricCard key={m.key} metric={m} />
          ))}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed text-on-surface-variant">
          この議員について、割合として算定できる指標はありません。
        </p>
      )}

      <h3 className="mb-2 mt-5 text-sm font-semibold text-on-surface">確認できた活動の記録</h3>
      <p className="mb-2 text-xs leading-relaxed text-on-surface-variant">
        点数にはしていません。公開された一次資料から確認できた件数と、確認できていない項目をそのまま示しています。
      </p>
      <ul className="space-y-2">
        {facts.map((m) => (
          <MetricCard key={m.key} metric={m} />
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setMethodologyOpen((v) => !v)}
        aria-expanded={methodologyOpen}
        className={`mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline ${linkClass}`}
      >
        {methodologyOpen ? "算定方法を閉じる" : "算定方法を見る"}
      </button>
      {methodologyOpen && (
        <div className="mt-2 space-y-2 rounded-lg bg-surface-container-high p-3 text-xs leading-relaxed text-on-surface-variant">
          <p>
            指標は、公開された一次資料から確認できた件数を、あらかじめ決めた固定の分母で割った割合です。他の議員の活動によって本人の値が上下することはありません。資料を確認できていない項目は0とはせず「資料を確認中」、制度上その議員に当てはまらない項目は「対象外」として区別しています。集計の対象は、在職中かつ会議録を確認できた会期に限っています。
          </p>
          <p>詳しい定義・計算式・欠損データの扱い・出典の一覧は、算定方法ページでご確認いただけます。</p>
          <Link to="/methodology/council-activity" className={`inline-block font-medium text-primary underline ${linkClass}`}>
            算定方法の詳細ページを見る →
          </Link>
        </div>
      )}
    </SectionCard>
  );
}
