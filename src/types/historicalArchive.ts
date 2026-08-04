/**
 * 「延岡市政アーカイブ」拡張（フェーズ1設計）の型定義案。
 *
 * このファイルはフェーズ1（調査・設計）の成果物であり、現時点ではどの画面・データからも
 * 使用していない（wiringしない）。既存の src/types/index.ts・src/data/*.json・
 * 既存コンポーネントは一切変更していない。実データ登録・画面実装はフェーズ2以降で行う。
 * 設計の背景・各フィールドの根拠は docs/historical-civic-data-plan.md を参照。
 */

export type ArchiveVerificationStatus = "verified" | "partiallyVerified" | "needsReview" | "sourceUnavailable";

/** 出典1件分。既存のSourceMetaより詳細な来歴（ページ番号・抽出方法等）を保持できるよう拡張している。 */
export interface ArchiveSourceRef {
  sourceUrl?: string;
  sourceTitle?: string;
  sourceOrganization?: string;
  /** ISO形式。資料の公表日。 */
  sourcePublishedDate?: string;
  /** ISO形式。資料の更新日。 */
  sourceUpdatedDate?: string;
  /** ISO形式。サイト運営者がこの資料にアクセスした日。 */
  accessedAt?: string;
  /** PDF内の該当ページ番号。 */
  pageNumber?: number;
  extractionMethod?: "manual" | "pdf-extraction" | "official-api" | "other";
  verificationStatus: ArchiveVerificationStatus;
  notes?: string;
}

export type ArchiveMemberStatus =
  | "current"
  | "former"
  | "resigned"
  | "lostOffice"
  | "deceased"
  | "termCompleted"
  | "unknown";

export type ArchiveRetirementReason = "任期満了" | "辞職" | "失職" | "市長選挙立候補" | "死去" | "不明";

/**
 * 現職議員（members.json）・元議員（formerMembers.json）を人物単位で束ねるインデックス層。
 * 既存2ファイルの実データを複製せず、legacyMemberId / legacyFormerMemberId で参照する。
 * 氏名の表記ゆれ・同姓同名対策のため、氏名そのものをidに使わない。
 */
export interface ArchiveMemberProfile {
  id: string;
  /** members.json側のid（現職として存在する場合のみ）。 */
  legacyMemberId?: string;
  /** formerMembers.json側のid（元議員として存在する場合のみ）。 */
  legacyFormerMemberId?: string;
  slug: string;
  name: string;
  nameKana?: string;
  alternateNames?: string[];
  status: ArchiveMemberStatus;
  currentMember: boolean;
  firstElectedDate?: string;
  termCount?: number;
  /** 公式資料で確認できる場合のみ設定する。推測で埋めない。 */
  retirementReason?: ArchiveRetirementReason;
  sourceRefs: ArchiveSourceRef[];
  lastVerifiedAt?: string;
}

export type ArchiveAffiliationType = "faction" | "party" | "committee" | "councilRole";

/**
 * 会派・政党・委員会・議会内役職の在籍履歴1件分。
 * endDate=nullは現在も継続中を意味する。会期時点の所属は
 * startDate <= 会期開始日 <= (endDate ?? 現在) で導出する。
 */
export interface ArchiveMemberAffiliation {
  id: string;
  memberProfileId: string;
  affiliationType: ArchiveAffiliationType;
  /** faction時はfactions.jsonのid、その他は委員会名・役職名のスラッグ。 */
  affiliationId: string;
  role?: string;
  startDate: string;
  endDate: string | null;
  sourceRef: ArchiveSourceRef;
}

/** 選挙単位の議員在籍期間。ArchiveMemberAffiliation（会派等）とは別軸で管理する。 */
export interface ArchiveMemberTerm {
  id: string;
  memberProfileId: string;
  electionDate?: string;
  termStart: string;
  termEnd: string | null;
  termNumber?: number;
  status: "elected" | "resigned" | "termCompleted" | "unknown";
  constituency?: string;
  sourceRefs: ArchiveSourceRef[];
}

/**
 * 歴代市長1名分。既存のMayor型（mayor.json、現職市長の公約・政策詳細）とは別管理とし、
 * 任期の事実関係のみを保持する。現職市長は isCurrentMayor: true とし、
 * 詳細プロフィールは既存 /mayor ページへ誘導する（二重管理を避ける）。
 */
export interface ArchiveMayor {
  id: string;
  slug: string;
  name: string;
  nameKana?: string;
  status: "current" | "former" | "deceased" | "unknown";
  profile?: string;
  manifestoSummary?: string;
  isCurrentMayor: boolean;
  sourceRefs: ArchiveSourceRef[];
  lastVerifiedAt?: string;
}

export interface ArchiveMayorTerm {
  id: string;
  mayorId: string;
  termStart: string;
  termEnd: string | null;
  termNumber?: number;
  electionDate?: string;
  /** 例: "通常選挙" "補欠選挙" "無投票"。公式資料で確認できた場合のみ設定する。 */
  electionType?: string;
  /** 就任当時人口。fiscalYearsとの重複を許容し、任期詳細ページ単体での表示用に保持する。 */
  populationAtStart?: number | null;
  /** 前任・後任市長。確認できた場合のみ設定する。 */
  previousMayorId?: string | null;
  nextMayorId?: string | null;
  sourceRefs: ArchiveSourceRef[];
}

/**
 * 市債残高は資料ごとに定義が異なるため、区分ごとに別フィールドで保持する。
 * 異なる定義の数値を同一グラフで直接比較しないこと（UI実装時の注意）。
 */
export interface ArchiveMunicipalBondBalance {
  /** 1. 一般会計の市債残高。 */
  generalAccountBondBalanceYen: number | null;
  /** 2. 普通会計の地方債残高。 */
  ordinaryAccountLocalBondBalanceYen: number | null;
  /** 3. 特別会計を含む残高。 */
  includingSpecialAccountsYen: number | null;
  /** 4. 企業会計を含む全会計残高。 */
  includingEnterpriseAccountsYen: number | null;
  /** 5. 市民一人当たり市債残高。 */
  perCapitaYen: number | null;
  /** 元資料の定義をそのまま記録する注記。異なる定義同士の比較を避けるために必須とする。 */
  definitionNote: string;
  sourceRefs: ArchiveSourceRef[];
}

export interface ArchiveFundBalance {
  totalYen: number | null;
  fiscalAdjustmentFundYen: number | null;
  /** 減債基金。財源調整用基金の定義に含まれ単独では確認できない場合はnullのまま、definitionNoteで補足する。 */
  bondRedemptionFundYen: number | null;
  otherSpecificPurposeFundsYen: number | null;
  perCapitaYen: number | null;
  /** 元資料の基金分類定義をそのまま記録する注記（例：どの基金を合算した数値か）。 */
  definitionNote?: string;
  sourceRefs: ArchiveSourceRef[];
}

/**
 * 人口・世帯数（Population型）。年度単位。元資料の基準日が会計年度末と一致しない場合が
 * あるため、referenceDateを必ず保持し、UI側で基準日のずれを明示する。
 */
export interface ArchivePopulation {
  /** 西暦の会計年度（4月始まり）。例: 2026 = 令和8年度。 */
  fiscalYear: number;
  population: number | null;
  households: number | null;
  /** 元資料の基準日（ISO）。会計年度末（3/31）と一致しない場合がある。 */
  referenceDate?: string;
  sourceRefs: ArchiveSourceRef[];
}

/**
 * 予算・決算規模（Budget型）。予算（当初・補正後）と決算は型レベルで別フィールドにし、
 * 混同しない。金額はすべて円（内部値）。未取得値は0にせず、必ずnullにする。
 */
export interface ArchiveBudget {
  fiscalYear: number;
  /** 一般会計当初予算。 */
  generalAccountInitialBudgetYen: number | null;
  /** 一般会計補正後（最終）予算。決算額ではない。 */
  generalAccountFinalBudgetYen: number | null;
  /** 一般会計決算。予算とは別の数値として扱う。 */
  generalAccountSettlementYen: number | null;
  specialAccountBudgetYen: number | null;
  enterpriseAccountBudgetYen: number | null;
  totalRevenueYen: number | null;
  totalExpenditureYen: number | null;
  localTaxRevenueYen: number | null;
  localAllocationTaxYen: number | null;
  nationalSubsidiesYen: number | null;
  prefecturalSubsidiesYen: number | null;
  sourceRefs: ArchiveSourceRef[];
  notes?: string;
}

/**
 * 市債（Debt型）。年度単位で、発行額（フロー）と残高（ストック、5区分）を分離する。
 * 残高の5区分は同一グラフで直接比較しないこと（ArchiveMunicipalBondBalance参照）。
 */
export interface ArchiveDebt {
  fiscalYear: number;
  /** 当該年度の市債発行額（予算計上額・決算額のいずれかはnotesで明記する）。残高ではない。 */
  municipalBondIssuanceYen: number | null;
  balance: ArchiveMunicipalBondBalance;
  notes?: string;
}

/**
 * 基金（Fund型）。年度単位。決算額か見込額かをisEstimateで区別する
 * （既存financeDashboard.jsonの「令和7年度末見込」のような扱いを踏襲）。
 */
export interface ArchiveFund {
  fiscalYear: number;
  /** true = 決算未確定の見込額、false/undefined = 決算額。 */
  isEstimate?: boolean;
  balance: ArchiveFundBalance;
  notes?: string;
}

/**
 * 財政健全化判断比率等（Finance型）。総務省の地方公共団体財政健全化法に基づき
 * 市が公表した指標のみを扱い、独自の評価・順位づけは行わない。
 */
export interface ArchiveFinance {
  fiscalYear: number;
  /** 実質公債費比率とは別の起債制限比率系指標がある場合のための単純な公債費負担率(%)。未確認ならnull。 */
  debtServiceRatioPercent: number | null;
  /** 実質公債費比率(%)。 */
  realDebtServiceRatioPercent: number | null;
  /** 将来負担比率(%)。 */
  futureBurdenRatioPercent: number | null;
  /** 経常収支比率(%)。 */
  currentAccountRatioPercent: number | null;
  /** 財政力指数。 */
  financialStrengthIndex: number | null;
  sourceRefs: ArchiveSourceRef[];
  notes?: string;
}

/**
 * 年度単位の財政データ全体（FiscalYear型）。Population/Budget/Debt/Fund/Financeを
 * 年度単位で束ねる。各サブ型が確認できていない年度はundefinedのまま欠落させ、
 * 0や架空値で埋めない。市長比較・年度比較・将来の政策比較の共通土台として使う。
 */
export interface ArchiveFiscalYear {
  /** 西暦の会計年度（4月始まり）。例: 2026 = 令和8年度。 */
  fiscalYear: number;
  mayorId?: string;
  mayorTermId?: string;
  population?: ArchivePopulation;
  budget?: ArchiveBudget;
  debt?: ArchiveDebt;
  fund?: ArchiveFund;
  finance?: ArchiveFinance;
  notes?: string;
  verifiedAt?: string;
}

export type ArchivePolicyOwnerType = "mayor" | "member" | "faction" | "city";

export type ArchivePolicySourceType =
  | "electionManifesto"
  | "policyDocument"
  | "councilQuestion"
  | "mayorPolicySpeech"
  | "budgetDocument"
  | "comprehensivePlan"
  | "officialStatement";

/**
 * 公式資料に基づく確認状態のみ。「達成」「未達成」は市が公式に進捗評価を公表している場合を除き
 * 使わない（独自判定の禁止）。
 */
export type ArchivePolicyStatus =
  | "proposed"
  | "planned"
  | "budgeted"
  | "started"
  | "ongoing"
  | "completed"
  | "changed"
  | "suspended"
  | "notVerified";

/**
 * AIによる分類・要約1件分。公式データ（summary・sourceOriginalText）とは必ず別フィールドで管理し、
 * 人による確認前（humanReviewed: false）は一般公開しない運用とする。
 */
export interface ArchiveAIGeneratedContent {
  text: string;
  generatedAt: string;
  model?: string;
  humanReviewed: boolean;
  humanReviewedAt?: string;
  humanReviewedBy?: string;
}

/**
 * 市長・議員・会派・市の政策1件分。出典のない政策は登録しないこと。
 * テーマ分類・比較は事実検索の補助であり、政治的評価・優劣判定を含めない。
 */
export interface ArchivePolicy {
  id: string;
  ownerType: ArchivePolicyOwnerType;
  ownerId: string;
  title: string;
  /** 公式資料からの引用・人による整理。AI生成ではない。 */
  summary: string;
  /** 公約集・議事録等からの原文全体。要約と切り離して必ず保持する。 */
  sourceOriginalText?: string;
  categoryIds: string[];
  announcedDate?: string;
  sourceType: ArchivePolicySourceType;
  sourceUrl?: string;
  sourceDocument?: string;
  status?: ArchivePolicyStatus;
  statusEvidenceUrl?: string;
  relatedFiscalYears?: number[];
  relatedProjects?: string[];
  /** 既存billVotes.jsonのid。公式資料で関連が確認できた場合のみ設定する。 */
  relatedBillVoteIds?: string[];
  /** 既存generalQuestions.jsonのid。公式資料で関連が確認できた場合のみ設定する。 */
  relatedQuestionIds?: string[];
  /** AIによる分類・要約。公式見解として表示しないこと。原文（sourceOriginalText）へのリンクを必ず併記する。 */
  aiAnalysis?: {
    aiSummary?: ArchiveAIGeneratedContent;
    aiCategoryLabels?: ArchiveAIGeneratedContent;
  };
  lastVerifiedAt?: string;
}
