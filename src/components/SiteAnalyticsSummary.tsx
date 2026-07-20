import { useEffect, useState } from "react";
import { SectionCard } from "./SectionCard";

interface SiteStats {
  totalPageViews: number;
  source: "cloudflare";
  updatedAt: string;
}

type LoadState = { status: "loading" } | { status: "success"; data: SiteStats } | { status: "error" };

export function SiteAnalyticsSummary() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-stats")
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data: SiteStats) => {
        if (!cancelled) setState({ status: "success", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard title="サイト利用状況" titleClassName="text-lg font-bold text-on-surface">
      {state.status === "loading" && (
        <p className="text-sm text-on-surface-variant">累計アクセス数を読み込んでいます</p>
      )}
      {state.status === "error" && (
        <div>
          <p className="text-sm text-on-surface-variant">累計アクセス数は現在集計中です</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Cloudflare Analyticsの集計結果が利用可能になり次第、表示します。
          </p>
        </div>
      )}
      {state.status === "success" && (
        <div className="rounded-lg bg-surface-container-high p-4">
          <p className="text-xs text-on-surface-variant">累計アクセス数</p>
          <p className="mt-1 text-3xl font-bold text-on-surface break-all">
            {state.data.totalPageViews.toLocaleString("ja-JP")}回
          </p>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
        Cloudflare Analyticsによる集計値です。個人を特定できる情報は表示していません。
      </p>
    </SectionCard>
  );
}
