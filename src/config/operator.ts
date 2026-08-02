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
  /** 運営者名または運営団体名（ペンネーム可。実名は登録しない）。 */
  operatorName?: string;
  /** 編集責任者名（実名は登録しない）。 */
  editorName?: string;
  /** 運営形態（例："個人運営"）。 */
  operatorType?: string;
  /** 所在地域（例："宮崎県延岡市"）。詳細な住所や電話番号は登録しない。 */
  region?: string;
  /** 連絡先メールアドレス（個人メールアドレスは登録しない。フォーム中心の導線を優先する）。 */
  contactEmail?: string;
  /** サイト開設日（YYYY-MM-DD形式）。確認できていない場合は設定しない（推測で入力しない）。 */
  foundedDate?: string;
  /** 運営目的の説明文 */
  purpose?: string;
  /** 政党・会派・候補者との関係についての説明 */
  politicalRelationship?: string;
  /** 利益相反に関する説明 */
  conflictOfInterest?: string;
  /**
   * 収益化の状況。"none"＝広告・収益化なし。それ以外を設定する場合は、
   * AboutPage側の表示文言も実態に合わせて更新すること。
   */
  monetizationStatus?: "none" | "ads" | "donations" | "other";
  /**
   * 「このサイトについて」ページ下部に表示する最終更新日（YYYY-MM-DD形式）。
   * ビルド日時を自動表示すると、文章を変更していなくても日付だけ変わってしまうため、
   * このページの内容を実際に更新したときだけ手動で書き換える。
   */
  aboutPageUpdatedAt?: string;
}

/**
 * 運営者情報。値が確定したら、該当する項目に文字列を設定してください。
 * 実名・詳細住所・私用電話番号・生年月日等は、確認の有無にかかわらず登録しないこと。
 */
export const operatorConfig: OperatorConfig = {
  operatorName: "のべおか市政データラボ",
  editorName: undefined,
  operatorType: "個人運営",
  region: "宮崎県延岡市",
  contactEmail: undefined,
  foundedDate: undefined,
  purpose: undefined,
  politicalRelationship: undefined,
  conflictOfInterest: undefined,
  monetizationStatus: "none",
  aboutPageUpdatedAt: "2026-08-02",
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
