/**
 * ページのURL（pathname）から、title・description・canonical・robots・OGP・構造化データを
 * 一意に導出する共通モジュール。
 *
 * - クライアント側（usePageTitle）と、ビルド時のプリレンダリングスクリプトの両方が、
 *   この getSeoForPath だけを情報源として使う。値の二重管理を避けるための唯一の窓口。
 * - 各詳細ページの「該当データが見つからない場合はnoindex」という既存ルールも、
 *   ここに集約する。
 * - lastmod（dateModified）は呼び出し側（scripts/prerender.mjs）が
 *   scripts/lib/public-routes.mjs で解決した値を渡す。ここでは日付を独自に計算しない
 *   （サイトマップのlastmodと矛盾しないようにするため）。
 */
import membersData from "../data/members.json";
import mayorData from "../data/mayor.json";
import generalQuestionsData from "../data/generalQuestions.json";
import billVotesData from "../data/billVotes.json";
import mayorPromisesData from "../data/mayorPromises.json";
import financeDashboardData from "../data/financeDashboard.json";
import mayorEntertainmentExpensesData from "../data/mayorEntertainmentExpenses.json";
import compensationComparisonData from "../data/compensationComparison.json";
import { mayorPressConferences } from "../data/mayorPressConferences";
import type {
  BillVoteItem,
  CompensationComparisonEntry,
  CouncilMember,
  FinanceDashboardData,
  GeneralQuestionItem,
  Mayor,
  MayorEntertainmentExpensesData,
  MayorPromisesData,
} from "../types";
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "../config/site";
import { getOperatorField, isOperatorConfigured } from "../config/operator";
import { billOgImage, memberOgImage } from "./ogImage";

const members = membersData as CouncilMember[];
const mayor = mayorData as Mayor;
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const billVotes = billVotesData as BillVoteItem[];
const mayorPromises = (mayorPromisesData as MayorPromisesData).promises;
const financeDashboard = financeDashboardData as FinanceDashboardData;
const entertainmentExpenses = mayorEntertainmentExpensesData as MayorEntertainmentExpensesData;
const compensationComparison = compensationComparisonData as CompensationComparisonEntry[];

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

export interface SeoOptions {
  /** サイトマップと同じ情報源（public-routes.mjs）から渡される、このページの最終更新日（YYYY-MM-DD）。 */
  lastmod?: string;
}

function buildFullTitle(pageTitle?: string): string {
  return pageTitle ? `${pageTitle}｜${SITE_NAME}` : SITE_NAME;
}

/** organization名。運営者情報が未設定の場合はサイト名で代用する。 */
function organizationName(): string {
  return getOperatorField("operatorName") ?? SITE_NAME;
}

function breadcrumbListData(items: BreadcrumbEntry[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.to ? { item: `${SITE_URL}${item.to}` } : {}),
    })),
  };
}

function breadcrumbJsonLd(items: BreadcrumbEntry[]): JsonLdEntry {
  return {
    id: "breadcrumb-jsonld",
    data: { "@context": "https://schema.org", ...breadcrumbListData(items) },
  };
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

/** 運営者情報が1項目でも設定されている場合だけ返す。存在しない団体をでっち上げないための判定。 */
function organizationJsonLd(): JsonLdEntry | undefined {
  if (!isOperatorConfigured()) return undefined;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: organizationName(),
    url: SITE_URL,
  };
  const email = getOperatorField("contactEmail");
  if (email) data.email = email;
  const region = getOperatorField("region");
  if (region) data.areaServed = region;
  const founded = getOperatorField("foundedDate");
  if (founded) data.foundingDate = founded;
  const purpose = getOperatorField("purpose");
  if (purpose) data.description = purpose;
  return { id: "organization-jsonld", data };
}

interface WebPageInput {
  title: string;
  description: string;
  url: string;
  image: string;
  breadcrumbs: BreadcrumbEntry[];
  datePublished?: string;
  dateModified?: string;
  mainEntity?: Record<string, unknown>;
}

function webPageJsonLd(input: WebPageInput): JsonLdEntry {
  return {
    id: "webpage-jsonld",
    data: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: input.title,
      description: input.description,
      url: input.url,
      inLanguage: "ja",
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
      ...(input.breadcrumbs.length > 0 ? { breadcrumb: breadcrumbListData(input.breadcrumbs) } : {}),
      primaryImageOfPage: { "@type": "ImageObject", url: input.image },
      ...(input.datePublished ? { datePublished: input.datePublished } : {}),
      ...(input.dateModified ? { dateModified: input.dateModified } : {}),
      ...(input.mainEntity ? { mainEntity: input.mainEntity } : {}),
    },
  };
}

interface DatasetInput {
  id: string;
  name: string;
  description: string;
  url: string;
  dateModified?: string;
  temporalCoverage?: string;
}

/**
 * 公開データを一覧・検索できるページ用のDataset構造化データ。
 * 実在しないCSV/JSON/API/ライセンスURLは作らないため、distribution・licenseは設定しない。
 */
function datasetJsonLd(input: DatasetInput): JsonLdEntry {
  return {
    id: input.id,
    data: {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: input.name,
      description: input.description,
      url: input.url,
      creator: { "@type": "Organization", name: organizationName() },
      publisher: { "@type": "Organization", name: organizationName() },
      inLanguage: "ja",
      spatialCoverage: "宮崎県延岡市",
      ...(input.temporalCoverage ? { temporalCoverage: input.temporalCoverage } : {}),
      ...(input.dateModified ? { dateModified: input.dateModified } : {}),
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
  extraJsonLd?: (JsonLdEntry | undefined)[];
  /** WebPage構造化データのdatePublished（確実な根拠がある場合のみ設定）。 */
  datePublished?: string;
  /** WebPageのmainEntity（例：議員詳細ページのPerson）。 */
  mainEntity?: Record<string, unknown>;
  /** WebPage構造化データを出力しない（404ページ・/bills・/search等、索引対象外のページ用）。 */
  skipWebPage?: boolean;
}

function makeResult(input: SeoInput, options?: SeoOptions): SeoResult {
  const breadcrumbs = input.breadcrumbs ?? [];
  const fullTitle = buildFullTitle(input.pageTitle);
  const description = input.description ?? DEFAULT_DESCRIPTION;
  const canonical = `${SITE_URL}${input.canonicalPath ?? input.path}`;
  const robots = input.robots ?? "index, follow";
  const image = input.image ?? DEFAULT_OG_IMAGE;

  const jsonLd: JsonLdEntry[] = [];
  if (breadcrumbs.length > 0) jsonLd.push(breadcrumbJsonLd(breadcrumbs));
  const skipWebPage = input.skipWebPage ?? robots !== "index, follow";
  if (!skipWebPage) {
    jsonLd.push(
      webPageJsonLd({
        title: fullTitle,
        description,
        url: canonical,
        image,
        breadcrumbs,
        datePublished: input.datePublished,
        dateModified: options?.lastmod,
        mainEntity: input.mainEntity,
      }),
    );
  }
  for (const entry of input.extraJsonLd ?? []) {
    if (entry) jsonLd.push(entry);
  }

  return {
    pageTitle: input.pageTitle,
    fullTitle,
    description,
    path: input.path,
    canonical,
    robots,
    image,
    ogType: input.ogType ?? "website",
    breadcrumbs,
    jsonLd,
  };
}

function notFound(path: string, pageTitle: string): SeoResult {
  return makeResult({ path, pageTitle, robots: "noindex, nofollow", skipWebPage: true });
}

/** 静的ページ（動的セグメントを含まないページ）のSEO情報。 */
function staticPageSeo(pathname: string, options?: SeoOptions): SeoResult | undefined {
  const lastmod = options?.lastmod;

  switch (pathname) {
    case "/": {
      const description = DEFAULT_DESCRIPTION;
      return makeResult(
        {
          path: "/",
          pageTitle: "市長・市議会・議案を分かりやすく",
          description,
          breadcrumbs: [],
          extraJsonLd: [
            {
              id: "website-jsonld",
              data: { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
            },
            organizationJsonLd(),
            datasetJsonLd({
              id: "dataset-members-jsonld",
              name: "延岡市議会議員一覧データ",
              description: "延岡市議会議員のプロフィール、所属会派、所属委員会等を整理した一覧データです。",
              url: `${SITE_URL}/`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );
    }

    case "/mayor": {
      const verifiedSns = mayor.sns.filter((s) => s.verificationStatus === "verified").map((s) => s.url);
      const sameAs = [...(mayor.officialUrl ? [mayor.officialUrl] : []), ...verifiedSns];
      const url = `${SITE_URL}/mayor`;
      return makeResult(
        {
          path: "/mayor",
          pageTitle: `延岡市長 ${mayor.name}`,
          description: `延岡市長${mayor.name}氏のプロフィール、経歴、公約、市政方針を公開資料に基づいて掲載しています。`,
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市長情報" }],
          extraJsonLd: [personJsonLd("person-jsonld", mayor.name, url, sameAs)],
          mainEntity: { "@type": "Person", name: mayor.name, url },
        },
        options,
      );
    }

    case "/mayor/policy-progress":
      return makeResult(
        {
          path: "/mayor/policy-progress",
          pageTitle: "市長公約の進捗状況",
          description:
            "延岡市長の個別公約について、現在の状況、確認できた取組、根拠資料をキーワード・政策分野・進捗状況などで検索できます。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市長公約の進捗状況" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-policy-progress-jsonld",
              name: "市長公約の進捗状況データ",
              description: "市長の個別公約ごとの進捗状況、根拠資料を整理したデータです。",
              url: `${SITE_URL}/mayor/policy-progress`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/mayor/entertainment-expenses":
      return makeResult(
        {
          path: "/mayor/entertainment-expenses",
          pageTitle: "市長交際費",
          description: `${entertainmentExpenses.fiscalYearLabel}の市長交際費について、公式資料に基づく支出明細と月別・区分別の合計を掲載しています。`,
          breadcrumbs: [
            { label: "ホーム", to: "/" },
            { label: "市長情報", to: "/mayor" },
            { label: "市長交際費" },
          ],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-entertainment-expenses-jsonld",
              name: "市長交際費データ",
              description: `${entertainmentExpenses.fiscalYearLabel}の市長交際費の支出明細データです。`,
              url: `${SITE_URL}/mayor/entertainment-expenses`,
              dateModified: lastmod,
              temporalCoverage: entertainmentExpenses.fiscalYear,
            }),
          ],
        },
        options,
      );

    case "/mayor/press-conferences":
      return makeResult(
        {
          path: "/mayor/press-conferences",
          pageTitle: "市長定例記者会見",
          description: "延岡市長の定例記者会見の発表事項を、延岡市公式ホームページに基づいて開催日順に整理しています。",
          breadcrumbs: [
            { label: "ホーム", to: "/" },
            { label: "市長情報", to: "/mayor" },
            { label: "市長定例記者会見" },
          ],
        },
        options,
      );

    case "/finance":
      return makeResult(
        {
          path: "/finance",
          pageTitle: "延岡市の財政",
          description: `${financeDashboard.fiscalYearLabel}の一般会計の歳入・歳出構成、基金残高、人口推移、財政指標を公開資料に基づいて整理しています。`,
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "延岡市の財政" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-finance-jsonld",
              name: "延岡市の財政データ",
              description: `${financeDashboard.fiscalYearLabel}の一般会計の歳入・歳出構成、基金残高、人口推移、財政指標のデータです。`,
              url: `${SITE_URL}/finance`,
              dateModified: lastmod,
              temporalCoverage: financeDashboard.fiscalYear,
            }),
          ],
        },
        options,
      );

    case "/dashboard":
      return makeResult(
        {
          path: "/dashboard",
          pageTitle: "市政データダッシュボード",
          description: "延岡市議会議員、議案、市長公約などの登録件数や構成を、データから自動集計して確認できます。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "ダッシュボード" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-dashboard-jsonld",
              name: "延岡市政データダッシュボード集計データ",
              description: "延岡市議会議員、議案、市長公約などの登録件数・構成を自動集計したデータです。",
              url: `${SITE_URL}/dashboard`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/compensation": {
      const referenceDate = compensationComparison.find((c) => c.municipality === "延岡市")?.referenceDate;
      return makeResult(
        {
          path: "/compensation",
          pageTitle: "市長・市議会議員の報酬",
          description: "延岡市長、議長、副議長、市議会議員の月額報酬、期末手当、年間見込額、算出根拠を掲載しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "報酬" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-compensation-jsonld",
              name: "市長・市議会議員の報酬比較データ",
              description: "延岡市長、議長、副議長、市議会議員の月額報酬と近隣・県内自治体との比較データです。",
              url: `${SITE_URL}/compensation`,
              dateModified: lastmod,
              temporalCoverage: referenceDate,
            }),
          ],
        },
        options,
      );
    }

    case "/city-guide":
      return makeResult(
        {
          path: "/city-guide",
          pageTitle: "延岡市役所 どこに行けばいい？診断｜相談先の課を簡単検索",
          description:
            "延岡市で困った時、どこの課に相談すればよいか質問に答えるだけで確認できます。福祉、子育て、高齢者、防災、生活相談など、市役所の相談窓口を分かりやすく案内します。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市役所案内" }],
        },
        options,
      );

    case "/bills":
      // /bills/votes へのリダイレクト専用URL。直接アクセスされても404にならないよう実体は残すが、
      // 索引対象・OGP対象は統合先の/bills/votesとする。
      return makeResult(
        {
          path: "/bills",
          canonicalPath: "/bills/votes",
          pageTitle: "議案ごとの賛否",
          description: "延岡市議会に提出された議案の概要、採決結果、議員ごとの賛成・反対などを確認できます。",
          robots: "noindex, follow",
          skipWebPage: true,
        },
        options,
      );

    case "/bills/votes":
      return makeResult(
        {
          path: "/bills/votes",
          pageTitle: "議案ごとの賛否",
          description: "延岡市議会に提出された議案の概要、採決結果、議員ごとの賛成・反対などを確認できます。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "議案ごとの賛否" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-bills-jsonld",
              name: "延岡市議会 議案ごとの賛否データ",
              description: "延岡市議会に提出された議案の概要、採決結果、議員ごとの賛成・反対のデータです。",
              url: `${SITE_URL}/bills/votes`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/questions":
      return makeResult(
        {
          path: "/questions",
          pageTitle: "一般質問データベース",
          description: "延岡市議会の一般質問を議員別、テーマ別、年度別に検索できます。質問項目・要約・出典を掲載しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "一般質問データベース" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-questions-jsonld",
              name: "延岡市議会 一般質問データベース",
              description: "延岡市議会の一般質問（議員別・テーマ別・年度別）の質問項目・要約・出典のデータです。",
              url: `${SITE_URL}/questions`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/about":
      return makeResult(
        {
          path: "/about",
          pageTitle: "このサイトについて",
          description: "延岡市政見える化ポータルの目的、運営方針、主な情報源について説明しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "このサイトについて" }],
          extraJsonLd: [organizationJsonLd()],
        },
        options,
      );

    case "/editorial-policy":
      return makeResult(
        {
          path: "/editorial-policy",
          pageTitle: "編集方針・情報源",
          description: "延岡市政見える化ポータルの編集方針、情報源、政治的中立性、訂正・更新方針について説明しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "編集方針・情報源" }],
        },
        options,
      );

    case "/contact":
      return makeResult(
        {
          path: "/contact",
          pageTitle: "情報提供・訂正依頼",
          description: "掲載内容の誤りのご指摘や、新しい公開資料の情報提供を受け付ける窓口です。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "情報提供・訂正依頼" }],
        },
        options,
      );

    case "/terms":
      return makeResult(
        {
          path: "/terms",
          pageTitle: "利用規約・免責事項",
          description: "延岡市政見える化ポータルの利用規約、免責事項、プライバシーに関する案内を掲載しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "利用規約・免責事項" }],
        },
        options,
      );

    case "/updates":
      return makeResult(
        {
          path: "/updates",
          pageTitle: "更新履歴",
          description: "延岡市政見える化ポータルの機能追加、データ更新、表示改善などの更新履歴を掲載しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "更新履歴" }],
        },
        options,
      );

    case "/search":
      // 検索結果はURLごとに内容が変わり続けるため、クエリの有無にかかわらず常にnoindexにする。
      return makeResult(
        {
          path: "/search",
          pageTitle: "サイト内検索",
          description: "議員、一般質問、議案、市長公約、財政、報酬、市役所案内などをまとめて検索できます。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "サイト内検索" }],
          skipWebPage: true,
        },
        options,
      );

    default:
      return undefined;
  }
}

/** /members/:id */
function memberSeo(id: string, options?: SeoOptions): SeoResult {
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
  const url = `${SITE_URL}/members/${id}`;

  return makeResult(
    {
      path: `/members/${id}`,
      pageTitle: `${member.name}議員｜${titleParts.join("・")}`,
      description: `延岡市議会議員${member.name}氏の${descriptionParts.join("、")}などを掲載しています。`,
      image: memberOgImage(member.id),
      breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "議員一覧", to: "/" }, { label: member.name }],
      extraJsonLd: [personJsonLd("person-jsonld", member.name, url, sameAs, "延岡市議会")],
      mainEntity: { "@type": "Person", name: member.name, url },
    },
    options,
  );
}

/** /questions/:id */
function questionSeo(id: string, options?: SeoOptions): SeoResult {
  const item = generalQuestions.find((q) => q.id === id);
  if (!item) return notFound(`/questions/${id}`, "一般質問情報");

  return makeResult(
    {
      path: `/questions/${id}`,
      pageTitle: `${item.title}｜${item.memberName}議員の一般質問`,
      description: `${item.memberName}議員が${item.questionDate}の${item.sessionName}で行った質問「${item.title}」の内容・答弁・出典を掲載しています。`,
      ogType: "article",
      breadcrumbs: [
        { label: "ホーム", to: "/" },
        { label: "一般質問データベース", to: "/questions" },
        { label: item.memberName },
      ],
      datePublished: item.questionDate,
    },
    options,
  );
}

/** /mayor/policy-progress/:id */
function promiseSeo(id: string, options?: SeoOptions): SeoResult {
  const promise = mayorPromises.find((p) => p.id === id);
  if (!promise) return notFound(`/mayor/policy-progress/${id}`, "公約情報");

  return makeResult(
    {
      path: `/mayor/policy-progress/${id}`,
      pageTitle: `${promise.promiseText}｜市長公約の進捗状況`,
      description: `市長公約「${promise.promiseText}」の進捗状況（${promise.statusLabel}）、根拠資料、最終確認日を掲載しています。`,
      ogType: "article",
      breadcrumbs: [
        { label: "ホーム", to: "/" },
        { label: "市長公約の進捗状況", to: "/mayor/policy-progress" },
        { label: promise.categoryTitle },
      ],
    },
    options,
  );
}

/** /bills/votes/:id */
function billVoteSeo(id: string, options?: SeoOptions): SeoResult {
  const bill = billVotes.find((b) => b.id === id);
  if (!bill) return notFound(`/bills/votes/${id}`, "議案情報");

  return makeResult(
    {
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
    },
    options,
  );
}

/** /mayor/press-conferences/:date */
function pressConferenceSeo(date: string, options?: SeoOptions): SeoResult {
  const conference = mayorPressConferences.find((c) => c.date === date);
  if (!conference) return notFound(`/mayor/press-conferences/${date}`, "記者会見が見つかりません");

  const description = `延岡市長定例記者会見（${conference.date}）で発表された内容を、延岡市公式ホームページに基づいて掲載しています。`;

  return makeResult(
    {
      path: `/mayor/press-conferences/${date}`,
      pageTitle: conference.title,
      description,
      ogType: "article",
      breadcrumbs: [
        { label: "ホーム", to: "/" },
        { label: "市長情報", to: "/mayor" },
        { label: conference.title },
      ],
      datePublished: conference.date,
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
            description,
            author: { "@type": "Organization", name: organizationName() },
            publisher: { "@type": "Organization", name: organizationName() },
            isBasedOn: conference.sourceUrl,
            citation: conference.sourceUrl,
          },
        },
      ],
    },
    options,
  );
}

const MEMBER_RE = /^\/members\/([^/]+)$/;
const QUESTION_RE = /^\/questions\/([^/]+)$/;
const PROMISE_RE = /^\/mayor\/policy-progress\/([^/]+)$/;
const BILL_VOTE_RE = /^\/bills\/votes\/([^/]+)$/;
const PRESS_CONFERENCE_RE = /^\/mayor\/press-conferences\/([^/]+)$/;

/**
 * 現在のURLパス（クエリ・ハッシュを除く）から、そのページのSEO情報を返す。
 * 未知のパスの場合も、404ページ用のSeoResult（noindex, nofollow）を返す（nullは返さない）。
 * optionsのlastmodは、プリレンダリング時にサイトマップと同じ値（public-routes.mjs）を渡すことで、
 * WebPage/DatasetのdateModifiedとサイトマップのlastmodを一致させる。クライアント側の通常のページ
 * 遷移ではlastmodを渡さないため、dateModifiedは省略される（初期HTML側はプリレンダリングで確定済み）。
 */
export function getSeoForPath(pathname: string, options?: SeoOptions): SeoResult {
  const path = pathname === "" ? "/" : pathname;

  const staticResult = staticPageSeo(path, options);
  if (staticResult) return staticResult;

  const memberMatch = path.match(MEMBER_RE);
  if (memberMatch) return memberSeo(decodeURIComponent(memberMatch[1]), options);

  const questionMatch = path.match(QUESTION_RE);
  if (questionMatch) return questionSeo(decodeURIComponent(questionMatch[1]), options);

  const promiseMatch = path.match(PROMISE_RE);
  if (promiseMatch) return promiseSeo(decodeURIComponent(promiseMatch[1]), options);

  const billVoteMatch = path.match(BILL_VOTE_RE);
  if (billVoteMatch) return billVoteSeo(decodeURIComponent(billVoteMatch[1]), options);

  const pressConferenceMatch = path.match(PRESS_CONFERENCE_RE);
  if (pressConferenceMatch) return pressConferenceSeo(decodeURIComponent(pressConferenceMatch[1]), options);

  return notFound(path, "ページが見つかりません");
}
