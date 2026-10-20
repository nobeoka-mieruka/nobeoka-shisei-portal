import type { SourceEntry } from "../types";
import { GlobeIcon } from "./icons";
import { BROKEN_SOURCE_LINK_LABEL, isKnownBrokenSourceLink } from "../lib/brokenSourceLinks";

export function SourceList({ sources }: { sources?: SourceEntry[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {sources.map((s) => (
        <li key={s.url}>
          {isKnownBrokenSourceLink(s.url) ? (
            // 外部リンク監査で到達できないと確認済みのURLはリンクにしない（Phase209と同じ方針）。
            <span className="inline-flex min-h-11 flex-wrap items-center gap-1.5 py-1 text-sm text-on-surface-variant">
              <GlobeIcon className="h-4 w-4 shrink-0" />
              <span className="break-words">{s.label}</span>
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs">{BROKEN_SOURCE_LINK_LABEL}</span>
            </span>
          ) : (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${s.label}を新しいタブで開く`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded py-1 text-sm text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <GlobeIcon className="h-4 w-4 shrink-0" />
              <span className="break-words">{s.label}</span>
              <span aria-hidden className="text-xs text-on-surface-variant">
                （外部サイト）
              </span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
