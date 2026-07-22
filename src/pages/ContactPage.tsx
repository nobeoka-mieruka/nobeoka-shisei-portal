import { Link } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { GlobeIcon } from "../components/icons";
import { CONTACT_FORM_URL } from "../config/site";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";

export function ContactPage() {
  usePageTitle({
    title: "情報提供・訂正依頼",
    description: "掲載内容の誤りのご指摘や、新しい公開資料の情報提供を受け付ける窓口です。",
  });

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">情報提供・訂正依頼</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          掲載内容の誤りや、追加してほしい公開情報をお知らせいただく窓口です。
        </p>
      </div>

      <SectionCard title="ご連絡いただきたい内容">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface">
          <p>次のような情報がありましたら、下記のフォームからご連絡ください。</p>
          <ul className="list-disc space-y-1 pl-5 text-on-surface-variant">
            <li>掲載内容に誤りがある、または古くなっている</li>
            <li>掲載すべき公開情報（公式ホームページ、会議録、議案書など）がまだ載っていない</li>
            <li>リンク切れや表示の不具合</li>
          </ul>
          <p>
            いただいた情報は、公開資料や公式情報を確認したうえで、必要に応じて修正・追加します。すべての内容を掲載するとは限りません。
          </p>
          <p>
            延岡市役所の手続きや相談先（住民票、税金、子育て、介護、ごみ、道路など）をお探しの場合は、
            <Link
              to="/city-guide"
              className="rounded text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              延岡市役所 どこに行けばいい？診断
            </Link>
            もあわせてご利用ください。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="ご連絡いただけない内容">
        <div className="space-y-3 text-sm leading-relaxed text-on-surface-variant">
          <p>
            誹謗中傷、個人情報、根拠の確認できない情報、特定の候補者などの宣伝を目的とした内容はお受けできません。
          </p>
          <p>
            当サイトの基本的な考え方は、
            <Link
              to="/editorial-policy"
              className="rounded text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              編集方針
            </Link>
            にまとめています。あわせてご確認ください。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="フォーム">
        {CONTACT_FORM_URL ? (
          <div className="space-y-3">
            <a
              href={CONTACT_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="情報提供・訂正依頼フォームを新しいタブで開く"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <GlobeIcon className="h-4 w-4" aria-hidden="true" />
              情報提供・訂正依頼フォームを開く
            </a>
            <div className="space-y-1.5 text-xs leading-relaxed text-on-surface-variant">
              <p>Googleフォームが新しいタブで開きます。</p>
              <p>
                ご提供いただいた内容は、公開資料や公式情報を確認したうえで、必要に応じて修正または追加します。すべての情報を掲載することや、すべてのご連絡へ返信することをお約束するものではありません。
              </p>
              <p>
                入力された個人情報は、問い合わせ内容の確認や返信のために使用します。Googleフォームを利用するため、入力した情報はGoogleのサービスを通じて送信されます。
              </p>
            </div>
          </div>
        ) : (
          <p className="inline-flex items-center rounded-full bg-surface-container-high px-3 py-1.5 text-xs text-on-surface-variant">
            情報提供・訂正依頼フォームは準備中です
          </p>
        )}
      </SectionCard>

      <LastUpdated />
    </div>
  );
}
