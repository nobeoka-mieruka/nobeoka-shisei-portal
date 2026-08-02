import raw from "./councilSpeechPeriod.json";

/**
 * 会議録本文取得・AI要約・検索・SEO・サイトマップの対象期間（単一情報源）。
 * scripts/*.mjsからは同じJSON（src/config/councilSpeechPeriod.json）を直接readFileSyncで
 * 読み込むこと（このファイルはReact/TypeScript側専用のラッパー）。値を変更する場合は
 * councilSpeechPeriod.jsonの方を編集する（このファイル・.mjs側の両方に個別に値を持たせない）。
 */
export interface CouncilSpeechPeriod {
  /** ISO形式。この日付以降に開催された本会議のみを対象とする（延岡市議会議員選挙日）。 */
  from: string;
  /** ISO形式。nullの場合は最新の取得可能な公開会議録まで。 */
  to: string | null;
}

export const councilSpeechPeriod: CouncilSpeechPeriod = raw as CouncilSpeechPeriod;

/** 発言日（ISO形式）が対象期間に含まれるかどうか。日付未確認（null/undefined）はfalseとして扱う。 */
export function isWithinCouncilSpeechPeriod(dateIso: string | null | undefined): boolean {
  if (!dateIso) return false;
  const afterFrom = dateIso >= councilSpeechPeriod.from;
  const beforeTo = councilSpeechPeriod.to == null || dateIso <= councilSpeechPeriod.to;
  return afterFrom && beforeTo;
}
