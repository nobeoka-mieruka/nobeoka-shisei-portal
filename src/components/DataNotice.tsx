export function DataNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-1 text-xs leading-relaxed text-on-surface-variant ${className}`}>
      <p>
        掲載内容は、延岡市および延岡市議会の公開資料、選挙公報、議員本人が公開するホームページ・SNS等を基に整理しています。情報に誤りや変更がある場合は、情報提供・訂正フォームからお知らせください。
      </p>
      <p>
        当サイトは、特定の政党、会派、議員、候補者または政治団体を支持・推薦・批判することを目的としていません。
      </p>
    </div>
  );
}
