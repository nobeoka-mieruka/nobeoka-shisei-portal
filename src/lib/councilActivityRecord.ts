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

/**
 * 会期を実施率の分母から外した理由。内部コードであり、画面にそのまま出さない。
 * 表示用の日本語は EXCLUSION_REASON_LABELS_JA で別に持つ（内部コードと表示文言を分離する）。
 */
export type ActivityExclusionReason =
  /** その会期の時点でまだ議員ではなかった（初当選前・途中就任前）。 */
  | "NOT_YET_MEMBER"
  /** その会期の時点ですでに議員ではなかった（辞職・失職・任期満了後）。 */
  | "NO_LONGER_MEMBER"
  /** 議長在任のため、慣例として一般質問を行わない。 */
  | "SPEAKER_TERM"
  /** 会議録などの一次資料がまだ公開されていない。「質問なし」ではない。 */
  | "SOURCE_NOT_PUBLISHED"
  /** 上記以外で、制度上その議員に当てはまらない。 */
  | "NOT_APPLICABLE";

/** 市民向けの短い説明。内部コードとは1対1で対応させる。 */
export const EXCLUSION_REASON_LABELS_JA: Record<ActivityExclusionReason, string> = {
  NOT_YET_MEMBER: "この会期の時点では、まだ議員ではありませんでした",
  NO_LONGER_MEMBER: "この会期の時点では、すでに議員ではありませんでした",
  SPEAKER_TERM: "役職就任期間のため、比較条件を揃える目的で算定対象会期から除外しています",
  SOURCE_NOT_PUBLISHED: "会議録がまだ公開されていないため、確認できません（質問がなかったという意味ではありません）",
  NOT_APPLICABLE: "制度上、この議員には当てはまりません",
};

/**
 * 質問項目1件について、再質問を確認できたかどうかの判定。
 *
 * 機械で判定できることだけを状態にする。「追及が鋭い」といった中身の評価はしない。
 * 公開する指標（再質問確認数・確認率）に数えるのは CONFIRMED だけにする。
 */
export type FollowUpConfidence =
  /** 本人の再質問があり、その前に答弁が記録されている。 */
  | "CONFIRMED"
  /** 本人の再質問はあるが、先行する質問・答弁が会議録要約に取り込めていない。 */
  | "LIKELY"
  /** 再質問の記録はあるが、発言者が本人ではない（他の議員の関連質問）。 */
  | "NOT_INDIVIDUALLY_ATTRIBUTABLE"
  /** 同じ登壇の他の質問には再質問が記録されているため、この項目は確認したうえで0件。 */
  | "CONFIRMED_ZERO"
  /** その登壇全体に再質問の記録が1件も無く、0件なのか未整備なのか判断できない。 */
  | "UNRECORDED";

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
  /** 分母から外した理由の内部コード（対象外のときのみ）。 */
  excludedReasonCode?: ActivityExclusionReason;
  /** 分母から外した理由の説明文（市民向け。コードの定型文＋個別の補足）。 */
  excludedReason?: string;
  /**
   * その判断の根拠にした資料のID。第三者が同じ資料へ辿れるようにする。
   * 根拠資料を特定できていない場合は持たせない（でっち上げない）。
   */
  evidenceSourceId?: string;
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
  /** 根拠の画面で、分子・分母が何を数えたものかを言葉で示すための見出し。 */
  numeratorLabel?: string;
  denominatorLabel?: string;
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
  /** 本会議での討論。 */
  debates?: ActivityRecordListItem[];
  /** 討論の分子・分母（討論が行われた会期のうち、討論に立った会期）。 */
  debateSessions?: { numerator: number; denominator: number };
  /** 請願の紹介議員として、一次資料で確認できた記録。 */
  petitionIntroductions?: ActivityRecordListItem[];
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
 * 質問項目1件の再質問を判定する。
 *
 * 会議録の要約では、他の議員が持ち時間の中で行った「関連質問」が、
 * 登壇した議員の質問項目の中に再質問として並ぶことがある（発言者名は別人、
 * speakerId は空）。これを本人の再質問として数えると、他人の発言を
 * その議員の実績にしてしまうため、発言者が本人であることを必ず確かめる。
 */
export function judgeFollowUp(
  item: CouncilSpeech["questionItems"][number],
  memberId: string,
  speechHasAnyFollowUp: boolean,
): FollowUpConfidence {
  const exchanges = [...(item.exchanges ?? [])].sort((a, b) => a.order - b.order);
  const followUps = exchanges.filter((e) => e.type === "follow-up-question");
  if (followUps.length === 0) {
    // 同じ登壇の他の項目に再質問が記録されているなら、この項目は確認したうえで0件。
    // 登壇全体に1件も無い場合は、再質問が無かったのか要約が未整備なのか区別できない。
    return speechHasAnyFollowUp ? "CONFIRMED_ZERO" : "UNRECORDED";
  }
  const own = followUps.filter((e) => e.speakerId === memberId);
  if (own.length === 0) return "NOT_INDIVIDUALLY_ATTRIBUTABLE";
  const afterAnswer = own.some((e) =>
    exchanges.some((x) => x.order < e.order && (x.type === "answer" || x.type === "follow-up-answer")),
  );
  return afterAnswer ? "CONFIRMED" : "LIKELY";
}

/** 議員1名分の、質問項目ごとの判定結果をまとめる。 */
function summarizeFollowUps(speeches: CouncilSpeech[]): Record<FollowUpConfidence, number> {
  const counts: Record<FollowUpConfidence, number> = {
    CONFIRMED: 0,
    LIKELY: 0,
    NOT_INDIVIDUALLY_ATTRIBUTABLE: 0,
    CONFIRMED_ZERO: 0,
    UNRECORDED: 0,
  };
  for (const speech of speeches) {
    const speechHasAnyFollowUp = (speech.questionItems ?? []).some((q) =>
      (q.exchanges ?? []).some((e) => e.type === "follow-up-question"),
    );
    for (const item of speech.questionItems ?? []) {
      counts[judgeFollowUp(item, speech.memberId, speechHasAnyFollowUp)] += 1;
    }
  }
  return counts;
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
  excludedSessions: {
    sessionId: string;
    sessionTitle: string;
    reasonCode: ActivityExclusionReason;
    /** コードの定型文に加えて示したい補足（無ければ定型文だけを使う）。 */
    reasonNote?: string;
    evidenceSourceId?: string;
  }[] = [],
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
      excludedReasonCode: s.reasonCode,
      excludedReason: s.reasonNote
        ? `${EXCLUSION_REASON_LABELS_JA[s.reasonCode]}。${s.reasonNote}`
        : EXCLUSION_REASON_LABELS_JA[s.reasonCode],
      evidenceSourceId: s.evidenceSourceId,
    })),
  ].sort((a, b) => a.sessionId.localeCompare(b.sessionId));

  const denominator = eligibleSessions.length;
  const askedSessionCount = eligibleSessions.filter((s) => askedSessionIds.has(s.sessionId)).length;

  // 分母が0になるのは、その議員が一般質問を行える会期が1つも無かった場合
  // （議長在任が対象期間の全てを占める等）。0%ではなく「対象外」とする。
  const denominatorAvailable = denominator > 0;
  // 分母が0のときに示す理由。制度上の対象外（議長など）を優先して拾う。
  const notApplicableSource =
    excludedSessions.find((s) => s.reasonCode === "SPEAKER_TERM") ?? excludedSessions[0];
  const notApplicableNote = notApplicableSource
    ? notApplicableSource.reasonNote
      ? `${EXCLUSION_REASON_LABELS_JA[notApplicableSource.reasonCode]}。${notApplicableSource.reasonNote}`
      : EXCLUSION_REASON_LABELS_JA[notApplicableSource.reasonCode]
    : undefined;

  const questionItems = asked.reduce((sum, s) => sum + s.questionItems.length, 0);
  const followUps = summarizeFollowUps(asked);
  // 公開する件数は CONFIRMED だけ。判断できないもの（UNRECORDED）は分母からも外し、
  // 0件として扱わずに別の行で件数を示す。
  const itemsWithFollowUp = followUps.CONFIRMED;
  const followUpDenominator = questionItems - followUps.UNRECORDED;

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
      numeratorLabel: "一般質問を行った会期",
      denominatorLabel: "算定対象の会期（会議録を確認できた会期）",
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
      numeratorLabel: "一般質問を行った会期",
      denominatorLabel: "算定対象の会期（会議録を確認できた会期）",
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
        "答弁のあとに本人が重ねて質問したことを、公開会議録上で確認できた質問項目の数です。他の議員が持ち時間の中で行った関連質問は含みません。多い少ないで優劣を判断するものではありません。",
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
        denominatorAvailable && followUpDenominator > 0
          ? Math.round((itemsWithFollowUp / followUpDenominator) * 100)
          : null,
      unit: "%",
      numerator: denominatorAvailable && followUpDenominator > 0 ? itemsWithFollowUp : undefined,
      denominator: denominatorAvailable && followUpDenominator > 0 ? followUpDenominator : undefined,
      numeratorLabel: "再質問を確認できた質問項目",
      denominatorLabel: "再質問の有無を確認できた質問項目",
      availability: !denominatorAvailable
        ? "not-applicable"
        : followUpDenominator > 0
          ? "available"
          : questionItems === 0
            ? // 質問項目そのものが0件。確認した結果として0件である。
              "confirmed-zero"
            : // 質問項目はあるが、そのすべてで再質問の記録が残っていない。
              // 再質問が無かったのか未整備なのか区別できないため、0%とは書かない。
              "not-acquired",
      description:
        "再質問の有無を確認できた質問項目のうち、公開会議録上で再質問を確認できた質問の割合です。やり取りの内容は評価していません。",
      availabilityNote: !denominatorAvailable
        ? notApplicableNote
        : followUps.UNRECORDED > 0
          ? `このほかに、登壇全体で再質問の記録が残っていない質問項目が${followUps.UNRECORDED}件あります。再質問をしなかったのか、会議録の要約がそこまで作られていないのかを区別できないため、分母から外しています（0件として扱っていません）。`
          : undefined,
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

  const debates = extras.debates ?? [];
  const debateSessions = extras.debateSessions;
  values.push({
    key: "debate-rate",
    label: "討論を行った会期",
    group: "council",
    kind: "number",
    value:
      debateSessions && debateSessions.denominator > 0
        ? Math.round((debateSessions.numerator / debateSessions.denominator) * 100)
        : null,
    unit: "%",
    numerator: debateSessions && debateSessions.denominator > 0 ? debateSessions.numerator : undefined,
    denominator: debateSessions && debateSessions.denominator > 0 ? debateSessions.denominator : undefined,
    numeratorLabel: "討論を行った会期",
    denominatorLabel: "討論が行われた会期",
    availability:
      !debateSessions || debateSessions.denominator === 0
        ? "not-acquired"
        : debateSessions.numerator > 0
          ? "available"
          : "confirmed-zero",
    description:
      "本会議の討論の場で発言したことを会議録で確認できた会期の割合です。討論が1件も行われなかった会期は分母に入れていません。賛成・反対のどちらであったかは評価しません。討論に立たなかったことは、議案に賛成だったという意味でも、関心が無かったという意味でもありません。",
    sourceLabel: SOURCE_MINUTES,
    ordinanceBasis: "延岡市議会基本条例 第2条第3号（議員相互の自由な討議により議論を尽くすこと）",
    evidenceKind: "items",
    items: debates,
  });

  const petitionIntroductions = extras.petitionIntroductions ?? [];
  values.push({
    key: "petition-introductions",
    label: "請願の紹介議員",
    group: "council",
    kind: "list",
    value: null,
    unit: "",
    items: petitionIntroductions,
    availability: petitionIntroductions.length > 0 ? "available" : "not-acquired",
    description:
      "請願の紹介議員として、会議録で氏名を確認できた記録です。延岡市議会は紹介議員を公開資料に定型掲載していないため、ここに出るのは本会議の発言の中で言及された例外的なものだけです。記録が無いことは、紹介議員になっていないという意味ではありません。",
    sourceLabel: "延岡市議会 会議録（本会議での言及）",
    ordinanceBasis: "延岡市議会基本条例 第2条第2号（市民の意見を市政に反映させること）",
    evidenceKind: "items",
    availabilityNote:
      petitionIntroductions.length > 0
        ? undefined
        : "議案等審議結果・市議会だより・本会議の上程文のいずれにも紹介議員の欄が無く、請願文書表はウェブ公開されていません。0件ではなく、確認できていないという意味です。",
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
    numeratorLabel: "この議員の賛否を確認できた議案",
    denominatorLabel: "個人別の賛否が公開されている議案",
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
