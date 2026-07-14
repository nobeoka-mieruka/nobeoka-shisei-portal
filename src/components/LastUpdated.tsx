import { getLastUpdatedText } from "../lib/lastUpdated";

export function LastUpdated({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-on-surface-variant ${className}`}>最終更新：{getLastUpdatedText()}</p>
  );
}
