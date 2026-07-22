/** 「延岡市役所 どこに行けばいい？診断」ページ（/city-guide）で使う型定義。 */

/** カテゴリカードに表示するアイコンの種類。実際のアイコン部品は components/city-guide 側で管理する。 */
export type CityGuideIconName =
  | "document"
  | "yen"
  | "child"
  | "heart"
  | "support"
  | "recycle"
  | "house"
  | "droplet"
  | "briefcase"
  | "alert"
  | "question";

/** 最初に選ぶ相談カテゴリ1件分。行政組織名ではなく、市民が検索しやすい相談内容の切り口で分類する。 */
export interface CityGuideCategory {
  id: string;
  name: string;
  description: string;
  icon: CityGuideIconName;
  /** カテゴリカードの表示順。 */
  order: number;
}

/**
 * 相談窓口データベースの1レコード（src/data/cityGuideEntries.json）。
 *
 * 同じ category 内では、配列に並んでいる順番に「〜ですか？」と質問し、「はい」が選ばれた時点でそのレコードが
 * 結果として確定する。「いいえ」なら同じカテゴリの次のレコードへ進み、最後まで「いいえ」が続いた場合は
 * category: "unknown" のレコード（総合案内）を案内する。
 * question が null のレコードは、質問を挟まずそのまま結果として表示する（総合案内など）。
 *
 * 電話番号・場所・公式URLは、延岡市公式ホームページ「組織でさがす」の各課ページで確認できたものだけを登録すること。
 * 確認できていない項目は空文字列のままにし、絶対に推測で入力しないこと。
 * 受付時間はこのレコードでは持たず、共通設定（src/data/cityGuideConfig.json）の officeHours を
 * 診断結果画面で表示する（全課共通のため）。
 */
export interface CityGuideEntry {
  id: string;
  /** CityGuideCategory.id への参照。 */
  category: string;
  /** 「〜ですか？」形式の質問文。null の場合は質問せずこのレコードをそのまま結果として表示する。 */
  question: string | null;
  /** 担当課・窓口の名称（延岡市公式ホームページで確認できる正式名称）。 */
  department: string;
  /** 電話番号（例："0982-33-xxxx"）。公式ページで確認できない場合は空文字列にする。 */
  phone: string;
  /** 窓口の場所（庁舎名・階数など）。公式ページで確認できない場合は空文字列にする。 */
  location: string;
  /** 担当課ページの公式URL。確認できない場合は空文字列にする。 */
  officialUrl: string;
  /** 相談内容・担当業務の説明文（結果画面の「相談内容」欄に使う）。 */
  description: string;
  /** 電話番号・場所・公式URLを最終確認した日（ISO形式 "YYYY-MM-DD"）。未確認の場合は空文字列。 */
  lastChecked: string;
}

/** 全課共通の設定（src/data/cityGuideConfig.json）。受付時間を1か所で管理し、全結果画面に自動反映する。 */
export interface CityGuideConfig {
  /** 全課共通の受付時間表示（例："平日 8:30〜17:15"）。 */
  officeHours: string;
  /** 市役所の名称。 */
  officeName: string;
  /** 受付時間に関する補足（例："年末年始・祝日を除く"）。 */
  note: string;
  /** 担当課の電話番号が未確認のときに案内する代表電話番号。公式ページで確認できたもののみ設定する。 */
  representativePhone: string;
  /** representativePhone の確認元ページURL。 */
  representativePhoneSourceUrl: string;
}

/**
 * 将来のライフイベント別案内（結婚、出生、引っ越し、死亡、就職、介護開始など）用の型。
 * 現時点ではデータを持たない。
 */
export interface CityGuideLifeEvent {
  id: string;
  name: string;
  description: string;
  departmentIds: string[];
}
