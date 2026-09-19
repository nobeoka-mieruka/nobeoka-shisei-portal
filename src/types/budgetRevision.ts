import type { ArchiveSourceTrustLevel } from "./sourceTrust";

/**
 * 予算の段階（Phase261で新設）。当初予算と補正予算を混同しないよう、段階ごとに1件のレコードにする。
 * - `initial`: 当初予算
 * - `supplementary`: 補正予算（同じ定例会で複数回提出される場合は round で区別する）
 */
export type BudgetRevisionKind = "initial" | "supplementary";

/** 延岡市の公表資料の種類。概要書（市民向けの要約）と予算書（議案そのもの）を区別する。 */
export type BudgetSourceType = "概要書" | "予算書";

/** 数値の出典1件。「どの資料のどのページの数値か」を後から追跡できるようにする。 */
export interface BudgetSource {
  title: string;
  /** 延岡市公式サイト上のPDFのURL。 */
  url: string;
  sourceType: BudgetSourceType;
  /** PDFの物理ページ番号（1始まり。資料に印字されたページ番号ではない）。 */
  pdfPage: number;
  /** 資料に明記された作成日（例：概要書の「令和8年8月31日 財政課作成」）。明記が無ければnull。 */
  documentDate: string | null;
  /** サイト運営者が資料を取得・照合した日（ISO形式）。 */
  retrievedAt: string;
  trustLevel: ArchiveSourceTrustLevel;
}

/**
 * 補正額の財源内訳（千円）。概要書の「補正額の財源内訳」欄の区分どおり。
 * 資料で空欄の区分は0ではなくnull（空欄＝その財源が無いことを資料が示している場合も、
 * 当サイトでは値を作らない）。合計は補正額と一致することを validate:data で検査する。
 */
export interface BudgetFunding {
  nationalPrefecturalThousandYen: number | null;
  localBondThousandYen: number | null;
  otherThousandYen: number | null;
  /** 「その他」の内容（資料の「財源内訳欄の『その他』の内容」欄。例：寄附金）。 */
  otherNote: string | null;
  generalRevenueThousandYen: number | null;
  /** 「一般財源」の内容（例：繰越金）。 */
  generalRevenueNote: string | null;
}

/** 金額の内訳1行（資料の概要欄に記載された内訳。例：「扶助費（図書カード購入費）17,400千円」）。 */
export interface BudgetProjectBreakdown {
  label: string;
  thousandYen: number;
}

/** 補正予算に計上された事業1件（概要書の「主要事業等内訳」の1行）。 */
export interface BudgetRevisionProject {
  /** 年度・段階を含む一意なID（例：fy2026-sep-2-book-card）。 */
  id: string;
  /** 事業名（資料の表記どおり）。 */
  name: string;
  /** 担当課（資料の【】内の表記どおり）。 */
  department: string;
  /** 資料の「新規」欄に「新」とある事業のみtrue。 */
  isNew: boolean;
  /** 資料上の事業グループ（例：「物価高騰対策事業（物価高騰対応重点支援地方創生臨時交付金充当事業）」）。 */
  group: string;
  /** 款・項・目（例：「2総務費 1)総務管理費 (9)企画費」）。 */
  budgetClassification: string;
  /** 事業の目的・内容（資料の概要欄を要約せず、必要な範囲で抜き出したもの）。 */
  purpose: string;
  /** 対象者・対象施設（資料に明記されたもののみ。記載が無ければnull）。 */
  targets: string | null;
  beforeThousandYen: number;
  supplementaryThousandYen: number;
  afterThousandYen: number;
  funding: BudgetFunding;
  breakdown: BudgetProjectBreakdown[];
  /**
   * 分野タグ。既存の政策カテゴリ（src/data/archivePolicyCategories.json の id）を使う。
   * 独自のタグ体系は作らない。
   */
  policyCategoryIds: string[];
  /**
   * 関連する市長公約（mayorPromises.json の id）。公式資料で関連が明記されている場合のみ設定する。
   * 内容が似ているだけでは関連付けない（「公約実現」等の判定もしない）。
   */
  relatedPromiseIds: string[];
  /** この事業の数値の出典（sources の添字）。 */
  sourceIndex: number;
}

/** 会計ごとの補正（一般会計・特別会計・企業会計）。 */
export interface BudgetRevisionAccount {
  /** 会計名（資料の表記どおり。例：一般会計）。 */
  accountName: string;
  /** 対応する議案の番号（資料に明記された表記。例：議案第49号）。 */
  billNumber: string;
  /** billVotes.json の議案ID。議決結果・議員別賛否はこの議案レコードを参照する（ここに複製しない）。 */
  billId: string;
  /** 補正前の額（千円）。当初予算の場合はnull。 */
  beforeThousandYen: number | null;
  /** 補正額（千円）。当初予算の場合はnull。 */
  supplementaryThousandYen: number | null;
  /** 補正後の額（当初予算の場合は当初予算額、千円）。 */
  afterThousandYen: number;
  /** 補正額の財源内訳。資料で確認していない段階はnull。 */
  funding: BudgetFunding | null;
  sourceIndex: number;
}

/**
 * 予算の1段階（当初予算、または1回分の補正予算）。src/data/budgetRevisions.json。
 *
 * 【一意性】同じ月に複数の補正（例：9月補正と9月補正（2次分））が出るため、
 * 年度＋月だけでは衝突する。id は `fy{年度}-{段階キー}`（例：fy2026-sep-2）とし、
 * さらに sessionId（定例会）＋ round（同じ定例会での提出順）＋ 議案番号でも区別する。
 */
export interface BudgetRevision {
  id: string;
  /** 会計年度（西暦、4月始まり）。 */
  fiscalYear: number;
  kind: BudgetRevisionKind;
  /** 資料の表記どおりの段階名（例：「9月補正（2次分）」「補正予算（第1号）」）。 */
  label: string;
  /** 議案を審議した定例会・臨時会（councilSessions.json の id）。 */
  sessionId: string;
  /** 同じ定例会で提出された同じ会計の補正予算のうち何番目か（1始まり、当初予算は1）。 */
  round: number;
  /** 年度内の順番（当初予算＝0）。予算の変化を時系列に並べるために使う。 */
  sequence: number;
  accounts: BudgetRevisionAccount[];
  /** 主要事業。資料で確認・登録した段階のみ（未登録の段階は空配列で、画面に「未登録」と表示する）。 */
  projects: BudgetRevisionProject[];
  /** 事業グループごとの補正額合計（資料の「○○事業合計」欄。検算用）。 */
  projectGroupTotals: { group: string; supplementaryThousandYen: number }[];
  sources: BudgetSource[];
  /** 延岡市公式サイトで資料を掲載しているページ（年度の予算ページ）。 */
  listingPageUrl: string;
  notes?: string;
}
