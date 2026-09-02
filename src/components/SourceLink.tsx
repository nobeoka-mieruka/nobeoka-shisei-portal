import { GlobeIcon } from "./icons";
import { formatJapaneseDate } from "../config/site";
import { trackEvent } from "../lib/analytics";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface SourceLinkProps {
  url: string;
  label?: string;
  verifiedAt?: string;
  className?: string;
}

export function SourceLink({ url, label = "根拠資料を見る", verifiedAt, className = "" }: SourceLinkProps) {
  return (
    <span className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${className}`}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label}（外部サイトが新しいタブで開きます）`}
        onClick={() => {
          let hostname = "";
          try {
            hostname = new URL(url).hostname;
          } catch {
            // 不正なURLの場合はhostnameを空のまま送信する（クリック自体は妨げない）。
          }
          trackEvent("official_source_click", { link_domain: hostname, page_path: window.location.pathname });
        }}
        className="inline-flex items-center gap-1 rounded py-1 text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <GlobeIcon className="h-3.5 w-3.5" />
        {label}
        <span aria-hidden>（外部サイト）</span>
      </a>
      {verifiedAt && (
        <span className="text-on-surface-variant">
          最終確認：{ISO_DATE.test(verifiedAt) ? formatJapaneseDate(verifiedAt) : verifiedAt}
        </span>
      )}
    </span>
  );
}
