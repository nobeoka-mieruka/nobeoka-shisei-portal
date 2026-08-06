import { Link, useLocation } from "react-router-dom";
import citySpecialPostsData from "../data/citySpecialPosts.json";
import type { CitySpecialPost, CitySpecialPostRole } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SectionCard } from "../components/SectionCard";
import { SourceList } from "../components/SourceList";
import { LandmarkIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";

const citySpecialPosts = citySpecialPostsData as CitySpecialPost[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const ROLE_ORDER: CitySpecialPostRole[] = ["deputy-mayor", "superintendent", "auditor", "agricultural-committee-member"];

const ROLE_DESCRIPTIONS: Record<CitySpecialPostRole, string> = {
  "deputy-mayor": "市長を補佐し、市長に事故があるとき等にその職務を代理します。市議会の同意を得て市長が選任します。",
  superintendent: "教育委員会の指揮監督のもと、教育委員会の事務をつかさどります。市議会の同意を得て市長が任命します。",
  auditor: "市の財務・事務執行を監査します。市議会の同意を得て市長が選任します。",
  "agricultural-committee-member": "農地の利用最適化等に関する事務を担う行政委員会（農業委員会）の委員です。市議会の同意を得て市長が任命します。",
};

export function CityOfficialsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const byRole = ROLE_ORDER.map((role) => ({
    role,
    posts: citySpecialPosts.filter((p) => p.role === role),
  })).filter((g) => g.posts.length > 0);

  const roleLabelFor = (role: CitySpecialPostRole) =>
    citySpecialPosts.find((p) => p.role === role)?.roleLabel ?? role;

  const latestVerifiedAt = citySpecialPosts.reduce<string | undefined>(
    (latest, p) => (!latest || p.lastVerifiedAt > latest ? p.lastVerifiedAt : latest),
    undefined,
  );

  return (
    <div className="px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <LandmarkIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">副市長・教育長・行政委員会委員</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          市長以外の特別職・行政委員会委員のうち、市議会の同意（人事議案）を経て就任したことが公式資料で確認できる現職者を掲載しています。市長は
          <Link to="/mayor" className={`mx-1 text-on-primary-container underline ${linkClass}`}>
            市長のページ
          </Link>
          、歴代市長は
          <Link to="/mayors" className={`mx-1 text-on-primary-container underline ${linkClass}`}>
            歴代市長アーカイブ
          </Link>
          をご覧ください。
        </p>
      </div>

      <div className="mb-5 rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        選挙管理委員会委員については、公式資料で委員全員の氏名・任期を確認できていないため、本ページには未掲載です（委員長のみ報道等で氏名の手がかりがありますが、一次資料での確認が取れ次第、追加します。最終確認日：
        {latestVerifiedAt ? formatJapaneseDate(latestVerifiedAt) : "確認中"}）。監査委員は、延岡市公式ホームページ「監査委員制度の概要」で識見委員2名・議選委員1名の計3名と明記されていることを確認し、掲載しています。
      </div>

      {byRole.map(({ role, posts }) => (
        <SectionCard key={role} title={`${roleLabelFor(role)}（${posts.length}名）`} className="mb-4">
          <p className="text-xs leading-relaxed text-on-surface-variant">{ROLE_DESCRIPTIONS[role]}</p>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {posts.map((p) => (
              <li key={p.id} className="rounded-lg border border-outline-variant p-3">
                <p className="text-sm font-semibold text-on-surface">
                  {p.name}
                  {p.nameKana && <span className="ml-1.5 text-xs font-normal text-on-surface-variant">（{p.nameKana}）</span>}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {p.appointedDate ? `${formatJapaneseDate(p.appointedDate)} 就任（議会同意）` : "就任日確認中"}
                </p>
                {p.notes && <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">{p.notes}</p>}
                {p.relatedLinks && p.relatedLinks.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.relatedLinks.map((l) => (
                      <li key={l.to}>
                        <Link to={l.to} className={`text-xs font-medium text-primary hover:underline ${linkClass}`}>
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2">
                  <SourceList sources={p.sourceRefs} />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}

      <LastUpdated
        className="mt-4"
        dataAsOfLabel="掲載データの最終確認日"
        dataAsOf={latestVerifiedAt ? formatJapaneseDate(latestVerifiedAt) : undefined}
      />

      <div className="mt-4">
        <CorrectionRequestButton pageName="副市長・教育長・行政委員会委員" />
      </div>
    </div>
  );
}
