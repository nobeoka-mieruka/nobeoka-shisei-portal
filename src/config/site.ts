/** サイト全体の設定値。 */

export const SITE_NAME = "延岡市政見える化ポータル";

/** 本番URL。カスタムドメインへ移行する場合はここだけ書き換える。 */
export const SITE_URL = "https://nobeoka-shisei-portal.pages.dev";

export const DEFAULT_DESCRIPTION =
  "延岡市長、市議会議員、議案、採決結果、一般質問、報酬などの公開情報を、市民向けに分かりやすく整理した非公式データベースです。";

/** 共通OGP画像（1200x630）の絶対パス。 */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/** "2026-07-11" のようなISO形式の日付を "2026年7月11日" の表記に変換する。 */
export function formatJapaneseDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

/**
 * 情報提供・訂正依頼フォームのURL（Googleフォームなど）。
 * まだ用意できていない間は空文字のままにしておくと、ページ側で「準備中」と表示される。
 * フォームができたら、ここにURLを入れるだけで反映される。
 */
export const CONTACT_FORM_URL = "https://forms.gle/aPavgikpkoA6YP1L9";

/**
 * 全ページ共通の告知バー。enabled を false にすると非表示になる。
 * 正式公開後は、警告のような強い見た目にならないよう、HomePage側の非公式サイト表記と役割を分けている。
 */
export const maintenanceNotice = {
  enabled: false,
  title: "公開運用中",
  message: "掲載情報は、公的資料を確認しながら順次追加・更新しています。",
};
