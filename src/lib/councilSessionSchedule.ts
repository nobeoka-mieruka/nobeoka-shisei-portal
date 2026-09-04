// 拡張子付きでimportしているのは、scripts/test-council-session-schedule-state.mjs が
// Node（--experimental-strip-types）からこのモジュールを直接importして境界値テストを行うため。
// Nodeの解決規則では拡張子を省略できない。tsconfig.app.jsonのallowImportingTsExtensionsで許可済み。
import { formatJapaneseDate } from "../config/site.ts";
import type { CouncilSessionPhase } from "./councilSessions";

// ---------------------------------------------------------------------------
// Phase221：会期の進行状態（開催予定／開催中／開催済み）を、閲覧している日で判定する。
//
// Phase203は「プリレンダリング済みHTMLはビルド時に固定されるため、日付に依存した文言は
// ビルド時と閲覧時で食い違う」という理由で、"開催予定・開催中"という複合ラベル1つに
// まとめていた。Phase221はこの制約を次の方針で正面から解決する。
//
//   1. 判定関数は「今日（YYYY-MM-DD）」を引数で受け取る純関数にする（内部でnew Date()を呼ばない）。
//   2. サーバー（プリレンダリング）側では today=null を渡し、日付に依存しない表記だけを出す。
//      → ビルド日時の状態がHTMLへ焼き付くことは構造的に起こらない。
//   3. ブラウザ側はハイドレーション完了後にだけ today を確定させ（src/hooks/useTodayJst.ts）、
//      同じ純関数へ日本標準時（Asia/Tokyo）の今日を渡して精密なラベルへ差し替える。
//
// 判定に使うデータは既存の実データだけで、新しいstatusフィールドは追加しない：
//   - councilSessions.json の startDate / endDate（公式資料で確認できた会期のみ保持）
//   - generalQuestions.json の questionDate（質問通告書に記載された一般質問の予定日）
//   - questionCollectionStatus.json への登録有無（＝CouncilSessionPhase。日付に依存しない）
//
// 会期そのものの開会日・閉会日が未確認の会期については、確認できている一般質問の予定日を
// 判定の基準に使い、その旨（basis）を必ず併記する。開会日・閉会日を推測で補完しない。
// ---------------------------------------------------------------------------

/** 会期の進行状態を判定する基準時間帯。延岡市議会の日程はすべて日本時間で公表される。 */
export const COUNCIL_SESSION_TIME_ZONE = "Asia/Tokyo";
/** 画面に表示する時間帯の呼び名。 */
export const COUNCIL_SESSION_TIME_ZONE_LABEL = "日本標準時";

/**
 * 指定時刻を、指定時間帯（既定：Asia/Tokyo）の暦日（YYYY-MM-DD）へ変換する。
 * 閲覧端末の時間帯設定（海外・UTC等）に関係なく、常に日本時間の「今日」を返す。
 */
export function dateStringInTimeZone(
  now: Date = new Date(),
  timeZone: string = COUNCIL_SESSION_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/**
 * 会期の進行状態。
 * - "pending"：閲覧日がまだ確定していない（サーバー生成HTML・JavaScript無効時）。
 *   ビルド日時の状態を焼き付けないための状態であり、日付に依存しない表記だけを出す。
 * - "schedule-unconfirmed"：日程を1日も確認できていない（推測しない）。
 * - "upcoming"：判定基準の初日より前。
 * - "ongoing"：判定基準の期間内。
 * - "awaiting-results"：判定基準の最終日を過ぎたが、議決結果・会議録がまだ未確認。
 * - "completed"：収録対象として登録済み（日付に依存しない）。
 */
export type CouncilSessionScheduleState =
  | "pending"
  | "schedule-unconfirmed"
  | "upcoming"
  | "ongoing"
  | "awaiting-results"
  | "completed";

/**
 * 進行状態を何の日程から判定したか。
 * - "session-period"：公式資料で確認した会期の開会日〜閉会日
 * - "question-dates"：質問通告書に記載された一般質問の予定日（会期の開会日・閉会日は未確認）
 */
export type CouncilSessionScheduleBasis = "session-period" | "question-dates";

/** 判定に使う入力。すべて既存データの実値で、欠けている項目は省略する（推測で埋めない）。 */
export interface CouncilSessionScheduleInput {
  /** questionCollectionStatus.jsonへの登録有無から決まる、日付に依存しない状態。 */
  phase: CouncilSessionPhase;
  /** 会期の開会日（councilSessions.jsonのstartDate）。未確認ならundefined。 */
  startDate?: string;
  /** 会期の閉会日（councilSessions.jsonのendDate）。未確認ならundefined。 */
  endDate?: string;
  /** 一般質問の予定日のうち最も早い日（generalQuestions.jsonのquestionDateの実値）。 */
  firstQuestionDate?: string;
  /** 同じく最も遅い日。 */
  lastQuestionDate?: string;
}

/** 判定に使った日程の範囲。 */
export interface CouncilSessionSchedulePeriod {
  basis: CouncilSessionScheduleBasis;
  from: string;
  to: string;
}

/**
 * 判定に使う日程を決める。会期の開会日・閉会日を確認できていればそれを優先し、
 * 未確認の場合だけ一般質問の予定日を使う。どちらも無ければnull（状態を判定しない）。
 */
export function resolveCouncilSessionSchedulePeriod(
  input: CouncilSessionScheduleInput,
): CouncilSessionSchedulePeriod | null {
  if (input.startDate) {
    return { basis: "session-period", from: input.startDate, to: input.endDate ?? input.startDate };
  }
  if (input.firstQuestionDate) {
    return {
      basis: "question-dates",
      from: input.firstQuestionDate,
      to: input.lastQuestionDate ?? input.firstQuestionDate,
    };
  }
  return null;
}

/**
 * 会期の進行状態を判定する純関数。
 *
 * @param today 日本標準時の今日（YYYY-MM-DD）。まだ確定していない場合（サーバー生成HTML・
 *              JavaScript無効時）はnullを渡す。nullのときは日付に依存した判定を一切行わない。
 */
export function councilSessionScheduleState(
  input: CouncilSessionScheduleInput,
  today: string | null,
): CouncilSessionScheduleState {
  // 収録対象として登録済みの会期は、日付を見るまでもなく開催済み。
  if (input.phase === "completed") return "completed";
  if (today === null) return "pending";
  const period = resolveCouncilSessionSchedulePeriod(input);
  if (!period) return "schedule-unconfirmed";
  if (today < period.from) return "upcoming";
  if (today > period.to) return "awaiting-results";
  return "ongoing";
}

/**
 * 状態の表示名。"awaiting-results"だけは判定基準によって意味が変わるため、basisを見て言い換える
 * （会期の閉会日が未確認のまま「開催済み」と断定しないため）。
 */
export function councilSessionScheduleStateLabel(
  state: CouncilSessionScheduleState,
  basis: CouncilSessionScheduleBasis | null,
): string {
  switch (state) {
    case "completed":
      return "開催済み";
    case "upcoming":
      return "開催予定";
    case "ongoing":
      return "開催中";
    case "awaiting-results":
      return basis === "question-dates" ? "一般質問終了・結果確認中" : "開催済み・結果確認中";
    case "schedule-unconfirmed":
      return "日程未確認";
    case "pending":
    default:
      return "開催予定または開催中";
  }
}

/** 日程の範囲を「2026年9月8日〜2026年9月10日」のような表示用文字列にする。1日だけなら1日分。 */
export function formatCouncilSessionPeriod(period: CouncilSessionSchedulePeriod): string {
  if (period.from === period.to) return formatJapaneseDate(period.from);
  return `${formatJapaneseDate(period.from)}〜${formatJapaneseDate(period.to)}`;
}

const BASIS_LABELS: Record<CouncilSessionScheduleBasis, string> = {
  "session-period": "公式資料で確認した会期の日程",
  "question-dates": "質問通告書に記載された一般質問の予定日",
};

/** 画面表示に必要な情報を1か所にまとめたもの。表示側でこれ以外の言い回しを作らない。 */
export interface CouncilSessionScheduleInfo {
  state: CouncilSessionScheduleState;
  /** バッジ等に表示する短い状態名。 */
  label: string;
  /** 判定基準（日程が1日も確認できていない場合はnull）。 */
  basis: CouncilSessionScheduleBasis | null;
  /** 判定に使った日程（同上）。 */
  period: CouncilSessionSchedulePeriod | null;
  /** 「2026年9月8日〜2026年9月10日」形式の日程。日程未確認ならnull。 */
  periodText: string | null;
  /** 何を基準に、いつ時点で判定した状態かを説明する文（title属性・注記に使う）。 */
  description: string;
}

/**
 * 状態・表示名・判定根拠をまとめて返す。
 *
 * todayがnullのとき（サーバー生成HTML・JavaScript無効時）は、日付に依存する断定を一切せず、
 * 「日程」と「判定はご覧の端末の日付で行う」ことだけを伝える。
 */
export function councilSessionScheduleInfo(
  input: CouncilSessionScheduleInput,
  today: string | null,
): CouncilSessionScheduleInfo {
  const period = resolveCouncilSessionSchedulePeriod(input);
  const basis = period?.basis ?? null;
  const state = councilSessionScheduleState(input, today);
  const periodText = period ? formatCouncilSessionPeriod(period) : null;

  const sentences: string[] = [];
  if (period && periodText) {
    sentences.push(`判定の基準：${BASIS_LABELS[period.basis]}（${periodText}）。`);
    if (period.basis === "question-dates") {
      sentences.push("会期そのものの開会日・閉会日は、公式資料でまだ確認できていません。");
    }
  } else if (state !== "completed") {
    sentences.push("開催日程を確認できる公式資料がまだ無いため、日程からの判定はしていません。");
  }

  switch (state) {
    case "completed":
      sentences.push("会期が終了し、当サイトの収録対象として登録済みです。");
      break;
    case "pending":
      sentences.push(
        `「開催予定」「開催中」「結果確認中」のどれにあたるかは、ご覧の端末の日付（${COUNCIL_SESSION_TIME_ZONE_LABEL}）で判定します。`,
      );
      break;
    case "awaiting-results":
      sentences.push("議決結果・会議録は、公式資料が公開され次第、確認のうえ掲載します。");
      break;
    default:
      break;
  }
  if (today !== null && state !== "completed") {
    sentences.push(`${formatJapaneseDate(today)}（${COUNCIL_SESSION_TIME_ZONE_LABEL}）時点の状態です。`);
  }

  return {
    state,
    label: councilSessionScheduleStateLabel(state, basis),
    basis,
    period,
    periodText,
    description: sentences.join(""),
  };
}

/**
 * 一般質問1件分の日付の見出し語。予定日（これから）と実施済みの日を取り違えないようにする。
 * 会議録で内容を確認済みの会期（phase="completed"）は通常の質問日として扱う。
 */
export function questionDateLabelPrefix(
  phase: CouncilSessionPhase,
  questionDate: string,
  today: string | null,
): string {
  if (phase === "completed") return "";
  // 閲覧日が未確定のとき（サーバー生成HTML）は、質問通告書ベースであることが分かる
  // 「質問予定日」表記を保つ（ビルド日時での判定はしない）。
  if (today === null) return "質問予定日 ";
  return questionDate >= today ? "質問予定日 " : "";
}
