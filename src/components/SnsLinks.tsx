import type { SNSLink } from "../types";
import { snsMeta } from "../lib/sns";

interface SnsLinksProps {
  links: SNSLink[];
  className?: string;
}

export function SnsLinks({ links, className = "" }: SnsLinksProps) {
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {links.map((link) => {
        const meta = snsMeta[link.platform];
        const Icon = meta.Icon;
        return (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={meta.label}
            title={meta.label}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition hover:bg-secondary-container hover:text-on-secondary-container active:scale-95"
          >
            <Icon className="h-5 w-5" />
          </a>
        );
      })}
    </div>
  );
}
