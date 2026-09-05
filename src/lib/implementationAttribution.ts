/**
 * Phase230-231：実施主体の注記（ImplementationAttribution）を市民向けの日本語へ変換する。
 *
 * 表示の原則：
 * ・内部コード（miyazakiPrefecture 等）は画面に出さない。
 * ・色ではなく文字で「誰の事業か」を伝える。
 * ・注記が無い出来事について「延岡市の事業」と断定しない（未設定＝確認中）。
 * ・「延岡市で開催された」ことと「延岡市の事業である」ことを混同させない文言にする。
 */
import type {
  ImplementationAttribution,
  ImplementationScope,
  ImplementingBody,
  NobeokaRelation,
} from "../types";

export const IMPLEMENTING_BODY_LABEL: Record<ImplementingBody, string> = {
  nobeokaCity: "延岡市",
  miyazakiPrefecture: "宮崎県",
  nationalGovernment: "国",
  cityPrefectureJoint: "延岡市と宮崎県の共同",
  wideAreaUnion: "複数の自治体で構成する団体",
  other: "延岡市・宮崎県・国以外の団体",
};

export const IMPLEMENTATION_SCOPE_LABEL: Record<ImplementationScope, string> = {
  nobeokaCity: "延岡市",
  northernMiyazaki: "県北（延岡市を含む地域）",
  miyazakiPrefecture: "宮崎県全域",
  national: "全国",
  other: "その他",
};

export const NOBEOKA_RELATION_LABEL: Record<NobeokaRelation, string> = {
  cityProject: "延岡市の事業",
  prefecturalProjectInNobeoka: "宮崎県の事業を延岡市で実施",
  cityPrefectureJoint: "延岡市と宮崎県の共同実施",
  nobeokaParticipant: "延岡市が参加（主催・実施主体ではありません）",
  nobeokaBeneficiary: "延岡市民が対象",
  relatedOnly: "延岡市域での出来事（延岡市は実施主体ではありません）",
};

/** 画面に並べる「項目名：値」の組。値が確認できていない項目は含めない。 */
export interface ImplementationAttributionLine {
  label: string;
  value: string;
}

export function implementationAttributionLines(attribution: ImplementationAttribution): ImplementationAttributionLine[] {
  const lines: ImplementationAttributionLine[] = [
    { label: "実施主体", value: IMPLEMENTING_BODY_LABEL[attribution.implementingBody] },
  ];
  if (attribution.implementationScope) {
    lines.push({ label: "対象地域", value: IMPLEMENTATION_SCOPE_LABEL[attribution.implementationScope] });
  }
  lines.push({ label: "延岡市との関係", value: NOBEOKA_RELATION_LABEL[attribution.nobeokaRelation] });
  return lines;
}
