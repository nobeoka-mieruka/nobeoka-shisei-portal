import { normalize } from "../lib/search";

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
}

/**
 * text内で検索語（複数可、スペース区切り）に一致する部分を<mark>で強調する。
 * dangerouslySetInnerHTMLは使わず、Reactの通常のノードとして安全に組み立てる。
 */
export function HighlightText({ text, query, className = "" }: HighlightTextProps) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return <span className={className}>{text}</span>;

  const normalizedText = normalize(text);
  const ranges: { start: number; end: number }[] = [];

  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const idx = normalizedText.indexOf(token, from);
      if (idx === -1) break;
      ranges.push({ start: idx, end: idx + token.length });
      from = idx + token.length;
    }
  }

  if (ranges.length === 0) return <span className={className}>{text}</span>;

  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((r, i) => {
    if (r.start > cursor) nodes.push(text.slice(cursor, r.start));
    nodes.push(
      <mark key={i} className="rounded-sm bg-tertiary-container text-on-tertiary-container">
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <span className={className}>{nodes}</span>;
}
