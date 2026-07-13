import { GlobeIcon } from "./icons";
import { formatJapaneseDate } from "../config/site";

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
        className="inline-flex items-center gap-1 rounded text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
