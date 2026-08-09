const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** ページ切替時にスクロール位置を戻す先の要素ID（省略時はスクロールしない）。 */
  scrollTargetId?: string;
}

/**
 * 件数の多い一覧（議案賛否、一般質問アーカイブ等）を分割表示するための共通ページネーション。
 * 前へ／次へボタンとページ番号（現在ページの前後2件＋先頭・末尾）を表示する。
 * スマートフォンでの誤タップを避けるため、ボタンは44px以上のタップ領域を確保している。
 */
export function Pagination({ currentPage, totalPages, onPageChange, scrollTargetId }: PaginationProps) {
  if (totalPages <= 1) return null;

  const goTo = (page: number) => {
    const clamped = Math.max(1, Math.min(totalPages, page));
    onPageChange(clamped);
    if (scrollTargetId) {
      document.getElementById(scrollTargetId)?.scrollIntoView({ block: "start" });
    }
  };

  const pageNumbers = new Set<number>([1, totalPages, currentPage]);
  for (let d = 1; d <= 2; d++) {
    if (currentPage - d >= 1) pageNumbers.add(currentPage - d);
    if (currentPage + d <= totalPages) pageNumbers.add(currentPage + d);
  }
  const sorted = Array.from(pageNumbers).sort((a, b) => a - b);

  const buttonClass = (active: boolean) =>
    `flex h-11 min-w-[44px] items-center justify-center rounded-full px-3 text-sm font-medium transition ${focusRing} ${
      active
        ? "bg-primary text-on-primary"
        : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
    }`;

  return (
    <nav aria-label="ページ送り" className="mt-4 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage <= 1}
        className={`flex h-11 min-w-[44px] items-center justify-center rounded-full bg-surface-container-high px-4 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest disabled:pointer-events-none disabled:opacity-40 ${focusRing}`}
        aria-label="前のページ"
      >
        ＜前へ
      </button>
      {sorted.map((page, i) => (
        <span key={page} className="flex items-center gap-2">
          {i > 0 && sorted[i - 1] !== page - 1 && <span className="text-on-surface-variant">…</span>}
          <button
            type="button"
            onClick={() => goTo(page)}
            aria-current={page === currentPage ? "page" : undefined}
            aria-label={`${page}ページ目`}
            className={buttonClass(page === currentPage)}
          >
            {page}
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={`flex h-11 min-w-[44px] items-center justify-center rounded-full bg-surface-container-high px-4 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest disabled:pointer-events-none disabled:opacity-40 ${focusRing}`}
        aria-label="次のページ"
      >
        次へ＞
      </button>
    </nav>
  );
}
