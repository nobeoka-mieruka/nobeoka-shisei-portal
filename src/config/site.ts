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

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ISO形式（YYYY-MM-DD）のときだけ日本語表記へ変換し、それ以外は元の値をそのまま返す。
 *
 * Phase218：出典の「取得日」「公表日」「議決日」等がISO文字列のまま表示されている画面があり、
 * スクリーンリーダーでは「にせんにじゅうろく ハイフン ぜろはち ハイフン さんじゅういち」のように
 * 数字とハイフンの羅列として読み上げられていた。年月のみの記録や注記付きの記録も実在するため、
 * 変換できない値は推測で補完せずそのまま表示する。
 */
export function formatJapaneseDateIfIso(value: string): string {
  return ISO_DATE_PATTERN.test(value) ? formatJapaneseDate(value) : value;
}

/** 各元号の開始年（西暦）。令和元年＝2019年、平成元年＝1989年、昭和元年＝1926年。 */
const REIWA_START_YEAR = 2019;
const HEISEI_START_YEAR = 1989;
const SHOWA_START_YEAR = 1926;

/**
 * 西暦の年を和暦（元号＋年）へ変換する。画面側（React/TypeScript）の元号換算は、この関数だけを
 * 情報源とする。各ページで `令和${year - 2018}年` のような式を書かない。
 *
 * Phase219：従来の年度表記は「令和＝西暦−2018」という式だけを、元号の分岐なしにすべての年へ
 * 適用していた。そのため令和より前の年（2000年＝平成12年、2018年＝平成30年など）に対して
 * 「令和-18年度」「令和0年度」という実在しない表記を生成していた。存在しない年度を0へ丸めたり
 * 非表示にしたりするのではなく、元号の境界で分岐して正しい元号を返すことで解消する。
 * スクリプト側の scripts/lib/council-shared.mjs の eraYearFor（Phase163で同じ誤りを修正済み）と
 * 同じ規則・同じ表記（1年は「元年」）に揃えてある。
 *
 * 注意：換算は「年」単位のため、改元日をまたぐ年（1989年・2019年）の改元日前後を日単位で
 * 区別することはできない（2019年3月は正しくは平成31年3月だが、この関数は令和元年を返す）。
 * 会期名など日単位の正確さが必要な表示は、councilSessions.json の eraYear / title（開催月まで
 * 確認した実データ）を使うこと。年度（4月始まり）の呼称は年度開始年の元号に合わせるため、
 * toEraFiscalYearLabel は改元年でも正しい（2019年度＝令和元年度）。
 */
export function toEraYearLabel(year: number): string {
  if (year >= REIWA_START_YEAR) {
    const n = year - REIWA_START_YEAR + 1;
    return `令和${n === 1 ? "元" : n}年`;
  }
  if (year >= HEISEI_START_YEAR) {
    const n = year - HEISEI_START_YEAR + 1;
    return `平成${n === 1 ? "元" : n}年`;
  }
  if (year >= SHOWA_START_YEAR) {
    const n = year - SHOWA_START_YEAR + 1;
    return `昭和${n === 1 ? "元" : n}年`;
  }
  // 大正以前は本サイトの対象範囲外（延岡市議会関連データは大正末期以降のみを扱う）。
  // 推測で元号を割り当てず、西暦のまま表示する。
  return `西暦${year}年`;
}

/**
 * 会計年度（4月始まりの年度の開始年。例：2019 → "令和元年度"、2018 → "平成30年度"）を
 * 和暦の年度表記へ変換する。年度の呼称は年度開始年の元号に合わせる（国・自治体の慣行と同じ）。
 */
export function toEraFiscalYearLabel(fiscalYear: number): string {
  return `${toEraYearLabel(fiscalYear)}度`;
}

/** "2026-07-11" のようなISO形式の日付が属する会計年度（4月始まり）の開始年を返す。 */
export function fiscalYearOfIsoDate(iso: string): number {
  const [year, month] = iso.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

/**
 * "2026-07-11" のようなISO形式の日付を、日本の会計年度（4月始まり）に基づく
 * "令和8年度" のような表記に変換する。絞り込み条件の年度表示に使う。
 */
export function toFiscalYearLabel(iso: string): string {
  return toEraFiscalYearLabel(fiscalYearOfIsoDate(iso));
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
