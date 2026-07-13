import { formatJapaneseDate } from "../config/site";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ISO形式なら日本語表記に変換する。日付として不正な値（例: 2026-13-40）は null を返し、非表示にする。 */
function formatDate(value: string): string | null {
  const match = value.match(ISO_DATE);
  if (!match) return value; // ISO形式でなければ、すでに整形済みの文字列として扱う
  const [, , m, d] = match;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return formatJapaneseDate(value);
}

interface LastUpdatedInfoProps {
  verifiedAt?: string;
  updatedAt?: string;
  className?: string;
}

export function LastUpdatedInfo({ verifiedAt, updatedAt, className = "" }: LastUpdatedInfoProps) {
  const verified = verifiedAt ? formatDate(verifiedAt) : null;
  const updated = updatedAt ? formatDate(updatedAt) : null;

  if (!verified && !updated) return null;

  if (verified && updated && verified === updated) {
    return (
      <div className={`text-xs text-on-surface-variant ${className}`}>
        <p>
          最終確認日・データ更新日：{verified}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-0.5 text-xs text-on-surface-variant ${className}`}>
      {verified && <p>最終確認日：{verified}</p>}
      {updated && <p>データ更新日：{updated}</p>}
    </div>
  );
}
