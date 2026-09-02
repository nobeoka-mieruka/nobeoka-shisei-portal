import { Link, useLocation } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { StatCard } from "../components/StatCard";
import { GlossaryNote } from "../components/GlossaryNote";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { cityOrganizationDivisions, cityOrganizationSections } from "../lib/cityOrganization";

export function CityOrganizationPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const dataAsOf = cityOrganizationSections
    .map((s) => s.dataAsOf)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">延岡市役所の組織一覧</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市公式ホームページ「組織でさがす」の公表内容に基づき、部・局・委員会・総合支所の配下にある課・室・センター・事務局の電話番号・所在地・公式URLを整理しています。相談内容から窓口を探したい場合は
          <Link to="/city-guide" className="mx-1 underline">
            市役所どこに行けばいい？診断
          </Link>
          もご利用ください。
        </p>
      </div>

      <GlossaryNote
        term="組織データについて"
        definition="延岡市公式サイトの各課ページに掲載された「連絡先」欄をそのまま転記しています。FAX番号が未公表の課はFAX欄を「未公表」と表示し、0や推測値では補完していません。組織改編（部課の新設・廃止・改称）の履歴は今回対象外です。"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="部・局・委員会等" value={cityOrganizationDivisions.length} unit="組織" />
        <StatCard label="課・室・センター等" value={cityOrganizationSections.length} unit="組織" />
      </div>

      <div className="space-y-4">
        {cityOrganizationDivisions.map((division) => {
          const sections = cityOrganizationSections.filter((s) => s.parentDivisionId === division.id);
          return (
            <div key={division.id} className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-on-surface">{division.name}</h2>
                <a
                  href={division.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline"
                >
                  公式ページ
                </a>
              </div>
              <ul className="mt-3 divide-y divide-outline-variant">
                {sections.map((section) => (
                  <li key={section.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="font-medium text-on-surface">{section.name}</p>
                    <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-on-surface-variant sm:grid-cols-2">
                      <div>
                        <dt className="inline">電話：</dt>
                        <dd className="inline">{section.phone}</dd>
                      </div>
                      <div>
                        <dt className="inline">FAX：</dt>
                        <dd className="inline">{section.fax ?? "未公表"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="inline">所在地：</dt>
                        <dd className="inline">
                          {section.address ?? "確認中"}
                          {section.floor && `　${section.floor}`}
                        </dd>
                      </div>
                    </dl>
                    {section.subSectionPhones && section.subSectionPhones.length > 1 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-primary">係ごとの電話番号を見る</summary>
                        <ul className="mt-1 space-y-0.5 pl-4 text-xs text-on-surface-variant">
                          {section.subSectionPhones.map((sub, i) => (
                            <li key={i}>
                              {sub.label ?? "係名不明"}：{sub.tel}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <a
                      href={section.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-primary underline"
                    >
                      公式ページ
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {dataAsOf && <LastUpdated className="mt-4" dataAsOfLabel="組織データの最終確認日" dataAsOf={dataAsOf} />}
      <CorrectionRequestButton pageName="延岡市役所の組織一覧" />
    </div>
  );
}
