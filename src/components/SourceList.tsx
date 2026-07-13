import type { SourceEntry } from "../types";
import { GlobeIcon } from "./icons";

export function SourceList({ sources }: { sources?: SourceEntry[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {sources.map((s) => (
        <li key={s.url}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${s.label}を新しいタブで開く`}
            className="inline-flex items-center gap-1.5 rounded text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <GlobeIcon className="h-4 w-4 shrink-0" />
            <span className="break-words">{s.label}</span>
            <span aria-hidden className="text-xs text-on-surface-variant">
              （外部サイト）
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
