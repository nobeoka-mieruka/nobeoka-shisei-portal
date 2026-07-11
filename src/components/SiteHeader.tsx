import { NavLink } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    isActive
      ? "bg-secondary-container text-on-secondary-container"
      : "text-on-surface-variant hover:bg-surface-container-high"
  }`;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <NavLink
            to="/"
            className="min-w-0 truncate text-lg font-semibold text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            延岡市政見える化ポータル
          </NavLink>
          <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
            β版
          </span>
        </div>
        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          <NavLink to="/" end className={navLinkClass}>
            議員一覧
          </NavLink>
          <NavLink to="/mayor" className={navLinkClass}>
            市長ページ
          </NavLink>
          <NavLink to="/dashboard" className={navLinkClass}>
            ダッシュボード
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
