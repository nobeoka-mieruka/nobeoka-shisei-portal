export type SNSPlatform =
  | "x"
  | "facebook"
  | "instagram"
  | "threads"
  | "youtube"
  | "line"
  | "blog"
  | "website";

export interface SNSLink {
  platform: SNSPlatform;
  url: string;
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
  | "記録なし";

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

export interface CouncilMember {
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
