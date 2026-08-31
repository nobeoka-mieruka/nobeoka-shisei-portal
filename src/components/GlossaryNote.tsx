import { QuestionMarkCircleIcon } from "./icons";

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
 * Phase140項目9：説明が開けること自体に気づきにくいという指摘を受け、「？」アイコンと
 * 枠線・開閉に応じて回転する三角マークを加え、タップできる見出しであることを視覚的に示す。
 */
export function GlossaryNote({ term, definition, className = "" }: GlossaryNoteProps) {
  return (
    <details
      className={`group rounded-xl border border-outline-variant/60 bg-surface-container-low p-3.5 text-xs leading-relaxed text-on-surface-variant ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-on-surface [&::-webkit-details-marker]:hidden">
        <QuestionMarkCircleIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="underline decoration-dotted underline-offset-2">{term}とは？</span>
        <span aria-hidden className="ml-auto shrink-0 text-on-surface-variant transition-transform group-open:rotate-90">
          ▶
        </span>
      </summary>
      <p className="mt-1.5">{definition}</p>
    </details>
  );
}
