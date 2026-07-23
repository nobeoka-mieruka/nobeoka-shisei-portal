import { Link, useLocation } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";

export function AboutPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <Breadcrumbs items={seo.breadcrumbs} />
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">このサイトについて</h1>
      </div>

      <SectionCard title="サイトの目的">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>
            このサイトは、延岡市の市長、市議会議員、会派、議会活動、市政に関する情報を、市民に分かりやすく伝えることを目的とした民間運営の情報サイトです。
          </p>
          <p>延岡市や延岡市議会が運営する公式サイトではありません。</p>
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

      <LastUpdated />

      <p className="text-sm">
        <Link
          to="/terms"
          className="rounded text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          利用規約・免責事項はこちら
        </Link>
      </p>
    </div>
  );
}
