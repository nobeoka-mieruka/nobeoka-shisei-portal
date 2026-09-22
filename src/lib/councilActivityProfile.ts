import type { CouncilMember } from "../types";
import billProposalRolesData from "../data/billProposalRoles.json";
import billVotesData from "../data/billVotes.json";
import { committeeReportActivityEvents } from "./committees";
import type { CouncilActivityRecord } from "./councilActivityRecord";

/**
 * 議会活動プロフィール（7軸）。
 *
 * 延岡市議会基本条例が議会・議員に定めている役割を7つの軸として置き、
 * そのうち「公開された一次資料から個人単位で確認でき、26名全員へ同じ算定方法を
 * 適用でき、算定式を公開でき、第三者が再計算できる」軸だけを数値で示す。
 *
 * 【絶対にしないこと】
 * - 軸を合計した総合点・偏差値・星評価・順位づけ
 * - 算定できない軸を0や最低値として描くこと
 * - 他の議員の値を基準に本人の値を変えること
 *
 * 数値が無い軸は「算定できない理由」を状態として持つ。これは活動が無いという
 * 意味ではない。0（確認した結果0件）とは別物として扱う。
 */

/**
 * 軸の状態。既存の語彙（evidenceAvailability / councilActivityRecord）と
 * 同じ意味の区分を使い、新しい同義コードを増やさない。
 */
export type AxisStatus =
  /** 一次資料から個人単位で算定できた。 */
  | "CONFIRMED"
  /** 算定できるが、対象が一部の議員に限られる等の条件付き。指標としては数値を出さない。 */
  | "CONDITIONAL"
  /** 記録は公開されているが、誰の行為かが分かる形で記載されていない。 */
  | "NOT_INDIVIDUALLY_ATTRIBUTABLE"
  /** 資料は公開されているが、当サイトがまだ取り込んでいない。 */
  | "NOT_ACQUIRED"
  /** 公式資料そのものがまだ公表されていない。 */
  | "SOURCE_NOT_PUBLISHED"
  /** 複数の公開資料の経路を調べたが確認できなかった。存在しないと断定しない。 */
  | "RESEARCH_EXHAUSTED"
  /** 制度上その議員に当てはまらない。 */
  | "NOT_APPLICABLE";

/** 市民向けの短い状態ラベル。内部コードと表示文言は分離する。 */
export const AXIS_STATUS_LABELS_JA: Record<AxisStatus, string> = {
  CONFIRMED: "算定できました",
  CONDITIONAL: "条件付き（指標にしていません）",
  NOT_INDIVIDUALLY_ATTRIBUTABLE: "個人単位では算定できません",
  NOT_ACQUIRED: "一次資料を取り込めていません",
  SOURCE_NOT_PUBLISHED: "公式資料が未公表です",
  RESEARCH_EXHAUSTED: "調べましたが確認できていません",
  NOT_APPLICABLE: "算定対象外です",
};

export interface AxisSourceRef {
  label: string;
  url?: string;
}

/** 数値を出せる軸が持つ、再計算のための内訳。 */
export interface AxisMeasurement {
  numeratorLabel: string;
  numerator: number;
  denominatorLabel: string;
  denominator: number;
  rateLabel: string;
  /** 0〜100の割合。点数ではない。 */
  rate: number;
  /** 図の半径に使う0〜1。利用者へ数値としては見せない。 */
  ratio: number;
}

export interface CouncilActivityAxis {
  key: string;
  /** 条例に沿った並び順（1〜7）。 */
  order: number;
  /**
   * 画面に出す軸名。条例上の役割そのものではなく、実際に観測している活動に近い名前にする。
   * 「市政運営の監視・評価」のような大きな概念を軸名にすると、
   * その役割全体を数値化しているように誤解されるため。
   */
  label: string;
  /** 図の頂点に置く短い名前（スマホで切れないように）。 */
  shortLabel: string;
  /** 条例が定めている役割。 */
  roleInOrdinance: string;
  /** 今回その役割に関連して観測している活動。 */
  observedActivity: string;
  /** 割合の上限（100%）の意味。満点・優秀という意味ではない。 */
  upperBoundMeaning: string;
  status: AxisStatus;
  /** なぜその状態なのか。活動が無いという意味ではないことを含めて書く。 */
  reason: string;
  measurement: AxisMeasurement | null;
  ordinanceBasis: string;
  /** 何を測っているか。 */
  measures: string;
  /** 何を測っていないか。 */
  doesNotMeasure: string;
  dataUsed: string;
  targetPeriodLabel: string;
  /** 欠損条件。 */
  missingRule: string;
  /** 対象外条件。 */
  notApplicableRule: string;
  sourceRefs: AxisSourceRef[];
  /** 個人帰属可能性。 */
  individualAttribution: string;
  /** 更新方法。 */
  updateRule: string;
}

const MINUTES_SOURCE: AxisSourceRef = {
  label: "延岡市議会 会議録検索システム",
  url: "https://www.kensakusystem.jp/nobeoka/",
};

const billProposalRoles = (billProposalRolesData as { roles: { role: string; personId: string }[] }).roles;
const decisionSubmitterRecords = billProposalRoles.filter((r) => r.role === "submitter");
const decisionSubmitterMemberIds = new Set(decisionSubmitterRecords.map((r) => r.personId));
const committeeReportMemberIds = new Set(committeeReportActivityEvents.map((e) => e.memberId));
const petitionBills = (billVotesData as { id: string; billTitle?: string }[]).filter(
  (b) => /請願|陳情/.test(b.billTitle ?? "") || /chinjo|seigan/.test(b.id),
);
const budgetReportEvents = committeeReportActivityEvents.filter((e) =>
  /予算審査|決算審査/.test(e.committeeName ?? ""),
);

/**
 * 議員1名分の7軸を組み立てる。
 *
 * @param member 対象の議員
 * @param record 会期単位の公開記録（1つ目の軸の数値はここから取る。二重に計算しない）
 * @param targetPeriodLabel 対象期間の表示文言
 * @param memberCount 現職議員数（全員へ適用できるかの説明に使う）
 */
export function buildCouncilActivityProfile(
  member: CouncilMember,
  record: CouncilActivityRecord,
  targetPeriodLabel: string,
  memberCount: number,
): CouncilActivityAxis[] {
  const askedRate = record.values.find((v) => v.key === "asked-rate");
  const excludedForSpeaker = record.sessions.filter((s) => s.excludedReasonCode === "SPEAKER_TERM");
  const measurable =
    askedRate && askedRate.value !== null && askedRate.numerator != null && askedRate.denominator != null;

  const monitoring: CouncilActivityAxis = {
    key: "monitoring",
    order: 1,
    label: "一般質問による市政チェック",
    shortLabel: "一般質問",
    roleInOrdinance: "市長等が行う市政の運営状況を、公正に監視し、評価すること（延岡市議会基本条例 第2条第1号）",
    observedActivity: "本会議で一般質問・質疑に立ったことを、会議録で確認できた会期の割合",
    upperBoundMeaning: "算定対象のすべての会期で一般質問を確認できた状態。満点・優秀という意味ではありません。",
    status: measurable ? "CONFIRMED" : "NOT_APPLICABLE",
    reason: measurable
      ? "会議録で発言者の氏名まで確認できるため、全議員に同じ算定方法を適用できます。"
      : excludedForSpeaker.length > 0
        ? "対象期間のすべての会期で議長を務めていたため、実施率を算定していません。一般質問をしなかった、活動が少ない、という意味ではありません。"
        : "算定対象となる会期がありません。",
    measurement: measurable
      ? {
          numeratorLabel: "一般質問実施会期",
          numerator: askedRate.numerator as number,
          denominatorLabel: "算定対象会期",
          denominator: askedRate.denominator as number,
          rateLabel: "確認率",
          rate: askedRate.value as number,
          ratio: (askedRate.numerator as number) / (askedRate.denominator as number),
        }
      : null,
    ordinanceBasis: "延岡市議会基本条例 第2条第1号（市長等が行う市政の運営状況を公正に監視、評価すること）",
    measures: "本会議で一般質問・質疑に立ったことを会議録で確認できた会期の割合。",
    doesNotMeasure:
      "質問の回数・長さ・内容の良し悪し、答弁を引き出せたかどうか、政策の当否。議員の能力や熱心さも測っていません。",
    dataUsed: "会議録の発言要約、会議録の取得状況",
    targetPeriodLabel,
    missingRule: "会議録が公開されていない会期は、分母にも分子にも入れません。「質問しなかった」とはみなしません。",
    notApplicableRule:
      "議長を務めていた会期は、比較条件を揃えるため分母から外します（議長は本会議の進行役を務める役職です）。" +
      "副議長は外していません（副議長が一般質問を行わないと明記した公式資料を確認できていないため）。" +
      "就任前・辞職後の会期も分母に入れません。",
    sourceRefs: [MINUTES_SOURCE],
    individualAttribution: "高い。会議録に発言者の氏名が明記されています。",
    updateRule: "新しい会議録を取り込むたびに自動で再計算します。",
  };

  const policyProposal: CouncilActivityAxis = {
    key: "policy-proposal",
    order: 2,
    label: "議員提出議案の提出",
    shortLabel: "議案提出",
    roleInOrdinance: "政策の立案・決定・執行・評価における論点、争点を明らかにすること（第2条第2号）",
    observedActivity: "本会議で決議案の提案理由説明を行ったことを、会議録で氏名まで確認できた件数",
    upperBoundMeaning: "（割合として算定していません）",
    status: "CONDITIONAL",
    reason:
      `議員提出決議の提出者は会議録で氏名まで確認でき、現在${decisionSubmitterRecords.length}件・` +
      `${decisionSubmitterMemberIds.size}名分を登録しています。ただし提案の機会は議員ごとに等しくないため、` +
      "割合として算定できる分母がありません。条例案・意見書の提出者も取り込めていません。" +
      "提出の記録が無いことは、政策提言をしていないという意味ではありません。",
    measurement: null,
    ordinanceBasis:
      "延岡市議会基本条例 第2条第2号（市の政策形成及び執行に係る立案、決定、執行、評価における論点、争点を明らかにすること）",
    measures: "本会議で決議案の提案理由説明を行ったことを、会議録で氏名まで確認できた件数（実数として別途掲載）。",
    doesNotMeasure: "提言の内容、実現したかどうか、賛否の方向。",
    dataUsed: "議員提出決議の提案理由説明",
    targetPeriodLabel,
    missingRule: "条例案・意見書等の提出者は未取得のため、件数に含めていません。",
    notApplicableRule: "該当なし。",
    sourceRefs: [MINUTES_SOURCE],
    individualAttribution: `記録がある範囲では高い。ただし該当するのは${memberCount}名中${decisionSubmitterMemberIds.size}名です。`,
    updateRule: "会議録から提案理由説明の発言者を確認し、人手で登録します。",
  };

  const representation: CouncilActivityAxis = {
    key: "representation",
    order: 3,
    label: "請願・陳情の紹介",
    shortLabel: "請願紹介",
    roleInOrdinance: "市民の意見を市政に反映させること（第2条第2号）",
    observedActivity: "請願・陳情の紹介議員として氏名を確認できた件数（現在は取り込めていません）",
    upperBoundMeaning: "（割合として算定していません）",
    status: "NOT_ACQUIRED",
    reason:
      `請願・陳情は${petitionBills.length}件を登録していますが、紹介議員の氏名は1件も取り込めていません。` +
      "紹介した実績が無いという意味ではなく、当サイトが資料を取り込めていないという意味です。",
    measurement: null,
    ordinanceBasis: "延岡市議会基本条例 第2条第2号（市民の意見を市政に反映させること）",
    measures: "（現在は測定していません）請願・陳情の紹介議員として氏名を確認できた件数。",
    doesNotMeasure:
      "地域行事への参加、後援会活動、SNSでの発信。これらは条例が定める議員の職務ではないため対象にしていません。",
    dataUsed: "（未取得）請願文書表・議案書",
    targetPeriodLabel,
    missingRule: "紹介議員の氏名を確認できるまで、件数を表示しません。0件とは表示しません。",
    notApplicableRule: "該当なし。",
    sourceRefs: [
      { label: "延岡市議会 議案等審議結果", url: "https://www.city.nobeoka.miyazaki.jp/site/gikai/1456.html" },
    ],
    individualAttribution: "資料には紹介議員が記載されるため、取り込めば帰属可能と見込まれます。",
    updateRule: "請願文書表の取り込みができしだい反映します。",
  };

  const longTermView: CouncilActivityAxis = {
    key: "long-term-view",
    order: 4,
    label: "取り上げた政策分野の記録",
    shortLabel: "政策分野",
    roleInOrdinance: "政策の立案・決定・執行・評価における論点、争点を明らかにすること（第2条第2号）",
    observedActivity: "会議録の見出し語から自動分類した政策分野と、2会期以上で取り上げたテーマの一覧",
    upperBoundMeaning: "（割合として算定していません。分野の広さを良いこととして数値化しません）",
    status: "CONDITIONAL",
    reason:
      "取り上げた政策分野と、複数会期で取り上げたテーマは一覧として表示しています。" +
      "ただし分野の数はキーワード辞書の網羅度に左右され、現在は見出し語の約4割がどの分野にも分類できていません。" +
      "分野が広いことを良いこととして数値化しません。",
    measurement: null,
    ordinanceBasis: "延岡市議会基本条例 第2条第2号（政策の立案・決定・執行・評価における論点、争点を明らかにすること）",
    measures: "会議録の見出し語から自動分類した政策分野と、2会期以上で取り上げたテーマ（いずれも一覧として表示）。",
    doesNotMeasure: "分野の広さ、テーマの重要度、視野の広さそのもの。政策テーマに価値の上下は付けません。",
    dataUsed: "会議録の見出し語、テーマ辞書",
    targetPeriodLabel,
    missingRule: "どのキーワードにも一致しない見出し語は、推測で分類せず「分類していない見出し語」として別に数えます。",
    notApplicableRule: "該当なし。",
    sourceRefs: [MINUTES_SOURCE],
    individualAttribution: "見出し語は発言に紐づくため帰属可能。ただし分類は当サイトの自動処理です。",
    updateRule: "会議録の取り込みと、テーマ辞書の更新のたびに再計算します。",
  };

  const budgetReview: CouncilActivityAxis = {
    key: "budget-review",
    order: 5,
    label: "予算・決算特別委員会での報告",
    shortLabel: "予算決算",
    roleInOrdinance: "市長等が行う市政の運営状況を、公正に監視し、評価すること（第2条第1号）",
    observedActivity: "本会議での予算・決算特別委員会の委員長報告（委員会内の質疑は個人を特定できません）",
    upperBoundMeaning: "（割合として算定していません）",
    status: "NOT_INDIVIDUALLY_ATTRIBUTABLE",
    reason:
      `予算審査特別委員会・決算審査特別委員会の審査結果は本会議の委員長報告で確認でき、現在${budgetReportEvents.length}件を登録しています。` +
      "しかし委員会の中での質疑は会議録に「委員より」とだけ記録され、どの議員の発言かを特定できません。" +
      "そのため委員長を務めた議員以外は算定できません。これは審査に加わっていないという意味ではありません。",
    measurement: null,
    ordinanceBasis: "延岡市議会基本条例 第2条第1号（市長等が行う市政の運営状況を公正に監視、評価すること）",
    measures: "（現在は測定していません）本会議での予算・決算特別委員会の委員長報告は実数として別途掲載しています。",
    doesNotMeasure: "委員会での質疑の回数・内容、予算への賛否。",
    dataUsed: "本会議での委員長報告",
    targetPeriodLabel,
    missingRule: "委員会内の個別質疑は個人に帰属できないため、件数を表示しません。",
    notApplicableRule: "委員長を務めた議員以外は、委員長報告の件数を持ちません（0件ではなく対象外）。",
    sourceRefs: [MINUTES_SOURCE],
    individualAttribution: "低い。委員長報告のみ帰属可能で、委員会内の発言は匿名で記録されます。",
    updateRule: "会議録の委員長報告から機械的に確認・登録します。",
  };

  const memberDebate: CouncilActivityAxis = {
    key: "member-debate",
    order: 6,
    label: "本会議での討論",
    shortLabel: "討論",
    roleInOrdinance: "議員相互の自由な討議により議論を尽くすこと（第2条第3号）",
    observedActivity: "本会議での賛成・反対討論の発言者（現在は取り込めていません）",
    upperBoundMeaning: "（割合として算定していません）",
    status: "NOT_ACQUIRED",
    reason:
      "賛成・反対討論の発言者は会議録本文に記載がありますが、当サイトはまだ討論者を構造化して取り込めていません。" +
      "討論をしていないという意味ではありません。",
    measurement: null,
    ordinanceBasis: "延岡市議会基本条例 第2条第3号（議員相互の自由な討議により議論を尽くすこと）",
    measures: "（現在は測定していません）本会議での賛成・反対討論の発言者。",
    doesNotMeasure: "討論の内容、賛否の方向。",
    dataUsed: "（未取得）会議録本文の討論部分",
    targetPeriodLabel,
    missingRule: "討論者を確認できるまで、件数を表示しません。0件とは表示しません。",
    notApplicableRule: "該当なし。",
    sourceRefs: [MINUTES_SOURCE],
    individualAttribution: "会議録に発言者名が記載されるため、取り込めば帰属可能と見込まれます。",
    updateRule: "会議録からの討論者抽出ができしだい反映します。",
  };

  const committeeActivity: CouncilActivityAxis = {
    key: "committee-activity",
    order: 7,
    label: "委員会での役職と報告",
    shortLabel: "委員会",
    roleInOrdinance: "議会の活動原則（第2条）",
    observedActivity: "所属委員会と、本会議での委員長・副委員長報告（出席名簿は確認できていません）",
    upperBoundMeaning: "（割合として算定していません）",
    status: "RESEARCH_EXHAUSTED",
    reason:
      `所属委員会は登録済みで、本会議での委員長・副委員長報告は${memberCount}名中${committeeReportMemberIds.size}名分を確認しています。` +
      "ただし議員別の出席・欠席名簿を複数の公開資料の経路で調べましたが確認できていません" +
      "（延岡市議会が公表していないと断定するものではありません）。" +
      "出席の記録が無いまま委員長報告だけを軸にすると、役職に就いたかどうかを表すだけになるため、数値にしていません。",
    measurement: null,
    ordinanceBasis: "延岡市議会基本条例 第2条（議会の活動原則）",
    measures: "（現在は測定していません）所属委員会と、本会議での委員長・副委員長報告は別途掲載しています。",
    doesNotMeasure: "出席率、委員会での発言、役職の重み。委員会に所属していること自体は活動実績として数えません。",
    dataUsed: "委員会名簿、本会議での委員長報告",
    targetPeriodLabel,
    missingRule: "議員別の出席・欠席名簿を確認できていないため、出席率は算定しません。欠席0件とも表示しません。",
    notApplicableRule: "該当なし。",
    sourceRefs: [MINUTES_SOURCE],
    individualAttribution: "委員長報告のみ帰属可能。出席は名簿自体を確認できていません。",
    updateRule: "出席名簿を確認できしだい、算定方法を公開したうえで反映します。",
  };

  void member;
  return [monitoring, policyProposal, representation, longTermView, budgetReview, memberDebate, committeeActivity];
}

/** 数値を出せる軸の数。ポリゴン表示へ切り替えるかの判断に使う。 */
export function measurableAxisCount(axes: CouncilActivityAxis[]): number {
  return axes.filter((a) => a.measurement !== null).length;
}

/**
 * ポリゴン（レーダー）として描いてよいか。
 *
 * 数値のある軸が少ないまま多角形を描くと、資料が無いことが
 * 活動の少なさとして見えてしまう。3軸以上そろうまでは状態図で示す。
 */
export const POLYGON_MIN_AXES = 3;

export function canRenderPolygon(axes: CouncilActivityAxis[]): boolean {
  return measurableAxisCount(axes) >= POLYGON_MIN_AXES;
}
