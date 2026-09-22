import type { CouncilSpeech } from "../types";
import { QUESTION_LIKE_SPEECH_TYPES } from "./questionLikeSpeechTypes";

/**
 * 公開記録による議会活動（延岡市議会基本条例 第2条第1号「市政運営の監視・評価」）。
 *
 * 【設計の前提】
 * - ここで作るのは、議員の優劣を判定する点数ではない。公開された一次資料から確認できた
 *   活動を、共通の基準で数えたものだけを持つ。
 * - 複数の値を1つの総合点へ合成しない。各値は独立して表示する。
 * - 他の議員の活動によって本人の値が変わらない。分母はすべて固定値。
 * - 「確認した結果0件」と「まだ確認できていない」「制度上対象外」を必ず区別する。
 *
 * 【なぜ会期単位を中心に据えるか】
 * 質問項目数や再質問数は、会議録から要約を抽出できた量に左右される。実データでは、
 * 会議録を取得済みでも要約が途中の会期があり、1登壇あたりの記録量が会期によって
 * 1.2件〜10.7件と開きがある。件数だけを見せると、議員の活動ではなく当サイトの整備
 * 状況を表示することになる。「その会期に質問したかどうか」は記録が薄い会期でも
 * 確実に残るため、会期単位であれば全議員を同じ条件で比べられる。
 * そのうえで、件数（質問項目・再質問・継続テーマ）は参考の実数として併記する。
 */

/** 1つの値の確認状況。市民向けの表示と、0との取り違え防止に使う。 */
export type ActivityRecordAvailability =
  /** 一次資料で確認できた。 */
  | "available"
  /** 一部の資料だけで確認した。 */
  | "partial"
  /** 一次資料を確認した結果、0件だった。未調査ではない。 */
  | "confirmed-zero"
  /** 資料は公表されているが、当サイトがまだ取り込んでいない。 */
  | "not-acquired"
  /** 公式資料がまだ公表されていない。 */
  | "not-published"
  /** 記録は公表されているが、誰の行為かが分かる形で記載されていない。 */
  | "not-individually-attributable"
  /** 制度上その議員に当てはまらないため、算定の対象にしない。 */
  | "not-applicable";

/** 会期1件分の、その議員にとっての状態。「根拠を見る」で一覧表示する。 */
export interface SessionQuestionRecord {
  sessionId: string;
  sessionTitle: string;
  /** 分母に含めたか。議長在任などで対象外の会期は false。 */
  countedInDenominator: boolean;
  /** 質問・質疑を確認できたか。分母外の会期では null。 */
  asked: boolean | null;
  /** 分母から外した理由（対象外のときのみ）。 */
  excludedReason?: string;
  /** 会議録へのリンク（確認できた場合）。 */
  transcriptUrl?: string;
}

/** 表示する1項目分の値。点数ではなく、確認できた事実の数。 */
export interface ActivityRecordValue {
  key: string;
  label: string;
  /** 数値。確認できていない場合は null（0にしない）。 */
  value: number | null;
  unit: string;
  /** 割合の場合の分子・分母。実数のみの項目では持たない。 */
  numerator?: number;
  denominator?: number;
  availability: ActivityRecordAvailability;
  /** 何を数えたかの説明。価値判断を含めない。 */
  description: string;
  /** 使用した一次資料。 */
  sourceLabel: string;
  /** 延岡市議会基本条例のうち対応する条（ある場合）。 */
  ordinanceBasis?: string;
  /** availability が not-applicable 等のときに、その理由を市民向けに説明する。 */
  availabilityNote?: string;
}

/** 議員1名分の、公開記録による議会活動。 */
export interface CouncilActivityRecord {
  /** 一般質問が可能だった会期（分母）と、その内訳。 */
  sessions: SessionQuestionRecord[];
  values: ActivityRecordValue[];
}

const SOURCE_MINUTES = "延岡市議会 会議録（本会議）";
const ORDINANCE_MONITORING =
  "延岡市議会基本条例 第2条第1号（市長等が行う市政の運営状況を公正に監視、評価すること）";

function questionLikeSpeeches(speeches: CouncilSpeech[]): CouncilSpeech[] {
  return speeches.filter((s) => s.isPublished && QUESTION_LIKE_SPEECH_TYPES.has(s.speechType));
}

/**
 * 公開記録による議会活動を算定する。
 *
 * @param speeches その議員の、対象期間内の公開済み発言
 * @param eligibleSessions 一般質問が可能だった会期（分母）。会議録を確認できた会期のうち、
 *                         議長在任などで制度上質問を行わない会期を除いたもの。
 * @param excludedSessions 分母から外した会期と、その理由
 */
export function buildCouncilActivityRecord(
  speeches: CouncilSpeech[],
  eligibleSessions: { sessionId: string; sessionTitle: string }[],
  excludedSessions: { sessionId: string; sessionTitle: string; reason: string }[] = [],
): CouncilActivityRecord {
  const asked = questionLikeSpeeches(speeches);
  const askedSessionIds = new Set(asked.map((s) => s.sessionId));
  const transcriptBySession = new Map<string, string>();
  for (const s of asked) {
    const url = s.summarySources?.find((src) => src.sourceUrl)?.sourceUrl;
    if (url && !transcriptBySession.has(s.sessionId)) transcriptBySession.set(s.sessionId, url);
  }

  const sessions: SessionQuestionRecord[] = [
    ...eligibleSessions.map((s) => ({
      sessionId: s.sessionId,
      sessionTitle: s.sessionTitle,
      countedInDenominator: true,
      asked: askedSessionIds.has(s.sessionId),
      transcriptUrl: transcriptBySession.get(s.sessionId),
    })),
    ...excludedSessions.map((s) => ({
      sessionId: s.sessionId,
      sessionTitle: s.sessionTitle,
      countedInDenominator: false,
      asked: null,
      excludedReason: s.reason,
    })),
  ].sort((a, b) => a.sessionId.localeCompare(b.sessionId));

  const denominator = eligibleSessions.length;
  const askedSessionCount = eligibleSessions.filter((s) => askedSessionIds.has(s.sessionId)).length;

  // 分母が0になるのは、その議員が一般質問を行える会期が1つも無かった場合
  // （議長在任が対象期間の全てを占める等）。0%ではなく「対象外」とする。
  const denominatorAvailable = denominator > 0;

  const questionItems = asked.reduce((sum, s) => sum + s.questionItems.length, 0);
  const allItems = asked.flatMap((s) => s.questionItems);
  const itemsWithFollowUp = allItems.filter((item) =>
    (item.exchanges ?? []).some((e) => e.type === "follow-up-question"),
  ).length;

  const values: ActivityRecordValue[] = [
    {
      key: "eligible-sessions",
      label: "一般質問が可能だった会期",
      value: denominatorAvailable ? denominator : null,
      unit: "会期",
      availability: denominatorAvailable ? "available" : "not-applicable",
      availabilityNote: denominatorAvailable ? undefined : excludedSessions[0]?.reason,
      description:
        "会議録を確認できた定例会のうち、その議員が一般質問を行える立場にあった会期の数です。実施率の分母になります。",
      sourceLabel: SOURCE_MINUTES,
      ordinanceBasis: ORDINANCE_MONITORING,
    },
    {
      key: "asked-sessions",
      label: "一般質問を行った会期",
      value: denominatorAvailable ? askedSessionCount : null,
      unit: "会期",
      availability: !denominatorAvailable
        ? "not-applicable"
        : askedSessionCount > 0
          ? "available"
          : "confirmed-zero",
      description: "上記の会期のうち、本会議で質問・質疑に立ったことを会議録で確認できた会期の数です。",
      sourceLabel: SOURCE_MINUTES,
      ordinanceBasis: ORDINANCE_MONITORING,
    },
    {
      key: "asked-rate",
      label: "一般質問実施率",
      value: denominatorAvailable ? Math.round((askedSessionCount / denominator) * 100) : null,
      unit: "%",
      numerator: denominatorAvailable ? askedSessionCount : undefined,
      denominator: denominatorAvailable ? denominator : undefined,
      availability: denominatorAvailable ? "available" : "not-applicable",
      availabilityNote: denominatorAvailable ? undefined : excludedSessions[0]?.reason,
      description:
        "一般質問を行った会期数 ÷ 一般質問が可能だった会期数。質問の回数や長さ、内容の良し悪しは含みません。",
      sourceLabel: SOURCE_MINUTES,
      ordinanceBasis: ORDINANCE_MONITORING,
    },
    {
      key: "question-items",
      label: "質問項目",
      value: questionItems,
      unit: "件",
      availability: questionItems > 0 ? "available" : "confirmed-zero",
      description:
        "会議録で確認できた質問項目の数です。1つのテーマを細かく分けて質問する議員と、大きくまとめて質問する議員がいるため、多いほど活発という意味ではありません。",
      sourceLabel: SOURCE_MINUTES,
    },
    {
      key: "follow-up-items",
      label: "再質問を確認できた質問",
      value: itemsWithFollowUp,
      unit: "件",
      availability: itemsWithFollowUp > 0 ? "available" : "confirmed-zero",
      description:
        "答弁を受けて重ねて質問したことが会議録で確認できた質問項目の数です。多いほど優れているという意味ではありません。",
      sourceLabel: SOURCE_MINUTES,
      ordinanceBasis: ORDINANCE_MONITORING,
    },
    {
      key: "follow-up-rate",
      label: "再質問の確認率",
      value: questionItems > 0 ? Math.round((itemsWithFollowUp / questionItems) * 100) : null,
      unit: "%",
      numerator: questionItems > 0 ? itemsWithFollowUp : undefined,
      denominator: questionItems > 0 ? questionItems : undefined,
      availability: questionItems > 0 ? "available" : "confirmed-zero",
      description: "再質問を確認できた質問項目 ÷ 質問項目の総数。会議録の記録から数えたものです。",
      sourceLabel: SOURCE_MINUTES,
      ordinanceBasis: ORDINANCE_MONITORING,
    },
  ];

  return { sessions, values };
}
