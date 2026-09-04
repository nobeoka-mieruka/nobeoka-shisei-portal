import { useTodayJst } from "../../hooks/useTodayJst";
import {
  councilSessionScheduleInfo,
  type CouncilSessionScheduleInput,
} from "../../lib/councilSessionSchedule";

/**
 * Phase221：会期の進行状態（開催予定／開催中／一般質問終了・結果確認中／開催済み）を示すバッジ。
 *
 * サイト内で会期の状態を文字で示す箇所は、必ずこの部品を通す（言い回しの単一情報源）。
 * 判定は src/lib/councilSessionSchedule.ts の純関数で行い、日付は
 * useTodayJst()（ハイドレーション完了後にだけ確定）から受け取る。
 * サーバー生成HTMLには「開催予定または開催中」という日付に依存しない表記だけが入るため、
 * ビルド日時の状態が固定されることはない。
 *
 * 色だけで意味を伝えないよう、状態は常に文字で表示し、判定根拠を title 属性にも入れる。
 */
export function CouncilSessionStatusBadge({
  session,
  className = "bg-tertiary-container text-on-tertiary-container",
}: {
  session: CouncilSessionScheduleInput;
  className?: string;
}) {
  const today = useTodayJst();
  const info = councilSessionScheduleInfo(session, today);
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      title={info.description}
    >
      {info.label}
    </span>
  );
}
