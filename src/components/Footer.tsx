import { Link } from "react-router-dom";
import { SITE_LAST_UPDATED, formatJapaneseDate } from "../config/site";
import { DataNotice } from "./DataNotice";

const linkClass =
  "rounded text-on-surface-variant hover:text-on-surface hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function Footer() {
  return (
    <footer className="mt-8 border-t border-outline-variant px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-2 text-center sm:text-left">
        <p className="text-xs font-medium text-on-surface-variant">β版・試験公開中</p>
        <p className="text-sm text-on-surface-variant">
          本サイトは、延岡市・延岡市議会が運営する公式サイトではありません。
        </p>
        <p className="text-xs text-on-surface-variant">
          このβ版URLの無断転載・不特定多数への拡散はご遠慮ください。
        </p>
        <DataNotice className="pt-1" />
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1 text-sm sm:justify-start">
          <Link to="/" className={linkClass}>
            ホーム
          </Link>
          <Link to="/" className={linkClass}>
            市議会議員一覧
          </Link>
          <Link to="/mayor" className={linkClass}>
            市長情報
          </Link>
          <Link to="/dashboard" className={linkClass}>
            ダッシュボード
          </Link>
          <Link to="/finance" className={linkClass}>
            延岡市の財政
          </Link>
          <Link to="/questions" className={linkClass}>
            一般質問データベース
          </Link>
          <Link to="/bills/votes" className={linkClass}>
            議案ごとの賛否
          </Link>
          <Link to="/about" className={linkClass}>
            このサイトについて
          </Link>
          <Link to="/updates" className={linkClass}>
            更新履歴
          </Link>
          <Link to="/editorial-policy" className={linkClass}>
            編集方針
          </Link>
          <Link to="/contact" className={linkClass}>
            情報提供・訂正依頼
          </Link>
          <Link to="/terms" className={linkClass}>
            利用規約・免責事項
          </Link>
          <Link to="/terms#privacy" className={linkClass}>
            プライバシーに関する案内
          </Link>
        </nav>
        <p className="pt-2 text-xs text-on-surface-variant sm:text-left">
          最終更新：{formatJapaneseDate(SITE_LAST_UPDATED)}
        </p>
      </div>
    </footer>
  );
}
