import { Link, NavLink } from "react-router-dom";
import { SearchIcon } from "./icons";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    isActive
      ? "bg-secondary-container text-on-secondary-container"
      : "text-on-surface-variant hover:bg-surface-container-high"
  }`;

const searchLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    isActive
      ? "bg-secondary-container text-on-secondary-container"
      : "text-on-surface-variant hover:bg-surface-container-high"
  }`;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            to="/"
            aria-label="延岡市政見える化ポータルのトップページへ"
            className="flex min-w-0 items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <img
              src="/images/nobeoka-shisei-logo.webp"
              alt="延岡市政見える化ポータル"
              width={1536}
              height={1024}
              className="h-auto w-[clamp(200px,38vw,400px)] max-w-full shrink-0 rounded-md bg-white object-contain px-2 py-1.5"
            />
            <h1 className="sr-only">延岡市政見える化ポータル</h1>
          </Link>
          <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant sm:px-2.5 sm:text-xs">
            非公式
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
            <NavLink to="/compensation" className={navLinkClass}>
              報酬
            </NavLink>
            <NavLink to="/city-guide" className={navLinkClass}>
              市役所案内
            </NavLink>
          </nav>
          <NavLink to="/search" className={searchLinkClass} aria-label="サイト内検索へ移動">
            <SearchIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span>検索</span>
          </NavLink>
        </div>
      </div>
    </header>
  );
}
