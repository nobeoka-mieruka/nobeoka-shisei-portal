/**
 * Evidence Availability（データ確認状況）共通語彙（Phase110）。
 *
 * 【目的】サイト全体で「データが0」「資料がない」「まだ収録していない」「公式公開待ち」
 * 「十分調査したが公開資料から確認できない」が別々の意味で使われ、表現がページごとに
 * バラついていた状態を、共通のコード・日本語ラベル・説明文へ寄せるための語彙集。
 *
 * 【設計方針】
 * - これは表示・説明のための共通語彙であり、新しい採点・順位付けロジックではない。
 * - 既存ページの計算ロジック・データ構造（`activityRadar.ts`の3区分dataStatus等）は
 *   変更しない。既存の3区分（complete/partial/missing）と本語彙は共存し、必要な箇所
 *   （councilActivityBarometer.ts等）で本語彙へマッピングして「なぜmissingなのか」を
 *   説明する追加レイヤーとして使う。
 * - 大規模な全面書き換えは行わず、新規・見直し対象の画面から順に採用する。
 *   適用候補は各ページのコメント、または`docs/evidence-availability-rollout.md`
 *   （作成する場合）を参照。
 *
 * 【重要】research_exhaustedは「資料が存在しない」ことを意味しない。「複数の公開資料の
 * 経路を調査したが、現時点では確認できなかった」という意味に限定する。
 */
export type EvidenceAvailabilityCode =
  | "confirmed"
  | "confirmed_zero"
  | "partial"
  | "not_collected"
  | "waiting_external"
  | "source_not_published"
  | "research_exhausted"
  | "not_applicable"
  | "unknown";

export const EVIDENCE_AVAILABILITY_CODES: readonly EvidenceAvailabilityCode[] = [
  "confirmed",
  "confirmed_zero",
  "partial",
  "not_collected",
  "waiting_external",
  "source_not_published",
  "research_exhausted",
  "not_applicable",
  "unknown",
];

/** 市民向けの短い状態ラベル（例：「確認済み」「公開資料から確認できず」）。 */
export const EVIDENCE_AVAILABILITY_LABELS_JA: Record<EvidenceAvailabilityCode, string> = {
  confirmed: "確認済み",
  confirmed_zero: "確認済み（該当なし）",
  partial: "一部確認",
  not_collected: "未収録",
  waiting_external: "公式資料公開待ち",
  source_not_published: "資料未公表",
  research_exhausted: "公開資料から確認できず",
  not_applicable: "対象外",
  unknown: "不明",
};

/** 各状態の意味を説明する市民向けの1〜2文。専門用語（英語のコード名）はここでは使わない。 */
export const EVIDENCE_AVAILABILITY_DESCRIPTIONS_JA: Record<EvidenceAvailabilityCode, string> = {
  confirmed: "一次資料（公式サイト・会議録等）で内容を確認できています。",
  confirmed_zero: "一次資料を確認した結果、該当する事実が0件であることを確認できています。未調査ではありません。",
  partial: "資料の一部のみ確認できています。全体像とは異なる可能性があります。",
  not_collected: "本サイトがまだこの情報を収集・登録していません。0件という意味ではありません。",
  waiting_external:
    "具体的な資料（会議録等）が近く公開される見込みで、公開待ちの状態です。公開され次第、自動更新の仕組みで反映します。",
  source_not_published: "情報源となる公式資料自体が、まだ公表されていません。",
  research_exhausted:
    "複数の公開資料の経路を調査しましたが、該当する記録を確認できませんでした。資料が存在しないと断定するものではありません。",
  not_applicable: "対象期間・対象者に本来該当しないため、確認の対象になりません（欠席・0点として扱いません）。",
  unknown: "現時点で状態を分類できていません。",
};

export function evidenceAvailabilityLabel(code: EvidenceAvailabilityCode): string {
  return EVIDENCE_AVAILABILITY_LABELS_JA[code];
}

export function evidenceAvailabilityDescription(code: EvidenceAvailabilityCode): string {
  return EVIDENCE_AVAILABILITY_DESCRIPTIONS_JA[code];
}

/** confirmed_zeroだけが「本当の0」。他の状態を0件・0点として表示しないためのガード。 */
export function isGenuineZero(code: EvidenceAvailabilityCode): boolean {
  return code === "confirmed_zero";
}

/** 156セル等の簡易マトリクスで使う記号（色だけに依存しないための併記用）。 */
export const EVIDENCE_AVAILABILITY_SYMBOLS: Record<EvidenceAvailabilityCode, string> = {
  confirmed: "○",
  confirmed_zero: "○",
  partial: "△",
  not_collected: "―",
  waiting_external: "…",
  source_not_published: "…",
  research_exhausted: "―",
  not_applicable: "・",
  unknown: "？",
};

export function evidenceAvailabilitySymbol(code: EvidenceAvailabilityCode): string {
  return EVIDENCE_AVAILABILITY_SYMBOLS[code];
}

export interface EvidenceAvailabilityEntry {
  key: string;
  label: string;
  code: EvidenceAvailabilityCode;
  /** 市民向けの補足説明（件数等の具体値を含めてよい）。 */
  detail?: string;
}

/**
 * 【Phase114：サイト全体への展開候補（設計メモ、今回は実装しない）】
 *
 * 現時点で本語彙を採用しているのは議員活動バロメーター系（council-activity/data-status/
 * methodology/activity-radar）のみ。以下は、既存ページの状態表現を監査した結果、
 * 本語彙へ寄せると分かりやすくなると考えられる候補（大規模移行はせず、次に着手する場合の
 * 設計メモとして残す）。
 *
 * - 財政（FinancePage/FinanceBudgetPage/FinanceDebtPage/FinanceFundsPage等）：
 *   年度によって「未収録」「確認中」等の表現が混在。年度別archiveFiscalYears.jsonの
 *   各サブオブジェクト（budget/debt/fund/finance）が無い年度をconfirmed/not_collected/
 *   waiting_externalへ寄せられる（決算前年度はwaiting_external、過去年度で資料が
 *   見つからない場合はresearch_exhausted等）。
 * - 政治資金（PoliticalFundsPage/PoliticalFundOrganizationDetailPage）：
 *   TASK-016B（年度別収支報告書、宮崎県選管の公表待ち）はwaiting_externalの好例。
 *   `blockedTaskWatch.json`のハッシュ監視結果と組み合わせられる。
 * - 歴代市長（MayorsPage/MayorDetailPage/archiveMayorTerms.json）：
 *   TASK-045（1937〜1994年の任期空白13件）はresearch_exhausted（国会図書館ログイン必須で
 *   自動調査が前進しない）の好例。
 * - 選挙（ElectionsPage/ElectionDetailPage）：
 *   `dataCompleteness`オブジェクト（electionConfirmed/candidateListConfirmed/
 *   voteCountConfirmed/turnoutConfirmed）は既に本語彙に近いboolean群を持っており、
 *   4項目それぞれをconfirmed/not_collectedへマッピングしやすい。
 * - 一般質問（GeneralQuestionsPage/GeneralQuestionDetailPage）：
 *   councilSpeechSummaries.jsonのisPublished等の既存フラグをそのまま流用可能。
 * - 委員会（CommitteeDetailPage）：
 *   委員会内部発言（本語彙で既にresearch_exhausted運用中）に加え、委員会単独の会議録の
 *   有無自体も同じ語彙で表現できる。
 *
 * いずれも既存の各ページの計算・データ構造は変更せず、表示専用のマッピング関数を
 * 追加する形で段階的に適用する想定（council-activity系で採用した設計と同じ方針）。
 */
