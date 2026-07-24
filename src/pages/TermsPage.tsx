import { useLocation } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";

const sections: { id?: string; title: string; body: string; link?: { label: string; url: string } }[] = [
  {
    title: "1. 掲載情報について",
    body: "本サイトは、公開情報をもとに作成しています。情報の正確性や完全性の確保に努めていますが、内容を保証するものではありません。",
  },
  {
    title: "2. 公式情報の確認",
    body: "市政、議会、選挙、政治資金、制度などに関する正式な判断には、延岡市、延岡市議会、宮崎県、総務省などの公式情報をご確認ください。",
  },
  {
    title: "3. 免責事項",
    body: "本サイトの情報を利用したことによって生じた損害や不利益について、運営者は責任を負いません。",
  },
  {
    title: "4. 内容の変更",
    body: "掲載内容は、予告なく追加、修正、削除する場合があります。",
  },
  {
    title: "5. 外部リンク",
    body: "外部サイトの内容や安全性について、本サイトは責任を負いません。",
  },
  {
    title: "6. 著作権・出典",
    body: "文章、画像、ロゴ、資料などの権利は、それぞれの権利者に帰属します。引用や転載を行う場合は、出典を明記してください。",
  },
  {
    title: "7. 誤りの連絡",
    body: "掲載内容に誤りがある場合は、確認のうえ必要に応じて修正します。",
  },
  {
    id: "privacy",
    title: "8. プライバシーについて",
    body: "当サイトの閲覧にあたって、会員登録やログインは必要なく、当サイト自体が閲覧者の個人情報を収集することはありません。「情報提供・訂正依頼」フォームからご連絡いただいた場合のみ、入力された内容を問い合わせ内容の確認・返信のために使用します。このフォームはGoogleフォームを利用しているため、入力内容はGoogleのサービスを通じて送信されます。",
  },
  {
    id: "analytics",
    title: "9. アクセス解析（Google Analytics）について",
    body: "当サイトでは、利用状況を把握するためにGoogle Analytics 4（GA4）を利用しています。ページの閲覧数、閲覧したページ、利用端末の種類などの情報が収集される場合があります。氏名、電話番号、住所などを入力しなくても閲覧いただけます。運営者は、Google Analyticsで取得した情報を用いて個人を直接特定することを目的とした利用は行いません。ブラウザの設定や広告ブロック機能などにより、計測を制限できる場合があります。",
    link: { label: "Googleのプライバシーポリシー", url: "https://policies.google.com/privacy" },
  },
];

export function TermsPage() {
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
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">利用規約・免責事項</h1>
      </div>

      <SectionCard title="規約・免責事項の内容">
        <div className="space-y-4">
          {sections.map((s) => (
            <div key={s.title} id={s.id}>
              <h2 className="text-sm font-semibold text-on-surface">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{s.body}</p>
              {s.link && (
                <a
                  href={s.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.link.label}（外部サイトが新しいタブで開きます）`}
                  className="mt-1 inline-block rounded text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {s.link.label}
                  <span aria-hidden>（外部サイト）</span>
                </a>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <LastUpdated />
    </div>
  );
}
