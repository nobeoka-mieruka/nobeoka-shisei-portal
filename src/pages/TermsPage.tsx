import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";

const sections: { id?: string; title: string; body: string }[] = [
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
];

export function TermsPage() {
  usePageTitle("利用規約・免責事項");

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">利用規約・免責事項</h1>
      </div>

      <SectionCard title="規約・免責事項の内容">
        <div className="space-y-4">
          {sections.map((s) => (
            <div key={s.title} id={s.id}>
              <h2 className="text-sm font-semibold text-on-surface">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{s.body}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <LastUpdated />
    </div>
  );
}
