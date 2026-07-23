/**
 * ページのURL（pathname）から、title・description・canonical・robots・OGP・構造化データを
 * 一意に導出する共通モジュール。
 *
 * - クライアント側（usePageTitle）と、ビルド時のプリレンダリングスクリプトの両方が、
 *   この getSeoForPath だけを情報源として使う。値の二重管理を避けるための唯一の窓口。
 * - 各詳細ページの「該当データが見つからない場合はnoindex」という既存ルールも、
 *   ここに集約する。
 */
import membersData from "../data/members.json";
import mayorData from "../data/mayor.json";
import generalQuestionsData from "../data/generalQuestions.json";
import billVotesData from "../data/billVotes.json";
import mayorPromisesData from "../data/mayorPromises.json";
import financeDashboardData from "../data/financeDashboard.json";
import mayorEntertainmentExpensesData from "../data/mayorEntertainmentExpenses.json";
import { mayorPressConferences } from "../data/mayorPressConferences";
import type {
  BillVoteItem,
  CouncilMember,
  FinanceDashboardData,
  GeneralQuestionItem,
  Mayor,
  MayorEntertainmentExpensesData,
  MayorPromisesData,
} from "../types";
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "../config/site";
import { billOgImage, memberOgImage } from "./ogImage";

const members = membersData as CouncilMember[];
const mayor = mayorData as Mayor;
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const billVotes = billVotesData as BillVoteItem[];
const mayorPromises = (mayorPromisesData as MayorPromisesData).promises;
const financeDashboard = financeDashboardData as FinanceDashboardData;
const entertainmentExpenses = mayorEntertainmentExpensesData as MayorEntertainmentExpensesData;

export type Robots = "index, follow" | "noindex, follow" | "noindex, nofollow";

export interface BreadcrumbEntry {
  label: string;
  to?: string;
}

export interface JsonLdEntry {
  id: string;
  data: Record<string, unknown>;
}

export interface SeoResult {
  /** サイト名を付ける前のページ固有タイトル。トップページはundefined。 */
  pageTitle?: string;
  /** サイト名まで含めた完全なタイトル（<title>にそのまま使う）。 */
  fullTitle: string;
  description: string;
  /** 現在のURLパス（クエリ・ハッシュを含まない）。 */
  path: string;
  canonical: string;
  robots: Robots;
  image: string;
  ogType: "website" | "article";
  breadcrumbs: BreadcrumbEntry[];
  jsonLd: JsonLdEntry[];
}

function buildFullTitle(pageTitle?: string): string {
  return pageTitle ? `${pageTitle}｜${SITE_NAME}` : SITE_NAME;
}

function breadcrumbJsonLd(items: BreadcrumbEntry[]): JsonLdEntry {
  return {
    id: "breadcrumb-jsonld",
    data: {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.label,
        ...(item.to ? { item: `${SITE_URL}${item.to}` } : {}),
      })),
    },
  };
}

interface SeoInput {
  path: string;
  /** canonical・og:urlに使うパス。省略時はpathと同じ（/bills→/bills/votesのような、実体の異なるリダイレクト専用ページ用）。 */
  canonicalPath?: string;
  pageTitle?: string;
  description?: string;
  robots?: Robots;
  image?: string;
  ogType?: "website" | "article";
  breadcrumbs?: BreadcrumbEntry[];
  extraJsonLd?: JsonLdEntry[];
}

function makeResult(input: SeoInput): SeoResult {
  const breadcrumbs = input.breadcrumbs ?? [];
  const jsonLd: JsonLdEntry[] = [];
  if (breadcrumbs.length > 0) jsonLd.push(breadcrumbJsonLd(breadcrumbs));
  if (input.extraJsonLd) jsonLd.push(...input.extraJsonLd);

  return {
    pageTitle: input.pageTitle,
    fullTitle: buildFullTitle(input.pageTitle),
    description: input.description ?? DEFAULT_DESCRIPTION,
    path: input.path,
    canonical: `${SITE_URL}${input.canonicalPath ?? input.path}`,
    robots: input.robots ?? "index, follow",
    image: input.image ?? DEFAULT_OG_IMAGE,
    ogType: input.ogType ?? "website",
    breadcrumbs,
    jsonLd,
  };
}

function notFound(path: string, pageTitle: string): SeoResult {
  return makeResult({ path, pageTitle, robots: "noindex, nofollow" });
}

function personJsonLd(id: string, name: string, url: string, sameAs: string[], memberOfName?: string): JsonLdEntry {
  return {
    id,
    data: {
      "@context": "https://schema.org",
      "@type": "Person",
      name,
      url,
      ...(sameAs.length > 0 ? { sameAs } : {}),
      ...(memberOfName ? { memberOf: { "@type": "Organization", name: memberOfName } } : {}),
    },
  };
}

/** 静的ページ（動的セグメントを含まないページ）のSEO情報。 */
function staticPageSeo(pathname: string): SeoResult | undefined {
  switch (pathname) {
    case "/":
      return makeResult({
        path: "/",
        pageTitle: "市長・市議会・議案を分かりやすく",
        description: DEFAULT_DESCRIPTION,
        breadcrumbs: [],
        extraJsonLd: [
          {
            id: "website-jsonld",
            data: { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
          },
        ],
      });

    case "/mayor": {
      const verifiedSns = mayor.sns.filter((s) => s.verificationStatus === "verified").map((s) => s.url);
      const sameAs = [...(mayor.officialUrl ? [mayor.officialUrl] : []), ...verifiedSns];
      return makeResult({
        path: "/mayor",
        pageTitle: `延岡市長 ${mayor.name}`,
        description: `延岡市長${mayor.name}氏のプロフィール、経歴、公約、市政方針を公開資料に基づいて掲載しています。`,
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市長情報" }],
        extraJsonLd: [personJsonLd("person-jsonld", mayor.name, `${SITE_URL}/mayor`, sameAs)],
      });
    }

    case "/mayor/policy-progress":
      return makeResult({
        path: "/mayor/policy-progress",
        pageTitle: "市長公約の進捗状況",
        description:
          "延岡市長の個別公約について、現在の状況、確認できた取組、根拠資料をキーワード・政策分野・進捗状況などで検索できます。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市長公約の進捗状況" }],
      });

    case "/mayor/entertainment-expenses":
      return makeResult({
        path: "/mayor/entertainment-expenses",
        pageTitle: "市長交際費",
        description: `${entertainmentExpenses.fiscalYearLabel}の市長交際費について、公式資料に基づく支出明細と月別・区分別の合計を掲載しています。`,
        breadcrumbs: [
          { label: "ホーム", to: "/" },
          { label: "市長情報", to: "/mayor" },
          { label: "市長交際費" },
        ],
      });

    case "/mayor/press-conferences":
      return makeResult({
        path: "/mayor/press-conferences",
        pageTitle: "市長定例記者会見",
        description: "延岡市長の定例記者会見の発表事項を、延岡市公式ホームページに基づいて開催日順に整理しています。",
        breadcrumbs: [
          { label: "ホーム", to: "/" },
          { label: "市長情報", to: "/mayor" },
          { label: "市長定例記者会見" },
        ],
      });

    case "/finance":
      return makeResult({
        path: "/finance",
        pageTitle: "延岡市の財政",
        description: `${financeDashboard.fiscalYearLabel}の一般会計の歳入・歳出構成、基金残高、人口推移、財政指標を公開資料に基づいて整理しています。`,
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "延岡市の財政" }],
      });

    case "/dashboard":
      return makeResult({
        path: "/dashboard",
        pageTitle: "市政データダッシュボード",
        description: "延岡市議会議員、議案、市長公約などの登録件数や構成を、データから自動集計して確認できます。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "ダッシュボード" }],
      });

    case "/compensation":
      return makeResult({
        path: "/compensation",
        pageTitle: "市長・市議会議員の報酬",
        description: "延岡市長、議長、副議長、市議会議員の月額報酬、期末手当、年間見込額、算出根拠を掲載しています。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "報酬" }],
      });

    case "/city-guide":
      return makeResult({
        path: "/city-guide",
        pageTitle: "延岡市役所 どこに行けばいい？診断｜相談先の課を簡単検索",
        description:
          "延岡市で困った時、どこの課に相談すればよいか質問に答えるだけで確認できます。福祉、子育て、高齢者、防災、生活相談など、市役所の相談窓口を分かりやすく案内します。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市役所案内" }],
      });

    case "/bills":
      // /bills/votes へのリダイレクト専用URL。直接アクセスされても404にならないよう実体は残すが、
      // 索引対象・OGP対象は統合先の/bills/votesとする。
      return makeResult({
        path: "/bills",
        canonicalPath: "/bills/votes",
        pageTitle: "議案ごとの賛否",
        description: "延岡市議会に提出された議案の概要、採決結果、議員ごとの賛成・反対などを確認できます。",
        robots: "noindex, follow",
      });

    case "/bills/votes":
      return makeResult({
        path: "/bills/votes",
        pageTitle: "議案ごとの賛否",
        description: "延岡市議会に提出された議案の概要、採決結果、議員ごとの賛成・反対などを確認できます。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "議案ごとの賛否" }],
      });

    case "/questions":
      return makeResult({
        path: "/questions",
        pageTitle: "一般質問データベース",
        description: "延岡市議会の一般質問を議員別、テーマ別、年度別に検索できます。質問項目・要約・出典を掲載しています。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "一般質問データベース" }],
      });

    case "/about":
      return makeResult({
        path: "/about",
        pageTitle: "このサイトについて",
        description: "延岡市政見える化ポータルの目的、運営方針、主な情報源について説明しています。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "このサイトについて" }],
      });

    case "/editorial-policy":
      return makeResult({
        path: "/editorial-policy",
        pageTitle: "編集方針・情報源",
        description: "延岡市政見える化ポータルの編集方針、情報源、掲載しない情報の範囲について説明しています。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "編集方針・情報源" }],
      });

    case "/contact":
      return makeResult({
        path: "/contact",
        pageTitle: "情報提供・訂正依頼",
        description: "掲載内容の誤りのご指摘や、新しい公開資料の情報提供を受け付ける窓口です。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "情報提供・訂正依頼" }],
      });

    case "/terms":
      return makeResult({
        path: "/terms",
        pageTitle: "利用規約・免責事項",
        description: "延岡市政見える化ポータルの利用規約、免責事項、プライバシーに関する案内を掲載しています。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "利用規約・免責事項" }],
      });

    case "/updates":
      return makeResult({
        path: "/updates",
        pageTitle: "更新履歴",
        description: "延岡市政見える化ポータルの機能追加、データ更新、表示改善などの更新履歴を掲載しています。",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "更新履歴" }],
      });

    case "/search":
      // 検索結果はURLごとに内容が変わり続けるため、クエリの有無にかかわらず常にnoindexにする。
      return makeResult({
        path: "/search",
        pageTitle: "サイト内検索",
        description: "議員、一般質問、議案、市長公約、財政、報酬、市役所案内などをまとめて検索できます。",
        robots: "noindex, follow",
        breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "サイト内検索" }],
      });

    default:
      return undefined;
  }
}

/** /members/:id */
function memberSeo(id: string): SeoResult {
  const member = members.find((m) => m.id === id);
  if (!member) return notFound(`/members/${id}`, "議員情報");

  const memberQuestions = generalQuestions.filter((q) => q.memberId === member.id);
  const memberHasBillVotes = billVotes.some((b) => b.memberVotes.some((v) => v.memberId === member.id));

  const titleParts = ["プロフィール"];
  if (memberQuestions.length > 0) titleParts.push("一般質問");
  if (memberHasBillVotes) titleParts.push("議案賛否");

  const descriptionParts = ["プロフィール", "所属会派", "所属委員会"];
  if (memberQuestions.length > 0) descriptionParts.push("一般質問");
  if (memberHasBillVotes) descriptionParts.push("議案別の賛否");

  const verifiedSns = member.sns.filter((s) => s.verificationStatus === "verified").map((s) => s.url);
  const sameAs = [...(member.profileUrl ? [member.profileUrl] : []), ...verifiedSns];

  return makeResult({
    path: `/members/${id}`,
    pageTitle: `${member.name}議員｜${titleParts.join("・")}`,
    description: `延岡市議会議員${member.name}氏の${descriptionParts.join("、")}などを掲載しています。`,
    image: memberOgImage(member.id),
    breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "議員一覧", to: "/" }, { label: member.name }],
    extraJsonLd: [personJsonLd("person-jsonld", member.name, `${SITE_URL}/members/${member.id}`, sameAs, "延岡市議会")],
  });
}

/** /questions/:id */
function questionSeo(id: string): SeoResult {
  const item = generalQuestions.find((q) => q.id === id);
  if (!item) return notFound(`/questions/${id}`, "一般質問情報");

  return makeResult({
    path: `/questions/${id}`,
    pageTitle: `${item.title}｜${item.memberName}議員の一般質問`,
    description: `${item.memberName}議員が${item.questionDate}の${item.sessionName}で行った質問「${item.title}」の内容・答弁・出典を掲載しています。`,
    ogType: "article",
    breadcrumbs: [
      { label: "ホーム", to: "/" },
      { label: "一般質問データベース", to: "/questions" },
      { label: item.memberName },
    ],
  });
}

/** /mayor/policy-progress/:id */
function promiseSeo(id: string): SeoResult {
  const promise = mayorPromises.find((p) => p.id === id);
  if (!promise) return notFound(`/mayor/policy-progress/${id}`, "公約情報");

  return makeResult({
    path: `/mayor/policy-progress/${id}`,
    pageTitle: `${promise.promiseText}｜市長公約の進捗状況`,
    description: `市長公約「${promise.promiseText}」の進捗状況（${promise.statusLabel}）、根拠資料、最終確認日を掲載しています。`,
    ogType: "article",
    breadcrumbs: [
      { label: "ホーム", to: "/" },
      { label: "市長公約の進捗状況", to: "/mayor/policy-progress" },
      { label: promise.categoryTitle },
    ],
  });
}

/** /bills/votes/:id */
function billVoteSeo(id: string): SeoResult {
  const bill = billVotes.find((b) => b.id === id);
  if (!bill) return notFound(`/bills/votes/${id}`, "議案情報");

  return makeResult({
    path: `/bills/votes/${id}`,
    pageTitle: `${bill.billNumber}「${bill.billTitle}」｜採決結果・議員別賛否`,
    description: `${bill.billNumber}「${bill.billTitle}」の概要、議決結果（${bill.result}）、議員別の賛否を掲載しています。`,
    image: billOgImage(bill.id),
    ogType: "article",
    breadcrumbs: [
      { label: "ホーム", to: "/" },
      { label: "議案一覧", to: "/bills/votes" },
      { label: bill.billNumber },
    ],
  });
}

/** /mayor/press-conferences/:date */
function pressConferenceSeo(date: string): SeoResult {
  const conference = mayorPressConferences.find((c) => c.date === date);
  if (!conference) return notFound(`/mayor/press-conferences/${date}`, "記者会見が見つかりません");

  return makeResult({
    path: `/mayor/press-conferences/${date}`,
    pageTitle: conference.title,
    description: `延岡市長定例記者会見（${conference.date}）で発表された内容を、延岡市公式ホームページに基づいて掲載しています。`,
    ogType: "article",
    breadcrumbs: [
      { label: "ホーム", to: "/" },
      { label: "市長情報", to: "/mayor" },
      { label: conference.title },
    ],
    extraJsonLd: [
      {
        id: "article-jsonld",
        data: {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: conference.title,
          datePublished: conference.date,
          dateModified: conference.verifiedAt,
          mainEntityOfPage: `${SITE_URL}/mayor/press-conferences/${conference.date}`,
          url: `${SITE_URL}/mayor/press-conferences/${conference.date}`,
          description: `延岡市長定例記者会見（${conference.date}）で発表された内容を、延岡市公式ホームページに基づいて掲載しています。`,
          author: { "@type": "Organization", name: SITE_NAME },
          publisher: { "@type": "Organization", name: SITE_NAME },
          isBasedOn: conference.sourceUrl,
          citation: conference.sourceUrl,
        },
      },
    ],
  });
}

const MEMBER_RE = /^\/members\/([^/]+)$/;
const QUESTION_RE = /^\/questions\/([^/]+)$/;
const PROMISE_RE = /^\/mayor\/policy-progress\/([^/]+)$/;
const BILL_VOTE_RE = /^\/bills\/votes\/([^/]+)$/;
const PRESS_CONFERENCE_RE = /^\/mayor\/press-conferences\/([^/]+)$/;

/**
 * 現在のURLパス（クエリ・ハッシュを除く）から、そのページのSEO情報を返す。
 * 未知のパスの場合も、404ページ用のSeoResult（noindex, nofollow）を返す（nullは返さない）。
 */
export function getSeoForPath(pathname: string): SeoResult {
  const path = pathname === "" ? "/" : pathname;

  const staticResult = staticPageSeo(path);
  if (staticResult) return staticResult;

  const memberMatch = path.match(MEMBER_RE);
  if (memberMatch) return memberSeo(decodeURIComponent(memberMatch[1]));

  const questionMatch = path.match(QUESTION_RE);
  if (questionMatch) return questionSeo(decodeURIComponent(questionMatch[1]));

  const promiseMatch = path.match(PROMISE_RE);
  if (promiseMatch) return promiseSeo(decodeURIComponent(promiseMatch[1]));

  const billVoteMatch = path.match(BILL_VOTE_RE);
  if (billVoteMatch) return billVoteSeo(decodeURIComponent(billVoteMatch[1]));

  const pressConferenceMatch = path.match(PRESS_CONFERENCE_RE);
  if (pressConferenceMatch) return pressConferenceSeo(decodeURIComponent(pressConferenceMatch[1]));

  return notFound(path, "ページが見つかりません");
}
