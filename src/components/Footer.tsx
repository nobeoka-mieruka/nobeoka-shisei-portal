import { Link } from "react-router-dom";
import { DataNotice } from "./DataNotice";
import { LastUpdated } from "./LastUpdated";
import { getOperatorField } from "../config/operator";

const linkClass =
  "flex min-h-[44px] items-center rounded py-2 text-on-surface-variant hover:text-on-surface hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

interface FooterLinkGroup {
  heading: string;
  links: { to: string; label: string }[];
}

const footerGroups: FooterLinkGroup[] = [
  {
    heading: "人物",
    links: [
      { to: "/people", label: "人物から探す" },
      { to: "/people?type=member", label: "現職議員一覧" },
      { to: "/members/former", label: "元議員一覧" },
      { to: "/mayor", label: "市長情報" },
      { to: "/mayors", label: "歴代市長（アーカイブ）" },
      { to: "/city-officials", label: "副市長・教育長・行政委員会委員" },
    ],
  },
  {
    heading: "議会",
    links: [
      { to: "/bills", label: "議案" },
      { to: "/ordinances", label: "条例" },
      { to: "/petitions", label: "請願" },
      { to: "/requests", label: "陳情" },
      { to: "/bills/votes", label: "議案ごとの賛否" },
      { to: "/council-documents", label: "定例会・議会資料" },
      { to: "/questions", label: "一般質問データベース" },
      { to: "/themes", label: "テーマから探す" },
      { to: "/executive-answers", label: "市長・執行部答弁" },
    ],
  },
  {
    heading: "市政",
    links: [
      { to: "/policies", label: "政策・公約" },
      { to: "/finance", label: "延岡市の財政" },
      { to: "/compensation", label: "報酬" },
      { to: "/compare", label: "比較する" },
      { to: "/timeline", label: "年表を見る" },
      { to: "/dashboard", label: "ダッシュボード" },
    ],
  },
  {
    heading: "市民向け",
    links: [
      { to: "/city-guide", label: "市役所案内" },
      { to: "/data-status", label: "データ収録状況" },
      { to: "/search", label: "サイト内検索" },
      { to: "/updates", label: "更新履歴" },
      { to: "/contact", label: "情報提供・訂正依頼" },
      { to: "/editorial-policy", label: "編集方針" },
      { to: "/about", label: "このサイトについて" },
      { to: "/terms", label: "利用規約・免責事項" },
      { to: "/terms#privacy", label: "プライバシーに関する案内" },
    ],
  },
];

export function Footer() {
  const operatorName = getOperatorField("operatorName");

  return (
    <footer className="mt-8 border-t border-outline-variant px-4 py-6 sm:px-6 print:hidden">
      <div className="mx-auto max-w-5xl space-y-2 text-center sm:text-left">
        <p className="text-xs font-medium text-on-surface-variant">公開運用中｜データ随時更新</p>
        {operatorName && <p className="text-sm text-on-surface-variant">運営：{operatorName}</p>}
        <p className="text-sm text-on-surface-variant">
          延岡市・延岡市議会の公式サイトではありません。
        </p>
        <p className="text-xs text-on-surface-variant">
          掲載している公的資料等の権利は、それぞれの公表元または権利者に帰属します。
        </p>
        <DataNotice className="pt-1" />

        <div className="grid grid-cols-1 gap-x-6 gap-y-5 pt-3 text-left sm:grid-cols-2 lg:grid-cols-4">
          {footerGroups.map((group) => (
            <div key={group.heading}>
              <h2 className="mb-1 text-xs font-semibold text-on-surface-variant">{group.heading}</h2>
              {/* Phase31：スマホ幅でgrid-cols-2にすると「副市長・教育長・行政委員会委員」等の
                  長いラベルが1列あたり数文字ずつの窮屈な折り返しになり読みにくかったため、
                  全幅で1列に統一した（情報量は変えず、読みやすさを優先）。 */}
              <nav aria-label={group.heading} className="grid grid-cols-1 gap-x-0">
                {group.links.map((link, i) => (
                  <Link key={`${link.to}-${i}`} to={link.to} className={`${linkClass} text-sm`}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <LastUpdated className="mt-4 border-t border-outline-variant pt-3 sm:text-left" />
      </div>
    </footer>
  );
}
