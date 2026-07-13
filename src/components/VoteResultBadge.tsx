import type { VoteResult } from "../types";

const styles: Record<VoteResult, string> = {
  賛成: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  反対: "bg-error-container text-on-error-container",
  棄権: "bg-[#fff3d6] text-[#7a5900] dark:bg-[#3a2e00] dark:text-[#f2cf6b]",
  欠席: "bg-surface-variant text-on-surface-variant",
  退席: "bg-surface-variant text-on-surface-variant",
  議長のため採決に加わらず: "bg-surface-variant text-on-surface-variant",
  確認中: "bg-surface-container-high text-on-surface-variant",
  記録なし: "bg-surface-container-high text-on-surface-variant",
};

export function VoteResultBadge({ result }: { result: VoteResult }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[result]}`}
    >
      {result}
    </span>
  );
}
