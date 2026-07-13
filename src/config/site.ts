/** サイト全体の設定値。更新日はここだけ書き換えれば全ページに反映される。 */

/** YYYY-MM-DD 形式。サイトの内容を更新したら、この日付を書き換えてください。 */
export const SITE_LAST_UPDATED = "2026-07-11";

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

/** 全ページ共通の更新中告知バー。enabled を false にすると非表示になる。 */
export const maintenanceNotice = {
  enabled: true,
  title: "β版公開中・リニューアルおよび情報更新中",
  message:
    "現在、機能追加・データ更新・画面調整を行っています。一部の表示や掲載内容が予告なく変更される場合があります。",
};
