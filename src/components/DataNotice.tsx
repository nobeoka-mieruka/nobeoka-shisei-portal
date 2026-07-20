import { Link } from "react-router-dom";

const linkClass =
  "rounded text-on-surface-variant underline hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function DataNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-1.5 text-xs leading-relaxed text-on-surface-variant ${className}`}>
      <p>掲載内容は、延岡市および延岡市議会の公開資料、選挙公報、議員本人が公開するホームページ・SNS等を基に整理しています。</p>
      <p>
        情報に誤りや変更がある場合は、
        <Link to="/contact" className={linkClass}>
          情報提供・訂正依頼
        </Link>
        からお知らせください。
      </p>
      <p>
        当サイトは、特定の政党、会派、議員、候補者または政治団体を支持・推薦・批判することを目的としていません。
      </p>
    </div>
  );
}
