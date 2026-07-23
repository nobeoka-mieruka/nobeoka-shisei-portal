import { Link } from "react-router-dom";
import { getSortedMayorPressConferences } from "../data/mayorPressConferences";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { StatCard } from "../components/StatCard";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MayorPressConferencesPage() {
  const conferences = getSortedMayorPressConferences();

  usePageTitle();

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <Breadcrumbs items={[{ label: "ホーム", to: "/" }, { label: "市長情報", to: "/mayor" }, { label: "市長定例記者会見" }]} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市長定例記者会見</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市公式ホームページに掲載された市長定例記者会見の発表内容を、そのまま整理して掲載しています。当サイトは延岡市公式サイトではありません。独自の評価や意見は加えていません。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="登録済み記者会見数" value={conferences.length} unit="件" />
      </div>

      {conferences.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          市長定例記者会見データを準備中です。公開資料を確認しながら順次追加します。
        </p>
      ) : (
        <ul className="space-y-3">
          {conferences.map((c) => (
            <li key={c.date}>
              <Link
                to={`/mayor/press-conferences/${c.date}`}
                className={`block rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high sm:p-5 ${linkClass}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-on-surface">{c.title}</p>
                  <span className="shrink-0 rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
                    延岡市公式発表
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  開催日：{formatJapaneseDate(c.date)}／発表事項{c.announcements.length}件
                </p>
                <p className="mt-2 border-t border-outline-variant pt-2 text-sm text-primary">発表内容を見る</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CorrectionRequestButton pageName="市長定例記者会見" />
    </div>
  );
}
