import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

const categoryList = [
  "延岡市公式情報",
  "延岡市議会公式情報",
  "選挙管理委員会資料",
  "議員本人による発信",
  "市長本人による発信",
  "政党または会派による発表",
  "その他の公開資料",
];

const sourceList = [
  "延岡市公式ホームページ",
  "延岡市議会公式ホームページ",
  "会議録",
  "議案書",
  "採決結果",
  "選挙管理委員会などが公開する資料",
  "議員本人の公式ホームページ",
  "議員本人の公式SNS",
  "市長本人の公式ホームページおよび公式SNS",
  "政党、会派、政治団体などの公式発表",
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export function EditorialPolicyPage() {
  usePageTitle({
    title: "編集方針・情報源",
    description: "延岡市政見える化ポータルの編集方針、情報源、掲載しない情報の範囲について説明しています。",
  });

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">編集方針</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          延岡市政見える化ポータルが、情報をどのように集め、どのような考え方で紹介しているかをまとめています。
        </p>
      </div>

      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-e1 sm:p-8">
        <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
          <p>
            延岡市政見える化ポータルは、延岡市政や延岡市議会に関する情報を、市民がスマートフォンなどから分かりやすく確認できるよう整理・紹介する情報サイトです。
          </p>
          <p className="font-medium text-slate-900">
            当サイトは、延岡市および延岡市議会が運営する公式サイトではありません。
          </p>
          <p>
            当サイトでは、特定の政党、会派、議員、市長、候補者または政治団体を支持、推薦、批判することを目的としていません。
          </p>
        </div>

        <Section title="掲載する情報">
          <p>掲載する情報は、原則として次の公開情報を基にしています。</p>
          <ul className="list-disc space-y-1 pl-5">
            {sourceList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>未確認の噂、匿名の情報、根拠の確認できない情報は掲載しません。</p>
        </Section>

        <Section title="公正中立性について">
          <p>当サイト独自の採点、ランキング、推薦、当落予測などは行いません。</p>
          <p>
            一般質問の回数、議案への賛否、公約の進捗などを掲載する場合も、その数字だけで議員や市長を評価することはありません。
          </p>
          <p>市民が公開情報を確認するための材料を、できる限り分かりやすく整理して掲載します。</p>
        </Section>

        <Section title="公的資料と本人発信の区別">
          <p>
            議員や市長本人のホームページ、SNS、動画、投稿内容などを掲載する場合は、公的資料と区別して、「本人発信」などの表示を行います。
          </p>
          <p>当サイトでは、情報の出典を次の7つの区分のいずれかで示します。</p>
          <ul className="list-disc space-y-1 pl-5">
            {categoryList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>本人発信として掲載する情報は、延岡市または延岡市議会が公表した情報とは異なる場合があります。</p>
          <p>最終的な内容については、掲載元の公式ホームページや公式SNSをご確認ください。</p>
        </Section>

        <Section title="情報の正確性と更新">
          <p>情報の正確性には十分注意しますが、掲載後に情報が変更される場合があります。</p>
          <p>掲載日時、確認日時または最終更新日が表示されている場合は、その時点で確認した情報です。</p>
          <p>最新の情報については、延岡市、延岡市議会、選挙管理委員会、議員本人などが公開する公式情報をご確認ください。</p>
        </Section>

        <Section title="訂正と情報提供">
          <p>掲載内容に誤りがある場合や、追加すべき公開情報がある場合は、情報提供・訂正依頼窓口からご連絡ください。</p>
          <p>提供された情報は、公開資料や公式情報を確認したうえで、必要に応じて修正または追加します。</p>
          <p>情報提供を受けたすべての内容を掲載するとは限りません。</p>
          <p>
            誹謗中傷、個人情報、根拠の確認できない情報、特定の候補者などの宣伝を目的とした内容は掲載しません。
          </p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <Link to="/contact" className="font-medium text-blue-700 underline hover:text-blue-800">
              情報提供・訂正依頼はこちらのページから送信できます
            </Link>
          </p>
        </Section>

        <Section title="選挙期間中の掲載方針">
          <p>選挙期間中も、特定の候補者を支持、推薦または批判する目的で情報を掲載しません。</p>
          <p>候補者情報を掲載する場合は、選挙管理委員会、候補者本人、政党その他の公式情報を基にします。</p>
          <p>候補者のおすすめ、独自採点、当落予測、人気投票などは行いません。</p>
          <p>現職議員、市長、候補者、立候補予定者を混同しないように表示します。</p>
        </Section>

        <Section title="著作権・引用・外部リンク">
          <p>当サイトに掲載する文章、画像、資料などの権利は、それぞれの権利者に帰属します。</p>
          <p>公的資料や公式ホームページなどを引用または紹介する場合は、出典を明記し、必要な範囲で使用します。</p>
          <p>外部サイトの内容について、当サイトがその正確性、安全性または継続的な公開を保証するものではありません。</p>
        </Section>

        <Section title="免責事項">
          <p>当サイトの情報を利用したことによって生じた損害について、当サイトは責任を負いかねます。</p>
          <p>重要な判断を行う場合は、必ず延岡市、延岡市議会、選挙管理委員会その他の公式情報をご確認ください。</p>
        </Section>
      </div>
    </div>
  );
}
