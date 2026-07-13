import { formatJapaneseDate } from "../config/site";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(value: string): string {
  return ISO_DATE.test(value) ? formatJapaneseDate(value) : value;
}

interface LastUpdatedInfoProps {
  verifiedAt?: string;
  updatedAt?: string;
  className?: string;
}

export function LastUpdatedInfo({ verifiedAt, updatedAt, className = "" }: LastUpdatedInfoProps) {
  if (!verifiedAt && !updatedAt) return null;

  return (
    <div className={`space-y-0.5 text-xs text-on-surface-variant ${className}`}>
      {verifiedAt && <p>最終確認日：{formatDate(verifiedAt)}</p>}
      {updatedAt && <p>データ更新日：{formatDate(updatedAt)}</p>}
    </div>
  );
}
