import type { BillVoteItem } from "../types";
import type { BillExplanationLevel } from "./billSummaryQuality";

/**
 * Phase206：詳細説明がまだ無い議案（Level1＋Level2）について、
 * 「なぜ説明が無いのか」＝**説明可能性（explainability）** を分類するための単一情報源。
 *
 * この軸を新設した理由（新しい enum を増やす前に既存構造を確認した結果）：
 * - src/lib/billSummaryQuality.ts の Level0〜3 は「どこまで確認が進んだか」の軸であり、
 *   「これ以上進めない理由」は表現できない（Level2 に、材料が無い案件と未整理の案件が同居する）。
 * - src/lib/billSourceRetrieval.ts の A/B/C/D は「原資料へ到達できるか」の軸であり、
 *   到達できた資料に個別の提案理由が書かれているかは表現できない。
 * - src/data/blockedTaskClassification.json の status（MANUAL_REVIEW / RESEARCH_EXHAUSTED /
 *   WAITING_EXTERNAL / COMPLETED）はサイト全体の人手対応台帳（全15件）の語彙で、
 *   議案1件ごとの粒度を持たない。
 * したがって既存の3つのどれでも代替できず、Phase206 で説明可能性コードを新設した。
 * ただし判定に使う値はすべて **既存フィールド** であり、新しい状態管理フィールド群は作らない
 * （唯一の追加は sharedProposalStatement＝原文引用の保管場所。判定用フラグではない）。
 *
 * 重要な前提（Phase205 の発見）：
 * 「一次資料本文を確認済み（Level2）」は「説明文を書けるだけの材料がある」を意味しない。
 * 会議録に、その議案固有の提案理由がそもそも書かれていない案件が多数存在する。
 * 「資料に個別の理由が無いことを確認済み」を「未調査」と同じ扱いにしないこと。
 */
export type BillExplainabilityCode =
  /** 一次資料本文から、当該議案固有の説明を推測なしで作成できる（原文引用がそのまま使える）。 */
  | "EXPLAINABLE_FROM_PRIMARY"
  /** 一次資料本文を確認したが、この議案固有の提案理由が存在しないことを確認済み。 */
  | "NO_INDIVIDUAL_REASON_CONFIRMED"
  /** 複数議案の一括説明等により、共通の説明のみが存在する（個別説明は存在しない）。 */
  | "SHARED_REASON"
  /** 一次資料は存在する（公開済み）が、この議案向けの構造化・紐付けがまだ足りない。 */
  | "SOURCE_NEEDS_STRUCTURING"
  /** 説明の作成に必要な一次資料そのものが、まだ公開されていない。 */
  | "SOURCE_INSUFFICIENT"
  /** 文脈判断・人手確認が必要（人事案件・議員提出案件など、機械処理の対象外）。 */
  | "HUMAN_REVIEW";

/**
 * 市民向けの状態表現。内部コードをそのまま画面へ出さないための変換表。
 * 「説明未整備」とだけ書かず、**なぜ説明が無いのか**が読んで分かる文にする。
 */
export const BILL_EXPLAINABILITY_CITIZEN_LABEL: Record<BillExplainabilityCode, string> = {
  EXPLAINABLE_FROM_PRIMARY: "会議録の記載をもとに、内容を整理中です",
  NO_INDIVIDUAL_REASON_CONFIRMED: "一次資料では、この議案だけの提案理由を確認できませんでした",
  SHARED_REASON: "他の議案とまとめて説明されています",
  SOURCE_NEEDS_STRUCTURING: "会議録は公開されていますが、この議案の内容はまだ整理できていません",
  SOURCE_INSUFFICIENT: "この議案の会議録がまだ公表されていません",
  HUMAN_REVIEW: "内容の確認に人の判断が必要なため、確認を続けています",
};

export const BILL_EXPLAINABILITY_CITIZEN_DESCRIPTION: Record<BillExplainabilityCode, string> = {
  EXPLAINABLE_FROM_PRIMARY:
    "会議録に、この議案について述べられた部分があることを確認しています。原文をそのまま引用する形で、順次このページへ掲載していきます。",
  NO_INDIVIDUAL_REASON_CONFIRMED:
    "会議録などの一次資料を実際に確認しましたが、この議案だけを取り上げた提案理由の記載が見当たりませんでした。説明が抜けているのではなく、公開されている資料にもともと書かれていない状態です。当サイトでは、資料に無い理由を推測して補うことはしません。",
  SHARED_REASON:
    "この議案は、同じ趣旨の他の議案とまとめて提案説明されています。そのため、この議案だけの説明ではなく、複数の議案に共通する説明が会議録に記録されています。下に会議録の原文をそのまま掲載しています。",
  SOURCE_NEEDS_STRUCTURING:
    "この議案が審議された会議録は公開されていますが、この議案に対応する箇所の確認と整理がまだ済んでいません。出典（議案等審議結果）は下に掲載しています。",
  SOURCE_INSUFFICIENT:
    "この議案が審議された会議録が、まだ公表されていません。公表され次第、内容を確認して掲載します。現時点で分かるのは、議案名・議決結果と、議案等審議結果の出典までです。",
  HUMAN_REVIEW:
    "この議案は、人事案件や議員提出の案件など、内容の取り扱いに人の判断が必要なものです。機械的な整理は行わず、確認を続けています。",
};

/**
 * Phase160/162 で確立している、機械的な説明整理の対象外とする案件。
 * - 人事案件・人権擁護委員候補者の推薦など、個人名を扱う案件
 * - 意見書・決議・請願・陳情など、市長提出議案とは制度上の位置づけが異なる案件
 * - 市長提出でない案件（委員会提出・議員提出）
 */
const PERSONNEL_TITLE_PATTERN = /(人権擁護委員|教育委員会委員|固定資産評価審査委員会委員|監査委員|公平委員会委員|副市長|農業委員会)/;
const NON_MAYOR_PROPOSAL_CATEGORIES = new Set(["意見書", "決議", "請願", "陳情"]);

export function isHumanReviewOnlyBill(
  bill: Pick<BillVoteItem, "billTitle" | "category" | "proposerType">,
): boolean {
  if (bill.category === "人事") return true;
  if (NON_MAYOR_PROPOSAL_CATEGORIES.has(bill.category ?? "")) return true;
  if (bill.proposerType && bill.proposerType !== "mayor") return true;
  return PERSONNEL_TITLE_PATTERN.test(bill.billTitle ?? "");
}

/**
 * verificationNote に、これまでのフェーズが記録した「市長発言の原文引用」があれば取り出す。
 * 引用は過去フェーズが会議録本文から転記したもので、ここで新たに文章を作ることはしない。
 */
const QUOTED_STATEMENT_PATTERN = /議案の対象は確認できた（「([^」]+)」）/;

export function extractQuotedStatement(verificationNote: string | undefined): string | null {
  if (!verificationNote) return null;
  const m = verificationNote.match(QUOTED_STATEMENT_PATTERN);
  return m ? m[1] : null;
}

/** verificationNote が「この議案固有の提案理由は資料に無い」と明記しているか。 */
const NO_INDIVIDUAL_REASON_PATTERN = /(個別の提案理由|固有の提案理由)[^。]{0,20}(見当たらな|記載が(?:無|な)い|ありませんでした)/;

export function statesNoIndividualReason(verificationNote: string | undefined): boolean {
  return Boolean(verificationNote && NO_INDIVIDUAL_REASON_PATTERN.test(verificationNote));
}

/** 引用が複数議案をまとめた一括説明かどうか（原文の言い回しだけで判定する）。 */
const BILL_NUMBER_IN_QUOTE = /第[〇一二三四五六七八九十百千]+号/g;
const MULTI_BILL_MARKER = /(これらの議案|両議案|から議案第|から第|議案第[^、。]{0,20}号(?:、|及び|・)第)/;

export function isSharedStatement(quote: string): boolean {
  if (MULTI_BILL_MARKER.test(quote)) return true;
  const numbers = quote.match(BILL_NUMBER_IN_QUOTE);
  return Boolean(numbers && new Set(numbers).size >= 2);
}

/**
 * 引用が議案名の言い換えにとどまらず、議案名からは分からない事実
 * （指定管理者となる団体名・事故の経緯・工事の内容など）を含んでいるか。
 *
 * 判定方法：引用文のうち、議案名に現れない文字が何文字連続しているか（最長連続未出現長）を数える。
 * 割合ではなく連続長を見るのは、「延岡市○○センターの指定管理者に、△△管理運営委員会を指定する」の
 * ように施設名が議案名と重複していても、団体名（△△）という新しい事実が入っている場合を
 * 取りこぼさないため。逆に「市道の路線認定であります」のような議案名の言い換えだけの引用は、
 * 連続未出現がほとんど生じないため除外される。
 */
const TRIVIAL_TAIL = /(もの|こと)?であります。?$/;
const NOISE_CHARS = /[\s、。「」（）()・]/g;
/** 議案名に無い事実とみなす最短の連続文字数。 */
const MIN_NEW_FACT_RUN = 4;

export function longestRunAbsentFromTitle(quote: string, billTitle: string): number {
  const core = quote.replace(TRIVIAL_TAIL, "").replace(NOISE_CHARS, "");
  const title = (billTitle ?? "").replace(NOISE_CHARS, "");
  let best = 0;
  let run = 0;
  for (let i = 0; i < core.length; i += 1) {
    const gram = core.slice(i, i + 3);
    const covered = gram.length < 3 ? true : title.includes(gram);
    if (covered) {
      run = 0;
    } else {
      run += 1;
      if (run > best) best = run;
    }
  }
  return best;
}

export function addsFactsBeyondTitle(quote: string, billTitle: string): boolean {
  const core = quote.replace(TRIVIAL_TAIL, "").replace(NOISE_CHARS, "");
  if (core.length < 20) return false;
  return longestRunAbsentFromTitle(quote, billTitle) >= MIN_NEW_FACT_RUN;
}

export interface BillExplainabilityResult {
  code: BillExplainabilityCode;
  /** 市民向けの状態表現（内部コードをそのまま画面に出さないための文言）。 */
  citizenLabel: string;
  citizenDescription: string;
  /** 判定の根拠を短く記録したもの（レポート・テスト用。画面表示用ではない）。 */
  basis: string;
}

export type BillExplainabilityInput = Pick<
  BillVoteItem,
  | "billTitle"
  | "category"
  | "proposerType"
  | "fiscalYear"
  | "transcriptUrl"
  | "verificationNote"
  | "sharedProposalStatement"
>;

/**
 * 詳細説明がまだ無い議案（level 1・2）の説明可能性を判定する。
 * level 3（すでに一次資料に基づく説明がある）を渡した場合は null を返す。
 *
 * level は src/lib/billSummaryQuality.ts の getBillExplanationLevel() の結果をそのまま渡す
 * （判定基準を二重に持たないため、このモジュールでは level を再計算しない）。
 */
export function classifyBillExplainability(
  bill: BillExplainabilityInput,
  level: BillExplanationLevel,
): BillExplainabilityResult | null {
  if (level === 3) return null;

  const build = (code: BillExplainabilityCode, basis: string): BillExplainabilityResult => ({
    code,
    citizenLabel: BILL_EXPLAINABILITY_CITIZEN_LABEL[code],
    citizenDescription: BILL_EXPLAINABILITY_CITIZEN_DESCRIPTION[code],
    basis,
  });

  // 1. 一括説明の原文引用が構造化済み＝共通説明のみ存在することが確定している。
  if (bill.sharedProposalStatement) {
    return build("SHARED_REASON", "sharedProposalStatement（会議録原文の一括説明）が登録されている");
  }

  const quote = extractQuotedStatement(bill.verificationNote);

  // 2. 一次資料本文を確認済み（Level2）。
  if (level === 2) {
    if (quote && isSharedStatement(quote)) {
      return build("SHARED_REASON", "verificationNote の原文引用が複数議案の一括説明である");
    }
    if (quote && addsFactsBeyondTitle(quote, bill.billTitle)) {
      if (isHumanReviewOnlyBill(bill)) {
        return build("HUMAN_REVIEW", "原文引用はあるが、人事・議員提出等のため機械的な整理の対象外");
      }
      return build(
        "EXPLAINABLE_FROM_PRIMARY",
        "verificationNote に、議案名からは分からない事実を含むこの議案固有の原文引用がある",
      );
    }
    if (statesNoIndividualReason(bill.verificationNote)) {
      return build(
        "NO_INDIVIDUAL_REASON_CONFIRMED",
        quote
          ? "原文引用は議案名の言い換えにとどまり、verificationNote が個別の提案理由の不在を明記している"
          : "verificationNote が個別の提案理由の不在を明記している",
      );
    }
    return build("HUMAN_REVIEW", "本文確認の記録はあるが、個別記載の有無が verificationNote に書かれていない");
  }

  // 3. 一次資料本文が未確認（Level1）。
  // 会議録そのものが未公表の場合は、他のどの事情よりも先に「資料が無い」ことが確定するため、
  // 人事案件かどうかの判定より優先する（Phase205 の MINUTES_NOT_PUBLISHED 24件と一致させる）。
  if (!bill.transcriptUrl && bill.fiscalYear === "令和8年度") {
    return build("SOURCE_INSUFFICIENT", "会議録が未公表（令和8年度分）");
  }
  if (isHumanReviewOnlyBill(bill)) {
    return build("HUMAN_REVIEW", "人事・意見書・決議・請願・陳情・議員提出等のため機械的な整理の対象外");
  }
  return build(
    "SOURCE_NEEDS_STRUCTURING",
    bill.transcriptUrl ? "会議録リンクは登録済みだが本文の確認・整理が未了" : "会議録は公開済みだがこの議案への個別リンクが未登録",
  );
}
