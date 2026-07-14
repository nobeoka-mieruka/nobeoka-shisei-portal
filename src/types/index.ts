export type SNSPlatform =
  | "x"
  | "facebook"
  | "instagram"
  | "threads"
  | "youtube"
  | "line"
  | "blog"
  | "website";

/**
 * SNSアカウントが本人公式のものと確認できているかどうかの状態。
 * 「SNSなし」のような断定は避け、確認状況を事実として示すための語だけを使う。
 */
export type SocialVerificationStatus = "verified" | "unverified" | "not_found" | "inactive";

export interface SNSLink {
  platform: SNSPlatform;
  url: string;
  /** 未設定の場合、確認状況バッジは表示されない。 */
  verificationStatus?: SocialVerificationStatus;
}

export interface Faction {
  id: string;
  name: string;
  /** Optional accent color (hex) used for the faction chip. Falls back to a palette cycle if omitted. */
  color?: string;
}

/**
 * 情報の出典区分。公的資料か本人発信かなどを、利用者が一目で区別できるようにするための分類。
 * 編集方針ページで説明している7区分と対応している。
 */
export type SourceType =
  | "延岡市公式情報"
  | "延岡市議会公式情報"
  | "選挙管理委員会資料"
  | "議員本人による発信"
  | "市長本人による発信"
  | "政党または会派による発表"
  | "その他の公開資料";

/**
 * 出典・確認日・更新日などをまとめて記録するための共通項目。すべて任意項目で、
 * データが揃っている範囲だけ入力すればよい（未入力＝「未確認」として扱う）。
 */
export interface SourceMeta {
  sourceTitle?: string;
  sourceUrl?: string;
  sourceType?: SourceType;
  /** ISO形式 (例: "2026-07-13") を推奨。資料が公表された日。 */
  publishedAt?: string;
  /** ISO形式。この情報をサイト運営者がいつ確認したか。 */
  verifiedAt?: string;
  /** ISO形式。サイト側でこの項目をいつ更新したか。 */
  updatedAt?: string;
  notes?: string;
}

/** 出典・参考資料の1件分（名称とURL）。 */
export interface SourceEntry {
  label: string;
  url: string;
}

export interface GeneralQuestion extends SourceMeta {
  id: string;
  date: string;
  /** e.g. "令和7年6月定例会" */
  session: string;
  title: string;
  summary?: string;
  /** 質問の全文、または会議録の該当部分。 */
  fullText?: string;
  /** 市側の答弁概要。 */
  answerSummary?: string;
  /** 会議録の該当箇所などのURL。 */
  minutesUrl?: string;
  videoUrl?: string;
}

export type VoteResult =
  | "賛成"
  | "反対"
  | "棄権"
  | "欠席"
  | "退席"
  | "議長のため採決に加わらず"
  | "確認中"
  | "記録なし"
  | "確認できず";

export interface BillVote extends SourceMeta {
  id: string;
  date: string;
  session: string;
  billNumber?: string;
  billName: string;
  result: VoteResult;
  note?: string;
}

export interface ActivityReport {
  id: string;
  date: string;
  title: string;
  body: string;
  imageUrl?: string;
  url?: string;
}

export type Gender = "male" | "female" | "other" | "undisclosed" | "unknown";

export interface CouncilMember extends SourceMeta {
  id: string;
  name: string;
  nameKana: string;
  photoUrl?: string;
  factionId: string;
  termCount?: number;
  age?: number;
  /** e.g. "令和8年5月16日現在" — reference date for the age value above */
  ageAsOf?: string;
  district?: string;
  gender: Gender;
  /** 議会内の役職（議長、副議長、委員長など）。未確認の場合は省略してよい。 */
  role?: string;
  committees: string[];
  profile: string;
  profileUrl?: string;
  sns: SNSLink[];
  questions: GeneralQuestion[];
  votes: BillVote[];
  reports: ActivityReport[];
  /** 出典・参考資料の一覧（延岡市議会公式プロフィール、選挙公報など）。未設定の場合は出典欄を表示しない。 */
  sources?: SourceEntry[];
}

/**
 * 公約の進捗区分。独自の評価に見えないよう、事実の確認状況を表す語だけを使う。
 * "取組中" は旧データとの後方互換のために残している値。
 */
export type PledgeStatus =
  | "未着手を確認"
  | "検討中"
  | "実施中"
  | "一部実施"
  | "実施済み"
  | "方針変更"
  | "中止を確認"
  | "確認できる資料なし"
  | "取組中";

export interface Pledge extends SourceMeta {
  id: string;
  title: string;
  description: string;
  category?: string;
  status?: PledgeStatus;
  /** 進捗状況の根拠となる資料のURL（sourceUrlと別に、状況固有の根拠を示したい場合に使う）。 */
  statusEvidenceUrl?: string;
}

export interface PolicyStatement {
  id: string;
  title: string;
  date?: string;
  body: string;
}

export interface MayorVideo {
  id: string;
  title: string;
  url: string;
  date?: string;
}

export interface CareerEntry {
  id: string;
  year: string;
  description: string;
}

export interface Mayor {
  name: string;
  nameKana: string;
  photoUrl?: string;
  termCount?: number;
  profile: string;
  career: CareerEntry[];
  pledges: Pledge[];
  policies: PolicyStatement[];
  sns: SNSLink[];
  officialUrl?: string;
  sourceUrl?: string;
  videos: MayorVideo[];
  /** ISO形式。この情報をサイト運営者がいつ確認したか。 */
  verifiedAt?: string;
  /** ISO形式。サイト側でこの項目をいつ更新したか。 */
  updatedAt?: string;
  /** 出典・参考資料の一覧。未設定の場合は出典欄を表示しない。 */
  sources?: SourceEntry[];
}

/** 特別職・議員報酬の比較対象となる役職。 */
export type CompensationRole = "mayor" | "chair" | "viceChair" | "member";

/**
 * 自治体ごとの首長・議長・副議長・議員報酬（月額）の比較データ。
 * 金額はすべて所得税等を差し引く前の月額報酬（円）。政務活動費・旅費・共済費・退職手当は含まない。
 */
export interface CompensationComparisonEntry {
  municipality: string;
  prefecture: string;
  /** ISO形式。報酬額の基準日。 */
  referenceDate: string;
  mayorMonthly: number;
  chairMonthly: number;
  viceChairMonthly: number;
  memberMonthly: number;
  /** 市長の期末手当支給月数。公式資料で確認できない場合は null。 */
  mayorBonusMonths: number | null;
  /** 議長・副議長・議員の期末手当支給月数。公式資料で確認できない場合は null。 */
  councilBonusMonths: number | null;
  /** 役職加算など、期末手当の算定基礎額に対する加算率。公式資料で確認できない場合は null（＝概算扱い）。 */
  bonusAdjustmentRate: number | null;
  sourceTitle: string;
  sourceUrl: string;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  confirmedAt?: string;
  notes: string;
  /** 現行額とは別に、まだ施行されていない改定案（答申等）がある場合の補足。 */
  pendingProposal?: {
    description: string;
    sourceTitle?: string;
    sourceUrl?: string;
  };
}

/** 宮崎県内9市中の月額報酬順位（役職1件分）。 */
export interface PrefectureCompensationRankingEntry {
  role: CompensationRole;
  monthly: number;
  /** 県内順位（月額報酬のみで算定。期末手当を含む年間総額の順位ではない）。 */
  rank: number;
}

/**
 * 宮崎県内市町村（現在は9市）を対象とした月額報酬の順位データ。
 * 個別自治体ごとの比較データ（CompensationComparisonEntry）とは別に、
 * 県公表資料に基づく順位のみを保持する。
 */
export interface PrefectureCompensationRanking {
  /** ISO形式。順位算定の基準日。 */
  referenceDate: string;
  /** 比較対象の市数。 */
  totalMunicipalities: number;
  sourceTitle: string;
  sourceUrl: string;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  confirmedAt?: string;
  note: string;
  roles: PrefectureCompensationRankingEntry[];
}

/** 一次資料の出所を記録するための共通メタ情報（報酬比較データ用）。 */
export interface CompensationSourceMeta {
  sourceTitle: string;
  sourceOrganization: string;
  sourceUrl: string;
  /** ISO形式。資料の公表日。 */
  publishedDate?: string;
  /** ISO形式。データの基準日。 */
  referenceDate: string;
  /** 順位・金額の算定方法を説明する文章。 */
  calculationMethod: string;
  /** 比較対象の自治体数。未確定の場合は null。 */
  targetCount: number | null;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  lastVerified?: string;
  notes: string;
}

/** 宮崎県内市の報酬月額（1市分）。第20-1表に掲載された数値をそのまま使用する。 */
export interface MiyazakiMunicipalityCompensation {
  municipality: string;
  mayorMonthly: number;
  chairMonthly: number;
  viceChairMonthly: number;
  memberMonthly: number;
}

/** 宮崎県内市の報酬比較データ（複数市＋出典メタ情報）。 */
export interface MiyazakiCompensationComparison extends CompensationSourceMeta {
  municipalities: MiyazakiMunicipalityCompensation[];
}

/** 役職1件分の順位データ。全国横断の一次資料が確認できない間は monthly/rank とも null。 */
export interface RoleRankingEntry {
  role: CompensationRole;
  monthly: number | null;
  rank: number | null;
}

/** 全国815市区（792市＋東京23特別区、町村は含まない）を対象とした月額報酬順位。 */
export interface NationalCompensationRanking extends CompensationSourceMeta {
  roles: RoleRankingEntry[];
}

/** 類似団体（総務省の類似団体区分、または代替基準）を対象とした月額報酬順位。 */
export interface SimilarMunicipalityComparison extends CompensationSourceMeta {
  /** 類似団体の定義文（総務省区分名、または代替基準の説明）。未確定の場合は「確認中」等の文言。 */
  definition: string;
  /** 総務省の財政上の類似団体区分ではなく、当サイト独自の代替基準を使っている場合の注記。 */
  usesAlternativeDefinition: boolean;
  /** 対象自治体名の一覧。未確定の場合は空配列。 */
  targetMunicipalities: string[];
  roles: RoleRankingEntry[];
}

/** 市長公約1件分の進捗状況（土台段階：詳細な判定・関連予算の紐付けは行わない）。 */
export interface MayorPolicyProgressItem {
  id: string;
  title: string;
  /** 現在の状況を表す短い文章。詳細な判定はまだ行っていないため、断定的な評価語は避ける。 */
  currentStatus: string;
  /** 根拠資料を表す短い文章（資料名の一覧など）。 */
  evidenceLabel: string;
}

/** PDFなど、根拠資料1件分（見出しとURL）。 */
export interface PolicyProgressDocument {
  label: string;
  url: string;
}

/** 市長公約の進捗状況ページ全体のデータ。 */
export interface MayorPolicyProgressData {
  /** ISO形式。データの基準日。 */
  referenceDate: string;
  documents: PolicyProgressDocument[];
  referenceUrl: string;
  referenceLabel: string;
  policies: MayorPolicyProgressItem[];
}

/**
 * 個別公約の状況区分。サイト独自の採点・達成率ではなく、公表資料から確認できた事実の区分。
 * 「達成」「未達成」のような断定は使わない。
 */
export type MayorPromiseStatusLabel = "進行中" | "検討中" | "実施済み" | "確認中";

/** 根拠資料1件分（共有ドキュメント）。市長本人の公表資料か延岡市公式資料かを sourceType で区別する。 */
export interface MayorPromiseDocument {
  key: string;
  label: string;
  url: string;
  sourceType: string;
}

/** 個別公約が属する政策カテゴリ（4つの政策）。 */
export interface MayorPromiseCategory {
  id: string;
  title: string;
  /** 進捗ページ内のアンカーID（例: "children"）。他ページからこの政策まで直接リンクするために使う。 */
  anchor: string;
}

/** 根拠資料への参照1件分。ページ番号は実際にPDFを確認できた場合のみ設定する。 */
export interface MayorPromiseEvidenceRef {
  /** MayorPromiseDocument の key。 */
  documentKey: string;
  /** 該当ページ（例: "p.2"）。ウェブサイトなどページ概念がない資料、または該当箇所を確認できていない場合は省略する。 */
  page?: string;
}

/** 個別公約1件分のデータ。 */
export interface MayorPromiseItem {
  id: string;
  categoryId: string;
  categoryTitle: string;
  /** 公約の原文。要約・言い換えをせずそのまま保持する。 */
  promiseText: string;
  /** 内部区分キー（英字）。 */
  status: string;
  /** 画面表示用の日本語ラベル。 */
  statusLabel: MayorPromiseStatusLabel;
  /** 「現在確認できた取組」の箇条書き。事実の列挙であり、サイト独自の評価コメントは含めない。 */
  progressSummary: string[];
  /** この公約に関連する根拠資料への参照（ページ番号付き）。 */
  evidenceItems: MayorPromiseEvidenceRef[];
  /** 情報の出所区分（例：延岡市公式資料／市長本人の公表資料）。区別のためのタグ。 */
  sources: string[];
  /**
   * 関連予算。個別事業ごとの予算額を資料内で特定できた場合はその内容を、
   * 特定できない場合は「確認中」を設定する（推定はしない）。
   */
  relatedBudget: string;
  /**
   * 関連議案。議案データ（bills.json）が整うまでは「確認中」を設定する（推定はしない）。
   */
  relatedBill: string;
  /** ISO形式。この公約データの基準日。 */
  referenceDate: string;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  lastVerified: string;
  notes: string;
}

/** 市長公約の進捗状況ページ（個別公約12項目）全体のデータ。 */
export interface MayorPromisesData {
  /** ISO形式。データ全体の基準日。 */
  referenceDate: string;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  lastVerified: string;
  documents: MayorPromiseDocument[];
  categories: MayorPromiseCategory[];
  promises: MayorPromiseItem[];
}

/** 議案の種別。 */
export type BillCategory = "条例" | "予算" | "決算" | "人事" | "意見書" | "請願" | "その他";

/** 議案に対する、議員1人ごとの賛否記録。 */
export interface MemberBillVoteRecord {
  memberId: string;
  result: VoteResult;
}

/**
 * 議案・採決結果。今後の機能拡張用の型で、現時点では実データを持たない
 * （src/data/bills.json は空配列）。架空の議案データをここに基づいて作成しないこと。
 */
export interface Bill extends SourceMeta {
  id: string;
  billNumber: string;
  billName: string;
  summary?: string;
  /** ISO形式。議案の提出日。 */
  submittedAt?: string;
  /** ISO形式。採決日。 */
  votedAt?: string;
  billType?: BillCategory;
  submitter?: string;
  result?: VoteResult;
  yesCount?: number;
  noCount?: number;
  abstainCount?: number;
  absentCount?: number;
  memberVotes?: MemberBillVoteRecord[];
  billDocumentUrl?: string;
  minutesUrl?: string;
}

/** サイト更新履歴の種別。 */
export type UpdateHistoryCategory = "新規追加" | "データ更新" | "表示改善" | "出典追加" | "修正";

/** サイトの更新履歴1件分。 */
export interface UpdateHistoryEntry {
  id: string;
  /** ISO形式。更新日。 */
  date: string;
  title: string;
  description: string;
  /** 対象ページのラベル（複数可）。 */
  targetPages: string[];
  /** 使用した資料名（任意）。 */
  sourceUsed?: string;
  category: UpdateHistoryCategory;
}

/** 市長交際費の支出1件分。延岡市公式資料に掲載された内容をそのまま保持する。 */
export interface MayorEntertainmentExpenseItem {
  /** ISO形式。支出月日。 */
  date: string;
  /** 例: 慶弔費／渉外費／会費／協賛費 */
  category: string;
  description: string;
  /** 円。 */
  amount: number;
  sourceTitle: string;
  sourceUrl: string;
  /** ISO形式。この支出データの基準日（公表月末日など）。 */
  referenceDate: string;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  lastVerified: string;
}

/** 市長交際費ページ全体のデータ（年度単位）。将来、複数年度分を配列で持てるようにしている。 */
export interface MayorEntertainmentExpensesData {
  /** 例: "2026"（西暦の会計年度開始年）。将来の年度切替用のキー。 */
  fiscalYear: string;
  /** 例: "令和8年度" */
  fiscalYearLabel: string;
  /** ISO形式。データ全体の基準日。 */
  referenceDate: string;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  lastVerified: string;
  sourcePageTitle: string;
  sourcePageUrl: string;
  expenses: MayorEntertainmentExpenseItem[];
  /** 公式資料で支出0円と確認できた月（YYYY-MM形式）の一覧。未公表月とは区別して「0円」と表示する。 */
  confirmedZeroMonths: string[];
  /** まだ公式資料が公表されていない月（YYYY-MM形式）の一覧。推定値を出さず「データ確認中」と表示するために使う。 */
  unconfirmedMonths: string[];
}

/** 財政ダッシュボードの金額1件分（千円単位）。構成比は資料に記載された値をそのまま使用する（独自算定はしない）。 */
export interface FinanceAmountItem {
  label: string;
  amountThousandYen: number;
  /** 構成比（％）。資料に記載がある場合のみ設定する。 */
  percentage?: number;
}

/** 6月補正予算の主な事業1件分（千円単位）。 */
export interface FinanceProjectItem {
  title: string;
  amountThousandYen: number;
}

/** 一般会計の総額系数値（千円単位）。 */
export interface FinanceGeneralAccount {
  /** 補正後の総額。 */
  totalThousandYen: number;
  /** 補正前の総額。 */
  totalBeforeThousandYen: number;
  /** 補正額。 */
  supplementaryThousandYen: number;
}

/** 財源調整用基金の年度末残高1件分（千円単位）。 */
export interface FiscalAdjustmentFundEntry {
  /** 例: "令和3年度末" */
  fiscalYear: string;
  amountThousands: number;
  /** 決算額ではなく見込額の場合 true。 */
  isEstimate: boolean;
}

/** ある年度末時点での基金全体の内訳（千円単位）。財源調整用基金と基金全体を混同しないためのデータ。 */
export interface FundBalanceTotalBreakdown {
  /** 例: "令和6年度末" */
  fiscalYear: string;
  fiscalAdjustmentFunds: number;
  otherSpecificPurposeFunds: number;
  total: number;
}

/** 基金残高データ。財源調整用基金の推移と、基金全体の内訳を区別して保持する。 */
export interface FundBalanceData {
  fiscalAdjustmentFunds: FiscalAdjustmentFundEntry[];
  totalFunds: FundBalanceTotalBreakdown;
  /** 「財源調整用基金」の定義を説明する注記。 */
  definitionNote: string;
}

/** 各年1月1日現在の人口1件分。 */
export interface PopulationTrendEntry {
  /** 例: "令和2年" */
  year: string;
  /** ISO形式。 */
  referenceDate: string;
  population: number;
}

/** 直近の人口実数値（年次推移の系列とは基準日が異なるため別カードで扱う）。 */
export interface PopulationLatestValue {
  /** ISO形式。 */
  referenceDate: string;
  population: number;
}

/** 人口推移データ。 */
export interface PopulationTrendData {
  trend: PopulationTrendEntry[];
  latest: PopulationLatestValue;
  /** 令和2年から最新年までの減少数（人）。 */
  decreaseCount: number;
  /** 減少率（％）。 */
  decreaseRatePercent: number;
  /** 「現住人口」と「住民基本台帳人口」の違いについての注記。 */
  note: string;
}

/** 財政ダッシュボードの1セクション分の出典情報。 */
export interface FinanceSourceMeta {
  /** どのセクションに対応するか（例: "revenue"）。 */
  section: string;
  title: string;
  organization: string;
  /** ISO形式。資料の基準日。 */
  referenceDate: string;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  confirmedDate: string;
  url: string;
  /** 該当ページ番号（PDF内）。 */
  page?: number;
}

/** 財政ダッシュボード全体のデータ（年度単位）。 */
export interface FinanceDashboardData {
  /** 例: "2026"。将来の年度切替用のキー。 */
  fiscalYear: string;
  /** 例: "令和8年度" */
  fiscalYearLabel: string;
  /** ISO形式。データの基準日。 */
  referenceDate: string;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  lastVerified: string;
  generalAccount: FinanceGeneralAccount;
  revenue: FinanceAmountItem[];
  expenditureByPurpose: FinanceAmountItem[];
  expenditureByNature: FinanceAmountItem[];
  supplementaryBudgetProjects: FinanceProjectItem[];
  fundBalance: FundBalanceData;
  populationTrend: PopulationTrendData;
  /** 市債（歳入項目）についての注記。市債残高ではないことを明記する。 */
  debtNote: string;
  sources: FinanceSourceMeta[];
  notes: string;
}
