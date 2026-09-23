import type { CouncilMember } from "../types";
import billProposalRolesData from "../data/billProposalRoles.json";
import type { CouncilActivityRecord } from "./councilActivityRecord";

/**
 * 議会活動プロフィール。
 *
 * 延岡市議会基本条例が議会・議員に定めている役割のうち、
 * 「公開された一次資料から個人単位で確認でき、全議員へ同じ算定方法を適用でき、
 * 算定式を公開でき、第三者が再計算できる」ものだけを軸として置く。
 *
 * 【軸を絞った経緯（2026-09-23）】
 * 当初は条例上の役割をそのまま7軸としていたが、一次資料を調べた結果、
 * 次の3つは軸として成立しないことが分かったため外した。記録そのものは
 * 「議会での活動」として別に掲載しており、消したわけではない。
 * - 請願・陳情の紹介：紹介議員は公開資料に定型掲載されておらず、継続して取得できない。
 * - 予算・決算特別委員会：委員は議長を除く全議員で、委員会内の質疑は「委員より」と匿名。
 *   委員長を務めた議員しか記録が残らず、全議員を同じ条件で比べられない。
 * - 委員会での役職と報告：委員長報告は役職に就いた議員にしか発生しない
 *   （実データでは26名中13名が0件）。活動量ではなく役職の割り当てを表してしまう。
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
  /** 討論の分子・分母。呼び出し側が会議録データから数えて渡す。 */
  debate?: { numerator: number; denominator: number },
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

  const longTermView: CouncilActivityAxis = {
    key: "long-term-view",
    order: 3,
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

  const debateMeasurable = debate != null && debate.denominator > 0;
  const memberDebate: CouncilActivityAxis = {
    key: "member-debate",
    order: 4,
    label: "本会議での討論",
    shortLabel: "討論",
    roleInOrdinance: "議員相互の自由な討議により議論を尽くすこと（延岡市議会基本条例 第2条第3号）",
    observedActivity: "本会議の討論の場で発言したことを、会議録で確認できた会期の割合",
    upperBoundMeaning:
      "討論が行われたすべての会期で討論に立った状態。満点・優秀という意味ではありません。",
    status: debateMeasurable ? "CONFIRMED" : "NOT_APPLICABLE",
    reason: debateMeasurable
      ? "討論は会議録に発言者の氏名が記録されるため、全議員に同じ算定方法を適用できます。討論に立たなかったことは、議案に賛成だった・関心が無かったという意味ではありません。"
      : "対象期間に討論が行われた会期がないため、算定していません。",
    measurement: debateMeasurable
      ? {
          numeratorLabel: "討論を行った会期",
          numerator: debate.numerator,
          denominatorLabel: "討論が行われた会期",
          denominator: debate.denominator,
          rateLabel: "確認率",
          rate: Math.round((debate.numerator / debate.denominator) * 100),
          ratio: debate.numerator / debate.denominator,
        }
      : null,
    ordinanceBasis: "延岡市議会基本条例 第2条第3号（議員相互の自由な討議により議論を尽くすこと）",
    measures: "本会議で賛成討論・反対討論に立ったことを会議録で確認できた会期の割合。",
    doesNotMeasure:
      "賛成か反対かという立場、討論の内容や長さ、説得力。討論しなかった議員の賛否も測っていません（議案の採決は起立採決のため、会議録から個人の賛否は分かりません）。",
    dataUsed: "会議録の討論の段階から抽出した発言者の記録",
    targetPeriodLabel,
    missingRule:
      "討論が1件も行われなかった会期は、分母にも分子にも入れません。議案に異論が無ければ討論は行われないため、その会期を分母に入れると議員の行動と関係なく割合が下がります。",
    notApplicableRule:
      "議長を務めていた会期は、議事進行役のため分母から外します。就任前・辞職後の会期も分母に入れません。",
    sourceRefs: [MINUTES_SOURCE],
    individualAttribution: "高い。会議録に発言者の氏名が明記されています。",
    updateRule: "新しい会議録を取り込むたびに、討論の段階から自動で抽出し直します。",
  };
  void member;
  return [monitoring, policyProposal, longTermView, memberDebate];
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
