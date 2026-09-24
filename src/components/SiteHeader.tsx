import { Link, NavLink } from "react-router-dom";
import { SearchIcon } from "./icons";
import { SITE_NAV_GROUPS } from "../config/siteNavigation";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded-full px-3 py-2 text-sm font-medium transition ${focusRing} ${
    isActive
      ? "bg-secondary-container text-on-secondary-container"
      : "text-on-surface-variant hover:bg-surface-container-high"
  }`;

const searchLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition ${focusRing} ${
    isActive
      ? "bg-secondary-container text-on-secondary-container"
      : "text-on-surface-variant hover:bg-surface-container-high"
  }`;

/** PCで常に見せる主要な入口（その他はメニューの中）。 */
const PRIMARY_LINKS = [
  { label: "ホーム", to: "/", end: true },
  { label: "テーマ", to: "/themes" },
  { label: "市政の流れ", to: "/timeline" },
  { label: "議会", to: "/council-documents" },
  { label: "市長", to: "/mayor" },
  { label: "お金", to: "/finance" },
];

/** メニュー内のリンクを押したら、開いているメニューを閉じる（ページ遷移後も開いたままにしない）。 */
function closeMenu(e: React.MouseEvent<HTMLElement>) {
  const details = e.currentTarget.closest("details");
  if (details) details.open = false;
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-3 py-2 sm:gap-x-4 sm:gap-y-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <Link
            to="/"
            aria-label="延岡市政見える化ポータルのトップページへ"
            className={`flex min-w-0 items-center rounded ${focusRing}`}
          >
            <img
              src="/images/nobeoka-shisei-logo.webp"
              alt="延岡市政見える化ポータル"
              width={1536}
              height={1024}
              className="h-auto w-[160px] max-w-full shrink-0 rounded-md bg-white object-contain px-1.5 py-1 sm:w-[clamp(200px,38vw,400px)] sm:px-2 sm:py-1.5"
            />
          </Link>
          <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant sm:px-2.5 sm:text-xs">
            非公式
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <nav aria-label="主要メニュー" className="hidden shrink-0 items-center gap-0.5 lg:flex">
            {PRIMARY_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navLinkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <NavLink to="/search" className={searchLinkClass} aria-label="サイト内検索へ移動">
            <SearchIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span>検索</span>
          </NavLink>
          <details className="relative">
            <summary
              className={`flex min-h-11 cursor-pointer list-none items-center rounded-full px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high ${focusRing}`}
            >
              メニュー
            </summary>
            <nav
              aria-label="サイト全体のメニュー"
              className="absolute right-0 top-full z-30 mt-1 max-h-96 w-72 overflow-y-auto rounded-2xl bg-surface-container-high p-3 shadow-e2"
            >
              {SITE_NAV_GROUPS.map((g) => (
                <div key={g.title} className="mb-2 last:mb-0">
                  <p className="px-2 text-xs font-semibold text-on-surface-variant">{g.title}</p>
                  <ul>
                    {g.links.map((l) => (
                      <li key={l.to}>
                        <Link
                          to={l.to}
                          onClick={closeMenu}
                          className={`flex min-h-11 items-center rounded-lg px-2 text-sm text-on-surface hover:bg-surface-container-highest ${focusRing}`}
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
