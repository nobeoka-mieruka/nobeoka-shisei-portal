import { NavLink } from "react-router-dom";
import { HomeIcon, LandmarkIcon, YenIcon, SearchIcon, DocumentIcon } from "./icons";

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    isActive ? "text-on-secondary-container" : "text-on-surface-variant"
  }`;

/**
 * スマートフォン用の画面下部メニュー。「何を知りたいか」の入口（ホーム・検索・議会・市長・お金）に絞り、
 * それ以外のページ（報酬・市役所案内・ダッシュボード等）はヘッダーの「メニュー」とトップページから開ける。
 */
const ITEMS = [
  { to: "/", label: "ホーム", icon: HomeIcon, end: true },
  { to: "/search", label: "検索", icon: SearchIcon },
  { to: "/council-documents", label: "議会", icon: DocumentIcon },
  { to: "/mayor", label: "市長", icon: LandmarkIcon },
  { to: "/finance", label: "お金", icon: YenIcon },
];

export function BottomNav() {
  return (
    <nav aria-label="画面下部メニュー" className="fixed inset-x-0 bottom-0 z-20 border-t border-outline-variant bg-surface-container-low pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden print:hidden">
      <div className="mx-auto flex max-w-md items-stretch gap-1 px-2 min-[360px]:gap-2 min-[360px]:px-4">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={itemClass}>
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-8 w-full max-w-14 items-center justify-center rounded-full ${
                    isActive ? "bg-secondary-container" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
