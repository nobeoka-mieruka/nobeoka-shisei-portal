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
import { CsvDownloadButton } from "../components/CsvDownloadButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate, SITE_URL } from "../config/site";
import type { CsvColumn } from "../lib/csv";

const citySpecialPosts = citySpecialPostsData as CitySpecialPost[];

const CITY_OFFICIALS_CSV_COLUMNS: CsvColumn<CitySpecialPost>[] = [
  { header: "役職", value: (p) => p.roleLabel },
  { header: "氏名", value: (p) => p.name },
  { header: "読み仮名", value: (p) => p.nameKana },
  { header: "現職・歴代", value: (p) => (p.status === "former" ? "歴代" : "現職") },
  { header: "就任日", value: (p) => p.appointedDate },
  { header: "退任日", value: (p) => p.retiredDate },
  { header: "出典URL", value: (p) => p.sourceRefs.map((s) => s.url) },
  { header: "最終確認日", value: (p) => p.lastVerifiedAt },
  { header: "サイト内URL", value: () => `${SITE_URL}/city-officials` },
];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const ROLE_ORDER: CitySpecialPostRole[] = [
  "deputy-mayor",
  "superintendent",
  "auditor",
  "agricultural-committee-member",
  "election-commission-member",
  "election-commission-alternate",
];

const ROLE_DESCRIPTIONS: Record<CitySpecialPostRole, string> = {
  "deputy-mayor": "市長を補佐し、市長に事故があるとき等にその職務を代理します。市議会の同意を得て市長が選任します。",
  superintendent: "教育委員会の指揮監督のもと、教育委員会の事務をつかさどります。市議会の同意を得て市長が任命します。",
  auditor: "市の財務・事務執行を監査します。市議会の同意を得て市長が選任します。",
  "agricultural-committee-member": "農地の利用最適化等に関する事務を担う行政委員会（農業委員会）の委員です。市議会の同意を得て市長が任命します。",
  "election-commission-member":
    "選挙の管理執行に関する事務を担う行政委員会（選挙管理委員会）の委員です（地方自治法第182条）。市議会が指名推選により選挙します。委員長・職務代理者は委員の互選によるため、本ページでは委員長を特定していません。",
  "election-commission-alternate":
    "選挙管理委員に欠員が生じた場合に、あらかじめ議会が定めた順序で補欠する候補者です（地方自治法第182条）。",
  "assistant-mayor":
    "2007年3月31日以前に存在した役職で、現在の副市長に相当します（地方自治法改正により副市長制度へ移行）。市議会の同意を得て市長が選任していました。",
  treasurer:
    "2007年3月31日以前に存在した役職で、市の会計事務を担当しました（地方自治法改正により廃止、事務は会計管理者へ移行）。市議会の同意を得て市長が選任していました。",
};

export function CityOfficialsPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const currentPosts = citySpecialPosts.filter((p) => p.status !== "former");
  const formerPosts = citySpecialPosts.filter((p) => p.status === "former");

  const byRole = ROLE_ORDER.map((role) => ({
    role,
    posts: currentPosts.filter((p) => p.role === role),
  })).filter((g) => g.posts.length > 0);

  const roleLabelFor = (role: CitySpecialPostRole) =>
    citySpecialPosts.find((p) => p.role === role)?.roleLabel ?? role;

  // 副市長・教育長・監査委員・農業委員会委員は市長が任命し市議会が同意する（同意議決）。
  // 選挙管理委員・補充員は市議会が指名推選により選挙する（同意ではない）。表記を役職ごとに区別する。
  const isCouncilElected = (role: CitySpecialPostRole) =>
    role === "election-commission-member" || role === "election-commission-alternate";
  const appointmentLabelFor = (p: CitySpecialPost) => {
    if (!p.appointedDate) return "就任日確認中";
    return isCouncilElected(p.role)
      ? `${formatJapaneseDate(p.appointedDate)} 市議会にて選挙（指名推選）`
      : `${formatJapaneseDate(p.appointedDate)} 就任（議会同意）`;
  };

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
        選挙管理委員・補充員は、令和5年12月定例会（12月7日）の本会議録原文（日程第四 選挙管理委員及び補充員の選挙）で、委員4名・補充員4名の氏名が確定していることを確認し掲載しています。ただし委員長は委員の互選で決まるため公開の本会議では確認できず、本ページでは特定していません（最終確認日：
        {latestVerifiedAt ? formatJapaneseDate(latestVerifiedAt) : "確認中"}）。監査委員は、延岡市公式ホームページ「監査委員制度の概要」で識見委員2名・議選委員1名の計3名と明記されていることを確認し、掲載しています。
      </div>

      <div className="mb-4 flex justify-end">
        <CsvDownloadButton filename="nobeoka-city-officials.csv" rows={citySpecialPosts} columns={CITY_OFFICIALS_CSV_COLUMNS} />
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
                <p className="mt-1 text-xs text-on-surface-variant">{appointmentLabelFor(p)}</p>
                {p.termNote && <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">{p.termNote}</p>}
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

      {formerPosts.length > 0 && (
        <SectionCard title={`歴代（元職、${formerPosts.length}名）`} className="mb-4">
          <p className="text-xs leading-relaxed text-on-surface-variant">
既存データベース（議案ごとの賛否）に登録済みの人事同意議案や、延岡市史等の一次資料から在任が確認できた方のみ掲載しています。助役・収入役は2007年4月の制度廃止により現職者がいません。退任日は、退任自体に議会同意を要しないため公式資料で確認できない場合があります。
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {formerPosts.map((p) => (
              <li key={p.id} className="rounded-lg border border-outline-variant p-3">
                <p className="text-sm font-semibold text-on-surface">
                  {p.roleLabel}：{p.name}
                  {p.nameKana && <span className="ml-1.5 text-xs font-normal text-on-surface-variant">（{p.nameKana}）</span>}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {p.appointedDate ? `${formatJapaneseDate(p.appointedDate)} 就任（議会同意）` : "就任日確認中"}
                  {p.retiredDate ? `〜${formatJapaneseDate(p.retiredDate)} 退任` : "〜退任日確認中"}
                </p>
                {p.termNote && <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">{p.termNote}</p>}
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
      )}

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
