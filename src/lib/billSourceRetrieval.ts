import type { BillVoteItem } from "../types";

/**
 * Phase142で導入した議案の「原資料到達性」区分（A/B/C/D）の単一情報源。
 * Phase143で、令和元年度〜令和4年度（619件、Phase142時点のD区分）についても、延岡市議会
 * 会議録検索システムの年度・会期解決（resolveYearTreedepth/listSessionsForYear/listMeetingDays）が
 * 実際には正常に機能することを実データで確認できた。したがってPhase142のD区分「619件・到達方法
 * 未確立」という表現は、正確には「延岡市議会会議録検索システムからの本会議録リンク
 * （transcriptUrl相当）が個々の議案データへまだ登録されていない」状態であり、
 * 「原資料そのものが存在しない／取得不能」という意味では **ない**。
 *
 * 重要：この違いを混同しないよう、内部的には「sourceRetrievalUnresolved」（個別の紐付けが
 * 未着手・未確立）という考え方で扱う。A/B/C/Dという文字自体はPhase142の報告書との対応の
 * ため維持するが、変数名・関数名では「到達不能」ではなく「未解決（unresolved）」の語を使う。
 * 既存データ（billVotes.jsonのフィールド構成）への破壊的変更は行っていない
 * （本ファイルはbillVotes.jsonの既存フィールドから計算するだけの、読み取り専用の分類ロジック）。
 */

export type BillSourceRetrievalCategory = "A" | "B" | "C" | "D";

/** Phase142時点で「本会議録（会議録検索システム）へのリンクが既に個別議案へ登録されている」とみなせる年度。 */
const LINK_CONFIRMED_YEARS = new Set(["令和5年度", "令和6年度", "令和7年度", "令和8年度"]);

/** 提案理由説明・金額等が、原文中で数値中心に整理されており、構造化しやすいカテゴリ。 */
const STRUCTURED_CATEGORIES = new Set(["予算", "契約", "財産取得", "決算", "専決処分"]);

type SourceRetrievalInput = Pick<BillVoteItem, "transcriptUrl" | "fiscalYear" | "category">;

/**
 * 議案1件の原資料到達性区分（A/B/C/D）を判定する。Phase142の分類ロジックをそのまま維持している
 * （新しい分類基準を混ぜない。C＝画像PDF/OCR等が必要なものは、Phase142・Phase143とも実例が
 * 0件だったため、この関数では常にA/B/Dのいずれかを返す）。
 */
export function classifyBillSourceRetrieval(bill: SourceRetrievalInput): BillSourceRetrievalCategory {
  if (bill.transcriptUrl) {
    return STRUCTURED_CATEGORIES.has(bill.category ?? "") ? "A" : "B";
  }
  if (LINK_CONFIRMED_YEARS.has(bill.fiscalYear)) return "B";
  return "D";
}

export type DSourceRetrievalSubcategory = "D-A" | "D-B" | "D-C" | "D-D";

/**
 * Phase143：D区分（sourceRetrievalUnresolved、会議録リンク未登録）619件を、さらに4段階へ再分類する。
 * D-A：原資料への到達方法を確立し、半自動処理可能（数値中心の構造化しやすいカテゴリ）
 * D-B：原資料へ到達可能だが個別確認必要（条文・人事等、文脈判断が必要なカテゴリ）
 * D-C：画像PDF/OCR等が必要（Phase143時点で実例0件）
 * D-D：現時点でも到達方法未解決（Phase143時点で実例0件。令和元年度〜令和4年度の全16会期について
 *       resolveYearTreedepth・listSessionsForYear・listMeetingDaysが正常に機能し、返り値が
 *       councilSessions.jsonの既存startDate/endDateと完全一致することを確認できたため）
 *
 * この関数は、classifyBillSourceRetrieval()が"D"を返した議案にのみ適用することを想定している。
 */
export function classifyDSourceRetrievalSubcategory(bill: SourceRetrievalInput): DSourceRetrievalSubcategory {
  return STRUCTURED_CATEGORIES.has(bill.category ?? "") ? "D-A" : "D-B";
}

export const SOURCE_RETRIEVAL_CATEGORY_LABEL: Record<BillSourceRetrievalCategory, string> = {
  A: "本文取得＋構造化が比較的安全",
  B: "本文取得できるが個別確認必要",
  C: "画像PDF/OCR等が必要",
  D: "会議録リンクが未登録（sourceRetrievalUnresolved。原資料が存在しない、という意味ではない）",
};

/**
 * Phase144項目31：Phase142のA区分（174件）とPhase143のD-A区分（202件）は、
 * 同じ「構造化しやすいカテゴリ（予算/契約/財産取得/決算/専決処分）」という判定基準を共有するが、
 * **互いに素な（重複しない）集合**である。
 * - A（174件）＝ classifyBillSourceRetrieval()が"A"を返す議案＝ transcriptUrlが**既に**個別に
 *   登録されている議案のうち、構造化しやすいカテゴリのもの。
 * - D-A（202件）＝ classifyDSourceRetrievalSubcategory()の対象＝ transcriptUrlが**まだ**
 *   登録されていない議案（＝classifyBillSourceRetrievalが"D"を返す議案）のうち、
 *   構造化しやすいカテゴリのもの。
 * transcriptUrlの有無で完全に分岐するため、A（174件）とD-A（202件）は定義上重複しない
 * （重複件数は常に0）。市民向けUIでは、この2つの数字をそのまま並べて表示すると
 * 「174」「202」の関係が伝わらないため、内部分類の生数値を市民向けページへ直接出さない
 * （項目34）。
 */
export function countOverlapBetweenAAndDA(bills: SourceRetrievalInput[]): number {
  let overlap = 0;
  for (const b of bills) {
    const isA = classifyBillSourceRetrieval(b) === "A";
    const isDA = classifyBillSourceRetrieval(b) === "D" && classifyDSourceRetrievalSubcategory(b) === "D-A";
    if (isA && isDA) overlap++; // 定義上、常に0になるはずの検算用
  }
  return overlap;
}

/**
 * Phase144項目32・33：「原資料への到達可能性」（このファイルのA/B/C/D）と「説明の品質段階」
 * （src/lib/billSummaryQuality.tsのLevel0〜3）は、意図的に別軸として設計している。
 * sourceRetrievalStatus（本ファイル）とsummaryQuality（billSummaryQuality.ts）を混同しないこと。
 * 例：ある議案がA区分（本文取得が容易）であっても、まだ人が本文を読んで確認していなければ
 * Level1のままであり、A区分＝Level3を意味しない。
 *
 * 1,177件全体を「原資料到達性区分（A/B/D。C区分は実例0件のため列を省略）」×
 * 「説明品質段階（Level1/Level2/Level3）」でクロス集計する。合計は必ず1,177件になる。
 */
export function crossTabulateSourceRetrievalAndLevel<T extends SourceRetrievalInput>(
  bills: T[],
  levelOf: (bill: T) => 1 | 2 | 3,
): Record<BillSourceRetrievalCategory, Record<"Level1" | "Level2" | "Level3", number>> {
  const matrix: Record<string, Record<string, number>> = {};
  for (const cat of ["A", "B", "C", "D"] as BillSourceRetrievalCategory[]) {
    matrix[cat] = { Level1: 0, Level2: 0, Level3: 0 };
  }
  for (const b of bills) {
    const cat = classifyBillSourceRetrieval(b);
    const level = levelOf(b);
    matrix[cat][`Level${level}`]++;
  }
  return matrix as Record<BillSourceRetrievalCategory, Record<"Level1" | "Level2" | "Level3", number>>;
}

/**
 * Phase144項目35：「確認済み」という言葉を安易にまとめず、3段階を区別する市民向けラベル。
 * - sourceLinked（出典確認済み）：審議結果PDF等の出典が紐付いている（1,177件全件が該当）。
 * - sourceTextVerified（本文確認済み）：会議録等の一次資料本文を人が実際に確認した。
 * - summaryVerified（詳しい説明確認済み）：本文確認の上で、市民向けの独自説明まで作成・照合した（Level3）。
 * この3つを同じ「確認済み」という言葉でまとめて表示しない。
 */
export const CONFIRMATION_LEVEL_LABEL = {
  sourceLinked: "出典確認済み",
  sourceTextVerified: "本文確認済み",
  summaryVerified: "詳しい説明確認済み",
} as const;

/**
 * Phase143項目17〜19：A区分（174件）を将来（Phase144以降）半自動処理する際の、
 * 一次資料からの抽出候補の共通スキーマ（設計のみ。billVotes.jsonへの永続フィールドではない）。
 *
 * 重要な設計方針（項目18「空欄を埋めるAIにしない」）：
 * - 各項目は、一次資料本文から実際に確認できた場合のみ値を入れる。全項目を必須にしない
 *   （一次資料に無い情報を、それらしい文章で埋めるための構造ではない）。
 * - amountRawText（原文の金額表記そのもの）とamountYen（円に換算した数値）を分離して保持する。
 *   単位（千円／万円／百万円／億円）の変換ミスを、原文と照合して検証できるようにするため
 *   （項目19）。amountYenを自動計算した場合でも、amountRawTextは必ず保持し、破棄しない。
 * - verificationStatusが"verified"（人が原文と突き合わせて確認済み）になるまでは、
 *   この候補データをLevel3（summarySource: "manual"）としてbillVotes.jsonへ書き込まない
 *   （項目22「自動公開は禁止」）。
 */
export interface BillExtractionCandidate {
  billId: string;
  /** 何を決める議案か。一次資料の記述から抽出。 */
  what: string | null;
  /** なぜ必要か。一次資料に理由の記載がある場合のみ。無ければnull（推測で埋めない）。 */
  reason: string | null;
  /** 市民への主な影響。一次資料から直接読み取れる場合のみ。無ければnull。 */
  impact: string | null;
  /** 金額（原文表記のまま。例："七千四百二十五万円"）。単位変換前の値を必ず保持する。 */
  amountRawText: string | null;
  /** 金額（円換算後の数値）。amountRawTextから機械的に変換した場合は、必ずamountRawTextと併記する。 */
  amountYen: number | null;
  /** 対象（契約相手・取得物品・対象施設等）。一次資料で確認できた場合のみ。 */
  target: string | null;
  /** 議決結果。billVotes.json側の既存resultをそのまま参照し、この候補側では独自に判定しない。 */
  result: string;
  /** 根拠とした一次資料（既存sourceRefs／relatedDocumentUrlsの形式を優先利用し、新しい引用DBを作らない）。 */
  sourceRefUrls: string[];
  /** "draft"＝機械抽出直後・未照合／"verified"＝人が原文と突き合わせて確認済み／"rejected"＝誤り等で不採用。 */
  verificationStatus: "draft" | "verified" | "rejected";
}
