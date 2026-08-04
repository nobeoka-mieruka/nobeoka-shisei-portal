/**
 * 「延岡市政アーカイブ」比較ページ（/compare 以下）で共通利用する選択状態のユーティリティ。
 * 市長比較・財政比較など対象の種類が違っても同じロジックを使えるよう、IDの配列だけを扱う。
 */

/** 比較画面で選択できる最大件数。 */
export const MAX_COMPARE_ITEMS = 4;
/** 比較結果を表示するために必要な最小選択件数。1件だけでは「比較」にならないため表示しない。 */
export const MIN_COMPARE_ITEMS = 2;

const DEFAULT_PARAM_NAME = "items";

/**
 * URLのクエリ文字列（例: ?items=2024,2025）から選択済みIDを取り出す。
 * 存在しないID・重複IDは除去し、最大件数を超える分は先着順で切り捨てる。
 */
export function parseCompareSelection(
  searchParams: URLSearchParams,
  availableIds: readonly string[],
  paramName: string = DEFAULT_PARAM_NAME,
): string[] {
  const raw = searchParams.get(paramName);
  if (!raw) return [];
  const availableSet = new Set(availableIds);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of raw.split(",")) {
    const trimmed = id.trim();
    if (!trimmed || !availableSet.has(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= MAX_COMPARE_ITEMS) break;
  }
  return result;
}

/** 選択済みIDの配列から、URLに設定するクエリ文字列（?items=... 形式）を作る。 */
export function buildCompareSearchParams(
  ids: readonly string[],
  paramName: string = DEFAULT_PARAM_NAME,
): URLSearchParams {
  const params = new URLSearchParams();
  if (ids.length > 0) params.set(paramName, ids.join(","));
  return params;
}
