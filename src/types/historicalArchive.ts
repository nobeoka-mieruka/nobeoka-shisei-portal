/**
 * 「延岡市政アーカイブ」拡張の型定義。
 *
 * 歴代市長（MayorDetailPage等）・元議員プロフィール（MemberFormerDetailPage等）で
 * 実データ・実画面から使用している。既存の src/types/index.ts・既存の
 * members.json/formerMembers.json 等とは legacyMemberId/legacyFormerMemberId 等の
 * 参照フィールドで対応付け、実データを複製しない。
 * 設計の背景・各フィールドの根拠は docs/historical-civic-data-plan.md を参照。
 */

import type { BillMemberVoteStatus, BillProposerType, BillVoteResult } from "./index";
import type { ArchiveSourceTrustLevel } from "./sourceTrust";

export type ArchiveVerificationStatus = "verified" | "partiallyVerified" | "needsReview" | "sourceUnavailable";

/**
 * 出典の信頼レベル。定義・区分の詳細は src/types/sourceTrust.ts を参照（Phase128で
 * src/types/index.ts側からも共有参照できるよう、この型自体はsourceTrust.tsへ移動し、
 * 既存の `import type { ArchiveSourceTrustLevel } from "./historicalArchive"` を壊さないため
 * ここでre-exportしている）。
 */
export type { ArchiveSourceTrustLevel };

/** 出典1件分。既存のSourceMetaより詳細な来歴（ページ番号・抽出方法等）を保持できるよう拡張している。 */
export interface ArchiveSourceRef {
  sourceUrl?: string;
  sourceTitle?: string;
  sourceOrganization?: string;
  /** この資料の種別・信頼レベル（任意、Phase122パイロット導入）。 */
  trustLevel?: ArchiveSourceTrustLevel;
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

export type ArchiveRetirementReason =
  | "任期満了"
  | "辞職"
  | "失職"
  | "市長選挙立候補"
  | "死去"
  | "選挙落選"
  | "合併・制度変更"
  | "職務代理終了"
  | "不明";

/** 日付の確認できた精度。dayでない場合、対応する日付フィールドは並び替え用の暫定アンカー（月初・年初）であり、事実として確定した日ではない。 */
export type ArchiveDatePrecision = "day" | "month" | "year";

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
  notes?: string;
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
  /** 旧字体・改姓・通称等、公式資料で確認できた別表記。氏名表記のゆれによる同一人物の重複登録を防ぐために使う。 */
  alternateNames?: string[];
  /** 公式資料で確認できた場合のみ設定する。推測で埋めない。 */
  birthDate?: string;
  deathDate?: string;
  birthplace?: string;
  status: "current" | "former" | "deceased" | "unknown";
  /** 経歴・出身・学歴・市長就任前後の職歴等の要約（原文引用ではなく事実の整理）。 */
  profile?: string;
  manifestoSummary?: string;
  isCurrentMayor: boolean;
  sourceRefs: ArchiveSourceRef[];
  /** 登録経緯・調査状況等、人による補足メモ。公式見解ではない。 */
  notes?: string;
  lastVerifiedAt?: string;
}

export interface ArchiveMayorTerm {
  id: string;
  mayorId: string;
  /** 精度がday未満（termStartPrecision参照）の場合、月初・年初日を並び替え用の暫定アンカーとして保持する（架空の就任日ではない）。 */
  termStart: string;
  /** termStartの確認できた精度。未設定はday（既存データとの後方互換）。 */
  termStartPrecision?: ArchiveDatePrecision;
  termEnd: string | null;
  /** termEndの確認できた精度。未設定はday（既存データとの後方互換）。termEndがnullの場合は無関係。 */
  termEndPrecision?: ArchiveDatePrecision;
  termNumber?: number;
  electionDate?: string;
  /** 例: "通常選挙" "補欠選挙" "無投票"。公式資料で確認できた場合のみ設定する。 */
  electionType?: string;
  /** 退任理由。公式資料で確認できた場合のみ設定する。任期満了と選挙落選を混同しないこと。 */
  retirementReason?: ArchiveRetirementReason;
  /** 公選の市長本人か職務代理者かの区別。未設定はelected（既存データとの後方互換）。 */
  mayorRole?: "elected" | "acting" | "temporaryActing";
  /** 就任当時人口。fiscalYearsとの重複を許容し、任期詳細ページ単体での表示用に保持する。 */
  populationAtStart?: number | null;
  /** 前任・後任市長。確認できた場合のみ設定する。 */
  previousMayorId?: string | null;
  nextMayorId?: string | null;
  sourceRefs: ArchiveSourceRef[];
  /** 不自然な任期間隔の理由等、人による補足メモ。公式見解ではない。 */
  notes?: string;
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
  /**
   * 財政調整基金単体（総務省統一様式「財政状況資料集」の区分）。上記fiscalAdjustmentFundYen
   * （財政調整積立基金・地域づくり推進事業基金・退職手当基金・減債基金の広義合計、
   * financeDashboard.jsonの定義）とは別の数値であり、混同しないこと。
   */
  fiscalReserveFundYen: number | null;
  /** 減債基金。延岡市公表の財政状況資料集で単独確認できる年度はこの値を用いる。確認できない年度はnullのまま、definitionNoteで補足する。 */
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

/** municipalBondIssuanceYenが決算額・当初予算額・補正後予算額のいずれかを明示する（区分不明な予算額は"budget"）。 */
export type MunicipalBondIssuanceValueType = "settlement" | "initialBudget" | "revisedBudget" | "budget";

/**
 * municipalBondIssuanceYenの確認状況。値がnullの場合も含め、なぜnull／確定なのかを必ず区別する
 * （「未確認」を「0件」や「決算確認済み」と混同しないため）。
 * - settlementConfirmed: 決算額が一次資料で確認できた
 * - budgetOnly: 予算額（当初・補正後・区分未特定）のみ確認できた。決算額ではない
 * - sourcePendingPublication: 決算資料等の一次資料自体がまだ公表されていない
 * - sourceFoundValueUnextracted: 一次資料（PDF等）は所在を確認できたが、値を安全に抽出できていない
 * - unconfirmed: 一次資料の所在すら確認できていない
 */
export type MunicipalBondIssuanceStatus =
  | "settlementConfirmed"
  | "budgetOnly"
  | "sourcePendingPublication"
  | "sourceFoundValueUnextracted"
  | "unconfirmed";

/**
 * 市債（Debt型）。年度単位で、発行額（フロー）と残高（ストック、5区分）を分離する。
 * 残高の5区分は同一グラフで直接比較しないこと（ArchiveMunicipalBondBalance参照）。
 */
export interface ArchiveDebt {
  fiscalYear: number;
  /** 当該年度の市債発行額（フロー）。残高（ストック）ではない。値の性質はmunicipalBondIssuanceValueTypeで、確認状況はmunicipalBondIssuanceStatusで区別する。 */
  municipalBondIssuanceYen: number | null;
  /** municipalBondIssuanceYenが非nullの場合のみ設定する。 */
  municipalBondIssuanceValueType?: MunicipalBondIssuanceValueType;
  municipalBondIssuanceStatus: MunicipalBondIssuanceStatus;
  /** municipalBondIssuanceYenの根拠資料。balance.sourceRefs（残高の根拠資料）とは別に管理する（発行額と残高で出典資料が異なることが多いため）。 */
  municipalBondIssuanceSourceRefs: ArchiveSourceRef[];
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

export type ArchivePolicyOwnerType = "mayor" | "member" | "formerMember" | "faction" | "city";

export type ArchivePolicySourceType =
  | "electionManifesto"
  | "policyDocument"
  | "councilQuestion"
  | "mayorPolicySpeech"
  | "budgetDocument"
  | "settlementDocument"
  | "comprehensivePlan"
  | "ordinance"
  | "bill"
  | "officialStatement"
  | "otherOfficialSource";

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
 * 政策テーマの分類マスタ。固定ラベルではなくJSON管理とし、将来テーマを追加できるようにする。
 * フェーズ8以降は政策以外のアーカイブ（議案・条例・請願・陳情等）を横断する共通テーママスタ
 * としても利用する（新規のテーマ体系は作らず、これを正本として参照する）。
 */
export interface ArchivePolicyCategory {
  id: string;
  label: string;
  description?: string;
  /** ルールベース分類（キーワード一致）に使う同義語・関連語。未設定の場合はlabelのみで一致判定する。 */
  keywords?: string[];
}

/**
 * 市長・議員・元議員・会派・市の政策1件分。出典のない政策は登録しないこと。
 * テーマ分類・比較は事実検索の補助であり、政治的評価・優劣判定を含めない。
 */
export interface ArchivePolicy {
  id: string;
  slug: string;
  ownerType: ArchivePolicyOwnerType;
  /** ownerType=cityの場合は特定の主体に紐づかないため設定しない。 */
  ownerId?: string;
  title: string;
  /** 公式資料からの引用・人による整理。AI生成ではない。 */
  summary: string;
  /** 公約集・議事録等からの原文全体。要約と切り離して必ず保持する。 */
  sourceOriginalText?: string;
  categoryIds: string[];
  announcedDate?: string;
  sourceType: ArchivePolicySourceType;
  sourceRefs: ArchiveSourceRef[];
  status?: ArchivePolicyStatus;
  statusEvidenceUrl?: string;
  relatedFiscalYears?: number[];
  relatedProjects?: string[];
  /** 既存billVotes.jsonのid。公式資料で関連が確認できた場合のみ設定する。 */
  relatedBillVoteIds?: string[];
  /** 条例ID（フェーズ7で追加予定のArchiveOrdinance想定）。現時点では未使用。 */
  relatedOrdinanceIds?: string[];
  /** 既存generalQuestions.jsonのid。公式資料で関連が確認できた場合のみ設定する。 */
  relatedQuestionIds?: string[];
  /** 予算関連ID（将来の予算項目単位の想定）。現時点では未使用。 */
  relatedBudgetIds?: string[];
  /** 登録経緯・移行元データ等、人による補足メモ。公式見解ではない。 */
  notes?: string;
  /** AIによる分類・要約。公式見解として表示しないこと。原文（sourceOriginalText）へのリンクを必ず併記する。 */
  aiAnalysis?: {
    aiSummary?: ArchiveAIGeneratedContent;
    aiCategoryLabels?: ArchiveAIGeneratedContent;
  };
  lastVerifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ArchivePolicyQuestionRelationType =
  | "proposedInQuestion"
  | "discussedInQuestion"
  | "requestedInQuestion"
  | "answeredByCity"
  | "relatedTheme"
  | "needsReview";

/** 政策と一般質問の関連付け1件分。AIによる自動関連付けは候補（needsReview）のまま確定データと分離する。 */
export interface ArchivePolicyQuestionRelation {
  id: string;
  policyId: string;
  /** 既存generalQuestions.jsonのid。 */
  questionId: string;
  relationType: ArchivePolicyQuestionRelationType;
  sourceRef?: ArchiveSourceRef;
  verificationStatus: ArchiveVerificationStatus;
}

export type ArchivePolicyFiscalRelationType =
  | "proposed"
  | "budgeted"
  | "includedInProject"
  | "settled"
  | "related"
  | "needsReview";

/**
 * 政策と財政データ（年度別）の関連付け1件分。政策と財政数値を直接同一視せず、
 * 年度・relationTypeごとに明示的に管理する。
 */
export interface ArchivePolicyFiscalRelation {
  id: string;
  policyId: string;
  fiscalYear: number;
  budgetId?: string;
  projectId?: string;
  relationType: ArchivePolicyFiscalRelationType;
  amountYen?: number | null;
  amountDefinition?: string;
  sourceRef?: ArchiveSourceRef;
  verificationStatus: ArchiveVerificationStatus;
}

// ===== フェーズ7：議案・条例・請願・陳情アーカイブ =====
//
// 議員別の賛否・議決結果・出典PDFは既存 src/data/billVotes.json（BillVoteItem）が
// すでに広くカバーしているため、ここでは複製しない。既存レコードがある場合は
// ArchiveCouncilDocument.existingBillVoteId で参照し（歴代市長・元議員アーカイブと同じ
// 「複製せず参照する」パターン）、既存データに無い部分（条例の制定区分・施行日・公布日・
// 現行/失効、請願・陳情の広い審査ステータス、政策・予算年度との関連付け）のみを追加する。

export type ArchiveCouncilDocumentType = "bill" | "ordinance" | "petition" | "request";

/** 案件の進行状況。「結果（result）」とは別軸で、審査の段階そのものを表す。 */
export type ArchiveCouncilDocumentStatus =
  | "submitted" // 提出
  | "accepted" // 受理
  | "referred" // 委員会付託
  | "continuedReview" // 継続審査
  | "decided" // 議決・審査確定
  | "withdrawn" // 取下げ
  | "unresolved"; // 審議未了

/**
 * 請願・陳情の審査結果。既存BillVoteResultより広い区分（提出・受理・付託・審議未了等）を扱う。
 * 議案・条例は既存BillVoteResult（原案可決・否決等）をそのまま使う。
 */
export type ArchivePetitionOutcome =
  | "submitted"
  | "accepted"
  | "referred"
  | "continuedReview"
  | "adopted"
  | "partiallyAdopted"
  | "rejected"
  | "withdrawn"
  | "unresolved"
  | "sourceUnavailable";

export type ArchiveCouncilDocumentResult = BillVoteResult | ArchivePetitionOutcome;

export type ArchiveOrdinanceRevisionType = "enactment" | "fullRevision" | "partialRevision" | "repeal";

/** 条例の現在の効力状態。現行例規集との突合ができていない場合は必ず"unknown"のままにする。 */
export type ArchiveOrdinanceEffectStatus = "inForce" | "expired" | "unknown";

/**
 * 議員別賛否の区分。既存BillMemberVoteStatus（8区分）をそのまま再利用し、
 * 「資料未確認」のみアーカイブ層で追加する（既存billVotes.jsonの型・データは変更しない）。
 */
export type ArchiveCouncilVoteStatus = BillMemberVoteStatus | "sourceUnavailable";

/** 議員別賛否1件分。existingBillVoteIdが設定されている場合は使用しない（billVotes.json側を正とする）。 */
export interface ArchiveCouncilVote {
  memberId: string;
  vote: ArchiveCouncilVoteStatus;
}

/** 条例の改正履歴1件分。確認できない改正は登録せず、確認できた範囲のみ追加する。 */
export interface ArchiveOrdinanceRevisionHistoryEntry {
  date?: string;
  description: string;
  /** 改正を行った議案・条例のarchiveCouncilDocuments.json上のid（確認できた場合のみ）。 */
  relatedDocumentId?: string;
  sourceRef?: ArchiveSourceRef;
  verificationStatus: ArchiveVerificationStatus;
}

/** 議案（一般）固有の追加情報。現状は最小限とし、詳細は既存billVotes.jsonに委ねる。 */
export interface ArchiveBillDetail {
  /** 既存BillCategoryのラベルを表示用にそのまま保持する（参照整合性はexistingBillVoteId経由）。 */
  billCategory?: string;
}

export interface ArchiveOrdinanceDetail {
  revisionType: ArchiveOrdinanceRevisionType;
  /** 現行例規集との突合ができるまでは"unknown"のままにする（推測しない）。 */
  effectStatus: ArchiveOrdinanceEffectStatus;
  /** 公布日。確認できた場合のみ設定する。 */
  promulgationDate?: string;
  /** 施行日。確認できた場合のみ設定する。 */
  enforcementDate?: string;
  relatedOrdinanceDocumentIds?: string[];
  /** 改正履歴。確認できない場合は空配列のままにし、推測で埋めない。 */
  revisionHistory?: ArchiveOrdinanceRevisionHistoryEntry[];
}

/**
 * 請願固有の追加情報。請願者が私人の場合、公式サイトで公開されている範囲を超えて
 * 氏名・住所等は保存しない（petitionerCategoryは「地域団体」「市民個人」等の区分のみ）。
 */
export interface ArchivePetitionDetail {
  petitionerCategory?: string;
  /** 紹介議員（請願は原則必要、公式資料で確認できた場合のみ）。 */
  introducerMemberIds?: string[];
  committeeReferral?: string;
}

/** 陳情固有の追加情報。陳情は紹介議員を要しないためintroducerMemberIdsを持たない。 */
export interface ArchiveRequestDetail {
  petitionerCategory?: string;
  committeeReferral?: string;
}

/**
 * documentTypeごとの詳細情報を discriminated union として表した型。
 * 実データ（ArchiveCouncilDocument）ではdocumentTypeに応じたoptionalフィールド
 * （ordinanceDetail/petitionDetail/requestDetail）として直接保持するため、この型は
 * 将来ジェネリックに「その文書の詳細情報」を1つの値として扱いたい場合の補助定義として用意する。
 */
export type ArchiveCouncilDocumentDetail =
  | ({ documentType: "bill" } & ArchiveBillDetail)
  | ({ documentType: "ordinance" } & ArchiveOrdinanceDetail)
  | ({ documentType: "petition" } & ArchivePetitionDetail)
  | ({ documentType: "request" } & ArchiveRequestDetail);

/** 議決・審査結果1件分。ArchiveCouncilDocument本体のdecisionDate/resultの根拠を出典付きで補足する。 */
export interface ArchiveCouncilDecision {
  decisionDate?: string;
  result?: ArchiveCouncilDocumentResult;
  committeeId?: string;
  verificationStatus: ArchiveVerificationStatus;
  sourceRef?: ArchiveSourceRef;
}

export type ArchiveCouncilRelationType = "member" | "mayor" | "policy" | "question" | "budget" | "document";

/**
 * 議案・条例・請願・陳情と、議員・市長・政策・一般質問・予算・他の文書との関連付け1件分。
 * ArchivePolicyQuestionRelation等と同様、AIによる自動関連付けは候補（needsReview）のまま
 * 確定データと分離する。
 */
export interface ArchiveCouncilRelation {
  id: string;
  documentId: string;
  relationType: ArchiveCouncilRelationType;
  /** relationTypeに応じた相手側のid（members.json/archiveMayors.json/archivePolicies.json/
   * generalQuestions.json/archiveFiscalYears.json（年度）/archiveCouncilDocuments.jsonのいずれか）。 */
  targetId: string;
  sourceRef?: ArchiveSourceRef;
  verificationStatus: ArchiveVerificationStatus;
  notes?: string;
}

/**
 * 議案・条例・請願・陳情アーカイブ1件分。出典のないデータは登録しないこと。
 * 議員別賛否・議決結果・出典PDF等、既存billVotes.jsonにすでにある情報は
 * existingBillVoteIdで参照し、このファイルには重複登録しない。
 */
export interface ArchiveCouncilDocument {
  id: string;
  slug: string;
  documentType: ArchiveCouncilDocumentType;
  title: string;
  summary: string;
  /** 例："請願第1号"。 */
  number?: string;
  /** 西暦の会計年度。 */
  fiscalYear: number;
  sessionId?: string;
  meetingDate?: string;
  submittedDate?: string;
  decisionDate?: string;
  proposerType?: BillProposerType;
  proposerIds?: string[];
  status?: ArchiveCouncilDocumentStatus;
  result?: ArchiveCouncilDocumentResult;
  committeeId?: string;
  relatedMemberIds?: string[];
  relatedMayorIds?: string[];
  relatedPolicyIds?: string[];
  relatedQuestionIds?: string[];
  relatedBudgetIds?: string[];
  relatedFiscalYears?: number[];
  sourceRefs: ArchiveSourceRef[];
  verificationStatus: ArchiveVerificationStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  /** 既存billVotes.jsonの対応レコードid。設定されている場合、議決結果・議員別賛否・
   * 出典PDFはそちらを正とし、このファイルには重複登録しない。 */
  existingBillVoteId?: string;
  /** existingBillVoteIdが未設定の場合のみ使用する議員別賛否。 */
  voteEntries?: ArchiveCouncilVote[];
  billDetail?: ArchiveBillDetail;
  ordinanceDetail?: ArchiveOrdinanceDetail;
  petitionDetail?: ArchivePetitionDetail;
  requestDetail?: ArchiveRequestDetail;
}

// ===== フェーズ8：横断検索・テーマ検索の基盤 =====
//
// 今回のフェーズでは外部AI APIを一切呼び出していない。AI要約・AI分類は型・保存構造・
// 表示区分・管理フローのみを用意し、実データは0件（archiveAiSummaries.json）または
// 既存キーワード辞書によるルールベース判定の候補のみ（method="keywordMatch"、
// 架空のAI生成データではない）とする。確定データ（confirmed*）と候補
// （candidate、AI/ルールベース）は型レベルで必ず分離し、人が確認するまで
// 確定情報として公開表示しない。

/**
 * 横断検索ドキュメントの種別。既存の documentType 命名（bill/ordinance/petition/request/policy等、
 * フェーズ6・7で確立済み）と衝突しないよう、既存命名をそのまま再利用している。
 */
export type ArchiveSearchDocumentType =
  | "councilQuestion"
  | "councilTranscript"
  | "questionNotice"
  | "mayorAnswer"
  | "bill"
  | "billVote"
  | "ordinance"
  | "petition"
  | "request"
  | "policy"
  | "budget"
  | "settlement"
  | "debt"
  | "fund"
  | "population"
  | "mayor"
  | "member"
  | "formerMember"
  | "faction"
  | "committee"
  | "comprehensivePlan"
  | "policySpeech"
  | "statistics";

/**
 * 横断検索の共通ドキュメント型。既存の検索インデックス（SearchIndexEntry・searchIndex.json、
 * src/lib/search.ts）はそのまま維持し、この型は「テーマ横断表示・人物別横断表示」等の
 * フェーズ8新規機能が使う、より詳細な関連付け情報を持つ拡張レイヤーとして位置づける
 * （既存 /search を壊さないための段階的統合方針）。
 */
export interface ArchiveSearchDocument {
  id: string;
  documentType: ArchiveSearchDocumentType;
  /** 元データ（既存JSON。billVotes.json/archivePolicies.json等）側のid。 */
  sourceEntityId: string;
  slug?: string;
  title: string;
  /** 公式資料からの引用・要約本文。AI生成ではない。 */
  body: string;
  /** 人が確認した要約（あれば）。AI要約（aiSummary）とは必ず別フィールドで管理する。 */
  confirmedSummary?: string;
  /** AIによる要約。公式データとして扱わず、原文（body）へのリンクを必ず併記する。 */
  aiSummary?: string;
  keywords: string[];
  /** 人が確認したテーマ分類（archivePolicyCategories.jsonのid、共通テーママスタ）。 */
  confirmedCategoryIds: string[];
  /** ルールベース・AIによる分類候補（未確定）。confirmedCategoryIdsとは必ず分離する。 */
  aiCategoryCandidates?: string[];
  personIds?: string[];
  memberIds?: string[];
  formerMemberIds?: string[];
  mayorIds?: string[];
  factionIds?: string[];
  committeeIds?: string[];
  fiscalYears?: number[];
  sessionIds?: string[];
  meetingIds?: string[];
  relatedEntityIds?: string[];
  sourceRefs: ArchiveSourceRef[];
  publishedDate?: string;
  updatedDate?: string;
  verificationStatus: ArchiveVerificationStatus;
  /** AI生成情報（aiSummary/aiCategoryCandidates）自体の確認状況。公式データのverificationStatusとは別軸。 */
  aiVerificationStatus?: "notReviewed" | "needsReview" | "reviewed" | "rejected";
  /** ビルド時にこのドキュメントを検索インデックスへ反映した日時（ISO）。 */
  indexedAt?: string;
}

export type ArchiveRelationType =
  | "sameTheme"
  | "relatedQuestion"
  | "relatedAnswer"
  | "relatedPolicy"
  | "relatedBill"
  | "relatedOrdinance"
  | "relatedBudget"
  | "relatedPerson"
  | "sameFiscalYear"
  | "possibleDuplicate"
  | "needsReview";

/** ruleBased/keywordMatchはキーワード辞書による機械的な一致判定。aiCandidateは外部AI APIによる候補（今回は未使用）。 */
export type ArchiveRelationMethod = "explicitReference" | "ruleBased" | "keywordMatch" | "manual" | "aiCandidate";

export type ArchiveCandidateStatus = "candidate" | "confirmed" | "rejected" | "needsReview";

/**
 * 異なるアーカイブ間（一般質問・政策・議案等）の関連候補1件分。
 * AIまたはルールベースで生成した関連はstatus="candidate"のまま保存し、
 * 人が確認するまで確定関連として公開表示しない。
 */
export interface ArchiveRelationCandidate {
  id: string;
  sourceEntityType: ArchiveSearchDocumentType;
  sourceEntityId: string;
  targetEntityType: ArchiveSearchDocumentType;
  targetEntityId: string;
  relationType: ArchiveRelationType;
  /** 0〜1の確信度。ruleBased/keywordMatchの場合はキーワード一致度から機械的に算出する。 */
  confidence: number;
  method: ArchiveRelationMethod;
  reason?: string;
  /** 一致根拠となった原文の抜粋（キーワード一致箇所等）。 */
  evidenceText?: string;
  status: ArchiveCandidateStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

/**
 * AIによる要約1件分。フェーズ8では外部AI APIを呼び出していないため、実データは
 * 0件（型・保存構造のみ用意）。将来生成する場合も、原文が変わった場合に既存要約を
 * 「再確認が必要」と判定できるよう、生成時点の原文ハッシュ（sourceTextHash）を必須にする。
 */
export interface ArchiveAiSummary {
  id: string;
  sourceEntityType: ArchiveSearchDocumentType;
  sourceEntityId: string;
  summary: string;
  keyPoints?: string[];
  generatedAt: string;
  model: string;
  promptVersion?: string;
  /** 生成時点の原文のハッシュ値。再計算したハッシュと一致しない場合は再確認が必要と判定する。 */
  sourceTextHash: string;
  verificationStatus: ArchiveCandidateStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  revisionHistory?: { summary: string; generatedAt: string; model: string }[];
}

/**
 * ルールベース（キーワード一致）またはAIによるテーマ分類候補1件分。
 * ArchiveSearchDocument.confirmedCategoryIds（人が確認した分類）とは必ず分離する。
 */
export interface ArchiveAiCategoryCandidate {
  id: string;
  sourceEntityType: ArchiveSearchDocumentType;
  sourceEntityId: string;
  /** archivePolicyCategories.jsonのid（共通テーママスタ）。 */
  categoryId: string;
  confidence: number;
  reason?: string;
  evidenceText?: string;
  generatedAt: string;
  status: ArchiveCandidateStatus;
}

// ===== フェーズ10C：AI処理ジョブキュー・固有表現候補 =====
//
// 自動巡回（フェーズ10A・10B）が検出した新規・更新資料のうち、どれを（再）処理すべきかを
// 追跡するための実行管理層。ArchiveAiSummary・ArchiveAiCategoryCandidate・
// ArchiveRelationCandidateは「生成された結果」を保持する型であり、ArchiveAiJobは
// 「その結果をいつ・どの原文（sourceTextHash）に対して生成すべきか／したか」という
// 実行状態だけを持つ（結果の実体は複製せず、resultIdで参照する）。

export type ArchiveAiJobType = "summary" | "categoryClassification" | "relationCandidate" | "entityExtraction";

export type ArchiveAiJobStatus = "pending" | "processing" | "completed" | "failed" | "skipped" | "needsReview";

/**
 * AI処理ジョブ1件分。同一(sourceEntityId, jobType, sourceTextHash)の組み合わせでは
 * 重複したジョブを作らない（原文が変わらない限り再生成しない）。
 */
export interface ArchiveAiJob {
  id: string;
  sourceEntityType: ArchiveSearchDocumentType;
  sourceEntityId: string;
  jobType: ArchiveAiJobType;
  /** ジョブ作成時点の原文のハッシュ値（SHA-256）。原文が変われば新しいジョブになる。 */
  sourceTextHash: string;
  status: ArchiveAiJobStatus;
  /** 数値が小さいほど優先。既定は0。 */
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  /** 完了時、生成された結果のid（archiveAiSummaries.json・archiveAiCategoryCandidates.json・
   * archiveRelationCandidates.json・archiveEntityExtractionCandidates.jsonのいずれか）。 */
  resultId?: string;
  /** 結果（resultId先）の確認状況のコピー。要確認キュー集計を高速化するための非正規化フィールド。 */
  verificationStatus?: ArchiveCandidateStatus;
}

/**
 * 本文中の人物・固有表現の抽出候補1件分。既存マスタ（現職議員・元議員・市長・会派・委員会）に
 * 一致した場合のみcandidateIdsへ実在するIDを入れる。一致しない場合はrawNameのみを保持し、
 * 推測でIDを割り当てない（needsReview=trueのまま人による確認を待つ）。
 */
export interface ArchiveEntityExtractionCandidate {
  id: string;
  sourceEntityType: ArchiveSearchDocumentType;
  sourceEntityId: string;
  /** 原文に出現した表記そのまま。 */
  rawName: string;
  /** 既存マスタ側のID（member/formerMember/mayor/faction/committee等）。一致が無ければ空配列。 */
  candidateIds: string[];
  needsReview: boolean;
  method: ArchiveRelationMethod;
  generatedAt: string;
  status: ArchiveCandidateStatus;
}
