/** 「市役所どこに行けばいい？診断」ページ（/city-guide）で使う型定義。 */

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

export interface CityGuideRelatedLink {
  label: string;
  url: string;
}

/**
 * 案内先の担当課・窓口1件分。
 * 電話番号・場所・階数・受付時間・持ち物などは、公式資料で確認できるまでは省略（undefined）のままにする。
 * 存在しない情報を推測して埋めないこと。
 */
export interface CityGuideDepartment {
  id: string;
  name: string;
  shortDescription: string;
  mainTasks: string[];
  /** 未確認の場合は省略する。ページ側は、この値がない場合「公式ページを見る」ボタンを表示しない。 */
  officialUrl?: string;
  phone?: string;
  location?: string;
  floor?: string;
  hours?: string;
  itemsToBring?: string[];
  relatedLinks?: CityGuideRelatedLink[];
  notes?: string;
  /** この課が対応するカテゴリID（CityGuideCategory.id）の一覧。一覧モードでの分類表示に使う。 */
  categoryIds: string[];
}

/** 最初に選ぶ相談カテゴリ1件分。 */
export interface CityGuideCategory {
  id: string;
  name: string;
  description: string;
  icon: CityGuideIconName;
  /** このカテゴリで最初に表示する質問ID。null の場合は質問を挟まず directResultDepartmentId の結果を直接表示する。 */
  firstQuestionId: string | null;
  /** firstQuestionId が null のときに表示する担当課ID。 */
  directResultDepartmentId?: string;
  /** カテゴリカードの表示順。 */
  order: number;
}

/** 質問への回答選択肢1件分。nextQuestionId と resultDepartmentId のどちらか一方を設定する。 */
export interface CityGuideChoice {
  label: string;
  /** 次の質問へ進む場合の質問ID。 */
  nextQuestionId?: string;
  /** この選択で診断が確定する場合の担当課ID。 */
  resultDepartmentId?: string;
}

/**
 * 診断の質問1件分。
 * choices は「はい／いいえ」の2択に限定せず、3択以上も設定できる。
 */
export interface CityGuideQuestion {
  id: string;
  text: string;
  choices: CityGuideChoice[];
}

/**
 * 将来のライフイベント別案内（結婚、出生、引っ越し、死亡、就職、介護開始など）用の型。
 * 現時点ではデータを持たない（cityGuideLifeEvents は空配列）。
 */
export interface CityGuideLifeEvent {
  id: string;
  name: string;
  description: string;
  departmentIds: string[];
}
