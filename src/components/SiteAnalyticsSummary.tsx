import { useEffect, useState } from "react";
import { SectionCard } from "./SectionCard";
import { formatJapaneseDate } from "../config/site";

interface SiteStats {
  period: { from: string; to: string };
  visitors: number;
  pageViews: number;
  pagesPerVisitor: number;
  updatedAt: string;
}

type LoadState = { status: "loading" } | { status: "success"; data: SiteStats } | { status: "error" };

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${formatJapaneseDate(jst.toISOString().slice(0, 10))} ${hh}:${mm}`;
}

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
        <p className="text-sm text-on-surface-variant">サイト利用状況を読み込んでいます</p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-on-surface-variant">現在、サイト利用状況を取得できません</p>
      )}
      {state.status === "success" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-surface-container-high p-3">
              <p className="text-xs text-on-surface-variant">訪問者数</p>
              <p className="mt-1 text-lg font-semibold text-on-surface">
                {state.data.visitors.toLocaleString("ja-JP")}人
              </p>
            </div>
            <div className="rounded-lg bg-surface-container-high p-3">
              <p className="text-xs text-on-surface-variant">ページビュー</p>
              <p className="mt-1 text-lg font-semibold text-on-surface">
                {state.data.pageViews.toLocaleString("ja-JP")}PV
              </p>
            </div>
            <div className="rounded-lg bg-surface-container-high p-3">
              <p className="text-xs text-on-surface-variant">平均閲覧ページ数</p>
              <p className="mt-1 text-lg font-semibold text-on-surface">{state.data.pagesPerVisitor}ページ</p>
            </div>
            <div className="rounded-lg bg-surface-container-high p-3">
              <p className="text-xs text-on-surface-variant">集計期間</p>
              <p className="mt-1 text-lg font-semibold text-on-surface">過去30日間</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">最終更新：{formatUpdatedAt(state.data.updatedAt)}</p>
        </>
      )}
      <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
        Google Analyticsによる期間集計値です。個人を特定できる情報は表示していません。
      </p>
    </SectionCard>
  );
}
