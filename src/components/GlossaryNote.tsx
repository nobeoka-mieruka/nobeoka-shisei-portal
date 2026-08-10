interface GlossaryNoteProps {
  /** 用語（例："一般質問"）。表示は「{term}とは？」の見出しになる。 */
  term: string;
  /** 短い説明（1〜3文程度）。教科書的な長文は避け、要点のみとする。 */
  definition: string;
  className?: string;
}

/**
 * 議会・行政の専門用語について、市政や議会に詳しくない市民向けの短い補足を
 * 折りたたみ表示するコンポーネント。既定では閉じており、必要な人だけが開いて読む。
 * 一般的な制度の説明のみを扱い、延岡市固有の事実主張は含めない（出典不要な範囲に限定）。
 */
export function GlossaryNote({ term, definition, className = "" }: GlossaryNoteProps) {
  return (
    <details className={`rounded-xl bg-surface-container-low p-3.5 text-xs leading-relaxed text-on-surface-variant ${className}`}>
      <summary className="cursor-pointer font-medium text-on-surface">{term}とは？</summary>
      <p className="mt-1.5">{definition}</p>
    </details>
  );
}
