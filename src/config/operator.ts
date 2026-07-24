/**
 * 運営者情報の設定ファイル。
 *
 * ここに入力した値だけが /about ページや構造化データ（Organization）に反映される。
 * 未入力（undefined）の項目は、画面上に「未設定」「準備中」等を表示せず、
 * 項目そのものを非表示にする（src/lib/organization.ts, src/pages/AboutPage.tsx側で判定）。
 *
 * 実在しない氏名・住所・メールアドレス・団体名を、確認なしにここへ入力しないこと。
 * 値が確定していない項目は、コメントアウトしたまま、または空のままにしておく。
 */
export interface OperatorConfig {
  /** 運営者名または運営団体名 */
  operatorName?: string;
  /** 編集責任者名 */
  editorName?: string;
  /** 所在地域（例："宮崎県延岡市"）。詳細な住所や電話番号は登録しない。 */
  region?: string;
  /** 連絡先メールアドレス */
  contactEmail?: string;
  /** サイト開設日（YYYY-MM-DD形式） */
  foundedDate?: string;
  /** 運営目的の説明文 */
  purpose?: string;
  /** 政党・会派・候補者との関係についての説明 */
  politicalRelationship?: string;
  /** 利益相反に関する説明 */
  conflictOfInterest?: string;
}

/**
 * 運営者情報。値が確定したら、該当する項目に文字列を設定してください。
 * 例：operatorName: "延岡市政見える化ポータル運営事務局"
 */
export const operatorConfig: OperatorConfig = {
  operatorName: undefined,
  editorName: undefined,
  region: undefined,
  contactEmail: undefined,
  foundedDate: undefined,
  purpose: undefined,
  politicalRelationship: undefined,
  conflictOfInterest: undefined,
};

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** 運営者情報が1項目でも設定されているか。Organization構造化データを出力するかどうかの判定に使う。 */
export function isOperatorConfigured(): boolean {
  return Object.values(operatorConfig).some(hasValue);
}

export function getOperatorField(key: keyof OperatorConfig): string | undefined {
  const value = operatorConfig[key];
  return hasValue(value) ? value : undefined;
}
