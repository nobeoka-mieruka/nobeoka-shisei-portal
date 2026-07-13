import type { SNSLink } from "../types";
import { snsMeta } from "../lib/sns";
import { SocialVerificationBadge } from "./SocialVerificationBadge";

interface SnsLinksProps {
  links: SNSLink[];
  className?: string;
}

export function SnsLinks({ links, className = "" }: SnsLinksProps) {
  if (links.length === 0) return null;
  const withStatus = links.filter((link) => link.verificationStatus);

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
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
      {withStatus.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {withStatus.map((link) => (
            <li key={link.url} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-on-surface">{snsMeta[link.platform].label}</span>
              <SocialVerificationBadge status={link.verificationStatus} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
