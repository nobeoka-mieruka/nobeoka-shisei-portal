import { NavLink } from "react-router-dom";
import { HomeIcon, LandmarkIcon, ChartBarIcon, YenIcon } from "./icons";

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    isActive ? "text-on-secondary-container" : "text-on-surface-variant"
  }`;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-outline-variant bg-surface-container-low pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden print:hidden">
      <div className="mx-auto flex max-w-md items-stretch gap-2 px-4">
        <NavLink to="/" end className={itemClass}>
          {({ isActive }) => (
            <>
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full ${
                  isActive ? "bg-secondary-container" : ""
                }`}
              >
                <HomeIcon className="h-5 w-5" />
              </span>
              議員一覧
            </>
          )}
        </NavLink>
        <NavLink to="/mayor" className={itemClass}>
          {({ isActive }) => (
            <>
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full ${
                  isActive ? "bg-secondary-container" : ""
                }`}
              >
                <LandmarkIcon className="h-5 w-5" />
              </span>
              市長ページ
            </>
          )}
        </NavLink>
        <NavLink to="/dashboard" className={itemClass}>
          {({ isActive }) => (
            <>
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full ${
                  isActive ? "bg-secondary-container" : ""
                }`}
              >
                <ChartBarIcon className="h-5 w-5" />
              </span>
              ダッシュボード
            </>
          )}
        </NavLink>
        <NavLink to="/compensation" className={itemClass}>
          {({ isActive }) => (
            <>
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full ${
                  isActive ? "bg-secondary-container" : ""
                }`}
              >
                <YenIcon className="h-5 w-5" />
              </span>
              報酬
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
