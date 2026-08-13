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
  /**
   * 学歴・職歴等の経歴。延岡市議会公式プロフィールページには経歴の記載がないため、
   * 本人公式サイト・政党公式サイト等で個別に確認できた範囲のみ登録する（未確認の議員は省略）。
   * 推測で埋めない。
   */
  career?: CareerEntry[];
  /** 出典・参考資料の一覧（延岡市議会公式プロフィール、選挙公報など）。未設定の場合は出典欄を表示しない。 */
  sources?: SourceEntry[];
}

/** 副市長・教育長・監査委員・農業委員会委員等、市長以外の特別職・行政委員会委員の役職区分。 */
export type CitySpecialPostRole =
  | "deputy-mayor"
  | "superintendent"
  | "auditor"
  | "agricultural-committee-member"
  | "election-commission-member"
  | "election-commission-alternate";

/**
 * 副市長・教育長・監査委員・農業委員会委員等（src/data/citySpecialPosts.json）。
 * 現職に加え、既存データ（billVotes.jsonの人事同意議案）から後任者が明確に確認できる
 * 歴代在任者（status: "former"）も収録する（2026年8月に追加）。ただし、監査委員・
 * 教育委員会委員等、複数議席が短い周期で交代する役職の網羅的な歴代整理は、
 * 議選委員か識見委員かの区別や在任期間の境界を推測せずに確定させることが難しいため対象外とし、
 * 単一後任への交代が明確に確認できたもの（副市長等）のみを登録する。市長（mayor.json）・
 * 歴代市長アーカイブ（archiveMayors.json）とは別管理。
 */
export interface CitySpecialPost {
  id: string;
  role: CitySpecialPostRole;
  /** 表示用の役職名（例："副市長"）。 */
  roleLabel: string;
  name: string;
  nameKana?: string;
  /** 現職か歴代（過去の在任者）か。省略時はcurrentとして扱う。 */
  status?: "current" | "former";
  /** 議会同意等で就任が確認できた年月日（ISO形式）。未確認の場合はnull。 */
  appointedDate: string | null;
  /** 退任日（ISO形式）。公式資料で確認できた場合のみ設定する。未確認の場合はnull。 */
  retiredDate?: string | null;
  /** 任期・退任予定等、公式資料で確認できた場合のみ記載する自由記述。 */
  termNote?: string;
  /** 担当業務・所管の説明（公式資料で確認できた範囲）。 */
  duties?: string;
  profile?: string;
  /** 関連する議案（同意議案等）や公式ページへのリンク。 */
  relatedLinks?: { label: string; to: string }[];
  /** 同一人物が現職市議会議員でもある場合、members.jsonのidを設定する（議選委員等）。公式資料で同一人物と確認できた場合のみ設定する。 */
  relatedMemberId?: string;
  sourceRefs: SourceEntry[];
  /** 確認状況に関する補足（未確定要素がある場合に明記する）。 */
  notes?: string;
  lastVerifiedAt: string;
}

/** 委員会の区分。 */
export type CommitteeType = "常任委員会" | "議会運営委員会" | "特別委員会";

/** 委員会1名分の役職（委員長・副委員長・委員のいずれか）。 */
export type CommitteeRole = "委員長" | "副委員長" | "委員";

/** 委員会の構成員1名分。 */
export interface CommitteeMemberEntry {
  /** members.jsonまたはformerMembers.jsonのid。 */
  memberId: string;
  /** 表示用の氏名（公式名簿の表記）。 */
  memberName: string;
  role: CommitteeRole;
  /** その役職への就任日が名簿に個別注記されている場合のみ（例："令和7年5月9日委員長就任"）。 */
  appointedNote?: string;
}

/**
 * 常任委員会・議会運営委員会・特別委員会1件分（src/data/committees.json）。
 * 現在の任期（名簿記載時点）の構成のみを対象とし、予算審査特別委員会・決算審査特別委員会・
 * 長期総合計画審査特別委員会等、会期ごとに議長を除く全議員で構成・設置される臨時の委員会は
 * 対象外とする（委員名簿に個別掲載されないため）。審査した議案は billVotes.json の
 * committee フィールドから逆引きする（本ファイルには議案一覧を重複して持たない）。
 */
export interface Committee {
  id: string;
  name: string;
  type: CommitteeType;
  /**
   * 所管事項の説明。延岡市議会委員会条例の該当条文を確認できていないため、
   * 現時点では未確認。確認でき次第、条文に基づく記載へ更新する。
   */
  jurisdiction: string | null;
  members: CommitteeMemberEntry[];
  /** 委員定数（名簿記載の実人数。条例上の定数と異なる場合は備考に記載）。 */
  memberCount: number;
  /** 任期開始日（ISO形式）。名簿に記載がある場合のみ。 */
  termStart: string | null;
  /** 任期終了日（ISO形式）。名簿に記載がある場合のみ。 */
  termEnd: string | null;
  /** 設置日（特別委員会等、設置年月日が公式資料で確認できる場合）。 */
  establishedDate: string | null;
  /** 会議録検索システムでの当該委員会の発言記録を横断的に探すための参考リンク（トップページ）。 */
  minutesSearchUrl?: string;
  sourceRefs: SourceEntry[];
  notes?: string;
  lastVerifiedAt: string;
}

/**
 * 委員会活動報告書（所管事務調査報告書）1件分（src/data/committeeActivityReports.json）。
 * 延岡市議会公式サイト「委員会活動報告書」ページが年度ごとに公表するPDFへのインデックス。
 * 常任委員会・議会活性化特別委員会が毎年度選ぶ調査テーマの視察・調査まとめであり、
 * 委員会単独の会議録（開催日・出席委員・発言全文等）ではない点に注意（そのような一次資料は
 * 現時点で公表されていないことを2026年8月に確認済み）。
 */
export interface CommitteeActivityReport {
  id: string;
  /** committees.jsonのid。現行名簿に無い委員会（活動終了した特別委員会等）の場合はnull。 */
  committeeId: string | null;
  /** PDF公表時点の委員会表記をそのまま使う（committees.json側の名称と異なる場合がある）。 */
  committeeName: string;
  /** 対象年度（西暦、4月始まり）。例：令和7年度 → 2025。 */
  fiscalYear: number;
  /** 調査テーマ名、または「最終報告書」「中間報告書（第N回）」等の表記。 */
  title: string;
  url: string;
  /** この報告書PDFへのリンクを掲載している一覧ページのURL。 */
  sourceUrl: string;
  lastVerifiedAt: string;
}

/**
 * 委員長・副委員長が本会議で行った審査結果報告1件分（src/data/committeeReportActivity.json、Phase101）。
 *
 * 【重要：committee_internal_speechとの混同禁止】(Phase107で再確認・明確化)
 * この記録は「本会議の会議録」から抽出した、委員長・副委員長が本会議の壇上で行う
 * 審査結果報告（＝`committee_report_to_plenary`）であり、委員会そのものの内部で行われる
 * 質疑・討論等の個別発言（＝委員会内部発言、committee_internal_speech）ではない。
 * 延岡市議会では委員会単独の会議録（開催日・出席委員・個別発言全文）を一般公開している
 * ことを確認できておらず（複数の資料経路・PDF委員会活動報告書を確認したが、いずれも
 * 活動概要・調査結果のまとめのみで、個々の委員の発言記録・出席委員名簿は含まれていない。
 * CommitteeActivityReportのコメント参照）、委員会内部発言記録は本サイトに存在しない
 * （0件ではなく「確認できていない」＝research_exhausted）。
 * この型は、本会議の会議録から「◯◯委員会委員長（氏名）」「◯◯委員会副委員長（氏名）」
 * という発言者ラベルを機械的に抽出し、現職議員の氏名と完全一致（異体字正規化後）した
 * 場合のみ登録したものである。
 * 議会活動データ（レーダーチャート）の「提案・討論等」指標には反映しない（計算式を変更しないため）。
 */
export interface CommitteeReportActivityEvent {
  id: string;
  memberId: string;
  memberName: string;
  committeeId: string | null;
  committeeName: string;
  role: "chair" | "viceChair";
  /** ISO形式。本会議で報告を行った日。 */
  meetingDate: string | undefined;
  fileName: string;
  /** 本会議での委員長・副委員長報告。委員会内部発言（committee_internal_speech）とは明確に区別する。 */
  activityType: "committee_report_to_plenary";
  sourceUrl: string;
  verificationStatus: "verified";
  checkedAt: string;
}

/** 市政年表1件分の分類。 */
export type CivicTimelineCategory =
  | "市制施行・合併"
  | "市庁舎"
  | "行政組織"
  | "災害"
  | "公共事業"
  | "教育・福祉・産業";

/**
 * 市政年表1件分（src/data/civicTimelineEvents.json）。延岡市公式ホームページが公表する
 * 「近代の年表」等の一次資料のみを対象とし、推測で日付・出来事を補完しない。
 * 歴代市長の就任・退任はarchiveMayors.json/archiveMayorTerms.jsonで別管理のため対象外。
 */
export interface CivicTimelineEvent {
  id: string;
  /** 絞り込み用の西暦年。 */
  year: number;
  /** 表示用の日付文字列（例："1933年2月"「2006年2月20日」）。日・月が資料上不明な場合はその粒度のまま。 */
  dateLabel: string;
  category: CivicTimelineCategory;
  title: string;
  summary: string;
  /** 関連する人物（歴代市長id等）。公式資料で明確に確認できた場合のみ設定する。 */
  relatedPersonIds?: string[];
  relatedPages?: { label: string; to: string }[];
  sourceRefs: SourceEntry[];
  /** 日付の粒度・出典間の記載差異等の補足。 */
  notes?: string;
  lastVerifiedAt: string;
  verificationStatus: "verified" | "partiallyVerified";
}

/** 数値と、その数値の基準日・出典を1組にしたもの。自治体比較のように項目ごとに基準日が異なりうる場合に使う。 */
export interface DatedMetric {
  /** 未確認、または値が定義されない（例：将来負担比率が算定されない）場合はnull。 */
  value: number | null;
  /** ISO形式の基準日、または「令和7年度決算」のような和暦表記。 */
  referenceDate: string | null;
  /** 値がnullの理由（未確認なのか、制度上算定されないのかを区別する）。 */
  notApplicableReason?: string;
}

/**
 * 宮崎県内自治体比較1件分（src/data/municipalityComparison.json）。延岡市および比較対象6市
 * （宮崎市・都城市・日向市・日南市・小林市・西都市）を、公式資料で同一条件（同一年度・同一算定方法）
 * が確認できた範囲でのみ比較する。年度が異なる項目は、指標ごとにreferenceDateで個別に明示し、
 * 異なる年度の数値を無理に揃えない。推定順位・独自評価は行わない。
 */
export interface MunicipalityComparisonEntry {
  id: string;
  municipality: string;
  isNobeoka: boolean;
  population: DatedMetric;
  areaKm2: DatedMetric;
  councilSeats: DatedMetric;
  /** 議員報酬月額（円）。期末手当は含まない。 */
  councilMemberMonthlyYen: DatedMetric;
  mayorMonthlyYen: DatedMetric;
  deputyMayorMonthlyYen: DatedMetric;
  superintendentMonthlyYen: DatedMetric;
  fiscalStrengthIndex: DatedMetric;
  realDebtServiceRatioPercent: DatedMetric;
  futureBurdenRatioPercent: DatedMetric;
  /** 経常収支比率（％）。宮崎県「指標でみる宮崎県」市町村編財政より。 */
  currentAccountRatioPercent?: DatedMetric;
  /** 自主財源比率（％）。歳入総額に占める自主財源（市町村税等）の割合。 */
  independentFinancialResourceRatioPercent?: DatedMetric;
  /** 基金残高（百万円、基金全体）。 */
  fundBalanceMillionYen: DatedMetric;
  /** 地方債現在高（千円）。 */
  municipalBondBalanceThousandYen: DatedMetric;
  /** 歳入総額（千円）。 */
  totalRevenueThousandYen?: DatedMetric;
  /** 市町村税収入済額（千円）。 */
  localTaxRevenueThousandYen?: DatedMetric;
  /** 住民1人当たり歳入（千円）。出典が直接公表している値（当サイトの算出値ではない）。 */
  perCapitaRevenueThousandYen?: DatedMetric;
  /** 住民1人当たり市町村税（円）。出典が直接公表している値（当サイトの算出値ではない）。 */
  perCapitaLocalTaxYen?: DatedMetric;
  /** 住民1人当たり地方債現在高（千円）。出典が直接公表している値（当サイトの算出値ではない）。 */
  perCapitaBondBalanceThousandYen?: DatedMetric;
  sourceRefs: SourceEntry[];
  notes?: string;
  lastVerifiedAt: string;
}

/**
 * 現職ではない元議員（src/data/formerMembers.json）。
 * 過去会期の一般質問・発言履歴を保持するための最小限の人物データで、CouncilMemberとは
 * 別の管理単位。現職議員一覧・比較・集計の対象には含めない。
 */
export interface FormerMember {
  id: string;
  name: string;
  nameKana?: string | null;
  status: "former";
  /** 在職・発言を公式資料で確認できた会期IDの一覧（sessionId、例: "2024-12"）。 */
  servedSessions: string[];
  note: string;
  sourceNote?: string;
  lastVerified?: string | null;
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
  /** 自治体を一意に識別するID（ローマ字スラッグ）。 */
  id: string;
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

/** 正式掲載に必要な条件（公式資料・基準日・月額の確認）が揃っていない自治体1件分。 */
export interface PendingMunicipalityEntry {
  municipality: string;
  /** 未掲載の理由区分。今のところ「公式資料を確認できていない」の1種類のみ。 */
  status: "official_data_pending";
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
  /** 類似団体比較などで、個別実数ではなく最高額・最低額の範囲のみ公式資料で確認できた場合に設定する。 */
  max?: number;
  min?: number;
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
 * 「未達成」と断定できる公的根拠がない場合は使わない。
 * 「検討中」「実施済み」は初期データで使われていた区分（後方互換のため維持）、
 * それ以外は2026-07-21のTASK-007で追加した区分。
 */
export type MayorPromiseStatusLabel =
  | "達成"
  | "進行中"
  | "一部実施"
  | "未着手"
  | "方針変更"
  | "確認中"
  | "検討中"
  | "実施済み";

/** 根拠資料1件分（共有ドキュメント）。市長本人の公表資料か延岡市公式資料かを sourceType で区別する。 */
export interface MayorPromiseDocument {
  key: string;
  label: string;
  url: string;
  sourceType: string;
  /** ISO形式。資料が公開された日（確認できた場合のみ設定する）。 */
  publishedDate?: string;
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

/** 公約詳細ページの「関連リンク」1件分（PDF以外の参考ページなど）。 */
export interface MayorPromiseRelatedLink {
  label: string;
  url: string;
}

/**
 * 公約の進捗状態が変化した記録1件分。確認できた時点のみ追加する（推測で埋めない）。
 * 進捗状況を変更する場合は、出典（sourceUrl）と確認日（date）を必須とする（validate-data.mjsで検証）。
 */
export interface MayorPromiseHistoryEntry {
  /** ISO形式。この状態を確認した日。 */
  date: string;
  statusLabel: MayorPromiseStatusLabel;
  /** 進捗内容の説明。 */
  summary?: string;
  /** 根拠資料名。 */
  sourceTitle?: string;
  /** 根拠資料の公式URL。進捗状況を変更する場合は必須。 */
  sourceUrl?: string;
  /** 変化の内容を示す短い注記（summaryを優先し、noteは後方互換のため残す）。 */
  note?: string;
}

/** 個別公約1件分のデータ。 */
/**
 * 「確認中」（relatedBudget/relatedBillの現行値）と「確定」の間にある中間状態を表す。
 * confirmed（確定）は既存のrelatedBudget/relatedBill文字列そのものに一次資料の記載を
 * そのまま転記する運用を維持し、この型はそれ以外の状態（候補・調査中・見つからなかった・
 * 対象外）を安全に区別するために追加した。市民向け表示では"candidate"のみ「関連事業候補」
 * として明示し、絶対に「公約達成」とは表示しないこと（PromiseCandidateEvidenceLink自体は
 * 達成・未達成の判定を一切含まない）。
 */
export type PromiseEvidenceStatus = "confirmed" | "candidate" | "under_review" | "not_found" | "unavailable";

/**
 * 公約と関連しうる事業・予算・議案の候補1件分。名称が公約本文と完全一致しなくても、
 * 一次資料（または信頼できる報道）で関連性が示唆される場合に登録する。ただし
 * candidateReason・source・sourceType・sourceUrlを必ず伴い、根拠のない登録は禁止する。
 */
export interface MayorPromiseCandidateEvidence {
  id: string;
  status: PromiseEvidenceStatus;
  /** 候補となる事業・予算項目・議案の名称。 */
  label: string;
  /** なぜこれを候補と判断したか（例：「施政方針で名称が言及」「同一事業名が予算資料に記載」）。 */
  candidateReason: string;
  source: string;
  /** "primary" = 延岡市・延岡市議会等の一次資料。"news" = 信頼できる報道（一次資料が無い場合のみ）。 */
  sourceType: "primary" | "news";
  /** ISO形式。資料の日付（公表日・報道日等）。 */
  sourceDate: string;
  sourceUrl: string;
  /** ISO形式。サイト運営者がこの候補をいつ確認したか。 */
  checkedAt: string;
  notes?: string;
}

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
   * 関連議案。議案データ（billVotes.json）との紐付けが確認できるまでは「確認中」を設定する（推定はしない）。
   */
  relatedBill: string;
  /** ISO形式。この公約データの基準日。 */
  referenceDate: string;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  lastVerified: string;
  notes: string;
  /** 担当部署。公式資料で確認できない場合は省略する（表示側は「情報未登録」とする。推測で埋めない）。 */
  department?: string;
  /** 市民向けの分かりやすい概要。公約原文（promiseText）とは別に用意できた場合のみ設定する。 */
  citizenSummary?: string;
  /** この公約が発表された日（選挙公報・マニフェスト公表日など）。確認できない場合は省略する。 */
  announcedDate?: string;
  /** サイト側でこの公約データを最後に更新した日（ISO形式）。lastVerified（資料確認日）とは別の概念。 */
  siteUpdatedAt?: string;
  /** 関連リンク（PDF以外の参考ページなど）。 */
  relatedLinks?: MayorPromiseRelatedLink[];
  /** 進捗状態の変更履歴。確認できた時点のみ追加する（未設定の場合、詳細ページは最新の状態のみを表示する）。 */
  progressHistory?: MayorPromiseHistoryEntry[];
  /** 関連する議案（billVotes.jsonのid）。公式資料で関連が確認できた場合のみ設定する。 */
  relatedBillVoteIds?: string[];
  /** 関連する一般質問（generalQuestions.jsonのid）。公式資料で関連が確認できた場合のみ設定する。 */
  relatedQuestionIds?: string[];
  /** 関連する市長定例記者会見（mayorPressConferences.tsのdate、ISO形式）。公式資料で関連が確認できた場合のみ設定する。 */
  relatedPressConferenceDates?: string[];
  /**
   * relatedBudgetが「確認中」のままの公約について、名称完全一致は無いが関連しうる候補が
   * 見つかった場合に設定する（未設定＝候補も無し）。既存のrelatedBudget文字列は変更しない。
   */
  relatedBudgetCandidates?: MayorPromiseCandidateEvidence[];
  /** relatedBillと同様の候補（議案版）。 */
  relatedBillCandidates?: MayorPromiseCandidateEvidence[];
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

/** サイト更新履歴の種別。 */
export type UpdateHistoryCategory =
  | "新規追加"
  | "データ更新"
  | "表示改善"
  | "出典追加"
  | "修正"
  | "議案・表決"
  | "品質改善"
  | "新機能";

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
  /** 関連ページへのリンク先パス（任意）。指定した場合のみ linkLabel のボタンを表示する。 */
  linkUrl?: string;
  /** リンクボタンの表示文言（任意）。linkUrl とセットで指定する。 */
  linkLabel?: string;
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

/**
 * 健全化判断比率等の財政指標。総務省の地方公共団体財政健全化法に基づき延岡市が公表した数値のみを掲載する。
 * 今回確認できなかった指標はnullとし、「確認中」と表示する（0や架空値で埋めない）。
 */
export interface FinancialIndicatorsData {
  /** 例: "令和6年度決算" */
  fiscalYearLabel: string;
  /** 実質公債費比率（%）。 */
  realDebtServiceRatioPercent: number | null;
  /** 将来負担比率（%）。 */
  futureBurdenRatioPercent: number | null;
  /** 財政力指数。今回未確認のためnull。 */
  fiscalStrengthIndex: number | null;
  /** 経常収支比率（%）。今回未確認のためnull。 */
  currentBalanceRatioPercent: number | null;
  /** 実質収支（千円）。今回未確認のためnull。 */
  realBalanceThousandYen: number | null;
  /** 「対象なし」（黒字等のため算定対象外）として公表された指標名の一覧。未確認（null）とは区別する。 */
  notApplicableIndicators: string[];
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

/** 一般質問データベースの会議区分。 */
export type QuestionSessionType = "定例会" | "臨時会";

/** 一般質問データベースの質問区分。 */
export type QuestionType = "一般質問" | "代表質問";

/** 一般質問データベースにおける資料区分。既存の SourceType（議員・市長データ用）とは別に定義する。 */
export type QuestionSourceType = "議会会議録" | "議会映像" | "質問通告書" | "その他の公開資料";

/**
 * 一般質問データベース1件分のデータ。会議録検索システムで実際に確認できた内容のみを登録する。
 * 架空の議員名・質問内容・日付は登録しないこと（未確認の場合は generalQuestions.json を空配列のままにする）。
 */
export interface GeneralQuestionItem {
  id: string;
  /** 例: "令和8年" */
  councilYear: string;
  /** 例: "令和8年度" */
  fiscalYear: string;
  /** 例: "令和8年6月定例会" */
  sessionName: string;
  sessionType: QuestionSessionType;
  questionType: QuestionType;
  /** ISO形式。質問を行った日。 */
  questionDate: string;
  memberId: string;
  memberName: string;
  title: string;
  /** 全文転載は行わず、短い要約のみを掲載する。 */
  summary: string;
  topics: string[];
  /** 質問通告書・会議録で確認できた質問項目の一覧。全文ではなく項目名・見出しのみ。 */
  questionItems: string[];
  /** 質問項目数。questionItems.length と一致させる。 */
  questionCount?: number;
  /** その定例会・質問区分内での質問順。 */
  questionOrder?: number;

  // 質問通告書（基礎資料）
  noticeTitle?: string;
  noticeUrl?: string;
  /** 質問通告書PDFのURL（ある場合のみ）。 */
  noticePdf?: string;

  // 会議録（正式な発言記録）
  transcriptUrl?: string;
  /** 会議録PDFのURL（会議録ページ＝transcriptUrlとは別に、PDFが確認できた場合のみ）。 */
  transcriptPdfUrl?: string;
  /** 会議録内の該当箇所を示す参照情報（ページ・巻号など）。 */
  transcriptReference?: string;
  /** 質問時間（分）。会議録で確認できた場合のみ設定する。 */
  durationMinutes?: number;

  // 議会映像（延岡市議会公式YouTubeチャンネルの動画のみ）
  videoUrl?: string;
  /** 質問開始位置（秒）。会議録・映像で確認できた場合のみ設定し、推測では設定しない。 */
  videoStartSeconds?: number;
  /** 画面表示用の開始位置ラベル（例: "1:02:00"）。 */
  videoStartLabel?: string;
  videoTitle?: string;
  videoChannelName?: string;
  /** ISO形式。動画の視聴可否・内容をサイト運営者がいつ確認したか。 */
  videoLastVerified?: string;

  documentUrl?: string;

  // 市側の答弁（将来拡張用。今回は未実装のため値を持たせない）
  answerSummary?: string;
  answerSpeaker?: string;
  answerDepartment?: string;
  speechOrder?: number;

  /** 関連する議案（billVotes.jsonのid）。公式資料で関連が確認できた場合のみ設定する。 */
  relatedBillVoteIds?: string[];
  /** 関連する市長公約（mayorPromises.jsonのid）。公式資料で関連が確認できた場合のみ設定する。 */
  relatedMayorPromiseIds?: string[];
  /** 関連する予算・財政項目（financeDashboard.jsonの項目名。IDを持たないデータのため文言で保持する）。 */
  relatedFinanceItems?: string[];

  sourceTitle: string;
  sourceOrganization: string;
  sourceUrl: string;
  sourceType?: QuestionSourceType;
  /** ISO形式。会議録等の基準日。 */
  referenceDate?: string;
  /** ISO形式。サイト運営者がこの情報をいつ確認したか。 */
  lastVerified: string;
  notes?: string;
}

/**
 * 議案ごとの賛否データベースにおける、議員1人分の議決結果。
 * 表示ラベル: approve=賛成／oppose=反対／departed=退席／absent=欠席／recused=除斥／
 * notVoting=採決なし／abstained=棄権／unconfirmed=確認不能
 * "abstained"（棄権＝出席のうえで意思表示しない）と"departed"（退席＝採決前に議場を退出）は
 * 別概念のため区別している。公式記録で個人の賛否が明示されていない場合は"unconfirmed"を使う
 * （推測で"approve"/"oppose"を割り当てないこと）。
 */
export type BillMemberVoteStatus =
  | "approve"
  | "oppose"
  | "departed"
  | "absent"
  | "recused"
  | "notVoting"
  | "abstained"
  | "unconfirmed";

/**
 * 議案の議決結果。公式資料で確認できない場合は「確認中」を使う。
 * 「原案可決及び認定」「否決及び不認定」は、水道・下水道事業会計等の剰余金処分と決算認定が
 * 1件の議案にまとめて提案され、可決／認定が一体で議決される場合の公式資料の表記をそのまま用いる
 * （議決結果の複合表記を単一の値へ強引に単純化しない）。
 */
export type BillVoteResult =
  | "原案可決"
  | "修正可決"
  | "否決"
  | "承認"
  | "不承認"
  | "認定"
  | "不認定"
  | "原案可決及び認定"
  | "否決及び不認定"
  | "同意"
  | "不同意"
  | "採択"
  | "一部採択"
  | "趣旨採択"
  | "不採択"
  | "継続審査"
  | "撤回"
  | "廃案"
  | "その他"
  | "確認中";

/** 案件の分類。公式資料の内容から機械的に判定できない場合は"その他"を使う（推測で細分類しない）。 */
export type BillCategory =
  | "条例"
  | "予算"
  | "決算"
  | "契約"
  | "財産取得"
  | "人事"
  | "意見書"
  | "決議"
  | "請願"
  | "陳情"
  | "専決処分"
  | "その他"
  | "不明";

/**
 * 議案・表決データの公開状態。未設定（省略）の場合は"published"として扱う（既存データとの後方互換のため）。
 *
 * 「公開するかどうか」と「確認が済んでいるかどうか」は別の軸として扱う（BillVerificationStatus参照）。
 * pendingReview・updatedPendingReviewは、確認は済んでいないが一般公開はする状態
 * （一覧・詳細ページに「確認待ち」等の表示を伴って掲載される）。
 * rejected（誤抽出と判断され却下）とerror（抽出処理でのエラー）のみ、一般公開ページから除外する。
 */
export type BillPublicationStatus = "published" | "pendingReview" | "updatedPendingReview" | "rejected" | "error";

/**
 * 議案データの確認状況。「公開状態（BillPublicationStatus）」とは独立した軸で管理する。
 * - verified：議案番号・件名・結果・議決日などの事実関係を確認済み
 * - partially-verified：一部の項目は確認できたが、一部は確認できていない
 * - pending：公式資料の記載が複合的・非定型的で、内容を確認中
 * - individual-votes-unavailable：案件単位の情報は確認できるが、議員個人の賛否は公式資料に記載がない
 * 未設定（省略）の場合は"verified"として扱う（既存データとの後方互換のため）。
 */
export type BillVerificationStatus = "verified" | "partially-verified" | "pending" | "individual-votes-unavailable";

/** 議案ごとの賛否データベースにおける、議員1人分の賛否記録。 */
export interface BillVoteMemberEntry {
  memberId: string;
  memberName: string;
  faction: string;
  vote: BillMemberVoteStatus;
}

/** 議案の根拠資料1件分（根拠資料の固定URL項目でカバーできないものを列挙するための任意項目）。 */
export interface BillRelatedDocument {
  title: string;
  url: string;
  sourceType?: string;
}

/** 議案の提出者区分。公式資料で確認できた場合のみ設定する（推測で分類しない）。 */
export type BillProposerType = "mayor" | "member" | "committee" | "other";

/**
 * 採決方法。公式資料（会議録等）で確認できた場合のみ設定する（TASK-004）。
 * 現在の主な情報源（議案等審議結果PDF）には採決方法の記載が無いため、確認できるまでは未設定のままにする
 * （"確認できず"は「確認を試みたが記載が無かった」ことを明示したい場合に使う値であり、単に未着手の場合は
 * フィールド自体を省略する）。
 */
export type BillVoteMethod =
  | "全会一致"
  | "起立多数"
  | "起立少数"
  | "簡易採決"
  | "記名投票"
  | "無記名投票"
  | "採決なし"
  | "確認できず";

/**
 * 個人別（議員ごと）の賛否が公開されているかどうかの状態。
 * verificationStatus（案件全体の確認状況）とは別の軸として管理する。
 * - disclosed：memberVotesに実際の個人別記録がある
 * - notDisclosed：公式資料を確認した結果、個人別の賛否は公表されていないと確認できた
 * - unconfirmed：まだ確認していない（memberVotesが空でも、非公表と決めつけない。既定値）
 * 議決結果（可決／否決）だけから個人別の賛否を推測してはならない。
 */
export type IndividualVoteDisclosureStatus = "disclosed" | "notDisclosed" | "unconfirmed";

/**
 * 議案ごとの賛否データベース1件分のデータ（第1段階：構造のみ）。
 * 架空の議案・議員・賛否結果は登録しないこと（未確認の場合は billVotes.json を空配列のままにする）。
 */
export interface BillVoteItem {
  id: string;
  fiscalYear: string;
  session: string;
  billNumber: string;
  billTitle: string;
  /**
   * 議案の概要文。確認できた事実（議案名・案件分類・定例会・議決結果等）のみを自然文に整えたもの。
   * 現在の情報源（審議結果PDF）には提案理由・目的等の本文は含まれないため、
   * それらを推測で補って記述することはしない。
   */
  summary: string;
  /** ISO形式。summaryを生成・更新した日時。 */
  summaryGeneratedAt?: string;
  /**
   * summaryの生成方法。
   * "template"＝確認済みの構造化データ（件名・分類・結果等）からの機械生成／
   * "pdf"＝議案本文PDFから抽出した内容に基づく／"manual"＝人が執筆・確認済み。
   * 未設定（省略）の場合は既存データとの互換のため区別しない。
   */
  summarySource?: "template" | "pdf" | "manual";
  submittedDate?: string;
  votingDate?: string;
  committee?: string;
  proposer?: string;
  /** 提出者区分（市長提出／議員提出など）。公式資料で区分が確認できた場合のみ設定する。 */
  proposerType?: BillProposerType;
  /** 担当課・提出部局（公式資料で確認できた場合のみ）。 */
  submittingDepartment?: string;
  result: BillVoteResult;
  memberVotes: BillVoteMemberEntry[];
  /** 採決方法。公式資料（主に会議録）で確認できた場合のみ設定する。 */
  voteMethod?: BillVoteMethod;
  /** 個人別賛否の公開状況。未設定はunconfirmedと同義に扱う（可決/否決の結果だけから推測しないこと）。 */
  individualVoteDisclosureStatus?: IndividualVoteDisclosureStatus;
  /**
   * 施行日（条例の制定・改正議案等で、公式資料に明記がある場合のみ設定する）。
   * 単一の施行日に整理できない場合（複数の規定でそれぞれ異なる日から施行される等）は、
   * 自由記述の文字列として登録する（例："令和6年4月1日（給料表）・令和6年12月1日（期末勤勉手当）、
   * いずれも遡及適用"）。ISO日付形式に限定しない。
   */
  effectiveDate?: string;

  // 議案の概要（詳細ページ用の任意項目。データがない項目は表示しない）
  /** 提出理由。 */
  reason?: string;
  /** 主な変更内容の箇条書き。 */
  mainChanges?: string[];
  /** 市民生活への影響。 */
  citizenImpact?: string;
  /** 関連する予算の概要。 */
  relatedBudgetSummary?: string;
  /** 関連する条例名の一覧（公式資料で確認できた場合のみ）。 */
  relatedOrdinances?: string[];
  topics?: string[];

  /** ISO形式。サイト運営者がこの議案データをいつ確認したか。 */
  lastVerified?: string;

  // 根拠資料（存在するものだけ画面に表示する）
  billDocumentUrl?: string;
  resultDocumentUrl?: string;
  transcriptUrl?: string;
  committeeDocumentUrl?: string;
  budgetDocumentUrl?: string;
  relatedDocumentUrls?: BillRelatedDocument[];
  /** 議会中継・録画のURL（延岡市議会公式のものに限る）。 */
  videoUrl?: string;

  // 関連情報（将来連携用の任意項目。今回は架空の関連付けを行わない）
  relatedQuestionIds?: string[];
  relatedCommitteeActivityIds?: string[];
  relatedMayorPromiseIds?: string[];
  relatedFinanceItems?: string[];

  // 定例会・議会資料PDFとの連携（任意項目。公式資料で確認できた場合のみ設定する）
  /** この議案が審議された定例会・臨時会のID（councilSessions.jsonのid）。 */
  sessionId?: string;
  /** この議案が掲載されている資料のID（councilSessions.json内のCouncilDocument.id）。 */
  sourceDocumentId?: string;
  /** 上記資料のPDFパス（サイト内保存の場合）。councilSessions.json側の値と重複するが、参照解決できない場合のフォールバック用に持たせる。 */
  sourceFilePath?: string;
  /** PDF内でこの議案が掲載されているページ番号（確認できた場合のみ）。 */
  sourcePage?: number;

  /** 案件分類（機械的に判定できた場合のみ）。 */
  category?: BillCategory;
  /**
   * 未設定（省略）の場合は"published"として扱う。
   * scripts/extract-council-pdf-data.mjs がPDFから自動抽出したデータの公開可否を管理する。
   */
  publicationStatus?: BillPublicationStatus;
  /** "automatic"はPDFからの自動抽出、省略または"manual"は手入力・人による確認済みを表す。 */
  extractionSource?: "manual" | "automatic";
  /** 抽出結果の内部的な確からしさ（0〜1）。一般公開ページには表示しない。 */
  extractionConfidence?: number;
  /** pendingReview等になった技術的な理由（開発・確認作業者向けの手がかり。一般公開ページには表示しない）。 */
  extractionNotes?: string;
  /** ISO形式。自動抽出処理を実行した日時。 */
  extractedAt?: string;

  /** 未設定（省略）の場合は"verified"として扱う。 */
  verificationStatus?: BillVerificationStatus;
  /** 確認待ち・一部確認済みの理由を、利用者向けに分かりやすく説明する文章（議案詳細ページの注意表示に使う）。 */
  verificationNote?: string;
  /** 確認作業を行った担当者・体制の識別子（任意。個人名は入れない）。 */
  reviewedBy?: string;
  /** 確認が済んでいない項目名の一覧（例: ["result", "individualVotes"]）。内部の手がかり用。 */
  unresolvedFields?: string[];

  /**
   * 複数回の採決がある場合の段階別記録（任意項目。第1段階：型のみ）。
   * 現在の自動抽出（審議結果PDF）は案件ごとに単一の結果のみを記載しており、
   * 修正案・再議等の段階別データは含まれない。将来、会議録等のより詳細な資料から
   * 抽出できるようになった場合のための拡張ポイントとして用意している。
   */
  voteStages?: BillVoteStage[];

  // 議案間の関連付け（議案差分比較機能用。任意項目、確認できたものだけ設定する）
  /** 関連する議案ID（種類を問わない緩い関連付け）。 */
  relatedBillIds?: string[];
  /** この議案が「改正後」にあたる場合の、改正前（元）の議案ID。 */
  revisionOfBillId?: string | null;
  /** この議案が過去の別議案を置き換える場合の、置き換え対象の議案ID。 */
  replacesBillId?: string | null;
  /** この議案が別の新しい議案に置き換えられた場合の、置き換え後の議案ID。 */
  supersededByBillId?: string | null;
  /** 出典PDFの内容ハッシュ等、差分比較の元テキストのバージョンを識別する値（任意）。 */
  sourceVersionHash?: string;
  /**
   * 議案間の関連付けの確からしさ。
   * "confirmed"＝人が確認して関連を確定したもの／"suggested"＝名称類似等による自動候補（未確定）／
   * "rejected"＝候補として提示されたが誤りと判断されたもの。
   * 一般公開ページでは"confirmed"の関連のみを確定情報として扱う。
   */
  relationStatus?: RelationStatus;
}

/** 1つの議案に対する採決が複数回行われる場合の、1段階分の記録。 */
export interface BillVoteStage {
  id: string;
  /** 例: "修正案" "修正後の原案" "原案" "再議" */
  label: string;
  /** 例: "修正部分を除く原案を可決すること" */
  questionText?: string;
  result: BillVoteResult;
  memberVotes: BillVoteMemberEntry[];
}

/**
 * 定例会・臨時会ごとの議会資料（PDF）を分類するカテゴリ。
 * proposals=議案・条例・予算／results=審議結果・表決結果／petitions=請願・陳情／
 * statements=意見書・決議・討論／minutes=会議録／newsletters=市議会だより／other=その他
 */
export type CouncilDocumentCategory =
  | "proposals"
  | "results"
  | "petitions"
  | "statements"
  | "minutes"
  | "newsletters"
  | "other";

/**
 * 資料の表示方式。
 * local … サイト内（public/council-documents/配下）に保存したPDFを表示する。
 * external … サイト内には複製せず、公式サイトのURL（sourceUrl）のみを案内する。
 * 公開可否が確認できない資料は必ずexternalにする（無断複製を避けるため）。
 */
export type CouncilDocumentStorageType = "local" | "external";

/**
 * データの確認状態（管理用の内部フラグ）。
 * "要確認" は scripts/generate-council-documents.mjs がPDFを自動検出した際、
 * 資料名・分類・定例会情報などを人が確認できていないことを示すために付ける。
 * "自動取得" は scripts/fetch-nobeoka-council-documents.mjs が延岡市議会公式サイトの
 * 一覧ページから機械的に取得したことを示す（出典・回次は公式ページの記載どおりだが、
 * 資料名・説明文などを人が手直ししていない状態）。
 * 画面上でこの値を一般利用者向けに強調表示することはしない（管理用データとして保持する）。
 */
export type CouncilVerificationStatus = "確認済み" | "要確認" | "自動取得";

/**
 * 資料の公開状態。未設定（省略）の場合は"published"として扱う（既存データとの後方互換のため）。
 * pendingReview系の資料は、一般公開ページ（一覧・詳細）には表示しない。
 */
export type CouncilPublicationStatus =
  | "published"
  | "pendingReview"
  | "updatedPendingReview"
  | "removedPendingReview"
  | "error";

/** 定例会・議会資料ページにおける、資料（PDF）1件分のデータ。 */
export interface CouncilDocument {
  id: string;
  category: CouncilDocumentCategory;
  title: string;
  description?: string;
  storageType: CouncilDocumentStorageType;
  /** storageType="local"の場合のみ使用。/council-documents/配下のパス（例: "/council-documents/2026/2026-06/results/deliberation-results.pdf"）。 */
  filePath?: string;
  fileType?: string;
  /** 延岡市議会・延岡市公式サイト上の元の資料URL。storageTypeによらず、確認できた場合は必ず入力する。 */
  sourceUrl?: string;
  /** 公式サイト上で、この資料へのリンクが掲載されているページのURL（一覧ページ等）。 */
  sourcePageUrl?: string;
  /** ISO形式。公式サイトでの公開日（確認できた場合のみ）。 */
  publishedDate?: string;
  pages?: number | null;
  fileSize?: string;
  /** ISO形式。サイト運営者がこの資料の内容・公開状況をいつ確認したか。 */
  verifiedAt?: string;
  /** 延岡市・延岡市議会が公開した公式資料であるかどうか。 */
  isOfficial: boolean;
  /** 未設定（省略）の場合は"確認済み"として扱う。 */
  verificationStatus?: CouncilVerificationStatus;
  /** 未設定（省略）の場合は"published"として扱う。 */
  publicationStatus?: CouncilPublicationStatus;
  notes?: string;
  /**
   * PDF本文のテキスト抽出状態。
   * "extracted"＝文字情報を抽出できた／"ocrRequired"＝画像のみでOCRが必要／
   * "error"＝抽出処理でエラー／未設定は"notAttempted"（未実行）として扱う。
   */
  textExtractionStatus?: "extracted" | "ocrRequired" | "error" | "notAttempted";
  /** ISO形式。PDF本文抽出処理を実行した日時。 */
  textExtractedAt?: string;
}

/** 定例会・臨時会の区分。 */
export type CouncilSessionType = "定例会" | "臨時会";

/**
 * 会期要約の確認状態。議案ごとのverificationStatusとは別軸で、要約文そのものの確認状況を表す。
 * "verified"＝要約の元になった構造化データ（議案・資料）がすべて確認済み／
 * "partially-verified"＝一部の議案・資料が確認待ちの状態を含む／
 * "pending"＝要約文自体が人による確認前（暫定掲載）／
 * "unavailable"＝要約作成に必要な資料（議案・資料）が登録されていない。
 */
export type SessionSummaryStatus = "verified" | "partially-verified" | "pending" | "unavailable";

/** 会期要約の作成に使用した資料1件分。 */
export interface SessionSummarySource {
  /** 対応するCouncilDocument.id（確認できる場合）。 */
  documentId?: string;
  title: string;
  filePath?: string;
  sourceUrl?: string;
  page?: number;
}

/**
 * 本会議・委員会1回分の概要（将来拡張用）。
 * 発言議員・トピックは、公式会議録等で発言者を確定できる場合のみ設定し、推測では補わない。
 */
export interface CouncilMeetingDay {
  id: string;
  /** ISO形式。開催日。 */
  date: string;
  /** 例: "第2号" */
  meetingNumber?: string;
  meetingType?: "本会議" | "委員会";
  title?: string;
  summary?: string;
  summaryStatus?: SessionSummaryStatus;
  /** 発言が公式資料で確認できた議員のmemberId。確定できない場合は空配列のままにする。 */
  speakerMemberIds?: string[];
  /** 会議録・議案名に明記された語句のみを設定する（独自分類・タグ付けはしない）。 */
  topics?: string[];
  documentIds?: string[];
}

/**
 * 定例会・臨時会ごとの議会資料データ1件分（第1段階：構造のみ）。
 * 架空の会期日程・資料は登録しないこと。未確認の項目は省略する（空文字を入れない）。
 */
export interface CouncilSession {
  id: string;
  /** 開催年（西暦）。会期の開催月が属する暦年（例: 令和8年3月定例会なら2026）。 */
  year: number;
  /** 年度（西暦、4月始まり）。フォルダ分類・一覧ページの年度別グルーピングに使う。 */
  fiscalYear: number;
  /** 元号表記（例: "令和8年"）。開催年（year）に対応する。 */
  eraYear: string;
  /** 例: "令和8年6月定例会" */
  title: string;
  sessionType: CouncilSessionType;
  /** 延岡市議会の回次（例: "第26回"）。公式資料で確認できた場合のみ設定する。 */
  sessionNumber?: string;
  /** ISO形式。会期開始日（確認できた場合のみ）。 */
  startDate?: string;
  /** ISO形式。会期終了日（確認できた場合のみ）。 */
  endDate?: string;
  /** public/council-documents/配下のフォルダパス（例: "/council-documents/2026/2026-06"）。 */
  folderPath: string;
  description?: string;
  documents: CouncilDocument[];
  /** 延岡市議会公式サイトの、この定例会に関する情報が確認できるページのURL。 */
  officialSessionUrl?: string;
  /** ISO形式。サイト運営者がこの定例会データをいつ確認したか。 */
  lastVerified?: string;
  /**
   * 未設定（省略）の場合は"確認済み"として扱う。
   * scripts/generate-council-documents.mjs がPDFフォルダから自動生成した定例会（正式名称・会期を
   * 未確認）には"要確認"を設定する。画面上ではこの値を一般利用者向けに強調表示しない。
   */
  status?: CouncilVerificationStatus;

  /** 一覧カード用の短い要約（80〜160字目安）。scripts/generate-session-summaries.mjsが生成する。 */
  shortSummary?: string;
  /**
   * 会期全体の要約（200〜500字目安）。議案・資料として登録済みの構造化データ（件名・分類・
   * 議決結果・資料区分等）のみから機械的に整えたもの。公式資料の本文をそのまま転載しない。
   */
  summary?: string;
  summaryStatus?: SessionSummaryStatus;
  /** ISO形式。summaryを生成・更新した日時。 */
  summaryGeneratedAt?: string;
  /** ISO形式。summaryの内容を人が公式資料と照合した日時（未確認の場合は未設定）。 */
  summaryVerifiedAt?: string;
  summarySources?: SessionSummarySource[];

  /**
   * 本会議・委員会ごとの概要（将来拡張用）。公式会議録から日別に整理できる場合のみ設定する。
   * 現時点のデータ基盤（審議結果一覧PDF）では発言者・トピックを確定できないため、通常は未設定。
   */
  meetingDays?: CouncilMeetingDay[];
}

/**
 * 議案間・質問間などの関連付けの確からしさを表す共通の型。
 * "confirmed"＝人が確認して関連を確定したもの／"suggested"＝自動検出等による候補（未確定）／
 * "rejected"＝候補として提示されたが誤りと判断されたもの。
 * 一般公開ページでは"confirmed"の関連のみを確定情報として扱う。
 */
export type RelationStatus = "confirmed" | "suggested" | "rejected";

/**
 * 一般質問・質疑の要約1件（本会議での1人・1回分の発言）の確認状態。
 * "minutes-not-fetched"＝この発言の元になる公式会議録本文そのものを未取得（現在の初期状態）／
 * "source-unavailable"＝会議録本文は確認したが、対象議員の発言範囲を特定できない等で資料が不足／
 * "speaker-identification-pending"＝発言者を会議録上で確定できていない／
 * "question-answer-link-pending"＝質問項目と答弁の対応関係が未確定。
 */
export type SpeechSummaryStatus =
  | "verified"
  | "partially-verified"
  | "pending"
  | "source-unavailable"
  | "minutes-not-fetched"
  | "speaker-identification-pending"
  | "question-answer-link-pending";

/**
 * 要約の元になった資料の種別。
 * "official-minutes-html"＝会議録検索システムのHTML本文／"official-minutes-pdf"＝本会議録PDF／
 * "general-question-notice"＝一般質問通告書（予定項目のみ、実際の発言内容の確認資料ではない）／
 * "council-newsletter"＝市議会だより／"other-official-source"＝その他の公式資料。
 */
export type SpeechSourceType =
  | "official-minutes-html"
  | "official-minutes-pdf"
  | "general-question-notice"
  | "council-newsletter"
  | "other-official-source";

/** 本会議での発言区分。質問・質疑系と、討論等のその他区分を混同しない。 */
export type CouncilSpeechType =
  | "一般質問"
  | "代表質問"
  | "関連質問"
  | "総括質疑"
  | "議案質疑"
  | "討論"
  | "動議"
  | "議事進行"
  | "委員長報告"
  | "議案提出理由"
  | "その他";

/** 会議区分。将来、委員会質疑を追加できるよう区分だけ用意しておく。 */
export type CouncilSpeechMeetingType = "本会議" | "予算審査特別委員会" | "常任委員会" | "その他";

export type CouncilSpeechExchangeType = "question" | "answer" | "follow-up-question" | "follow-up-answer";

/** 一問一答等での、質問・答弁の1つのやり取り。全文ではなく要点のみを保持する。 */
export interface CouncilSpeechExchange {
  order: number;
  type: CouncilSpeechExchangeType;
  /** type="question"/"follow-up-question"の場合、既存議員データのmemberId。 */
  speakerId?: string;
  /** type="answer"/"follow-up-answer"の場合の答弁者名（例: "市長"）。会議録で確定できた場合のみ設定する。 */
  speakerName?: string;
  summary: string;
}

/** 質問内容と議案・予算・条例との関連候補。自動確定はせず、必ずRelationStatusを区別する。 */
export interface CouncilSpeechRelatedBill {
  /** 既存billVotesのid。 */
  billId: string;
  relationType: "explicit-reference" | "topic-match" | "budget-reference" | "other";
  relationStatus: RelationStatus;
  /** 関連付けの根拠（例: "質問本文で議案第12号に言及"）。 */
  evidence?: string;
  sourcePage?: number;
}

/** 要約の作成に使用した資料1件分。 */
export interface CouncilSpeechSummarySource {
  title: string;
  sourceType?: SpeechSourceType;
  sourceUrl?: string;
  filePath?: string;
  pageFrom?: number;
  pageTo?: number;
  /** 会議録内で対象議員の発言区間を特定する手がかり（ページ内見出し等）。 */
  speakerSection?: string;
}

/**
 * 質問と答弁の対応付けの確からしさ。
 * "confirmed"＝発言順が一致し、答弁者が質問内容へ明確に回答しており、原文位置も確認できる／
 * "partially-confirmed"＝対応関係はおおむね確認できるが、一部不明瞭な点がある／
 * "pending"＝対応関係を未確認／"ambiguous"＝答弁が複数の質問にまたがる等、対応を1つに
 * 確定できない（この場合、answerSummaryは無理に埋めない）。
 */
export type QuestionAnswerLinkStatus = "confirmed" | "partially-confirmed" | "pending" | "ambiguous";

/** 一般質問・質疑1回分の中の、質問項目1つ分。 */
export interface CouncilSpeechQuestionItem {
  id: string;
  title: string;
  /** 質問本文に記載された事実のみから作成する要約。推測・評価を含めない。 */
  questionSummary: string;
  /** 対応する答弁が会議録上で明確な場合のみ作成する要約。 */
  answerSummary: string;
  /** 答弁者名・役職（会議録で確認できた場合のみ）。 */
  answerers?: string[];
  questionAnswerLinkStatus: QuestionAnswerLinkStatus;
  exchanges: CouncilSpeechExchange[];
  relatedBills: CouncilSpeechRelatedBill[];
  relatedDocuments?: string[];
  /**
   * 質問の取り上げ方（原文で明確に確認できる場合のみ設定する。例:
   * "現状確認" "制度内容の確認" "予算・数値の確認" "実施時期の確認" "今後の方針の確認" "改善提案"
   * "事業導入の提案" "対応の要望" "課題の指摘" "再質問による追加確認"）。発言者の意図を
   * 推測して分類しない。未確認の場合は省略する。
   */
  questionApproach?: string;
  /**
   * 答弁の状態（原文で明確に確認できる場合のみ設定する。例: "実施済み" "実施中" "実施予定"
   * "検討中" "調査・研究" "関係機関と協議" "継続対応" "現時点では予定なし" "制度上対応困難"
   * "回答のみで方針不明" "質問との対応確認中"）。答弁の十分性を評価する表現は使わない。
   * 未確認の場合は省略する。
   */
  answerStatus?: string;
}

/**
 * 一般質問・質疑1回分（1議員・1会期・1本会議）のデータ。
 * questionItems・summarySourcesが空の場合は、summaryStatusが
 * "minutes-not-fetched"（会議録本文未取得）または"source-unavailable"（資料不足）である。
 */
export interface CouncilSpeech {
  id: string;
  memberId: string;
  sessionId: string;
  /** ISO形式。発言（本会議開催）日。未確定の場合はnull。 */
  date: string | null;
  meetingNumber?: string;
  meetingType: CouncilSpeechMeetingType;
  speechType: CouncilSpeechType;
  /** 「公開するかどうか」と「確認が済んでいるかどうか」は別軸で管理する（議案データと同じ方針）。 */
  isPublished: boolean;
  summaryStatus: SpeechSummaryStatus;
  /** 会議録・質問本文に明記された語句のみ（独自分類・タグ付けはしない）。 */
  topics: string[];
  shortSummary?: string;
  questionItems: CouncilSpeechQuestionItem[];
  summarySources: CouncilSpeechSummarySource[];
  /** ISO形式。人が公式会議録と照合した日時。未確認の場合はnull。 */
  verifiedAt?: string | null;
  verificationNote?: string;
  /** ISO形式。この発言データ（要約・exchanges等）を最後に生成・更新した日時。未設定の場合はnull。 */
  generatedAt?: string | null;
  /**
   * "previous"の場合、現議員任期（councilSpeechPeriod.from）より前の旧任期の発言であることを明示する
   * （継続して現職を務める議員の旧任期発言を、現職の既存memberIdへ追加する場合に使う。TASK-005系）。
   * 未設定は"current"と同義（既存データとの後方互換）。isFormerMember:trueのレコード内の発言には
   * 通常設定不要（レコード全体が旧任期扱いのため）。
   * 議会活動レーダーチャート等、現任期のみを対象とする集計は、この値が"previous"の発言を
   * 対象から除外すること（src/lib/activityRadar.tsの利用側で必ずフィルタする）。
   */
  term?: "current" | "previous";
}

/**
 * 質問テーマの大分類（固定辞書）。src/data/themes.jsonの1件分。
 * 会議録データ本体ではなく、テーマ分類のための参照データ。
 * 各質問へのテーマの割り当ては保存せず、topicsから常に計算する
 * （src/lib/themeClassification.ts）。
 */
export interface Theme {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** テーマ分類（キーワード一致）に使う語句。 */
  keywords: string[];
}

/**
 * 答弁者の役職区分。speakerName（自由記述、例: "市長"）から機械的に分類する計算結果であり、
 * データとして保存はしない。判別できない場合はunknownとする（勝手に推測しない）。
 */
export type AnswererRole =
  | "mayor"
  | "deputyMayor"
  | "superintendent"
  | "departmentDirector"
  | "sectionManager"
  | "otherExecutive"
  | "unknown";

/** 議員1名分の、一般質問・質疑の収録・解析状況とデータ本体。 */
export interface CouncilMemberSpeechRecord {
  memberId: string;
  /**
   * trueの場合、memberIdはformerMembers.jsonのIDであり、現議員任期より前（councilSpeechPeriod.from
   * より前）の発言も対象になり得る（旧任期一般質問アーカイブ、TASK-005系）。現職議員（members.json）の
   * レコードでは設定しない。
   */
  isFormerMember?: boolean;
  /** 解析対象とした期間。会議録本文を1件も取得・解析していない間はfrom/toともnull。 */
  analysisPeriod: { from: string | null; to: string | null };
  /** 現時点の収録範囲。将来、委員会質疑（"committee"）を追加できるようにしておく。 */
  scope: ("plenary" | "committee")[];
  analyzedSessionCount: number;
  sessionsWithSpeechCount: number;
  sessionsWithoutSpeechCount: number;
  unavailableSessionCount: number;
  /** 会議録本文そのものを未取得の会期数。現時点ではこの値が対象会期数と一致する。 */
  unfetchedSessionCount: number;
  /** ISO形式。null＝まだ一度も解析していない。 */
  lastAnalyzedAt: string | null;
  /** テーマ別の登場会期数（活動量の指標ではない旨を画面側で必ず併記する）。 */
  topicCounts: { topic: string; sessionCount: number }[];
  speeches: CouncilSpeech[];
}

/** src/data/councilSpeechSummaries.json 全体の形。 */
export interface CouncilSpeechSummaryData {
  version: number;
  /** ISO形式。このデータを最後に生成した日時。null＝まだ生成（会議録取得・解析）を実行していない。 */
  generatedAt: string | null;
  members: CouncilMemberSpeechRecord[];
}

/**
 * 議員1名分の「AIによる質問内容の分析」の確認状態。councilSpeechSummariesの
 * SpeechSummaryStatusとは別軸（分析結果そのものの確認状況）。
 * "insufficient-data"＝分析に必要なデータ（発言者確定・出典URL・質問要約等）が不足／
 * "not-analyzed"＝まだ分析処理を実行していない。
 */
export type MemberSpeechAnalysisStatus = "verified" | "partially-verified" | "pending" | "insufficient-data" | "not-analyzed";

/** 分析項目1件分（主なテーマ・継続テーマ・新規テーマで共通の形）。根拠となる発言IDを必ず保持する。 */
export interface MemberSpeechAnalysisTopicEvidence {
  label: string;
  /** 会議録本文・質問要約に基づく事実の記述のみ。評価・推測を含めない。 */
  statement: string;
  evidenceSpeechIds: string[];
  sessionIds: string[];
}

/** 質問形式・答弁状態の集計1件分。 */
export interface MemberSpeechAnalysisCount {
  label: string;
  count: number;
}

/**
 * 議員1名分の「AIによる質問内容の分析」。councilSpeechSummaries.jsonの
 * isPublished:trueの発言データから機械的に生成する（手入力しない）。
 */
export interface MemberSpeechAnalysis {
  memberId: string;
  analysisPeriod: { from: string; to: string | null };
  analyzedSessionCount: number;
  analysisStatus: MemberSpeechAnalysisStatus;
  /** ISO形式。null＝まだ生成していない。 */
  generatedAt: string | null;
  /** ISO形式。人による確認日。null＝未確認。 */
  verifiedAt: string | null;
  /** 300〜700字程度の概要文。データが少ない場合は無理に長文化しない。 */
  overview: string;
  mainTopics: MemberSpeechAnalysisTopicEvidence[];
  /** 異なる2会期以上で確認できたテーマのみ（同一会期内の複数質問は継続と扱わない）。 */
  recurringTopics: MemberSpeechAnalysisTopicEvidence[];
  /** 解析済み会期の中で新たに確認されたテーマ。未解析会期がある場合は断定表現を避ける。 */
  newTopics: MemberSpeechAnalysisTopicEvidence[];
  /** 原文で確認できる質問形式のみ（例: "現状確認" "改善提案"）。推測で分類しない。 */
  questionApproaches: MemberSpeechAnalysisCount[];
  /** 原文で確認できる答弁状態のみ（例: "検討中" "実施予定"）。答弁の良し悪しは評価しない。 */
  answerStatusCounts: MemberSpeechAnalysisCount[];
  evidenceSpeechIds: string[];
  /** 未解析会期・データ不足等、分析の限界を明記する文のリスト。 */
  limitations: string[];
}

/** src/data/memberSpeechAnalysis.json 全体の形。 */
export interface MemberSpeechAnalysisData {
  version: number;
  generatedAt: string | null;
  members: MemberSpeechAnalysis[];
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
  /** 市債の複数年度残高推移。公式資料で確認できるまでは未設定のままにする（推測しない）。 */
  debtBalanceTrend?: { fiscalYear: string; amountThousandYen: number; isEstimate: boolean }[];
  financialIndicators?: FinancialIndicatorsData;
  sources: FinanceSourceMeta[];
  notes: string;
}

/**
 * 政治資金収支報告書関連の型（TASK-015）。
 *
 * 【方針】政治資金規正法に基づき、政治団体が都道府県選挙管理委員会または総務省へ提出し、
 * 公表された収支報告書の内容を、確認できた範囲のみ転記する。独自の評価・ランキング・
 * 「多い/少ない」等の論評は加えない。未確認の金額は0円ではなくnullとして扱う。
 * 本タスク（TASK-015）では型・画面の設計のみを行い、実データの投入はTASK-016で別途行う。
 */

/** 政治団体の区分（政治資金規正法上の分類のうち、地方議員・首長に関係し得るもの）。 */
export type PoliticalFundOrganizationType = "資金管理団体" | "後援会" | "政党支部" | "その他の政治団体" | "確認中";

/** 収支報告書の提出先・公表元。 */
export type PoliticalFundDisclosureAuthority = "総務省" | "宮崎県選挙管理委員会" | "延岡市選挙管理委員会" | "確認中";

/**
 * 政治団体レコード全体の確認状況（TASK-016A）。
 * - confirmed：主要項目（代表者名を含む）を一次資料で確認済み。
 * - partiallyVerified：団体の実在・団体区分・提出先・関連人物は公式資料で確認できたが、
 *   代表者名等の一部項目は未確認（例：公表PDFが画像スキャンでテキスト抽出できない）。
 * - pending：団体の実在自体、公式な提出先での公表がまだ確認できていない（候補者本人サイト等のみ）。
 */
export type PoliticalFundOrganizationVerificationStatus = "confirmed" | "partiallyVerified" | "pending";

/** 政治団体1件分。members.json等と同様、IDは本ファイル内で一意とする。 */
export interface PoliticalFundOrganization {
  id: string;
  /** 政治団体の名称（収支報告書の記載どおり）。 */
  name: string;
  organizationType: PoliticalFundOrganizationType;
  /**
   * 代表者の氏名。収支報告書に記載の氏名をそのまま用いる。
   * 一次資料（画像PDF等）から確認できない場合はnull（推測値・placeholder文字列は入れない）。
   * 画面側はnullを「確認中」と表示する。
   */
  representativeName: string | null;
  /** 会計責任者の氏名。非公表・未確認の場合はnull。 */
  treasurerName: string | null;
  /** このレコードの確認状況。representativeName等がnullの場合、validate:dataはこの値を見てエラーか許容かを判定する。 */
  verificationStatus: PoliticalFundOrganizationVerificationStatus;
  /**
   * members.jsonまたはformerMembers.jsonのidへの参照。公式資料上で本人の団体と確認できた場合のみ設定する。
   * 同姓同名等により断定できない場合はnullのままにし、relatedPersonNameのみで補助表示する。
   */
  relatedMemberId: string | null;
  /** 関連する氏名の表示用補助（relatedMemberIdが未確定の場合の参考表示）。 */
  relatedPersonName: string | null;
  disclosureAuthority: PoliticalFundDisclosureAuthority;
  /** 選管・総務省が公表している政治団体一覧・収支報告書公表ページのURL。 */
  officialListUrl: string | null;
  /** ISO形式。サイト運営者がこの政治団体の情報をいつ確認したか。 */
  verifiedAt: string | null;
  /** 補足事項（任意）。 */
  notes: string | null;
}

/** 収入の内訳（政治資金規正法の収支報告書様式に準拠した主要区分）。単位は円。未確認の項目はnull。 */
export interface PoliticalFundIncomeBreakdown {
  /** 個人の負担する党費又は会費。 */
  membershipFees: number | null;
  /** 個人からの寄附。 */
  donationsFromIndividuals: number | null;
  /** 法人その他の団体からの寄附。 */
  donationsFromOrganizations: number | null;
  /** 政党匿名寄附を除く政治団体からの寄附。 */
  donationsFromPoliticalOrganizations: number | null;
  /** 機関紙誌の発行その他の事業による収入。 */
  businessIncome: number | null;
  /** 借入金。 */
  loans: number | null;
  /** 本部又は支部から供与された交付金。 */
  grantsFromHeadquartersOrBranches: number | null;
  /** その他の収入。 */
  other: number | null;
}

/** 支出の内訳（政治資金規正法の収支報告書様式に準拠した主要区分）。単位は円。未確認の項目はnull。 */
export interface PoliticalFundExpenditureBreakdown {
  /** 経常経費のうち人件費。 */
  personnelExpenses: number | null;
  /** 経常経費のうち光熱水費。 */
  utilityExpenses: number | null;
  /** 経常経費のうち備品・消耗品費。 */
  equipmentExpenses: number | null;
  /** 経常経費のうち事務所費。 */
  officeExpenses: number | null;
  /** 政治活動費のうち組織活動費。 */
  organizationActivityExpenses: number | null;
  /** 政治活動費のうち選挙関係費。 */
  electionExpenses: number | null;
  /** 政治活動費のうち機関紙誌の発行その他の事業費。 */
  publicationExpenses: number | null;
  /** 政治活動費のうち調査研究費。 */
  researchExpenses: number | null;
  /** 政治活動費のうち寄附・交付金。 */
  donationsAndGrantsPaid: number | null;
  /** その他の経費。 */
  other: number | null;
}

/** 収支報告書1件分の確認状況。 */
export type PoliticalFundReportStatus = "確認済み" | "確認中" | "情報未登録";

/** 政治団体1団体・1年分の収支報告書。 */
export interface PoliticalFundReport {
  id: string;
  /** PoliticalFundOrganization.id への参照。 */
  organizationId: string;
  /** 例: "令和6年分"。収支報告書の対象年（暦年）。 */
  fiscalYear: string;
  reportStatus: PoliticalFundReportStatus;
  /** 金額の単位。円と千円の混同を防ぐため、値ではなく型で固定する。 */
  amountUnit: "円";
  /** 前年繰越額。 */
  carriedOverFromPreviousYear: number | null;
  /** 本年収入額（前年繰越額を含まない、その年の収入のみ）。 */
  totalIncome: number | null;
  incomeBreakdown: PoliticalFundIncomeBreakdown | null;
  /** 本年支出額。 */
  totalExpenditure: number | null;
  expenditureBreakdown: PoliticalFundExpenditureBreakdown | null;
  /** 翌年繰越額。 */
  carriedOverToNextYear: number | null;
  /** 選管・総務省による公表日。 */
  publishedDate: string | null;
  /** 一次資料（収支報告書PDF等）のタイトル。 */
  sourceTitle: string | null;
  /** 一次資料（収支報告書PDF等）のURL。 */
  sourceUrl: string | null;
  /** ISO形式。サイト運営者がこの報告書をいつ確認したか。 */
  verifiedAt: string | null;
  /** 補足事項（任意）。収支報告書の様式変更・非公表項目の有無等。 */
  notes: string | null;
}

/** サイト内横断検索のインデックス区分。 */
export type SearchEntryType =
  | "member"
  | "former-member"
  | "mayor"
  | "promise"
  | "bill"
  | "policy"
  | "council-document"
  | "question"
  | "speech"
  | "compensation"
  | "finance"
  | "political-fund"
  | "committee"
  | "update"
  | "guide"
  | "press-conference"
  | "election"
  | "page";

/**
 * サイト内横断検索のインデックス1件分。ビルド時に既存JSONから自動生成する（scripts/generate-search-index.mjs）。
 * 手入力はしないこと。
 */
export interface SearchIndexEntry {
  /** 一意なID（例: "member-m01"）。生成スクリプトが`${type}-${元データのid}`の形式で付与する。 */
  id: string;
  type: SearchEntryType;
  title: string;
  description: string;
  url: string;
  keywords: string[];
  /** 画面には表示しないが検索マッチ対象に含める補足本文（プロフィール全文・質問項目など）。重み付けは低め。 */
  content?: string;
  /** ISO形式。新しい順・古い順の並び替えに使う日付（質問日・採決日・更新日など）。 */
  date?: string;
  /** 参照元データのID（例: members.jsonのid、billVotes.jsonのidなど）。validate:dataでの参照整合性チェックに使う。 */
  sourceId?: string;
  /** 西暦の会計年度（確認できるエントリのみ）。/searchの年度絞り込みに使う。 */
  fiscalYear?: number;
  /** 元データのverificationStatus（確認できるエントリのみ）。/searchの確認状況絞り込みに使う。 */
  verificationStatus?: string;
  /**
   * ルールベース（キーワード一致）で抽出したテーマ分類候補のラベル。外部AI APIは未使用。
   * 通常検索では対象にせず、利用者が「AI候補を含める」を選択した場合のみ検索対象に含める
   * （公式のkeywordsとは必ず分離する）。
   */
  aiCandidateKeywords?: string[];
}
