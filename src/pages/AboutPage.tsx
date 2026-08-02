import { Link, useLocation } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { GlobeIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getOperatorField } from "../config/operator";
import { getSeoForPath } from "../lib/seo";

const linkClass =
  "rounded text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const externalLinkClass = `inline-flex items-center gap-1 ${linkClass}`;

const monetizationLabels: Record<string, string> = {
  none: "現在、本サイトには広告を掲載しておらず、閲覧に料金はかかりません。",
  ads: "本サイトには広告を掲載しています。",
  donations: "本サイトは寄付を受け付けています。",
  other: "収益化の状況については、随時このページでお知らせします。",
};

export function AboutPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const operatorName = getOperatorField("operatorName");
  const editorName = getOperatorField("editorName");
  const operatorType = getOperatorField("operatorType");
  const region = getOperatorField("region");
  const foundedDate = getOperatorField("foundedDate");
  const politicalRelationship = getOperatorField("politicalRelationship");
  const conflictOfInterest = getOperatorField("conflictOfInterest");
  const contactEmail = getOperatorField("contactEmail");
  const monetizationStatus = getOperatorField("monetizationStatus") ?? "none";
  const aboutPageUpdatedAt = getOperatorField("aboutPageUpdatedAt");

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
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          {operatorName && (
            <p className="font-medium">
              運営：{operatorName}
              {operatorType && <span className="ml-1 text-xs font-normal text-on-surface-variant">（{operatorType}）</span>}
            </p>
          )}
          <p>
            本サイトは、{operatorName ?? "運営者"}が{operatorType ?? "個人"}で運営する、非公式の市政情報整理サイトです。
          </p>
          <p>延岡市、延岡市議会その他の公表元が公開している資料を基に、市民が情報を確認しやすい形へ整理して掲載しています。</p>
          <p>本サイトは、延岡市または延岡市議会が運営する公式サイトではありません。</p>
          <p>
            運営者へのお問い合わせは、
            <Link to="/contact" className={linkClass}>
              お問い合わせフォーム
            </Link>
            をご利用ください。
          </p>
          {(editorName || region || foundedDate) && (
            <dl className="space-y-1 text-xs text-on-surface-variant">
              {editorName && (
                <div className="flex flex-wrap gap-x-2">
                  <dt>編集責任者</dt>
                  <dd>{editorName}</dd>
                </div>
              )}
              {region && (
                <div className="flex flex-wrap gap-x-2">
                  <dt>所在地域</dt>
                  <dd>{region}</dd>
                </div>
              )}
              {foundedDate && (
                <div className="flex flex-wrap gap-x-2">
                  <dt>サイト開設日</dt>
                  <dd>{formatJapaneseDate(foundedDate)}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </SectionCard>

      <SectionCard title="サイトの運営目的">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>
            本サイトは、延岡市の市長、市議会議員、会派、議会活動、議案、表決結果、一般質問、財政その他の市政情報を、市民に分かりやすく伝えることを目的としています。
          </p>
          <p>
            掲載情報は、延岡市、延岡市議会、各議員、会派、政治団体その他の公表元が公開している資料を基に整理しています。
          </p>
          <p>
            市長、議員、議会活動、議案、表決結果、一般質問、財政などの情報を、公式資料の公開状況に応じて順次整理・更新しています。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="運営上の立場">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>本サイトは、延岡市または延岡市議会が運営する公式サイトではありません。</p>
          <p>特定の政党、会派、議員、候補者、政治団体、議案または政策への支持、推薦、反対、批判を目的としていません。</p>
          <p>公開資料に基づく事実情報を、市民が確認しやすい形に整理することを目的としています。</p>
          <p>議員の点数化、順位付け、推薦、当落予測または政治姿勢の自動判定は行いません。</p>
          <p>
            編集方針・政治的中立性についての詳しい考え方は、
            <Link to="/editorial-policy" className={linkClass}>
              編集方針・情報源
            </Link>
            のページにまとめています。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="掲載基準と政治的中立性">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>
            運営者と特定の議員、会派、候補者、政治団体等との関係の有無にかかわらず、掲載基準および表示形式は可能な限り統一し、公式資料に基づいて情報を整理します。
          </p>
          <p>特定の人物や団体に有利または不利となることを目的として、情報を選別、改変または評価することはありません。</p>
          {politicalRelationship && <p>{politicalRelationship}</p>}
          {conflictOfInterest && <p>{conflictOfInterest}</p>}
        </div>
      </SectionCard>

      <SectionCard title="情報の正確性について">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>
            掲載内容は公式資料を基に確認していますが、資料の更新時期、表現、公開状況または読み取り方により、最新情報と異なる場合があります。
          </p>
          <p>正式な内容については、延岡市、延岡市議会その他の公表元が提供する公式資料をご確認ください。</p>
          <p>
            公式資料から個人別の賛否、出欠、採決状況などを確認できない場合は、推測せず「確認できません」「確認待ち」などと表示します。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="確認待ち情報について">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>
            公式資料の表現が複雑な案件や、資料だけでは結果区分を確定できない案件については、非掲載にせず「確認待ち」「一部確認済み」などの状態を明示して掲載する場合があります。
          </p>
          <p>確認できていない項目を推測で補完することはありません。</p>
          <p>確認待ち情報については、公式資料との照合作業後に順次更新します。</p>
          <p>
            <Link to="/bills/votes" className={linkClass}>
              議案ごとの賛否
            </Link>
            のページでは、確認状況を絞り込み条件としても確認できます。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="情報の主な出典">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>
            主な情報源は、延岡市公式サイト、延岡市議会公式サイト、会議録、審議結果、市議会だより、条例、議案書、予算書、決算資料、選挙管理委員会の公表資料、各議員・会派・政治団体が公表している情報などです。
          </p>
          <p>各ページで個別の出典を確認できる場合は、資料名、公式ページ、PDF、該当ページ、確認日などを表示します。</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <a
              href="https://www.city.nobeoka.miyazaki.jp/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="延岡市公式サイトを新しいタブで開く"
              className={externalLinkClass}
            >
              <GlobeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              延岡市公式サイト
            </a>
            <a
              href="https://www.city.nobeoka.miyazaki.jp/site/gikai/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="延岡市議会公式サイトを新しいタブで開く"
              className={externalLinkClass}
            >
              <GlobeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              延岡市議会公式サイト
            </a>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="掲載内容の訂正について">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>
            掲載内容に誤りや不足を見つけた場合は、お問い合わせフォームから、該当ページ、訂正を希望する内容および根拠となる公式資料をご連絡ください。
          </p>
          <p>内容を確認し、必要に応じて修正します。</p>
          <p>第三者から情報提供があった場合も、その情報だけで内容を確定せず、公式資料との照合を行います。</p>
        </div>
        <div className="mt-3">
          <CorrectionRequestButton pageName="このサイトについて" />
        </div>
      </SectionCard>

      <SectionCard title="個人情報の取り扱い">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>本サイトでは、公開されている公的資料や、議員・会派・政治団体等が自ら公表している情報を中心に取り扱います。</p>
          <p>
            公開の必要性がない個人の住所、私用電話番号、個人メールアドレス、生年月日の詳細その他の私生活上の情報は、原則として掲載しません。
          </p>
          <p>お問い合わせフォームから取得した情報は、問い合わせ対応および掲載内容の確認以外の目的には使用しません。</p>
          <p>
            より詳しい取り扱いについては、
            <Link to="/terms#privacy" className={linkClass}>
              プライバシーについて
            </Link>
            もあわせてご確認ください。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="広告・収益化について">
        <p className="text-sm leading-relaxed text-on-surface">
          {monetizationLabels[monetizationStatus] ?? monetizationLabels.none}
        </p>
      </SectionCard>

      <SectionCard title="免責事項">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>本サイトの掲載内容については正確性の確保に努めていますが、完全性、最新性または正確性を保証するものではありません。</p>
          <p>本サイトの情報を利用したことにより生じた損害等について、運営者は法令上認められる範囲を超えて責任を負うものではありません。</p>
          <p>選挙、議案、行政手続、法律、税務その他の重要な判断については、必ず公式資料または関係機関へご確認ください。</p>
          <p>
            より詳しい規約・免責事項は、
            <Link to="/terms" className={linkClass}>
              利用規約・免責事項
            </Link>
            のページにまとめています。
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

      {aboutPageUpdatedAt && (
        <p className="px-1 text-xs text-on-surface-variant">最終更新日：{formatJapaneseDate(aboutPageUpdatedAt)}</p>
      )}

      <LastUpdated />

      <p className="text-sm">
        <Link to="/terms" className={linkClass}>
          利用規約・免責事項を見る
        </Link>
      </p>
    </div>
  );
}
