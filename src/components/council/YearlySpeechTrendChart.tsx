import type { YearlySpeechCount } from "../../lib/councilSpeeches";

/**
 * 議員1名分の「年別の質問・質疑推移」棒グラフ。
 * 表示する数値は「質問・質疑を確認した会期数」（A）。未解析・質問確認なしの会期を
 * ゼロ件として断定しないよう、対象会期数との差分がある年には注記を添える。
 */
export function YearlySpeechTrendChart({ counts }: { counts: YearlySpeechCount[] }) {
  if (counts.length === 0) return null;
  const maxCount = Math.max(...counts.map((c) => c.sessionsWithQuestions), 1);

  return (
    <ul className="mt-2 space-y-2.5">
      {counts.map((c) => {
        const widthPercent = (c.sessionsWithQuestions / maxCount) * 100;
        const unresolved = c.targetSessionCount - c.sessionsWithQuestions;
        return (
          <li key={c.year}>
            {/* Phase194（WCAG）：role未指定のdivへaria-labelを付けると支援技術によっては
                無視される（aria-prohibited-attr）ため、可視テキストで同じ内容を伝える。 */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-on-surface">{c.year}年</span>
              <span className="shrink-0 text-xs text-on-surface-variant">{c.sessionsWithQuestions}会期</span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${widthPercent}%` }} />
            </div>
            {unresolved > 0 && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-on-surface-variant">
                残り{unresolved}会期は、未解析またはこの議員の質問・質疑が確認されなかった会期です。
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
