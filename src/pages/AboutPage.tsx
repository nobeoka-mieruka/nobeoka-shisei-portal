import { Link, useLocation } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { getOperatorField } from "../config/operator";

const linkClass =
  "rounded text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function AboutPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const operatorName = getOperatorField("operatorName");
  const editorName = getOperatorField("editorName");
  const region = getOperatorField("region");
  const foundedDate = getOperatorField("foundedDate");
  const purpose = getOperatorField("purpose");
  const politicalRelationship = getOperatorField("politicalRelationship");
  const conflictOfInterest = getOperatorField("conflictOfInterest");
  const contactEmail = getOperatorField("contactEmail");
  const hasOperatorFields = Boolean(operatorName || editorName || region || foundedDate);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">このサイトについて</h1>
      </div>

      <SectionCard title="運営主体">
        {hasOperatorFields ? (
          <dl className="space-y-2 text-sm leading-relaxed text-on-surface">
            {operatorName && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="shrink-0 text-on-surface-variant">運営者</dt>
                <dd>{operatorName}</dd>
              </div>
            )}
            {editorName && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="shrink-0 text-on-surface-variant">編集責任者</dt>
                <dd>{editorName}</dd>
              </div>
            )}
            {region && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="shrink-0 text-on-surface-variant">所在地域</dt>
                <dd>{region}</dd>
              </div>
            )}
            {foundedDate && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="shrink-0 text-on-surface-variant">サイト開設日</dt>
                <dd>{formatJapaneseDate(foundedDate)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm leading-relaxed text-on-surface-variant">
            本サイトは非公式の個人運営プロジェクトです。運営者情報は、確定次第このページに掲載します。
          </p>
        )}
      </SectionCard>

      <SectionCard title="サイトの運営目的">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>
            このサイトは、延岡市の市長、市議会議員、会派、議会活動、市政に関する情報を、市民に分かりやすく伝えることを目的とした情報サイトです。
          </p>
          {purpose && <p>{purpose}</p>}
          <p>
            掲載情報は、延岡市、延岡市議会、各議員・会派・政治団体などが公開している情報をもとに整理しています。
          </p>
          <p>
            今後、市長交際費、一般質問と答弁、議案と賛否、政治資金、財政、地域活動などの情報を順次追加する予定です。
          </p>
          <p>
            情報の正確性には十分配慮していますが、最新かつ正確な情報については、必ず各公式サイトや公表資料をご確認ください。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="運営上の立場">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>このサイトは、延岡市や延岡市議会が運営する公式サイトではありません。</p>
          <p>
            特定の政党、会派、議員、候補者を支持、推薦、批判することを目的としていません。公開資料に基づき、市民が情報を確認しやすい形に整理することを目的としています。
          </p>
          {politicalRelationship && <p>{politicalRelationship}</p>}
          {conflictOfInterest && <p>{conflictOfInterest}</p>}
          <p>
            編集方針・政治的中立性についての詳しい考え方は、
            <Link to="/editorial-policy" className={linkClass}>
              編集方針・情報源
            </Link>
            のページにまとめています。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="主な情報源">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>本サイトでは、主に以下の公開情報をもとに内容を整理しています。</p>
          <ul className="list-disc space-y-1 pl-5 text-on-surface-variant">
            <li>延岡市公式サイト</li>
            <li>延岡市議会公式サイト</li>
            <li>各議員、会派、政治団体などが公開している公式情報</li>
            <li>その他の公的機関が公開している資料</li>
          </ul>
          <p>掲載内容の確認にあたっては、必ず各公式サイトや原資料もご確認ください。</p>
        </div>
      </SectionCard>

      <SectionCard title="情報の更新と訂正">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>
            掲載内容に誤りが確認された場合は速やかに修正し、重要な訂正は
            <Link to="/updates" className={linkClass}>
              更新履歴
            </Link>
            にも掲載します。
          </p>
          <p>
            情報提供をいただいた場合も、公式資料や一次情報を確認したうえで反映するため、すぐには反映されないことがあります。詳しい訂正・更新の方針は
            <Link to="/editorial-policy#correction-policy" className={linkClass}>
              編集方針・情報源
            </Link>
            のページに掲載しています。
          </p>
          <p>
            掲載内容の誤りに気づいた場合や、追加してほしい情報がある場合は、
            <Link to="/contact" className={linkClass}>
              情報提供・訂正依頼
            </Link>
            からお知らせください。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="お問い合わせ">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>
            掲載内容についてのご意見、誤りのご指摘、情報提供は
            <Link to="/contact" className={linkClass}>
              情報提供・訂正依頼
            </Link>
            のページからお願いします。
          </p>
          {contactEmail && (
            <p>
              メールでのお問い合わせ：
              <a href={`mailto:${contactEmail}`} className={linkClass}>
                {contactEmail}
              </a>
            </p>
          )}
        </div>
      </SectionCard>

      <LastUpdated />

      <p className="text-sm">
        <Link to="/terms" className={linkClass}>
          利用規約・免責事項を見る
        </Link>
      </p>
    </div>
  );
}
