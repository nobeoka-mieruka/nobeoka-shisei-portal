import type { CouncilSpeech } from "../types";
import questionCollectionStatusData from "../data/questionCollectionStatus.json";
import { QUESTION_LIKE_SPEECH_TYPES } from "./questionLikeSpeechTypes";

/**
 * 議員詳細ページの「議会活動データ」レーダーチャート用の集計モジュール。
 *
 * 【最重要方針】この指数は議員の優劣・能力・人物評価・推薦順位を示すものではない。
 * 既存の一次情報・公開データを、項目ごとに共通基準で0〜100へ機械的に換算し、
 * 「公開情報から確認できる活動状況」を可視化するだけである。独自の総合点・順位・
 * 星評価・優秀/不十分などの判定は一切行わない。
 *
 * データが存在しない・不十分な項目は0点にせず、必ずdataStatus:"missing"（対象記録なし）
 * またはdataStatus:"partial"（一部データのみ収録）として扱い、valueをnullのまま返す
 * （呼び出し側は value===null を「未収録」として表示し、0を実データとして描画しない）。
 */

/**
 * 指標の算定状態。
 *
 * - complete … 算定できた（値が0であっても「確認した結果0」の意味）
 * - partial … 一部の資料だけで算定した
 * - missing … 資料が未収録・未公開で算定できない（0ではない）
 * - not-applicable … 制度上その議員に当てはまらないため算定しない
 *   （例：議長は慣例として一般質問を行わないため、質問の実施を測る指標の対象外）
 *   0点として描画してはならない。
 */
export type RadarDataStatus = "complete" | "partial" | "missing" | "not-applicable";

export interface RadarMetric {
  key: string;
  label: string;
  /** 0〜100。データ未収録・算定不能の場合はnull（0点として扱わない）。 */
  value: number | null;
  /** 正規化前の生値（参考表示用）。 */
  rawValue?: number;
  numerator?: number;
  denominator?: number;
  /** この指標が何を表すかの説明文（画面・ツールチップ表示用）。 */
  description: string;
  /** 算定方法の短い説明（ツールチップ用）。 */
  methodNote: string;
  /** 出典（データソース）の表示名。 */
  sourceLabel: string;
  updatedAt?: string;
  dataStatus: RadarDataStatus;
  /** 延岡市議会基本条例のうち、この指標が対応する条。市民へ根拠として示す。 */
  ordinanceBasis?: string;
  /** not-applicable のときに、なぜ対象外なのかを市民向けに説明する文。 */
  notApplicableReason?: string;
}

/**
 * 発言データの収録対象期間内で、実際に会議録本文を取得・検証済み（transcriptAvailable:true）の
 * 定例会IDの一覧（単一情報源はsrc/data/questionCollectionStatus.json）。
 * 会議録が未公開の会期（例：令和8年6月定例会）は、活動なしと誤解されないよう、
 * 分母からも分子からも除外する。
 */
export const TRANSCRIPT_AVAILABLE_SESSION_IDS: string[] = (
  questionCollectionStatusData as { sessions: { sessionId: string; transcriptAvailable: boolean }[] }
).sessions.filter((s) => s.transcriptAvailable).map((s) => s.sessionId);

function clamp0to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * 在職期間を考慮した「対象となる会期ID一覧」を求める。
 * - 現職議員：全員が同一の選挙日（councilSpeechPeriod.from）を任期開始とするため、
 *   会議録取得済みの全会期（TRANSCRIPT_AVAILABLE_SESSION_IDS）をそのまま対象とする。
 * - 元議員：公式資料で在職・発言を確認できた会期（formerMembers.jsonのservedSessions）
 *   のみを対象とする。servedSessionsは「活動が確認できた会期」であり、在職期間全体を
 *   保証するものではないため、この分母は「確認できた在職会期数」である旨を必ず明示する。
 */
export function eligibleSessionIdsFor(options: { isFormerMember: boolean; servedSessions?: string[] }): string[] {
  if (!options.isFormerMember) return TRANSCRIPT_AVAILABLE_SESSION_IDS;
  const served = options.servedSessions ?? [];
  return served.filter((id) => TRANSCRIPT_AVAILABLE_SESSION_IDS.includes(id));
}

/** 指定した議員の発言のうち、公開・確認済み（isPublished:true）のものだけを対象にする。 */
function publicQuestionLikeSpeeches(speeches: CouncilSpeech[]): CouncilSpeech[] {
  return speeches.filter((s) => s.isPublished && QUESTION_LIKE_SPEECH_TYPES.has(s.speechType));
}

/**
 * 市政運営の監視・評価（延岡市議会基本条例 第2条第1号）。
 *
 * 会議録を確認できた定例会のうち、本会議で質問・質疑に立ったことが確認できた会期の割合。
 *
 * **会期単位で数える理由**：質問項目数や再質問数は、会議録から要約を抽出できた量に左右される。
 * 実際に、会議録を取得済みでも要約が途中の会期があり、1登壇あたりの記録量が会期によって
 * 1.2件〜10.7件と開きがある。件数を指標にすると、議員の活動ではなく当サイトの整備状況を
 * 表示することになる。「その会期に登壇したかどうか」は記録が薄い会期でも確実に残るため、
 * 会期単位であれば全議員を同じ条件で比べられる。
 *
 * 分母は「会議録を確認できた会期数」という固定値で、他の議員の活動によって変動しない。
 */
export function calculateQuestionActivityIndex(
  speeches: CouncilSpeech[],
  eligibleSessionIds: string[],
  updatedAt?: string,
  options?: { notApplicableReason?: string },
): RadarMetric {
  const base = {
    key: "question",
    label: "市政運営の監視・評価",
    description:
      "会議録を確認できた定例会のうち、本会議で質問・質疑に立ったことが確認できた会期の割合です。質問の回数や長さ、内容の良し悪しは含みません。",
    methodNote:
      "質問・質疑を確認できた会期数 ÷ 会議録を確認できた会期数 × 100。会議録が未公開の会期は分母に含めません。",
    sourceLabel: "延岡市議会 会議録（本会議）",
    ordinanceBasis: "延岡市議会基本条例 第2条第1号（市長等が行う市政の運営状況を公正に監視、評価すること）",
    updatedAt,
  };
  // 制度上その議員に当てはまらない場合は、0ではなく「対象外」として扱う。
  if (options?.notApplicableReason) {
    return { ...base, value: null, dataStatus: "not-applicable", notApplicableReason: options.notApplicableReason };
  }
  if (eligibleSessionIds.length === 0) {
    return { ...base, value: null, dataStatus: "missing" };
  }
  const activeSessions = new Set(publicQuestionLikeSpeeches(speeches).map((s) => s.sessionId));
  const numerator = eligibleSessionIds.filter((id) => activeSessions.has(id)).length;
  const denominator = eligibleSessionIds.length;
  const value = clamp0to100((numerator / denominator) * 100);
  return { ...base, value, numerator, denominator, dataStatus: "complete" };
}

/**
 * 議会での発言量（事実の実数）。
 *
 * 以前は「発言した会期の割合×50 ＋ 質問項目数を上限20件で対数正規化×50」という
 * 合成値を返していたが、この重み付け・上限・対数変換には出典がなく、当サイトが作った
 * 独自の採点だった。実測でも26名中23名が上限で頭打ちになり、質問項目135件の議員と
 * 26件の議員が同じ値になっていた。前半の会期割合は「市政運営の監視・評価」と
 * 分子・分母が完全に同じで、重複した軸でもあった。
 *
 * 現在は点数を作らず、会議録から確認できた質問項目の実数だけを返す。
 * 会議録の要約は会期によって抽出量に差があるため、この実数は議員どうしの比較には
 * 使わず、その議員について確認できた記録の量として示す。
 */
export function calculateSpeechActivityIndex(
  speeches: CouncilSpeech[],
  eligibleSessionIds: string[],
  updatedAt?: string,
): RadarMetric {
  const base = {
    key: "speech",
    label: "議会での発言量",
    description:
      "会議録から確認できた質問項目の件数です。点数ではありません。会議録の要約は会期によって抽出できた量に差があるため、議員どうしを比べる数値としては扱いません。",
    methodNote: "会議録で確認できた質問項目の実数（点数化・正規化はしていません）。",
    sourceLabel: "延岡市議会 会議録（本会議）",
    updatedAt,
  };
  if (eligibleSessionIds.length === 0) {
    return { ...base, value: null, dataStatus: "missing" };
  }
  const published = publicQuestionLikeSpeeches(speeches);
  const totalItems = published.reduce((sum, s) => sum + s.questionItems.length, 0);
  // 点数（value）は作らない。確認できた実数だけを持たせる。
  return { ...base, value: null, rawValue: totalItems, dataStatus: "complete" };
}

/**
 * 3. 出席状況：本サイトは現時点で本会議・委員会の個別出席記録を収録していないため、
 * 常にdataStatus:"missing"を返す（0点として描画しない）。
 *
 * 【Phase106調査メモ】会議録検索システム（kensakusystem.jp）のHTML本文に加え、のべおか
 * 市議会だより（複数号のPDF）、会議日程表、議会事務局公開資料一覧、会議録検索システム
 * トップページの案内文を確認したが、いずれにも議員別の出席・欠席名簿は掲載されていない
 * （公開資料の構成上、本会議の開会宣言部分に出席者数のみが述べられ個人名の名簿までは
 * 含まれない）。「名簿が見つからない」ことは「全員出席」を意味しない点に注意し、
 * 未収録（missing）のまま0点扱いにしないという既存方針を維持する。
 */
export function calculateAttendanceIndex(): RadarMetric {
  return {
    key: "attendance",
    label: "出席状況",
    value: null,
    description:
      "本会議・委員会に議員一人ひとりが出席したかどうかの記録です。議員別の出席・欠席名簿を確認できていないため、数値にしていません。",
    methodNote:
      "算定していません。出席率・出席回数のいずれも表示しません（欠席が0件という意味でも、出席が0件という意味でもありません）。",
    sourceLabel: "出席記録（複数の公開資料経路を調査しましたが、議員別の出席・欠席名簿を確認できていません）",
    dataStatus: "missing",
  };
}

/**
 * 4. 議案等の意思表示：公開・記名採決のうち、賛否・棄権・欠席等の意思表示が確認できた割合。
 * 賛成・反対の「内容」を評価しない（賛成=高得点のような算定は行わない）。
 * 既存データ（billVotes.json）は議案ごとの議決結果のみで、議員個人の賛否内訳
 * （memberVotes）は現時点で全件未登録のため、常にdataStatus:"missing"を返す。
 */
export function calculateVotingDisclosureIndex(numerator: number, denominator: number, updatedAt?: string): RadarMetric {
  const base = {
    key: "voting",
    label: "議案等の意思表示",
    description: "公開されている記名採決のうち、この議員の賛否・棄権・欠席等の意思表示が確認できた議案の割合です。賛成・反対どちらであるかを評価するものではありません。",
    methodNote: "意思表示を確認できた議案数／対象議案数（分子・分母をそのまま示します。賛成・反対の内容は数値化しません）。",
    sourceLabel: "議案ごとの賛否（議案賛否データ）",
    updatedAt,
  };
  if (denominator === 0) {
    return {
      ...base,
      value: null,
      dataStatus: "missing",
    };
  }
  // 点数にはしない。延岡市議会の採決は簡易採決が大半で、個人別の賛否が公表された議案は
  // ごくわずかしかない。割合にすると分母が小さすぎて全員が同じ値になるか、
  // 在職期間の差だけで差がついてしまう。確認できた件数と対象件数をそのまま示す。
  return { ...base, value: null, numerator, denominator, dataStatus: numerator > 0 ? "complete" : "missing" };
}

/**
 * 5. 提案・討論等：議案提出・修正案提出・請願紹介・討論・動議・要望提案・委員長報告等の件数。
 * 現時点でarchiveCouncilDocuments.jsonに議員別の提案者・関連議員情報が未収録のため、
 * 常にdataStatus:"missing"を返す。
 */
export function calculateProposalActivityIndex(): RadarMetric {
  return {
    key: "proposal",
    label: "提案・討論等",
    value: null,
    description:
      "会議録に議員名が記載されている「決議の提出者」と「本会議での委員長・副委員長報告」は、実数として別途掲載しています。条例案・意見書等の提出者と請願・陳情の紹介議員は議員別に収録できていないため、この項目としては算定していません。",
    methodNote: "算定していません。確認できた件数は、合成せずそれぞれ別の実数として表示します。",
    sourceLabel: "会議録本文（決議の提出者・委員長報告は登録済み。条例案等の提出者と紹介議員は議員別に未収録）",
    dataStatus: "missing",
  };
}

export interface InformationDisclosureChecklistItem {
  label: string;
  filled: boolean;
}

/**
 * 6. 情報公開：議員本人の能力・活動量ではなく、ポータル上のプロフィール情報の充足状況。
 * SNS未利用等の不作為をマイナス評価しない（「未確認」ではなく単純な充足率として扱う）。
 */
export function calculateInformationDisclosureIndex(
  checklist: InformationDisclosureChecklistItem[],
  updatedAt?: string,
): RadarMetric {
  const base = {
    key: "disclosure",
    label: "情報公開",
    description: "経歴、所属会派、所属委員会、当選回数、公式ページ・SNS、一般質問履歴、議案賛否履歴など、ポータル上で確認できるプロフィール情報の充足状況です。SNSを利用していないこと自体を低評価とするものではありません。",
    methodNote: "確認できた項目数／確認対象項目数（分子・分母をそのまま示します）。",
    sourceLabel: "議員プロフィール（現職議員データ等）",
    updatedAt,
  };
  if (checklist.length === 0) {
    return { ...base, value: null, dataStatus: "missing" };
  }
  const numerator = checklist.filter((c) => c.filled).length;
  const denominator = checklist.length;
  // 8項目の選定は当サイトの設計で、延岡市議会基本条例に根拠があるものではない。
  // 割合にすると条例に根拠のない項目（SNSの有無など）が指標として並んでしまうため、
  // 点数は作らず、確認できた項目数をそのまま示す。
  // チェックリストの各項目は「確認済みか否か」を必ず判定できるため、結果が0件（未記入が多い）
  // であっても、それは「データが無くて算定できない」のではなく「確認した結果0件だった」という
  // 確定した値である。したがってchecklist自体が空（算定不能）の場合のみmissingとし、
  // それ以外は常にcompleteとして扱う（valueをそのまま実データとして表示する）。
  return {
    ...base,
    value: null,
    numerator,
    denominator,
    dataStatus: "complete",
  };
}

/** 全指標が"missing"（対象記録なし）かどうか。チャートの表示可否判定に使う。 */
export function allMetricsMissing(metrics: RadarMetric[]): boolean {
  return metrics.every((m) => m.value === null);
}
