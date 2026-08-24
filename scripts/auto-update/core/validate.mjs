/**
 * 自動更新パイプライン共通のスキーマ検証ヘルパー（Workstream A：共通コア）。
 * Zod等のランタイム検証ライブラリは今回導入していない（新規依存追加を最小化する方針）ため、
 * 手書きの軽量検証で対応する。将来Zod化する場合もこのモジュールのインターフェースを維持できる。
 */

/** 通常会期"YYYY-MM"／臨時会"YYYY-MM-extraordinary"／同月複数臨時会"YYYY-MM-extraordinary-NN"。 */
export const SESSION_ID_PATTERN = /^\d{4}-\d{2}(-extraordinary(-\d{2})?)?$/;

export function validateUrl(url, allowedHosts) {
  const errors = [];
  if (typeof url !== "string" || !/^https:\/\//.test(url)) {
    errors.push("URLがhttps文字列ではない");
    return errors;
  }
  try {
    const host = new URL(url).host;
    if (!allowedHosts.has(host)) errors.push(`許可されていないホスト: ${host}`);
  } catch {
    errors.push("URLの解析に失敗");
  }
  return errors;
}

export function validateSessionId(sessionId) {
  if (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) {
    return [`sessionId形式が不正: ${sessionId}`];
  }
  return [];
}

/** 必須フィールドがすべて非null・非undefinedであることを確認する。 */
export function validateRequiredFields(obj, requiredFields) {
  const errors = [];
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") {
      errors.push(`必須フィールドが欠落: ${field}`);
    }
  }
  return errors;
}

/** 汎用エントリ検証：URL・sessionId（指定時）・必須フィールドをまとめて検証する。 */
export function validateEntry(entry, { allowedHosts, requireSessionId = true, requiredFields = [] }) {
  const errors = [
    ...validateUrl(entry.sourceUrl, allowedHosts),
    ...(requireSessionId ? validateSessionId(entry.sessionId) : []),
    ...validateRequiredFields(entry, requiredFields),
  ];
  return { valid: errors.length === 0, errors };
}
