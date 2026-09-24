/**
 * サイト共通のメニュー（ヘッダーの「メニュー」とトップページの入口で共通利用）。
 * 「何のデータがあるか」ではなく「何を知りたいか」から選べるよう、目的別にまとめる。
 * 既存の主要ページへの導線は削らない（ヘッダーから外したページもここに残す）。
 */
export interface SiteNavLink {
  label: string;
  to: string;
}

export interface SiteNavGroup {
  title: string;
  links: SiteNavLink[];
}

export const SITE_NAV_GROUPS: SiteNavGroup[] = [
  {
    title: "市政を調べる",
    links: [
      { label: "キーワードで検索", to: "/search" },
      { label: "テーマから見る", to: "/themes" },
      { label: "市政の流れ（年表）", to: "/timeline" },
      { label: "市政90年の歴史", to: "/history" },
    ],
  },
  {
    title: "議会を見る",
    links: [
      { label: "定例会・議会資料", to: "/council-documents" },
      { label: "一般質問", to: "/questions" },
      { label: "議案ごとの賛否（議決結果）", to: "/bills/votes" },
      { label: "委員会", to: "/committees" },
      { label: "議員一覧", to: "/people?type=member" },
      { label: "議会活動の記録", to: "/council-activity" },
    ],
  },
  {
    title: "市長を見る",
    links: [
      { label: "市長ページ", to: "/mayor" },
      { label: "市長公約の進捗", to: "/mayor/policy-progress" },
      { label: "市長記者会見", to: "/mayor/press-conferences" },
      { label: "選挙結果", to: "/elections" },
      { label: "歴代市長", to: "/mayors" },
    ],
  },
  {
    title: "お金を見る",
    links: [
      { label: "延岡市の財政", to: "/finance" },
      { label: "予算・決算の推移", to: "/finance/budget" },
      { label: "基金", to: "/finance/funds" },
      { label: "市債", to: "/finance/debt" },
      { label: "人口の推移", to: "/compare/population" },
      { label: "報酬", to: "/compensation" },
    ],
  },
  {
    title: "その他",
    links: [
      { label: "市役所どこに行けばいい？診断", to: "/city-guide" },
      { label: "市政ダッシュボード", to: "/dashboard" },
      { label: "比較する", to: "/compare" },
      { label: "データの信頼性（収録状況）", to: "/data-status" },
      { label: "このサイトについて", to: "/about" },
    ],
  },
];
