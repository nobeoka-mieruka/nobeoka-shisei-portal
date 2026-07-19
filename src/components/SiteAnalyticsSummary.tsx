import { useEffect, useState } from "react";
import { SectionCard } from "./SectionCard";

interface SiteStats {
  totalPageViews: number;
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
    <SectionCard title="サイト利用状況">
      {state.status === "loading" && (
        <p className="text-sm text-on-surface-variant">累計アクセス数を読み込んでいます</p>
      )}
      {state.status === "error" && (
        <p className="text-xs text-on-surface-variant">累計アクセス数は現在集計中です</p>
      )}
      {state.status === "success" && (
        <div className="rounded-lg bg-surface-container-high p-3">
          <p className="text-xs text-on-surface-variant">累計アクセス数</p>
          <p className="mt-1 text-lg font-semibold text-on-surface">
            {state.data.totalPageViews.toLocaleString("ja-JP")}回
          </p>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
        Google Analyticsによる期間集計値です。個人を特定できる情報は表示していません。
      </p>
    </SectionCard>
  );
}
