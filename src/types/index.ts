export type SNSPlatform =
  | "x"
  | "facebook"
  | "instagram"
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

export interface GeneralQuestion {
  id: string;
  date: string;
  /** e.g. "令和7年6月定例会" */
  session: string;
  title: string;
  summary?: string;
  videoUrl?: string;
}

export type VoteResult = "賛成" | "反対" | "棄権" | "欠席";

export interface BillVote {
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
  committees: string[];
  profile: string;
  profileUrl?: string;
  sns: SNSLink[];
  questions: GeneralQuestion[];
  votes: BillVote[];
  reports: ActivityReport[];
}

export interface Pledge {
  id: string;
  title: string;
  description: string;
  category?: string;
  status?: "実施済み" | "取組中" | "検討中";
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
