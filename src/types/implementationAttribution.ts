/**
 * Phase230：出来事・施策の「実施主体」を構造として区別するための共通定義。
 *
 * 背景：延岡市域で起きた出来事には、延岡市の事業ではないもの（宮崎県が主体の事業、
 * 県が設置した施設、県主催で延岡市が参加した催し等）が含まれる。市政年表では
 * それらを同じ体裁で並べているため、区別が無いまま提示すると「延岡市の事業」と
 * 誤読させる恐れがある（Phase226・228の指摘）。
 *
 * 方針（RELEASE_SNAPSHOT.md「県事業と市事業の構造的な区別」で決定済み）：
 * ・既存フィールドで表現できないため、**任意フィールド**として最小限だけ追加する。
 *   既存レコードは未設定のままでよく、一括の後追い付与（backfill）は行わない。
 * ・一次資料で実施主体を確定できた場合だけ設定する。確定できないものはフィールドごと
 *   未設定にする（推測で埋めない・「市」で代用しない）。
 * ・「延岡市で開催された」「名称に延岡が含まれる」だけでは延岡市の事業と判定しない。
 * ・共同実施（cityPrefectureJoint）は、一次資料に県と市の双方が実施主体として
 *   明示されている場合に限る。推測でjointにしない。
 * ・県の予算額・県議会の議決結果を、市の財政・議案データへ転記しない
 *   （この型は「誰が実施したか」の注記であり、金額を持たない）。
 *
 * 型はimportを持たない独立モジュールとして定義する（既存の
 * ArchiveSourceTrustLevel〈src/types/sourceTrust.ts〉と同じ方式。複数の型定義ファイルから
 * 参照しても循環importにならないようにするため）。
 */

/**
 * 実施主体。「その取組みを実施した組織はどこか」を表す。
 * 資料を公表した機関（sourceOrganization）とは別の軸である
 * （県の報道発表で公表された延岡市の事業、市の年表に載る県の事業のどちらもありうる）。
 */
export type ImplementingBody =
  /** 延岡市（市の予算・市の事業として一次資料で確認できたもの）。 */
  | "nobeokaCity"
  /** 宮崎県（県立施設の設置・県主催事業など、県が主体であると一次資料で確認できたもの）。 */
  | "miyazakiPrefecture"
  /** 国・省庁。 */
  | "nationalGovernment"
  /** 延岡市と宮崎県の共同実施。双方が実施主体として一次資料に明示されている場合のみ。 */
  | "cityPrefectureJoint"
  /** 広域連合・一部事務組合・市町村圏協議会等、複数自治体で構成する団体。 */
  | "wideAreaUnion"
  /** 上記のいずれでもないことが資料で確認できた場合（民間・大学等）。 */
  | "other";

/**
 * 対象地域。「その取組みが対象とする範囲」を表す。
 * 資料に明記されていない場合は設定しない（開催地から推測して埋めない）。
 */
export type ImplementationScope =
  | "nobeokaCity"
  /** 県北（延岡市・日向市・東臼杵郡等）。資料が広域を対象と明示している場合。 */
  | "northernMiyazaki"
  | "miyazakiPrefecture"
  | "national"
  | "other";

/**
 * 延岡市との関係。実施主体が延岡市でない出来事について、
 * 延岡市がどう関わったのかを区別する。
 */
export type NobeokaRelation =
  /** 延岡市自身の事業・施策。 */
  | "cityProject"
  /** 宮崎県の事業を延岡市で実施したもの（延岡市の関与は資料上、会場・地域にとどまる）。 */
  | "prefecturalProjectInNobeoka"
  /** 延岡市と宮崎県の共同実施。 */
  | "cityPrefectureJoint"
  /** 延岡市（市長・所管課等）が参加者・出席者・参加機関として資料に明示されているもの。 */
  | "nobeokaParticipant"
  /** 延岡市民が対象・受益者であることが資料に明示されているもの。 */
  | "nobeokaBeneficiary"
  /** 延岡市域の出来事であるが、延岡市は実施主体でも参加者でもないもの（県立施設の設置等）。 */
  | "relatedOnly";

/**
 * 実施主体の注記1件分。設定する場合は「どの一次資料で確定したか」を必ず併せて記録する。
 * このオブジェクト自体が任意であり、**存在しない＝未確認**（画面では「確認中」と文字で表示する）。
 */
export interface ImplementationAttribution {
  implementingBody: ImplementingBody;
  nobeokaRelation: NobeokaRelation;
  /** 資料に対象地域が明記されている場合のみ設定する。 */
  implementationScope?: ImplementationScope;
  /**
   * この区分を確定した一次資料のURL。
   * 同じレコードのsourceRefsに含まれるURLでなければならない（validate:dataで検証する）。
   */
  attributionSourceUrl: string;
  /** 資料に明記されていた内容（協定名・参加機関・負担区分等）のみを書く。推測は書かない。 */
  attributionNote?: string;
}
