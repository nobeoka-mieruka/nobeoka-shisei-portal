import { Link, NavLink } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    isActive
      ? "bg-secondary-container text-on-secondary-container"
      : "text-on-surface-variant hover:bg-surface-container-high"
  }`;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
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
              className="h-8 w-auto max-w-[72vw] shrink-0 rounded-md bg-white object-contain px-1.5 py-1 sm:h-10 md:h-11 lg:h-14 lg:max-w-[520px]"
            />
            <h1 className="sr-only">延岡市政見える化ポータル</h1>
          </Link>
          <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant sm:px-2.5 sm:text-xs">
            非公式
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
          <NavLink to="/compensation" className={navLinkClass}>
            報酬
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
