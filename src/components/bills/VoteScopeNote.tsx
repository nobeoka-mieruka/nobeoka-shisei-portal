/** 議員別賛否を表示する箇所に添える、表示範囲の説明（議案への賛否であり、政策・公約への賛否ではない）。 */
export const VOTE_SCOPE_NOTE_TEXT =
  "この表示は議案への賛否を示すものであり、政策・公約そのものへの賛否を示すものではありません。";

export function VoteScopeNote({ className = "" }: { className?: string }) {
  return (
    <p
      className={`rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs leading-relaxed text-on-surface-variant ${className}`}
      role="note"
    >
      {VOTE_SCOPE_NOTE_TEXT}
      同じ議案でも、賛成・反対の理由は議員ごとに異なる場合があります。人物や政策の評価を示すものではありません。
    </p>
  );
}
