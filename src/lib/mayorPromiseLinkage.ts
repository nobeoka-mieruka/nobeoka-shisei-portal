import type { MayorPromiseItem, PromiseEvidenceStatus } from "../types";

/**
 * Phase208：市長公約「予算 → 議案 → 成果」の状態を、市民向けの表現へ精密化するための共通ロジック。
 *
 * ■ なぜ必要か
 * Phase205（reports/phase205-mayor-promise-linkage.json）で、既存の relatedBudget / relatedBill
 * （自由記述文）を読み取ると、同じ「未確認」の中に性質の異なる状態が混在していることが分かった。
 * とくに議案側は、
 *   - 当初予算議案に含まれており個別議案が無いことを一次資料で整理済み（＝答えが出ている）
 *   - 議案化を伴わない可能性が高いが、原文自身が「断定はしていない」と明記している（＝未確定）
 * の2つが、いずれも「議案：資料確認中」という同一表示に潰れていた。
 * 画面上でこの2つを区別することが Phase208 の目的である。
 *
 * ■ 状態語彙について（新しい status enum は追加していない）
 * - 解決状況（resolution）は、既存の PromiseEvidenceStatus
 *   （"confirmed" | "candidate" | "under_review" | "not_found" | "unavailable"、src/types/index.ts）
 *   をそのまま再利用する。Phase208 で新しい status enum は導入していない。
 * - reasonCode は Phase205 が定義した文字列をそのまま引き継ぐ。status を置き換えるものではなく、
 *   「なぜその解決状況なのか」を補足するためのコード。
 * - 判定規則も Phase205（scripts/analyze-phase205.mjs の classifyBudget / classifyBill）と同一。
 *   Phase208 では規則を変えずに、判定結果を画面表示へ届けられるようにした。
 *
 * ■ 絶対に守ること
 * - 「独立した議案が無いことを確認済み（NO_SEPARATE_BILL_CONFIRMED）」へ格上げしてよいのは、
 *   一次資料が断定している場合だけ。原文に「断定はしていない」等のヘッジ表現がある限り、
 *   under_review 側に置く（＝「議案なし」と「確認中」を混同しない）。
 * - reasonCode（内部コード）を画面へそのまま出さない。表示は必ず下記の表示辞書を経由する。
 * - Phase213：pending のうち「次にどの公式資料を確認すれば進むか」が特定できているものは
 *   awaitingSource にその資料名を持たせ、画面で「何を待っているか」を示す。
 *   resolved（確認済みで独立した議案・予算が無い）には awaitingSource を付けない。
 *   これは表示の粒度を上げるだけで、状態（reasonCode / resolution）は一切変えていない。
 * - 既存の isPromiseBudgetConfirmed / isPromiseBillConfirmed（src/lib/mayorPromiseStatus.ts）は
 *   「予算額／対応する議案そのものを特定できた公約数」という別指標であり、変更していない。
 *   BUDGET_BILL_INCLUDED は「独立議案が無いことの確認」であって「議案を特定できた」ではないため、
 *   その件数には算入しない。
 */

/** 予算の確認状況を補足する理由コード（Phase205 と同一）。 */
export type MayorPromiseBudgetReasonCode =
  /** 一次資料で公約と予算事業の対応関係を確認できた。 */
  | "CONFIRMED_BUDGET_ITEM"
  /** 市長定例記者会見資料の主要事業一覧に記載が無かった（＝予算が無いという意味ではない）。 */
  | "NOT_IN_MAJOR_PROJECT_LIST"
  /** 既存の人件費・事務費の枠内とみられるが、独立した予算額の明記は未確認。 */
  | "WITHIN_EXISTING_OPERATING_COST"
  /** 複数年度・複数議案にまたがるため単年度の予算額としては特定できていない。 */
  | "MULTI_YEAR_MULTI_BILL"
  /** 上記のいずれにも当てはまらない未確認。 */
  | "UNDER_REVIEW";

/** 議案の確認状況を補足する理由コード（Phase205 と同一 ＋ Phase208 で格上げ先・資料欠落を明示）。 */
export type MayorPromiseBillReasonCode =
  /** relatedBillVoteIds に、議案名または提案理由本文で対象事業を直接確認できた議案が登録されている。 */
  | "CONFIRMED_RELATED_BILL"
  /** 当初予算議案に含まれる歳出予算の一部であり、事業単位で議決された独立の議案は無いと整理済み。 */
  | "BUDGET_BILL_INCLUDED"
  /**
   * 一次資料が「独立した議案を伴わない」と断定しており、確認済みとして扱えるもの。
   * 現時点で該当は 0 件（Phase208 時点）。原文が「断定はしていない」と明記している間は
   * NO_SEPARATE_BILL_LIKELY のまま据え置き、ここへ格上げしない。
   */
  | "NO_SEPARATE_BILL_CONFIRMED"
  /** 現時点で議案が無いのは実態と整合し、将来の制度変更時に議案が提出される見込み。 */
  | "PENDING_FUTURE_BILL"
  /** 要綱・人事上の措置・運用改善等で議案化を伴わない可能性が高いが、原文が断定していない。 */
  | "NO_SEPARATE_BILL_LIKELY"
  /** 議案検索で該当 0 件だが、議案が無い理由の整理が原文に記載されていない。 */
  | "NOT_INTERPRETED"
  /** 上記のいずれにも当てはまらない未確認。 */
  | "UNDER_REVIEW"
  /** 説明の無い「確認中」だけが記録されており、参照できる資料の記述がまだ無い。 */
  | "SOURCE_NOT_FOUND";

/** 表示の強さ。色だけで意味を伝えないため、必ず文字ラベルと併用する。 */
export type LinkageTone =
  /** 一次資料で直接確認できた。 */
  | "confirmed"
  /** 「独立議案なし」等、答え自体は一次資料で整理済み（議案が可決されたという意味ではない）。 */
  | "resolved"
  /** まだ確認できていない。 */
  | "pending";

export interface LinkageDisplay {
  /** 一覧カードのバッジ用の短い文言。 */
  pillLabel: string;
  /** 詳細ページ用の1文説明（市民向け）。 */
  description: string;
  tone: LinkageTone;
  /**
   * Phase213：「何が揃えば次に進むのか」が読み手に分かるように、確認待ちの一次資料名を持たせる。
   * 値は Phase205（reports/phase205-mayor-promise-linkage.json の nextInvestigationTargets.nextSource）で
   * すでに特定済みの資料名をそのまま引き継いだものであり、Phase213 で新しく調査した資料ではない。
   * 「まだ確認できていない（＝資料待ち）」の場合にだけ入れる。
   * 「確認済みで独立した議案・予算が無い」場合（tone: "resolved"）には決して入れない。
   */
  awaitingSource?: string;
}

/**
 * Phase213：その状態が「特定の公式資料の入手・確認を待っている」ものかどうか。
 * 「確認済みで議案・予算なし（resolved）」と読み手が区別できるようにするための判定であり、
 * 新しい状態を作るものではない（tone と awaitingSource の組み合わせを見ているだけ）。
 */
export function isAwaitingSource(display: LinkageDisplay): boolean {
  return display.tone === "pending" && typeof display.awaitingSource === "string" && display.awaitingSource.length > 0;
}

export interface MayorPromiseBudgetLinkage {
  reasonCode: MayorPromiseBudgetReasonCode;
  /** 既存の PromiseEvidenceStatus を再利用した解決状況。 */
  resolution: PromiseEvidenceStatus;
  display: LinkageDisplay;
  /** 関連事業候補（確定ではない）が登録されているか。 */
  hasCandidates: boolean;
}

export interface MayorPromiseBillLinkage {
  reasonCode: MayorPromiseBillReasonCode;
  resolution: PromiseEvidenceStatus;
  display: LinkageDisplay;
  /** relatedBillVoteIds に登録された議案ID。 */
  billVoteIds: string[];
  /** 原文に「断定はしていない」等のヘッジ表現があるか（＝確認済みへ格上げできない根拠）。 */
  hedged: boolean;
}

/**
 * 原文が結論を留保していることを示す表現。これが含まれる限り「確認済み」へ格上げしない。
 * Phase205 の HEDGE_RE と同一。
 */
const HEDGE_PATTERN = /断定は(?:して)?いない/;

/** 未調査を示す前方一致（src/lib/mayorPromiseStatus.ts と同じ運用ルール）。 */
const UNRESOLVED_PREFIX = "確認中";

/**
 * 原文が留保を付けている場合に、説明文の末尾へ必ず添える一文。
 * 「予算議案に含まれている」ことまでは一次資料で整理済みでも、原文が
 * 「事業名を明示した別の議案が無いとまでは断定していない」と書いている公約があるため、
 * その留保を市民向け表示から落とさない（確認済みと確認中を混同しないための保険）。
 */
const HEDGE_NOTE =
  "なお、この事業名を明示した別の議案が存在しないとまでは断定していないため、引き続き確認します。";

const BUDGET_DISPLAY: Record<MayorPromiseBudgetReasonCode, LinkageDisplay> = {
  CONFIRMED_BUDGET_ITEM: {
    pillLabel: "予算額を確認済み",
    description: "公式資料で、この公約に対応する予算事業と金額を確認できました。",
    tone: "confirmed",
  },
  NOT_IN_MAJOR_PROJECT_LIST: {
    // Phase213：「追加確認中」だけでは何を待っているのか市民に伝わらないため、
    // 待っている資料が特定できている状態であることを短い文言でも示す（内部コードは出さない）。
    pillLabel: "予算資料の確認待ち",
    description:
      "市長定例記者会見資料の主要事業一覧には、この公約に対応する項目がありませんでした。同資料は規模の大きい事業の抜粋のため、予算が無いという意味ではありません。事業ごとの予算額まで分かる下記の資料を当サイトではまだ確認できておらず、確認できた時点でこの欄を更新します。",
    tone: "pending",
    awaitingSource: "令和8年度 延岡市予算に関する説明書（当初予算）",
  },
  WITHIN_EXISTING_OPERATING_COST: {
    pillLabel: "予算資料の確認待ち",
    description:
      "既存の人件費・事務費の枠内で実施されているとみられますが、独立した予算額の記載は確認できていません。下記の資料の総務費の内訳で確認できる可能性があり、確認できた時点でこの欄を更新します。",
    tone: "pending",
    awaitingSource: "令和8年度 延岡市予算に関する説明書（総務費）",
  },
  MULTI_YEAR_MULTI_BILL: {
    pillLabel: "関連議案に金額の記載あり",
    description:
      "複数年度・複数議案にまたがる事業のため、単年度の予算額としては特定できていません。個別の契約金額は関連議案に記載があります。",
    tone: "resolved",
  },
  UNDER_REVIEW: {
    pillLabel: "追加確認中",
    description: "この公約に対応する予算を確認中です。予算が無いという意味ではありません。",
    tone: "pending",
  },
};

const BILL_DISPLAY: Record<MayorPromiseBillReasonCode, LinkageDisplay> = {
  CONFIRMED_RELATED_BILL: {
    pillLabel: "関連議案を確認済み",
    description: "議案名または提案理由の本文で、この公約に対応する議案を確認できました。",
    tone: "confirmed",
  },
  BUDGET_BILL_INCLUDED: {
    pillLabel: "予算議案に含まれています",
    description:
      "この事業の費用は当初予算の議案に含まれています。当初予算は歳出全体をまとめて議決する仕組みのため、事業ごとに単独で議決された議案はありません。",
    tone: "resolved",
  },
  NO_SEPARATE_BILL_CONFIRMED: {
    pillLabel: "独立した議案はありません",
    description: "公式資料で、この公約には独立した議案が伴わないことを確認しました。",
    tone: "resolved",
  },
  PENDING_FUTURE_BILL: {
    pillLabel: "追加確認中",
    description:
      "現時点で独立した関連議案は確認されていません。制度上、実施が正式に決まった段階で議案が提出される見込みのため、引き続き確認します。",
    tone: "pending",
  },
  NO_SEPARATE_BILL_LIKELY: {
    pillLabel: "追加確認中",
    description:
      "現時点で独立した関連議案は確認されていません。要綱の制定や人事上の措置など、議案を伴わない進め方の可能性がありますが、公式資料で確定できていないため引き続き確認します。",
    tone: "pending",
  },
  NOT_INTERPRETED: {
    pillLabel: "追加確認中",
    description:
      "現時点で独立した関連議案は確認されていません。議案が無い理由の整理も済んでいないため、引き続き確認します。",
    tone: "pending",
  },
  UNDER_REVIEW: {
    pillLabel: "追加確認中",
    description: "この公約に対応する議案を確認中です。議案が無いという意味ではありません。",
    tone: "pending",
  },
  SOURCE_NOT_FOUND: {
    pillLabel: "資料確認中",
    description:
      "この公約に対応する議案の有無を判断できる公式資料が、まだ見つかっていません。議案が無いという意味ではありません。",
    tone: "pending",
  },
};

/** バッジの配色。tone は必ず文字ラベルと併用し、色だけで意味を伝えない。 */
export const linkageToneClass: Record<LinkageTone, string> = {
  confirmed: "bg-[#e0f2e9] text-[#1e6b45] dark:bg-[#0f2e1f] dark:text-[#7fd9a8]",
  resolved: "bg-secondary-container text-on-secondary-container",
  pending: "border border-outline-variant text-on-surface-variant",
};

/**
 * relatedBudget の自由記述から予算の確認状態を読み取る。
 * 判定規則は Phase205（scripts/analyze-phase205.mjs の classifyBudget）と同一。
 */
export function classifyPromiseBudgetLinkage(p: MayorPromiseItem): MayorPromiseBudgetLinkage {
  const text = p.relatedBudget ?? "";
  const hasCandidates = (p.relatedBudgetCandidates?.length ?? 0) > 0;
  const confirmed =
    /公約と事業の対応関係を一次資料で確認できた|一次資料の内容一致で確認できた|同一の新規事業（No\.\d+）であることを確認できた/.test(
      text,
    );
  if (confirmed) {
    return build("CONFIRMED_BUDGET_ITEM", "confirmed", BUDGET_DISPLAY, hasCandidates);
  }
  let reasonCode: MayorPromiseBudgetReasonCode = "UNDER_REVIEW";
  if (/主要事業一覧|主な事業/.test(text) && /記載は無かった|掲載が無い/.test(text)) {
    reasonCode = "NOT_IN_MAJOR_PROJECT_LIST";
  } else if (/既存の人件費・事務費の枠内/.test(text)) {
    reasonCode = "WITHIN_EXISTING_OPERATING_COST";
  } else if (/複数年度・複数議案にまたが/.test(text)) {
    reasonCode = "MULTI_YEAR_MULTI_BILL";
  }
  // MULTI_YEAR_MULTI_BILL は「関連議案側に金額の記載がある」ことまで一次資料で整理済みのため
  // under_review ではなく confirmed 相当の解決状況として扱う（予算額そのものは未特定なので
  // isPromiseBudgetConfirmed の件数には算入しない）。
  const resolution: PromiseEvidenceStatus = reasonCode === "MULTI_YEAR_MULTI_BILL" ? "confirmed" : "under_review";
  return build(reasonCode, resolution, BUDGET_DISPLAY, hasCandidates);
}

function build<T extends string>(
  reasonCode: T,
  resolution: PromiseEvidenceStatus,
  displays: Record<T, LinkageDisplay>,
  hasCandidates: boolean,
): { reasonCode: T; resolution: PromiseEvidenceStatus; display: LinkageDisplay; hasCandidates: boolean } {
  return { reasonCode, resolution, display: displays[reasonCode], hasCandidates };
}

/**
 * relatedBill / relatedBillVoteIds から議案の確認状態を読み取る。
 * 判定規則は Phase205（scripts/analyze-phase205.mjs の classifyBill）を踏襲し、
 * Phase208 で「原文が断定している場合のみ確認済みへ格上げする」分岐を明示した。
 */
export function classifyPromiseBillLinkage(p: MayorPromiseItem): MayorPromiseBillLinkage {
  const text = p.relatedBill ?? "";
  const billVoteIds = p.relatedBillVoteIds ?? [];
  const hedged = HEDGE_PATTERN.test(text);

  if (billVoteIds.length > 0) {
    return {
      reasonCode: "CONFIRMED_RELATED_BILL",
      resolution: "confirmed",
      display: BILL_DISPLAY.CONFIRMED_RELATED_BILL,
      billVoteIds,
      hedged: false,
    };
  }

  let reasonCode: MayorPromiseBillReasonCode = "NOT_INTERPRETED";
  if (
    /当初予算（議案第\d+号[^）]*）に含まれる歳出予算の一部/.test(text) &&
    /独立の議案は無い|独立の議案が(?:無|な)い/.test(text)
  ) {
    reasonCode = "BUDGET_BILL_INCLUDED";
  } else if (/条例改正議案が提出される可能性が高く|その時点で本欄を更新する/.test(text)) {
    reasonCode = "PENDING_FUTURE_BILL";
  } else if (/議案化を伴わない可能性が高い|議案化されていない可能性が高い/.test(text)) {
    // 原文が結論を留保している間は「議案なしを確認済み」とせず、確認中の側に置く。
    // ヘッジ表現が無く一次資料が断定している場合にのみ確認済みへ格上げする。
    reasonCode = hedged ? "NO_SEPARATE_BILL_LIKELY" : "NO_SEPARATE_BILL_CONFIRMED";
  } else if (text.startsWith(UNRESOLVED_PREFIX)) {
    reasonCode = "SOURCE_NOT_FOUND";
  }

  const resolution: PromiseEvidenceStatus =
    reasonCode === "BUDGET_BILL_INCLUDED" || reasonCode === "NO_SEPARATE_BILL_CONFIRMED"
      ? "confirmed"
      : reasonCode === "SOURCE_NOT_FOUND"
        ? "not_found"
        : "under_review";

  const base = BILL_DISPLAY[reasonCode];
  // 「予算議案に含まれる」ことは整理済みでも、原文が留保を付けている場合はその留保を必ず表示へ残す。
  const display: LinkageDisplay =
    hedged && reasonCode === "BUDGET_BILL_INCLUDED"
      ? { ...base, description: `${base.description}${HEDGE_NOTE}` }
      : base;

  return { reasonCode, resolution, display, billVoteIds, hedged };
}

/**
 * Phase213：予算側の状況を、市民向けの区分で集計する。
 * 「金額まで確認できた」「関連議案に金額の記載がある（整理済み）」「特定の公式資料を待っている」
 * 「それ以外の確認中」を、必ず別の数として数える（資料待ちを『予算なし』と読ませない）。
 */
export function summarizeBudgetLinkage(promises: MayorPromiseItem[]): {
  confirmedAmount: number;
  amountInRelatedBills: number;
  awaitingSource: number;
  underReview: number;
} {
  let confirmedAmount = 0;
  let amountInRelatedBills = 0;
  let awaitingSource = 0;
  let underReview = 0;
  for (const p of promises) {
    const linkage = classifyPromiseBudgetLinkage(p);
    if (linkage.reasonCode === "CONFIRMED_BUDGET_ITEM") confirmedAmount += 1;
    else if (linkage.resolution === "confirmed") amountInRelatedBills += 1;
    else if (isAwaitingSource(linkage.display)) awaitingSource += 1;
    else underReview += 1;
  }
  return { confirmedAmount, amountInRelatedBills, awaitingSource, underReview };
}

/**
 * 14公約の議案側の状況を、市民向けの3区分で集計する。
 * 「独立議案なし（確認済み）」と「確認中」を必ず別の数として数える。
 */
export function summarizeBillLinkage(promises: MayorPromiseItem[]): {
  confirmedBill: number;
  noSeparateBillConfirmed: number;
  underReview: number;
  sourceNotFound: number;
} {
  let confirmedBill = 0;
  let noSeparateBillConfirmed = 0;
  let underReview = 0;
  let sourceNotFound = 0;
  for (const p of promises) {
    const linkage = classifyPromiseBillLinkage(p);
    if (linkage.reasonCode === "CONFIRMED_RELATED_BILL") confirmedBill += 1;
    else if (linkage.resolution === "confirmed") noSeparateBillConfirmed += 1;
    else if (linkage.resolution === "not_found") sourceNotFound += 1;
    else underReview += 1;
  }
  return { confirmedBill, noSeparateBillConfirmed, underReview, sourceNotFound };
}
