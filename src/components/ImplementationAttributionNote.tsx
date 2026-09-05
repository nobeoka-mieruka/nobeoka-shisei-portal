import type { ImplementationAttribution } from "../types";
import { implementationAttributionLines } from "../lib/implementationAttribution";
import { humanizeDataNote } from "../lib/citizenTermLabels";

/**
 * Phase230-231：出来事の「実施主体」を市民向けの日本語で表示する。
 *
 * 市政年表には、延岡市の事業ではないもの（宮崎県が設置した施設、県主催で延岡市が参加した
 * 催し等）も含まれる。区別が無いまま並べると「延岡市の事業」と誤読される恐れがあるため、
 * 一次資料で実施主体を確認できた出来事にだけ、この注記を表示する。
 *
 * 注記が無い出来事は「未確認」であって「延岡市の事業」ではない。断定しないため、
 * ここでは何も描画しない（ページ側で確認中である旨をまとめて説明する）。
 * 色ではなく文字で伝え、内部コードは画面に出さない。
 */
export function ImplementationAttributionNote({
  attribution,
  className = "",
}: {
  attribution?: ImplementationAttribution;
  className?: string;
}) {
  if (!attribution) return null;
  const lines = implementationAttributionLines(attribution);
  return (
    <dl className={`rounded-lg bg-surface-container-low p-2.5 text-xs leading-relaxed text-on-surface-variant ${className}`}>
      {lines.map((line) => (
        <div key={line.label} className="flex flex-wrap gap-x-1">
          <dt className="font-semibold text-on-surface">{line.label}：</dt>
          <dd>{line.value}</dd>
        </div>
      ))}
      {/* 他の注記と同じく、内部用語が公開本文へ出ないよう市民向けの言い換えを通す。 */}
      {attribution.attributionNote && <p className="mt-1">{humanizeDataNote(attribution.attributionNote)}</p>}
    </dl>
  );
}
