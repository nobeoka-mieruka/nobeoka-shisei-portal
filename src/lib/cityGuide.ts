/**
 * 「延岡市役所 どこに行けばいい？診断」（/city-guide）のデータ読み込み層。
 *
 * 実データは以下のJSONファイルで管理する。ページ・コンポーネント側にはロジックを直接書かず、
 * これらのファイルに項目を追加・修正するだけで診断内容を変更できるようにしている。
 * - src/data/cityGuideCategories.json … 相談カテゴリ一覧
 * - src/data/cityGuideEntries.json … 相談窓口データベース本体（質問・担当課・電話番号など）
 * - src/data/cityGuideConfig.json … 受付時間など全課共通の設定
 *
 * 電話番号・公式URLなど、延岡市公式ホームページ「組織でさがす」の各課ページで
 * まだ確認できていない項目は空文字列のままにすること。存在しない情報を推測して入力しないこと。
 */

import categoriesData from "../data/cityGuideCategories.json";
import entriesData from "../data/cityGuideEntries.json";
import configData from "../data/cityGuideConfig.json";
import type { CityGuideCategory, CityGuideConfig, CityGuideEntry } from "../types/cityGuide";

export const cityGuideCategories: CityGuideCategory[] = [...(categoriesData as CityGuideCategory[])].sort(
  (a, b) => a.order - b.order,
);

export const cityGuideEntries: CityGuideEntry[] = entriesData as CityGuideEntry[];

export const cityGuideConfig: CityGuideConfig = configData as CityGuideConfig;

/** 相談内容がはっきりしない場合の案内先（総合案内）のエントリID。 */
export const GENERAL_INFO_ENTRY_ID = "general-info";

const categoryMap = new Map<string, CityGuideCategory>(cityGuideCategories.map((c) => [c.id, c]));
const entryMap = new Map<string, CityGuideEntry>(cityGuideEntries.map((e) => [e.id, e]));

export function getCategory(categoryId: string): CityGuideCategory | undefined {
  return categoryMap.get(categoryId);
}

export function getEntry(entryId: string): CityGuideEntry | undefined {
  return entryMap.get(entryId);
}

/** 指定したカテゴリのエントリを、JSON配列に並んでいる順番のまま返す（診断で質問する順序）。 */
export function getEntriesForCategory(categoryId: string): CityGuideEntry[] {
  return cityGuideEntries.filter((e) => e.category === categoryId);
}

/** そのカテゴリが、質問を挟まず最初のエントリをそのまま結果表示するカテゴリかどうか。 */
export function isDirectResultCategory(categoryId: string): boolean {
  const entries = getEntriesForCategory(categoryId);
  return entries.length > 0 && entries[0].question === null;
}

/**
 * 電話番号表示用の文字列から tel: リンク用の値を作る（ハイフン・空白・全角文字を除去）。
 * phone が空文字の場合は null を返す。
 */
export function toTelHref(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, "");
  return digits ? `tel:${digits}` : null;
}
