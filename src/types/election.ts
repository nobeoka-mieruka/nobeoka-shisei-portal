/**
 * 選挙結果データ（src/data/electionResults.json）の型。
 *
 * 既存の archiveMayorTerms.json（市長の任期・当選事実）・
 * archiveMemberTerms.json（現職議員の当選事実）とは別に、選挙そのもの
 * （定数・候補者数・候補者ごとの得票・当落・投票率等）を構造化して保持する。
 * 同じ当選の事実を重複登録するのではなく、archiveMayorTerms.json /
 * archiveMemberTerms.json 側から electionId で参照できるようにする想定
 * （今回のスコープでは参照フィールドの追加までは行っていない）。
 *
 * 推測順位・推定得票は登録しない。一次資料（延岡市選挙管理委員会公表の
 * 結果PDF）で確認できた値のみを構造化し、確認できていない項目は
 * nullのまま残す。
 */
export interface ElectionCandidate {
  name: string;
  nameKana: string | null;
  age: number | null;
  /** "無所属"等、資料の表記をそのまま使う。 */
  party: string | null;
  /** 現職／新人／元職。資料の表記が無い場合はnull。 */
  incumbencyStatus: string | null;
  /** 按分票を含む場合は小数のまま保持する（他候補との合計得票の按分等）。 */
  votes: number | null;
  elected: boolean;
  /** archiveMayorProfiles.json / archiveMemberProfiles.json / formerMembers.json の
   * いずれかのIDと一致する場合のみ設定する（本人特定が確実な場合のみ。推測で結び付けない）。 */
  linkedProfileId: string | null;
}

/**
 * 選挙結果の各項目がどこまで確認できているかを示すフラグ。
 * 1999年より前の選挙など、実施年月までは公式資料（延岡市公式年表等）で確認できても、
 * 候補者一覧・得票数・投票率までは確認できていない場合に使う。
 * このフィールド自体が無い（undefined）場合は、従来どおり全項目確認済みの選挙として扱う
 * （既存データの後方互換性のため）。
 */
export interface ElectionDataCompleteness {
  /** 選挙が実施されたこと自体（実施年月・当選者名など）が一次資料で確認できているか。 */
  electionConfirmed: boolean;
  /** candidates配列が完全な候補者一覧か（一部のみ・未確認ならfalse）。 */
  candidateListConfirmed: boolean;
  /** 候補者ごとの得票数が確認できているか。 */
  voteCountConfirmed: boolean;
  /** turnoutPercent等の投票率関連項目が確認できているか。 */
  turnoutConfirmed: boolean;
}

export interface ElectionResult {
  id: string;
  /** "延岡市長選挙" | "延岡市議会議員選挙" 等。 */
  electionName: string;
  electionType: "mayor" | "councilMember";
  /** ISO形式（electionDatePrecision="day"）または年月形式YYYY-MM（"month"）。投票日。 */
  electionDate: string;
  /** electionDateの精度。省略時は"day"（従来どおりの完全な日付）として扱う。 */
  electionDatePrecision?: "day" | "month";
  /** ISO形式。告示日。確認できない場合はnull。 */
  announcementDate: string | null;
  /** 一部項目が未確認の選挙（1999年より前等）でのみ設定する。省略時は全項目確認済み扱い。 */
  dataCompleteness?: ElectionDataCompleteness;
  /** 定数。確認できない場合はnull。 */
  seats: number | null;
  candidateCount: number | null;
  /** 有権者数。確認できない場合はnull。 */
  eligibleVoters: number | null;
  /** 投票者数。確認できない場合はnull。 */
  votersCount: number | null;
  /** 投票率（%）。確認できない場合はnull。 */
  turnoutPercent: number | null;
  /** 無効票数。確認できない場合はnull。 */
  invalidVotes: number | null;
  candidates: ElectionCandidate[];
  sourceRefs: {
    sourceUrl: string;
    sourceTitle: string;
    sourceOrganization: string;
    accessedAt: string;
    extractionMethod: "manual" | "pdf-extraction" | "official-api" | "other";
    verificationStatus: "verified" | "needsReview" | "partiallyVerified";
    notes?: string;
  }[];
  notes: string | null;
}
