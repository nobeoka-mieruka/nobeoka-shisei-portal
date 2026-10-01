/**
 * 検索インデックス（src/data/searchIndex.json）の「本当の重複」を判定するキー（Phase270）。
 *
 * 以前の検証は type・url・title の組で重複を判定していたため、更新履歴のように
 * すべてが同じページ（/updates）へリンクし、定型の題名を持つ別々の記録
 * （例：u139〈2026-09-05〉と u153〈2026-09-18〉、別のPDFを取り込んだ別の自動更新）を
 * 重複として警告していた（誤検出）。
 *
 * 判定の考え方：
 *   - 生成元の記録ID（sourceId）がある項目は、type＋正規化URL＋sourceId が同じときだけ重複
 *     （＝同じ記録を二重に索引へ入れている）。題名が同じでも、記録が違えば正常。
 *   - sourceId を持たない項目（固定ページ等）は、従来どおり type＋正規化URL＋title で判定する。
 *   - 題名だけでは判定しない（同じ題名の別資料は正常）。
 */

/** 末尾の「/」と、ページ内リンク（#…）を除いたURL。ルート「/」はそのまま。 */
export function normalizeSearchUrl(url) {
  const withoutHash = String(url ?? "").split("#")[0];
  return withoutHash.length > 1 ? withoutHash.replace(/\/+$/, "") : withoutHash;
}

export function searchIndexDuplicateKey(entry) {
  const identity = entry.sourceId != null && entry.sourceId !== "" ? `source:${entry.sourceId}` : `title:${entry.title}`;
  return `${entry.type}|${normalizeSearchUrl(entry.url)}|${identity}`;
}

/** 重複している項目の組を返す（[先に出た項目のid, 後の項目のid] の配列）。 */
export function findSearchIndexDuplicates(entries) {
  const seen = new Map();
  const duplicates = [];
  for (const entry of entries) {
    const key = searchIndexDuplicateKey(entry);
    if (seen.has(key)) duplicates.push([seen.get(key), entry.id]);
    else seen.set(key, entry.id);
  }
  return duplicates;
}
