import { Link } from "react-router-dom";
import { SITE_LAST_UPDATED, formatJapaneseDate } from "../config/site";

const linkClass =
  "rounded text-on-surface-variant hover:text-on-surface hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function Footer() {
  return (
    <footer className="mt-8 border-t border-outline-variant px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-2 text-center sm:text-left">
        <p className="text-xs font-medium text-on-surface-variant">β版・試験公開中</p>
        <p className="text-xs text-on-surface-variant">
          本サイトは、延岡市・延岡市議会が運営する公式サイトではありません。
        </p>
        <p className="text-xs text-on-surface-variant">
          このβ版URLの無断転載・不特定多数への拡散はご遠慮ください。
        </p>
        <div className="flex flex-col items-center gap-3 pt-1 text-sm sm:flex-row sm:justify-between">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
            <Link to="/about" className={linkClass}>
              このサイトについて
            </Link>
            <Link to="/terms" className={linkClass}>
              利用規約・免責事項
            </Link>
          </nav>
          <p className="text-xs text-on-surface-variant">最終更新：{formatJapaneseDate(SITE_LAST_UPDATED)}</p>
        </div>
      </div>
    </footer>
  );
}
