import { Link, useLocation } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { ChartBarIcon, DocumentIcon, LandmarkIcon, YenIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

interface CompareLink {
  to: string;
  title: string;
  description: string;
}

const compareLinks: CompareLink[] = [
  { to: "/compare/mayors", title: "歴代市長の比較", description: "任期・就任回数・出典を最大4名まで並べて比較します。" },
  { to: "/compare/finance", title: "年度別財政の比較", description: "人口・予算・市債・基金・財政健全化判断比率をまとめて比較します。" },
  { to: "/compare/population", title: "人口の比較", description: "人口・世帯数を最大4年度まで並べて比較します。" },
  { to: "/compare/budget", title: "予算・決算の比較", description: "一般会計の当初予算・補正後予算・決算額を比較します。" },
  { to: "/compare/debt", title: "市債の比較", description: "市債発行額・年度末残高（区分別）を比較します。" },
  { to: "/compare/funds", title: "基金の比較", description: "財源調整用基金・その他特定目的基金の残高を比較します。" },
  { to: "/compare/policies", title: "政策の比較", description: "市長・議員・会派・市の政策を最大4件まで並べて比較します。" },
];

export function ComparePage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市政アーカイブの比較</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          歴代市長・年度別財政を、最大4件まで選んで比較できます。点数化や優劣・勝敗の判定は行いません。データが少ない項目は「資料未確認」と表示し、0とは区別しています。
        </p>
      </div>

      <SectionCard title="比較の種類を選ぶ">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {compareLinks.map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                className={`block h-full rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
              >
                <div className="flex items-center gap-2">
                  {c.to === "/compare/mayors" ? (
                    <LandmarkIcon className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
                  ) : c.to === "/compare/policies" ? (
                    <DocumentIcon className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
                  ) : (
                    <YenIcon className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
                  )}
                  <p className="text-sm font-semibold text-on-surface">{c.title}</p>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">{c.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        現在登録されているデータは限られています。登録が少ない項目は各比較ページで「比較には2件以上の選択が必要です」等、状況をそのまま表示します。公式資料で確認できたものから順次追加します。
      </p>

      <LastUpdated className="mt-4" />
    </div>
  );
}
