/**
 * 「延岡市政アーカイブ」拡張（archiveMayors・archiveFiscalYears等）の検証で共通利用する
 * 汎用ヘルパー群。ファイル固有の知識を持たないため、将来追加予定のarchiveMembers・
 * archivePoliciesの検証にもそのまま再利用できる。
 */

export const ARCHIVE_VERIFICATION_STATUSES = new Set([
  "verified",
  "partiallyVerified",
  "needsReview",
  "sourceUnavailable",
]);

export const ARCHIVE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const ARCHIVE_URL_RE = /^(https?:\/\/\S+|\/\S+)$/;

function isBlank(v) {
  return typeof v !== "string" || v.trim().length === 0;
}

/** id重複・空idを検出し、有効なidのSetを返す（他ファイルからの参照整合性チェックに使う）。 */
export function checkDuplicateIds({ err }, records, idField, fileLabel) {
  const ids = new Set();
  for (const r of records ?? []) {
    const id = r?.[idField];
    const tag = `${fileLabel} (${id ?? "id不明"})`;
    if (isBlank(id)) err(tag, `${idField}が空です`);
    else if (ids.has(id)) err(tag, `${idField}が重複しています: ${id}`);
    else ids.add(id);
  }
  return ids;
}

/** slug重複・空slugを検出する。 */
export function checkDuplicateSlugs({ err }, records, slugField, fileLabel) {
  const slugs = new Set();
  for (const r of records ?? []) {
    const slug = r?.[slugField];
    const tag = `${fileLabel} (${r?.id ?? "id不明"})`;
    if (isBlank(slug)) err(tag, `${slugField}が空です`);
    else if (slugs.has(slug)) err(tag, `${slugField}が重複しています: ${slug}`);
    else slugs.add(slug);
  }
}

/**
 * 出典配列1件ずつの形式（URL・資料名・取得日・verificationStatus）を検証する。
 * accessedAtは既存データ移行分に欠けていることが多いため、無くても警告のみとする。
 */
export function checkSourceRefs({ err, warn }, sourceRefs, tag) {
  for (const ref of sourceRefs ?? []) {
    if (isBlank(ref.sourceUrl)) warn(tag, "出典のsourceUrlが空です");
    else if (!ARCHIVE_URL_RE.test(ref.sourceUrl)) err(tag, `sourceUrlの形式が不正です: ${ref.sourceUrl}`);
    if (isBlank(ref.sourceTitle)) warn(tag, "出典のsourceTitle（資料名）が空です");
    if (!ref.verificationStatus || !ARCHIVE_VERIFICATION_STATUSES.has(ref.verificationStatus)) {
      err(tag, `未定義または未設定のverificationStatusです: ${ref.verificationStatus}`);
    }
    if (!ref.accessedAt) warn(tag, "出典のaccessedAt（取得日）が未設定です");
    else if (!ARCHIVE_DATE_RE.test(ref.accessedAt)) err(tag, `accessedAtの形式が不正です: ${ref.accessedAt}`);
    if (ref.sourcePublishedDate && !ARCHIVE_DATE_RE.test(ref.sourcePublishedDate)) {
      err(tag, `sourcePublishedDateの形式が不正です: ${ref.sourcePublishedDate}`);
    }
    if (ref.sourceUpdatedDate && !ARCHIVE_DATE_RE.test(ref.sourceUpdatedDate)) {
      err(tag, `sourceUpdatedDateの形式が不正です: ${ref.sourceUpdatedDate}`);
    }
  }
}

/** sourceRefsが1件も無い場合にエラーとする（出典必須の人物・任期エンティティ向け）。 */
export function requireAtLeastOneSourceRef({ err }, sourceRefs, tag) {
  if (!Array.isArray(sourceRefs) || sourceRefs.length === 0) {
    err(tag, "sourceRefsが1件もありません（出典URLを最低1件保存してください）");
  }
}

/** 開始日≦終了日かを確認する。終了日nullは「現在も継続中」として扱う。 */
export function checkPeriodConsistency({ err }, startDate, endDate, tag) {
  if (startDate && !ARCHIVE_DATE_RE.test(startDate)) err(tag, `開始日の形式が不正です: ${startDate}`);
  if (endDate !== null && endDate !== undefined && !ARCHIVE_DATE_RE.test(endDate)) {
    err(tag, `終了日の形式が不正です: ${endDate}`);
  }
  if (
    startDate &&
    endDate &&
    ARCHIVE_DATE_RE.test(startDate) &&
    ARCHIVE_DATE_RE.test(endDate) &&
    startDate > endDate
  ) {
    err(tag, `開始日(${startDate})が終了日(${endDate})より後になっています`);
  }
}

/**
 * 同一グループ（例：同じmayorId）内で期間が重複していないかを検出する。
 * endDate=nullは「現在も継続中」として扱う。
 */
export function checkNoOverlappingPeriods({ err }, records, { groupField, startField, endField, idField = "id" }, fileLabel) {
  const groups = new Map();
  for (const r of records ?? []) {
    const key = r?.[groupField];
    if (isBlank(key)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => String(a[startField] ?? "").localeCompare(String(b[startField] ?? "")));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const prevEnd = prev[endField];
      if (prevEnd === null || prevEnd === undefined || prevEnd >= cur[startField]) {
        const tag = `${fileLabel} (${cur[idField] ?? "id不明"})`;
        err(tag, `期間が前の記録（${prev[idField] ?? "id不明"}）と重複しています`);
      }
    }
  }
}

/** null以外の数値が負値でないかを確認する。 */
export function checkNonNegative({ err }, value, fieldName, tag) {
  if (value === null || value === undefined) return;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    err(tag, `${fieldName}が数値ではありません: ${value}`);
  } else if (value < 0) {
    err(tag, `${fieldName}が負の値です: ${value}`);
  }
}

/** null以外の比率が0〜100の範囲内かを確認する。 */
export function checkPercentRange({ err }, value, fieldName, tag) {
  if (value === null || value === undefined) return;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    err(tag, `${fieldName}が数値ではありません: ${value}`);
  } else if (value < 0 || value > 100) {
    err(tag, `${fieldName}が0〜100の範囲外です: ${value}`);
  }
}

/** 年度が妥当な範囲・整数かを確認する。 */
export function checkYearRange({ err }, year, tag, { min = 1947, max = 2100 } = {}) {
  if (typeof year !== "number" || !Number.isInteger(year)) {
    err(tag, `年度が整数ではありません: ${year}`);
  } else if (year < min || year > max) {
    err(tag, `年度が妥当な範囲(${min}〜${max})外です: ${year}`);
  }
}

/** 年度の重複を検出する。 */
export function checkDuplicateYears({ err }, records, yearField, fileLabel) {
  const seen = new Set();
  for (const r of records ?? []) {
    const y = r?.[yearField];
    const tag = `${fileLabel} (${y ?? "年度不明"})`;
    if (seen.has(y)) err(tag, `年度が重複しています: ${y}`);
    else seen.add(y);
  }
}

/** 登録済み年度の最小〜最大の範囲内に歯抜けがあれば警告する（範囲外の未収集はエラーにしない）。 */
export function checkYearGaps({ warn }, years, fileLabel) {
  const sorted = [...new Set(years)].filter((y) => typeof y === "number").sort((a, b) => a - b);
  if (sorted.length < 2) return;
  const missing = [];
  for (let y = sorted[0]; y <= sorted[sorted.length - 1]; y++) {
    if (!sorted.includes(y)) missing.push(y);
  }
  if (missing.length > 0) {
    warn(fileLabel, `登録済み年度の範囲内(${sorted[0]}〜${sorted[sorted.length - 1]})に欠番があります: ${missing.join("、")}`);
  }
}

/** idSetに存在しない参照先を検出する。level:"warn"を指定するとエラーではなく警告にできる。 */
export function checkReferenceExists({ err, warn }, value, idSet, tag, message, { level = "error" } = {}) {
  if (value === null || value === undefined || value === "") return;
  if (!idSet.has(value)) {
    (level === "warn" ? warn : err)(tag, message ?? `存在しないIDを参照しています: ${value}`);
  }
}

/**
 * obj内の指定フィールドのいずれかがnull以外の場合、requiredFieldが空でないことを要求する。
 * 市債残高区分ごとの定義注記（definitionNote）必須チェック等に使う。
 */
export function checkAnyNonNullRequiresField({ err }, obj, valueFields, requiredField, tag, message) {
  const hasAnyValue = valueFields.some((f) => obj?.[f] !== null && obj?.[f] !== undefined);
  if (hasAnyValue && isBlank(obj?.[requiredField])) {
    err(tag, message ?? `値が設定されているのに${requiredField}が空です`);
  }
}

/**
 * obj内の指定フィールドのいずれかがnull以外なのにsourceRefsが空の場合に警告する。
 * 「値だけあって出典がない」状態を検出する（0とnullの区別そのものは型・入力時点の運用で
 * 担保するため、ここでは値と出典の対応関係の矛盾検出に留める）。
 */
export function checkValuesHaveSource({ warn }, obj, valueFields, sourceRefs, tag) {
  const present = valueFields.filter((f) => obj?.[f] !== null && obj?.[f] !== undefined);
  if (present.length > 0 && (!Array.isArray(sourceRefs) || sourceRefs.length === 0)) {
    warn(tag, `値が設定されているのに出典（sourceRefs）が1件もありません: ${present.join("、")}`);
  }
}
