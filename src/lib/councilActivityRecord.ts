import type { CouncilSpeech } from "../types";
import { QUESTION_LIKE_SPEECH_TYPES } from "./questionLikeSpeechTypes";

/**
 * 公開記録による議会活動（延岡市議会基本条例 第2条第1号「市政運営の監視・評価」ほか）。
 *
 * 【設計の前提】
 * - ここで作るのは、議員の優劣を判定する点数ではない。公開された一次資料から確認できた
 *   活動を、共通の基準で数えたものだけを持つ。
 * - 複数の値を1つの総合点へ合成しない。各値は独立して表示する。
 * - 他の議員の活動によって本人の値が変わらない。分母はすべて固定値。
 * - 「確認した結果0件」と「まだ確認できていない」「制度上対象外」を必ず区別する。
 * - 確認できない項目は、無理に数値にしない。状態を言葉で示す。
 *
 * 【なぜ会期単位を中心に据えるか】
 * 質問項目数や再質問数は、会議録から要約を抽出できた量に左右される。実データでは、
 * 会議録を取得済みでも要約が途中の会期があり、1登壇あたりの記録量が会期によって
 * 1.2件〜10.7件と開きがある。件数だけを見せると、議員の活動ではなく当サイトの整備
 * 状況を表示することになる。「その会期に質問したかどうか」は記録が薄い会期でも
 * 確実に残るため、会期単位であれば全議員を同じ条件で比べられる。
 * そのうえで、件数（質問項目・再質問）は参考の実数として併記する。
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

/** 画面上のまとまり。数字を一列に並べた「成績表」に見せないための区分。 */
export type ActivityRecordGroup = "question" | "theme" | "council";

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

/** 一覧として示す記録1件（政策テーマ、決議の提出者、委員長報告など）。 */
export interface ActivityRecordListItem {
  label: string;
  /** 「4会期（令和5年6月〜令和8年3月）」のような補足。 */
  detail?: string;
  /** 自動分類で付いた分類であることを示す場合に使う。 */
  classificationNote?: string;
  /** 一次資料への導線。 */
  url?: string;
  urlLabel?: string;
}

/** 表示する1項目分の値。点数ではなく、確認できた事実。 */
export interface ActivityRecordValue {
  key: string;
  label: string;
  group: ActivityRecordGroup;
  /** number は数と割合、list は名前の一覧として表示する。 */
  kind: "number" | "list";
  /** 数値。確認できていない場合は null（0にしない）。kind が list のときは null。 */
  value: number | null;
  unit: string;
  /** 割合の場合の分子・分母。実数のみの項目では持たない。 */
  numerator?: number;
  denominator?: number;
  /** kind が list のときの中身。 */
  items?: ActivityRecordListItem[];
  availability: ActivityRecordAvailability;
  /** 何を数えたかの説明。価値判断を含めない。画面では常に表示する。 */
  description: string;
  /** 使用した一次資料。 */
  sourceLabel: string;
  /** 延岡市議会基本条例のうち対応する条（ある場合）。 */
  ordinanceBasis?: string;
  /** availability が not-applicable 等のときに、その理由を市民向けに説明する。 */
  availabilityNote?: string;
  /** 「根拠を見る」で何を開くか。 */
  evidenceKind: "sessions" | "items" | "none";
}

/** 議員1名分の、公開記録による議会活動。 */
export interface CouncilActivityRecord {
  /** 一般質問が可能だった会期（分母）と、その内訳。 */
  sessions: SessionQuestionRecord[];
  values: ActivityRecordValue[];
}

/** buildCouncilActivityRecord へ渡す、一般質問以外の記録。 */
export interface CouncilActivityRecordExtras {
  /** 会議録で確認できた政策テーマ（会期数つき）。 */
  policyThemes?: ActivityRecordListItem[];
  /** 2会期以上で確認できたテーマ。 */
  recurringThemes?: ActivityRecordListItem[];
  /** 議員提出決議の提出者として確認できた件数。 */
  decisionSubmissions?: ActivityRecordListItem[];
  /** 本会議での委員長・副委員長報告。 */
  committeeReports?: ActivityRecordListItem[];
  /** 議案への賛否（個人別の記録が公開されている議案のうち、確認できた数）。 */
  namedVotes?: { numerator: number; denominator: number };
}

const SOURCE_MINUTES = "延岡市議会 会議録（本会議）";
const ORDINANCE_MONITORING =
  "延岡市議会基本条例 第2条第1号（市長等が行う市政の運営状況を公正に監視、評価すること）";
const ORDINANCE_POLICY =
  "延岡市議会基本条例 第2条第2号（市の政策形成及び執行に係る立案、決定、執行、評価における論点、争点を明らかにすること）";

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
 * @param extras 一般質問以外の記録（政策テーマ・決議の提出者・委員長報告など）
 */
export function buildCouncilActivityRecord(
  speeches: CouncilSpeech[],
  eligibleSessions: { sessionId: string; sessionTitle: string }[],
  excludedSessions: { sessionId: string; sessionTitle: string; reason: string }[] = [],
  extras: CouncilActivityRecordExtras = {},
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
  const notApplicableNote = excludedSessions[0]?.reason;

  const questionItems = asked.reduce((sum, s) => sum + s.questionItems.length, 0);
  const allItems = asked.flatMap((s) => s.questionItems);
  const itemsWithFollowUp = allItems.filter((item) =>
    (item.exchanges ?? []).some((e) => e.type === "follow-up-question"),
  ).length;

  const values: ActivityRecordValue[] = [
    {
      key: "asked-sessions",
      label: "一般質問を行った会期",
      group: "question",
      kind: "number",
      value: denominatorAvailable ? askedSessionCount : null,
      unit: "会期",
      numerator: denominatorAvailable ? askedSessionCount : undefined,
      denominator: denominatorAvailable ? denominator : undefined,
      availability: !denominatorAvailable
        ? "not-applicable"
        : askedSessionCount > 0
          ? "available"
          : "confirmed-zero",
      availabilityNote: denominatorAvailable ? undefined : notApplicableNote,
      description:
        "本人が一般質問を行える立場にあった会期のうち、本会議で質問・質疑に立ったことを会議録で確認できた会期の数です。",
      sourceLabel: SOURCE_MINUTES,
      ordinanceBasis: ORDINANCE_MONITORING,
      evidenceKind: "sessions",
    },
    {
      key: "asked-rate",
      label: "一般質問実施率",
      group: "question",
      kind: "number",
      value: denominatorAvailable ? Math.round((askedSessionCount / denominator) * 100) : null,
      unit: "%",
      numerator: denominatorAvailable ? askedSessionCount : undefined,
      denominator: denominatorAvailable ? denominator : undefined,
      availability: denominatorAvailable ? "available" : "not-applicable",
      availabilityNote: denominatorAvailable ? undefined : notApplicableNote,
      description:
        "本人が一般質問可能だった会期のうち、一般質問を行った会期の割合です。質問の回数や長さ、内容の良し悪しは含みません。",
      sourceLabel: SOURCE_MINUTES,
      ordinanceBasis: ORDINANCE_MONITORING,
      evidenceKind: "sessions",
    },
    {
      key: "question-items",
      label: "質問項目数",
      group: "question",
      kind: "number",
      // 一般質問を行える会期が1つも無い議員は、0件ではなく対象外。
      // 「確認した結果0件」と書くと、制度上行わない立場にいたことが実績ゼロに見えてしまう。
      value: denominatorAvailable ? questionItems : null,
      unit: "件",
      availability: !denominatorAvailable
        ? "not-applicable"
        : questionItems > 0
          ? "available"
          : "confirmed-zero",
      availabilityNote: denominatorAvailable ? undefined : notApplicableNote,
      description:
        "会議録で確認できた質問項目の数です。1つのテーマを細かく分けて質問する議員と、大きくまとめて質問する議員がいるため、多いほど活発という意味ではありません。",
      sourceLabel: SOURCE_MINUTES,
      evidenceKind: "sessions",
    },
    {
      key: "follow-up-items",
      label: "再質問確認数",
      group: "question",
      kind: "number",
      value: denominatorAvailable ? itemsWithFollowUp : null,
      unit: "件",
      availability: !denominatorAvailable
        ? "not-applicable"
        : itemsWithFollowUp > 0
          ? "available"
          : "confirmed-zero",
      availabilityNote: denominatorAvailable ? undefined : notApplicableNote,
      description:
        "公開会議録上で再質問として確認できた記録がある質問項目の数です。多い少ないで優劣を判断するものではありません。",
      sourceLabel: SOURCE_MINUTES,
      ordinanceBasis: ORDINANCE_MONITORING,
      evidenceKind: "sessions",
    },
    {
      key: "follow-up-rate",
      label: "再質問確認率",
      group: "question",
      kind: "number",
      value:
        denominatorAvailable && questionItems > 0
          ? Math.round((itemsWithFollowUp / questionItems) * 100)
          : null,
      unit: "%",
      numerator: denominatorAvailable && questionItems > 0 ? itemsWithFollowUp : undefined,
      denominator: denominatorAvailable && questionItems > 0 ? questionItems : undefined,
      availability: !denominatorAvailable
        ? "not-applicable"
        : questionItems > 0
          ? "available"
          : "confirmed-zero",
      availabilityNote: denominatorAvailable ? undefined : notApplicableNote,
      description:
        "公開会議録上で再質問として確認できた質問の割合です。答弁を受けて重ねて質問した記録があるかどうかだけを数えており、やり取りの内容は評価していません。",
      sourceLabel: SOURCE_MINUTES,
      ordinanceBasis: ORDINANCE_MONITORING,
      evidenceKind: "sessions",
    },
  ];

  const policyThemes = extras.policyThemes ?? [];
  values.push({
    key: "policy-themes",
    label: "取り上げた政策分野",
    group: "theme",
    kind: "list",
    value: null,
    unit: "",
    items: policyThemes,
    availability: !denominatorAvailable && policyThemes.length === 0
      ? "not-applicable"
      : policyThemes.length > 0
        ? "available"
        : "confirmed-zero",
    availabilityNote: !denominatorAvailable && policyThemes.length === 0 ? notApplicableNote : undefined,
    description:
      "会議録の見出し語から自動で分類した政策分野です。分野の数や広さを評価するものではなく、どの分野を取り上げたかを示すものです。どのキーワードにも当たらない語句は、推測で分類せず「分類していない語句」として別に数えています。",
    sourceLabel: `${SOURCE_MINUTES}（分類は当サイトによる自動分類）`,
    ordinanceBasis: ORDINANCE_POLICY,
    evidenceKind: "items",
  });

  const recurringThemes = extras.recurringThemes ?? [];
  values.push({
    key: "recurring-themes",
    label: "複数会期で取り上げたテーマ",
    group: "theme",
    kind: "list",
    value: null,
    unit: "",
    items: recurringThemes,
    availability: !denominatorAvailable && recurringThemes.length === 0
      ? "not-applicable"
      : recurringThemes.length > 0
        ? "available"
        : "confirmed-zero",
    availabilityNote: !denominatorAvailable && recurringThemes.length === 0 ? notApplicableNote : undefined,
    description:
      "2つ以上の会期で確認できたテーマです。同じ会期の中で複数回質問した場合は含めません。継続して取り上げたことを示すもので、テーマの重要度を比べるものではありません。",
    sourceLabel: SOURCE_MINUTES,
    ordinanceBasis: ORDINANCE_POLICY,
    evidenceKind: "items",
  });

  const decisionSubmissions = extras.decisionSubmissions ?? [];
  values.push({
    key: "decision-submissions",
    label: "議員提出決議の提出者",
    group: "council",
    kind: "list",
    value: null,
    unit: "",
    items: decisionSubmissions,
    availability: decisionSubmissions.length > 0 ? "available" : "confirmed-zero",
    description:
      "本会議で決議案の提案理由説明を行ったことを、会議録で氏名まで確認できた記録です。条例案・意見書等の提出者と、請願・陳情の紹介議員は、議員別に収録できていないため含みません。",
    sourceLabel: "延岡市議会 会議録（決議案の提案理由説明）",
    evidenceKind: "items",
  });

  const committeeReports = extras.committeeReports ?? [];
  values.push({
    key: "committee-reports",
    label: "本会議での委員長・副委員長報告",
    group: "council",
    kind: "list",
    value: null,
    unit: "",
    items: committeeReports,
    availability: committeeReports.length > 0 ? "available" : "confirmed-zero",
    description:
      "委員会の審査結果を本会議で報告した記録です。委員会の中での質疑は、会議録に「委員より」とだけ記載され誰の発言か特定できないため、含めていません。",
    sourceLabel: "延岡市議会 会議録（委員長報告）",
    evidenceKind: "items",
  });

  const namedVotes = extras.namedVotes;
  values.push({
    key: "named-votes",
    label: "議案への賛否（個人別に公開されたもの）",
    group: "council",
    kind: "number",
    value: namedVotes && namedVotes.denominator > 0 ? namedVotes.numerator : null,
    unit: "件",
    numerator: namedVotes && namedVotes.denominator > 0 ? namedVotes.numerator : undefined,
    denominator: namedVotes && namedVotes.denominator > 0 ? namedVotes.denominator : undefined,
    availability:
      !namedVotes || namedVotes.denominator === 0
        ? "not-individually-attributable"
        : namedVotes.numerator > 0
          ? "available"
          : "confirmed-zero",
    availabilityNote:
      !namedVotes || namedVotes.denominator === 0
        ? "議案の多くは起立採決で、会議録に議員一人ひとりの賛否が記載されません。賛否が無かったという意味ではなく、誰がどちらに手を挙げたかを公開記録から特定できない、という意味です。"
        : undefined,
    description:
      "記名投票など、議員一人ひとりの賛否が公開されている議案のうち、この議員の意思表示を確認できた件数です。賛成・反対のどちらであるかは評価しません。",
    sourceLabel: "延岡市議会 議案ごとの賛否（記名投票の記録）",
    ordinanceBasis: ORDINANCE_MONITORING,
    evidenceKind: "none",
  });

  return { sessions, values };
}
