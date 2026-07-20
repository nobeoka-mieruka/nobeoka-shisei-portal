import { useEffect, useState } from "react";
import { SectionCard } from "./SectionCard";

interface SiteStatsSuccess {
  ok: true;
  totalViews: number;
  todayViews: number;
  updatedAt: string;
  source: "cloudflare";
  windowDays?: number;
  rangeStartDate?: string;
}

interface SiteStatsFailure {
  ok: false;
  status: "configuration_required" | "temporarily_unavailable";
  message: string;
}

type SiteStatsResponse = SiteStatsSuccess | SiteStatsFailure;

type LoadState =
  | { status: "loading" }
  | { status: "success"; data: SiteStatsSuccess }
  | { status: "configuration_required"; message: string }
  | { status: "unavailable"; message: string };

const GENERIC_UNAVAILABLE_MESSAGE = "アクセス数を一時的に取得できません。";

export function SiteAnalyticsSummary() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-stats")
      .then((res) => res.json())
      .then((data: SiteStatsResponse) => {
        if (cancelled) return;
        if (data.ok) {
          setState({ status: "success", data });
        } else if (data.status === "configuration_required") {
          setState({ status: "configuration_required", message: data.message });
        } else {
          setState({ status: "unavailable", message: data.message });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable", message: GENERIC_UNAVAILABLE_MESSAGE });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard title="サイト利用状況" titleClassName="text-lg font-bold text-on-surface">
      {state.status === "loading" && (
        <p className="text-sm text-on-surface-variant">アクセス数を読み込んでいます</p>
      )}
      {state.status === "configuration_required" && (
        <div>
          <p className="text-sm text-on-surface-variant">アクセス解析の設定を確認しています</p>
          <p className="mt-1 text-xs text-on-surface-variant">準備が整い次第、アクセス数を表示します。</p>
        </div>
      )}
      {state.status === "unavailable" && (
        <div>
          <p className="text-sm text-on-surface-variant">アクセス数を確認中です</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Cloudflare Analyticsの集計結果が利用可能になり次第、表示します。
          </p>
        </div>
      )}
      {state.status === "success" && (
        <div className="rounded-lg bg-surface-container-high p-4">
          <p className="text-xs text-on-surface-variant">
            {state.data.windowDays ? `直近${state.data.windowDays}日間のアクセス数` : "アクセス数"}
          </p>
          <p className="mt-1 text-3xl font-bold text-on-surface break-all">
            {state.data.totalViews.toLocaleString("ja-JP")}回
          </p>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
        Cloudflare Analyticsで取得可能な期間内の集計値です（サイト開設以来の累計ではありません）。個人を特定できる情報は表示していません。
      </p>
    </SectionCard>
  );
}
