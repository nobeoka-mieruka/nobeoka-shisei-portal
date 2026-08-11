/**
 * 延岡市の行政組織データ（src/data/cityOrganizationDivisions.json・
 * src/data/cityOrganizationSections.json）の型。
 *
 * 出典：延岡市公式ホームページ「組織でさがす」
 * （https://www.city.nobeoka.miyazaki.jp/soshiki/）およびその配下の
 * 部局別ページ（/soshiki/N.html）・課室別ページ（/soshiki/N/）。
 * 各ページの「連絡先」欄（住所・階・Tel・Fax）をそのまま転記しており、
 * 公表されていない項目（一部の課のFAX等）はnullのまま残し、推測で
 * 補完していない。
 *
 * 2階層構成：
 * - CityOrganizationDivision：部・局・委員会・消防本部・消防署・
 *   総合支所・本庁直轄組織（16件）
 * - CityOrganizationSection：課・室・センター・事務局（83件）
 * これより下の「係」単位は、CityOrganizationSection.subSectionPhonesに
 * 参考情報として保持するが、正式な組織単位としては管理しない（係の新設・
 * 廃止・改称は課単位より頻繁なため、公式サイトの表示をそのまま都度参照する
 * 前提とする）。
 */
export interface CityOrganizationDivision {
  id: string;
  name: string;
  officialUrl: string;
  /** このdivisionに属するCityOrganizationSectionの件数（参考値）。 */
  sectionCount: number;
  /** ISO形式。この組織データをサイト運営者がいつ確認したか。 */
  dataAsOf: string;
}

export interface CityOrganizationSubSectionPhone {
  label: string;
  tel: string;
}

export interface CityOrganizationSection {
  id: string;
  name: string;
  /** CityOrganizationDivision.id。上位組織が公式サイト側で特定できなかった場合のみnull。 */
  parentDivisionId: string | null;
  parentDivisionName: string;
  /** 公式サイトの「連絡先」欄に郵便番号付き住所の記載が無い場合はnull（推測で補完しない）。 */
  address: string | null;
  /** 例:「本庁舎6階」。記載が無い場合はnull。 */
  floor: string | null;
  /** 代表電話番号（複数係がある場合は先頭の係の番号）。 */
  phone: string;
  /** 課内に複数の係があり、それぞれ電話番号が異なる場合の内訳（参考情報）。 */
  subSectionPhones: CityOrganizationSubSectionPhone[] | null;
  /** 公式サイトにFAX番号の記載が無い場合はnull（未公表。0として扱わない）。 */
  fax: string | null;
  officialUrl: string;
  /** 延岡市の標準開庁時間。個別の窓口延長等はbusinessHoursNoteで補足する。 */
  businessHours: string;
  businessHoursNote: string | null;
  /** ISO形式。この組織データをサイト運営者がいつ確認したか。 */
  dataAsOf: string;
}
