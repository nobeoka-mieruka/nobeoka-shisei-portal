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
 * 資料で「△」（減額）と記載された値は負の整数で持つ（例：9月補正の国・県支出金 △5,002千円）。
 * 概要書の「地方債／その他」欄は1列で、(債) の付いた額を地方債、財源名の付いた額をその他として分ける。
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
  /**
   * 資料の「財源内訳欄の『その他』及び『一般財源』の内容」が、その他・一般財源のどちらの内容かを
   * 区別せずに列挙している場合の原文（例：9月補正の一般会計）。区別できる場合は otherNote／generalRevenueNote を使う。
   */
  combinedContentNote?: string;
}

/** 会計の区分。一般会計と特別会計・企業会計を合算して「延岡市の予算総額」と表示しないために持つ。 */
export type BudgetAccountCategory = "一般会計" | "特別会計" | "企業会計";

/** 金額の内訳1行（資料の概要欄に記載された内訳。例：「扶助費（図書カード購入費）17,400千円」）。 */
export interface BudgetProjectBreakdown {
  label: string;
  thousandYen: number;
}

/** 補正予算に計上された事業1件（概要書の「主要事業等内訳」の1行）。 */
export interface BudgetRevisionProject {
  /** 年度・段階を含む一意なID（例：fy2026-sep-2-book-card）。 */
  id: string;
  /** 事業が属する会計（資料の表記どおり。例：一般会計、国民健康保険特別会計、下水道事業）。 */
  accountName: string;
  accountCategory: BudgetAccountCategory;
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
  /** 実施時期（資料に明記されたもののみ。例：「訪問予定日 10月下旬」。記載が無ければnull）。 */
  schedule: string | null;
  /** 資料が明記している関連事業（例：「【No.１ 延岡にぎわい創出支援事業 関連】」）。内容の類似では設定しない。 */
  relatedProjectIds: string[];
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
  accountCategory: BudgetAccountCategory;
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
  /** 議案の提出日（予算書の議案本文末尾「令和○年○月○日提出」、ISO形式）。確認できなければnull。 */
  submittedDate: string | null;
  /** submittedDate の根拠（sources の添字）。submittedDate が null なら null。 */
  submittedDateSourceIndex: number | null;
  /** 資料の注記（例：補正額0でも科目間の組替えがある場合の説明）。 */
  note?: string;
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
  /**
   * 事業一覧の網羅範囲。
   * - `all`: 資料の事業内訳の合計が補正額と一致する（9月補正（2次分）など）。事業合計＝補正額を検査する。
   * - `listedOnly`: 資料が「概要掲載事業」だけを掲載しており、補正額の一部しか事業別に示されない（9月補正など）。
   *   事業合計は listedProjectTotals（資料の「概要掲載事業合計」欄）と一致することを検査し、補正額との差は画面で明示する。
   * - `none`: 事業内訳を未登録。
   */
  projectCoverage: "all" | "listedOnly" | "none";
  /** projectCoverage が listedOnly の場合の、資料の「○○会計 概要掲載事業合計」欄（会計区分ごと）。 */
  listedProjectTotals: { accountCategory: BudgetAccountCategory; supplementaryThousandYen: number }[];
  /** 事業グループごとの補正額合計（資料の「○○事業合計」欄。検算用）。 */
  projectGroupTotals: { group: string; supplementaryThousandYen: number }[];
  sources: BudgetSource[];
  /** 延岡市公式サイトで資料を掲載しているページ（年度の予算ページ）。 */
  listingPageUrl: string;
  notes?: string;
}
