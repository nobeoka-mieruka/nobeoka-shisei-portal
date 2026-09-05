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
import formerMembersData from "../data/formerMembers.json";
import mayorData from "../data/mayor.json";
import generalQuestionsData from "../data/generalQuestions.json";
// Phase193：SEOのtitle・descriptionと「この議員の賛否が確認できるか」の判定に必要な項目だけを
// 抜き出した軽量インデックスを使う（billVotes.json本体〔約2.6MB〕は、要約文・根拠資料を
// 表示する画面側でimportする）。値はbillVotes.jsonからの純粋な抜き出しで内容は同一。
import billVotesIndexData from "../data/billVotesIndex.json";
import councilSessionsData from "../data/councilSessions.json";
import mayorPromisesData from "../data/mayorPromises.json";
import financeDashboardData from "../data/financeDashboard.json";
import mayorEntertainmentExpensesData from "../data/mayorEntertainmentExpenses.json";
import compensationComparisonData from "../data/compensationComparison.json";
import archiveCouncilLeadershipData from "../data/archiveCouncilLeadership.json";
// Phase193：同上。本文（質問項目・出典一覧）を含まない軽量インデックスを使う。
import councilSpeechIndexData from "../data/councilSpeechIndex.json";
import themesData from "../data/themes.json";
import { mayorPressConferences } from "../data/mayorPressConferences";
import politicalFundOrganizationsData from "../data/politicalFundOrganizations.json";
import politicalFundReportsData from "../data/politicalFundReports.json";
import committeesData from "../data/committees.json";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import archivePoliciesData from "../data/archivePolicies.json";
import archiveCouncilDocumentsData from "../data/archiveCouncilDocuments.json";
import electionResultsData from "../data/electionResults.json";
// Phase193：people.tsはbillVotes.json・councilSpeechSummaries.jsonを読み込むため、
// スラッグ解釈と表示ラベルだけを持つ軽量モジュールからimportする。
import { parsePersonSlug, personTypeLabel, type PersonType } from "./personSlug";
import type {
  BillVoteIndexItem,
  Committee,
  CompensationComparisonEntry,
  CouncilMember,
  CouncilSession,
  CouncilSpeechSummaryData,
  FinanceDashboardData,
  FormerMember,
  GeneralQuestionItem,
  Mayor,
  MayorEntertainmentExpensesData,
  MayorPromisesData,
  PoliticalFundOrganization,
  PoliticalFundReport,
  Theme,
} from "../types";
import type {
  ArchiveCouncilDocument,
  ArchiveCouncilDocumentType,
  ArchiveCouncilLeadershipTerm,
  ArchiveMayor,
  ArchiveMemberProfile,
  ArchivePolicy,
} from "../types/historicalArchive";
import type { ElectionResult } from "../types/election";
import { aggregateSpeechesByTheme, findPublishedSpeech } from "./councilSpeeches";
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "../config/site";
import { MAYOR_PROMISE_LEVELS, MAYOR_PROMISE_SCALE_SUMMARY, mayorPromiseCounts } from "./mayorPromiseTerms";
import { getOperatorField, isOperatorConfigured } from "../config/operator";
import { billOgImage, memberOgImage } from "./ogImage";
import { normalizePathname, safeDecodeURIComponent } from "./normalizePathname";
import { publicDocuments } from "./councilDocuments";
import { publicBills } from "./billVotes";
import photoDimensionsData from "../data/photoDimensions.json";

const photoDimensions = photoDimensionsData as Record<string, { width: number; height: number }>;

/** photoUrl（例: "/photos/xxx.webp"）から、実画像の寸法を引く。見つからない場合はundefined。 */
function photoDimensionsFor(photoUrl?: string): { width: number; height: number } | undefined {
  if (!photoUrl) return undefined;
  const filename = photoUrl.split("/").pop();
  return filename ? photoDimensions[filename] : undefined;
}

/** WebSiteとOrganizationを相互参照させるための@id。 */
export const websiteId = `${SITE_URL}/#website`;
export const organizationId = `${SITE_URL}/#organization`;

/** サイト自体のロゴ（実寸法: 1536×1024, public/images/nobeoka-shisei-logo.webp）。 */
const SITE_LOGO = {
  url: `${SITE_URL}/images/nobeoka-shisei-logo.webp`,
  width: 1536,
  height: 1024,
};

/**
 * このサイトが延岡市・延岡市議会が運営する公式サイトではないことを明示する説明文。
 * /about, /editorial-policy に掲載されている文言と一致させている。
 */
const SITE_IDENTITY_DESCRIPTION =
  "延岡市の市長、市議会議員、会派、議会活動、市政に関する情報を市民に分かりやすく伝えることを目的とした情報サイトです。延岡市や延岡市議会が運営する公式サイトではありません。";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const mayor = mayorData as Mayor;
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const billVotes = publicBills(billVotesIndexData as BillVoteIndexItem[]);
const councilSessions = councilSessionsData as CouncilSession[];
const mayorPromises = (mayorPromisesData as MayorPromisesData).promises;
// Phase202：市長公約の3階層（政策分野・個別公約・個別施策）の呼称・件数は
// src/lib/mayorPromiseTerms.ts の単一情報源を使う（meta descriptionへ件数を直書きしない）。
const speechSummaryData = councilSpeechIndexData as unknown as CouncilSpeechSummaryData;
const themes = themesData as Theme[];
const financeDashboard = financeDashboardData as FinanceDashboardData;
const entertainmentExpenses = mayorEntertainmentExpensesData as MayorEntertainmentExpensesData;
const compensationComparison = compensationComparisonData as CompensationComparisonEntry[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveCouncilLeadership = archiveCouncilLeadershipData as ArchiveCouncilLeadershipTerm[];
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];
const archivePolicies = archivePoliciesData as ArchivePolicy[];
const archiveCouncilDocuments = archiveCouncilDocumentsData as ArchiveCouncilDocument[];
const politicalFundOrganizations = politicalFundOrganizationsData as PoliticalFundOrganization[];
const politicalFundReports = politicalFundReportsData as PoliticalFundReport[];
const committees = committeesData as Committee[];
const electionResults = electionResultsData as ElectionResult[];

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

function personJsonLd(
  id: string,
  name: string,
  url: string,
  sameAs: string[],
  memberOfName?: string,
  photoUrl?: string,
): JsonLdEntry {
  const dims = photoDimensionsFor(photoUrl);
  return {
    id,
    data: {
      "@context": "https://schema.org",
      "@type": "Person",
      name,
      url,
      ...(sameAs.length > 0 ? { sameAs } : {}),
      ...(memberOfName ? { memberOf: { "@type": "Organization", name: memberOfName } } : {}),
      ...(photoUrl && dims
        ? {
            image: {
              "@type": "ImageObject",
              url: `${SITE_URL}${photoUrl}`,
              width: dims.width,
              height: dims.height,
            },
          }
        : {}),
    },
  };
}

/**
 * サイト自体を表すOrganization（運営者個人の氏名などは含めない）。
 * 運営者情報（src/config/operator.ts）が設定されている場合のみ、確認済みの追加項目
 * （連絡先メール・所在地域・開設日・運営目的）を上乗せする。未確認情報は絶対に含めない。
 */
function organizationJsonLd(): JsonLdEntry {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId,
    name: organizationName(),
    url: SITE_URL,
    logo: { "@type": "ImageObject", ...SITE_LOGO },
    description: SITE_IDENTITY_DESCRIPTION,
  };
  if (isOperatorConfigured()) {
    const email = getOperatorField("contactEmail");
    if (email) data.email = email;
    const region = getOperatorField("region");
    if (region) data.areaServed = region;
    const founded = getOperatorField("foundedDate");
    if (founded) data.foundingDate = founded;
    const purpose = getOperatorField("purpose");
    if (purpose) data.description = purpose;
  }
  return { id: "organization-jsonld", data };
}

/** WebSite構造化データ（トップページのみ）。サイト内検索が実在するためSearchActionを付与する。 */
function websiteJsonLd(): JsonLdEntry {
  return {
    id: "website-jsonld",
    data: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": websiteId,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": organizationId },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  };
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
      isPartOf: { "@id": websiteId },
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
      creator: { "@type": "Organization", "@id": organizationId, name: organizationName() },
      publisher: { "@type": "Organization", "@id": organizationId, name: organizationName() },
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
            websiteJsonLd(),
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

    case "/members/former":
      return makeResult(
        {
          path: "/members/former",
          pageTitle: "元議員（延岡市政アーカイブ）",
          description: "現職ではない過去の延岡市議会議員について、公式資料で確認できた在職・活動の記録を整理しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "元議員" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-archive-former-members-jsonld",
              name: "延岡市 元議員データ",
              description: "現職ではない過去の延岡市議会議員の在職・活動記録を公式資料に基づいて整理したデータです。",
              url: `${SITE_URL}/members/former`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/members/history":
      return makeResult(
        {
          path: "/members/history",
          pageTitle: "議員在籍履歴（延岡市政アーカイブ）",
          description: "会期ごとに、公式資料で在籍が確認できた元議員を整理しています。現在の所属を過去の会期へ遡って適用していません。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "議員在籍履歴" }],
        },
        options,
      );

    case "/mayor": {
      const verifiedSns = mayor.sns.filter((s) => s.verificationStatus === "verified").map((s) => s.url);
      const sameAs = [...(mayor.officialUrl ? [mayor.officialUrl] : []), ...verifiedSns];
      const url = `${SITE_URL}/mayor`;
      return makeResult(
        {
          path: "/mayor",
          pageTitle: `延岡市長 ${mayor.name}`,
          description: `延岡市長${mayor.name}氏のプロフィール、経歴、公約（${MAYOR_PROMISE_SCALE_SUMMARY}）、市政方針、資産などの公開を公開資料に基づいて掲載しています。`,
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市長情報" }],
          extraJsonLd: [personJsonLd("person-jsonld", mayor.name, url, sameAs, undefined, mayor.photoUrl)],
          mainEntity: { "@type": "Person", name: mayor.name, url },
        },
        options,
      );
    }

    case "/mayors":
      return makeResult(
        {
          path: "/mayors",
          pageTitle: "歴代市長（延岡市政アーカイブ）",
          description: "延岡市長の任期・経歴を公式資料で確認できた範囲で整理しています。市長個人への評価・採点は行っていません。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "歴代市長" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-archive-mayors-jsonld",
              name: "延岡市 歴代市長データ",
              description: "延岡市長の任期・経歴を公式資料に基づいて整理したデータです。",
              url: `${SITE_URL}/mayors`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/city-officials":
      return makeResult(
        {
          path: "/city-officials",
          pageTitle: "副市長・教育長・行政委員会委員",
          description:
            "延岡市の副市長・教育長・農業委員会委員など、市長以外の特別職・行政委員会委員のうち、市議会の同意を経て就任したことが公式資料で確認できる現職者を掲載しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "副市長・教育長・行政委員会委員" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-city-special-posts-jsonld",
              name: "延岡市 副市長・教育長・行政委員会委員データ",
              description: "延岡市の副市長・教育長・農業委員会委員等の現職者を公式資料に基づいて整理したデータです。",
              url: `${SITE_URL}/city-officials`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/people":
      return makeResult(
        {
          path: "/people",
          pageTitle: "人物から探す",
          description: "現職議員・元議員・市長を横断して、関連する政策・議案・条例・請願・陳情をまとめて確認できます。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "人物から探す" }],
        },
        options,
      );

    case "/policies":
      return makeResult(
        {
          path: "/policies",
          pageTitle: "政策（延岡市政アーカイブ）",
          description: "市長・議員・会派・市の政策を、公式資料の原文と出典に基づいて整理しています。達成・未達成の独自判定や優劣評価は行っていません。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "政策" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-archive-policies-jsonld",
              name: "延岡市政 政策データ",
              description: "市長・議員・会派・市の政策を公式資料に基づいて整理したデータです。",
              url: `${SITE_URL}/policies`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/mayor/policy-progress":
      return makeResult(
        {
          path: "/mayor/policy-progress",
          pageTitle: "市長公約の進捗状況",
          description: `延岡市長の公約（${MAYOR_PROMISE_SCALE_SUMMARY}）について、現在の状況、確認できた取組、根拠資料をキーワード・政策分野・進捗状況などで検索できます。`,
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市長公約の進捗状況" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-policy-progress-jsonld",
              name: "市長公約の進捗状況データ",
              description: `市長の${MAYOR_PROMISE_LEVELS.promise.label}${mayorPromiseCounts.promise}件ごとの進捗状況・根拠資料と、その内訳である${MAYOR_PROMISE_LEVELS.measure.label}${mayorPromiseCounts.measure}件を、${MAYOR_PROMISE_LEVELS.policyArea.label}${mayorPromiseCounts.policyArea}件に分けて整理したデータです。`,
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

    case "/political-funds":
      return makeResult(
        {
          path: "/political-funds",
          pageTitle: "政治資金収支報告書",
          description:
            "政治資金規正法に基づき政治団体が公表した収支報告書の内容を、総務省・宮崎県選挙管理委員会等の公式資料に基づいて整理しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "政治資金収支報告書" }],
        },
        options,
      );

    case "/committees":
      return makeResult(
        {
          path: "/committees",
          pageTitle: "委員会一覧",
          description:
            "延岡市議会の常任委員会・議会運営委員会・特別委員会の委員名簿を、延岡市議会公式ホームページの公表資料に基づいて整理しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "委員会一覧" }],
        },
        options,
      );

    case "/committees/leadership-history":
      return makeResult(
        {
          path: "/committees/leadership-history",
          pageTitle: "歴代議長・副議長（2001〜2012年分）",
          description: `延岡市議会の歴代議長・副議長を、延岡市公式ホームページが公開する延岡市史（市制80周年記念10年史）に基づいて整理しています。現時点では2001〜2012年分（議長${archiveCouncilLeadership.filter((t) => t.role === "議長").length}件・副議長${archiveCouncilLeadership.filter((t) => t.role === "副議長").length}件）のみの収録で、それ以前・それ以降は調査中です。`,
          breadcrumbs: [
            { label: "ホーム", to: "/" },
            { label: "委員会一覧", to: "/committees" },
            { label: "歴代議長・副議長" },
          ],
        },
        options,
      );

    case "/elections":
      return makeResult(
        {
          path: "/elections",
          pageTitle: "選挙結果一覧",
          description:
            "延岡市長選挙・延岡市議会議員選挙の候補者名・党派・得票数・当落・投票率を、延岡市選挙管理委員会等の公表資料に基づいて整理しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "選挙結果一覧" }],
        },
        options,
      );

    case "/city-organization":
      return makeResult(
        {
          path: "/city-organization",
          pageTitle: "延岡市役所の組織一覧",
          description:
            "延岡市役所の部・課・室・センターの所管・電話番号・所在地を、延岡市公式ホームページ「組織でさがす」の公表内容に基づいて整理しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "延岡市役所の組織一覧" }],
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

    case "/finance/budget":
      return makeResult(
        {
          path: "/finance/budget",
          pageTitle: "予算・決算規模の推移（延岡市政アーカイブ）",
          description: "延岡市の一般会計当初予算・補正後予算・決算額を、年度ごとに区別して整理しています。予算と決算は別の数値として扱っています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "延岡市の財政", to: "/finance" }, { label: "予算・決算規模の推移" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-finance-budget-jsonld",
              name: "延岡市 予算・決算規模の年度別データ",
              description: "延岡市の一般会計当初予算・補正後予算・決算額を年度別に整理したデータです。",
              url: `${SITE_URL}/finance/budget`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/finance/debt":
      return makeResult(
        {
          path: "/finance/debt",
          pageTitle: "市債の推移（延岡市政アーカイブ）",
          description: "延岡市の市債発行額・年度末残高を、区分（一般会計・普通会計・特別会計・企業会計・一人当たり）ごとに整理しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "延岡市の財政", to: "/finance" }, { label: "市債の推移" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-finance-debt-jsonld",
              name: "延岡市 市債の年度別データ",
              description: "延岡市の市債発行額・残高を年度別・区分別に整理したデータです。",
              url: `${SITE_URL}/finance/debt`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/finance/funds":
      return makeResult(
        {
          path: "/finance/funds",
          pageTitle: "基金残高の推移（延岡市政アーカイブ）",
          description: "延岡市の年度末基金残高（財源調整用基金・その他特定目的基金等）を、年度ごとに整理しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "延岡市の財政", to: "/finance" }, { label: "基金残高の推移" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-finance-funds-jsonld",
              name: "延岡市 基金残高の年度別データ",
              description: "延岡市の年度末基金残高を年度別に整理したデータです。",
              url: `${SITE_URL}/finance/funds`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/compare":
      return makeResult(
        {
          path: "/compare",
          pageTitle: "市政アーカイブの比較",
          description: "歴代市長・年度別財政（人口・予算・市債・基金）を、最大4件まで選んで比較できます。点数化や優劣判定は行いません。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較" }],
        },
        options,
      );

    case "/compare/mayors":
      // 選択した市長によって内容が変わり続けるページのため、常にnoindexにする。
      return makeResult(
        {
          path: "/compare/mayors",
          pageTitle: "歴代市長の比較",
          description: "歴代市長を最大4名まで選んで、任期・就任回数・出典を比較できます。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較", to: "/compare" }, { label: "歴代市長の比較" }],
          skipWebPage: true,
        },
        options,
      );

    case "/compare/members":
      // 選択した議員によって内容が変わり続けるページのため、常にnoindexにする。
      return makeResult(
        {
          path: "/compare/members",
          pageTitle: "議員の比較",
          description: "現職議員・元議員を横断して最大4名まで選び、会派・在籍状況・関連する政策や議案の件数を比較できます。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較", to: "/compare" }, { label: "議員の比較" }],
          skipWebPage: true,
        },
        options,
      );

    case "/compare/policies":
      // 選択した政策によって内容が変わり続けるページのため、常にnoindexにする。
      return makeResult(
        {
          path: "/compare/policies",
          pageTitle: "政策の比較",
          description: "市長・議員・会派・市の政策を最大4件まで選んで、所有者・テーマ・状況を比較できます。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較", to: "/compare" }, { label: "政策の比較" }],
          skipWebPage: true,
        },
        options,
      );

    case "/compare/finance":
      // 選択した年度によって内容が変わり続けるページのため、常にnoindexにする。
      return makeResult(
        {
          path: "/compare/finance",
          pageTitle: "年度別財政の比較",
          description: "人口・予算・市債・基金・財政健全化判断比率を、最大4年度まで選んで比較できます。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較", to: "/compare" }, { label: "年度別財政の比較" }],
          skipWebPage: true,
        },
        options,
      );

    case "/compare/population":
      // 選択した年度によって内容が変わり続けるページのため、常にnoindexにする。
      return makeResult(
        {
          path: "/compare/population",
          pageTitle: "人口の比較",
          description: "延岡市の人口・世帯数を、最大4年度まで選んで比較できます。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較", to: "/compare" }, { label: "人口の比較" }],
          skipWebPage: true,
        },
        options,
      );

    case "/compare/budget":
      // 選択した年度によって内容が変わり続けるページのため、常にnoindexにする。
      return makeResult(
        {
          path: "/compare/budget",
          pageTitle: "予算・決算の比較",
          description: "一般会計の当初予算・補正後予算・決算額を、最大4年度まで選んで比較できます。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較", to: "/compare" }, { label: "予算・決算の比較" }],
          skipWebPage: true,
        },
        options,
      );

    case "/compare/debt":
      // 選択した年度によって内容が変わり続けるページのため、常にnoindexにする。
      return makeResult(
        {
          path: "/compare/debt",
          pageTitle: "市債の比較",
          description: "市債発行額・年度末残高（区分別）を、最大4年度まで選んで比較できます。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較", to: "/compare" }, { label: "市債の比較" }],
          skipWebPage: true,
        },
        options,
      );

    case "/compare/funds":
      // 選択した年度によって内容が変わり続けるページのため、常にnoindexにする。
      return makeResult(
        {
          path: "/compare/funds",
          pageTitle: "基金の比較",
          description: "年度末の基金残高（財源調整用基金・その他特定目的基金）を、最大4年度まで選んで比較できます。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較", to: "/compare" }, { label: "基金の比較" }],
          skipWebPage: true,
        },
        options,
      );

    case "/compare/municipalities":
      return makeResult(
        {
          path: "/compare/municipalities",
          pageTitle: "延岡市と宮崎県内5市の比較",
          description: "延岡市と宮崎市・都城市・日向市・日南市・小林市・西都市の人口、議員報酬、財政指標等を、公式資料で確認できた範囲で比較します。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較", to: "/compare" }, { label: "延岡市と宮崎県内5市の比較" }],
        },
        options,
      );

    case "/compare/similar-municipalities":
      return makeResult(
        {
          path: "/compare/similar-municipalities",
          pageTitle: "類似団体（Ⅲ－３）財政比較",
          description: "延岡市が属する総務省の類似団体区分「Ⅲ－３」（人口・産業構造が近い全国59自治体）と、財政力指数・経常収支比率・実質公債費比率・将来負担比率等を同一年度・同一定義で比較します。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政アーカイブの比較", to: "/compare" }, { label: "類似団体（Ⅲ－３）財政比較" }],
        },
        options,
      );

    case "/timeline":
      return makeResult(
        {
          path: "/timeline",
          pageTitle: "延岡市政の年表",
          description: "市長任期・年度別財政データを、公式資料で確認できた範囲で年度別に一覧表示します。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "延岡市政の年表" }],
        },
        options,
      );

    case "/history":
      return makeResult(
        {
          path: "/history",
          pageTitle: "延岡市政90年の歴史年表（市制施行〜現在）",
          description:
            "1933年の市制施行から現在までの延岡市政の歩みを、市制施行、合併、市庁舎、災害、公共事業等の出来事と歴代市長、人口の推移とあわせて年代順に整理しています。延岡市公式資料で確認できる範囲のみ掲載。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市政年表" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-civic-timeline-jsonld",
              name: "延岡市政90年 市政年表データ",
              description: "延岡市公式資料で確認できる、市制施行・合併・市庁舎・行政組織・災害・公共事業等の主な出来事と、歴代市長・人口推移のデータです。",
              url: `${SITE_URL}/history`,
              dateModified: options?.lastmod,
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
          description: `延岡市議会議員、議案、市長公約（${MAYOR_PROMISE_SCALE_SUMMARY}）などの登録件数や構成を、データから自動集計して確認できます。`,
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "ダッシュボード" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-dashboard-jsonld",
              name: "延岡市政データダッシュボード集計データ",
              description: `延岡市議会議員、議案、市長公約（${MAYOR_PROMISE_SCALE_SUMMARY}）などの登録件数・構成を自動集計したデータです。`,
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
      // フェーズ7：議案アーカイブ（一覧）。議員別賛否そのものは既存/bills/votesが専用ルートとして扱う。
      return makeResult(
        {
          path: "/bills",
          pageTitle: "議案アーカイブ",
          description: "延岡市議会に提出された議案を、公式資料の原文と出典に基づいて整理しています。議員別の賛否は議案ごとの賛否ページでご確認いただけます。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "議案アーカイブ" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-archive-bills-jsonld",
              name: "延岡市議会 議案アーカイブデータ",
              description: "延岡市議会に提出された議案を公式資料に基づいて整理したデータです。",
              url: `${SITE_URL}/bills`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/ordinances":
      return makeResult(
        {
          path: "/ordinances",
          pageTitle: "条例アーカイブ",
          description: "延岡市の条例の制定・改正・廃止を、公式資料の原文と出典に基づいて整理しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "条例アーカイブ" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-archive-ordinances-jsonld",
              name: "延岡市 条例アーカイブデータ",
              description: "延岡市の条例の制定・改正・廃止を公式資料に基づいて整理したデータです。",
              url: `${SITE_URL}/ordinances`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/petitions":
      return makeResult(
        {
          path: "/petitions",
          pageTitle: "請願アーカイブ",
          description: "延岡市議会へ提出された請願の審査状況を、公式資料の原文と出典に基づいて整理しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "請願アーカイブ" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-archive-petitions-jsonld",
              name: "延岡市議会 請願アーカイブデータ",
              description: "延岡市議会へ提出された請願の審査状況を公式資料に基づいて整理したデータです。",
              url: `${SITE_URL}/petitions`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/requests":
      return makeResult(
        {
          path: "/requests",
          pageTitle: "陳情アーカイブ",
          description: "延岡市議会へ提出された陳情の審査状況を、公式資料の原文と出典に基づいて整理しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "陳情アーカイブ" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-archive-requests-jsonld",
              name: "延岡市議会 陳情アーカイブデータ",
              description: "延岡市議会へ提出された陳情の審査状況を公式資料に基づいて整理したデータです。",
              url: `${SITE_URL}/requests`,
              dateModified: lastmod,
            }),
          ],
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

    case "/council-documents":
      return makeResult(
        {
          path: "/council-documents",
          pageTitle: "延岡市議会の定例会・議会資料",
          description:
            "延岡市議会の定例会・臨時会ごとに、議案、審議結果、請願・陳情、会議録、市議会だよりなどの公式PDF資料を整理して掲載しています。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "定例会・議会資料" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-council-documents-jsonld",
              name: "延岡市議会 定例会・議会資料データ",
              description: "延岡市議会の定例会・臨時会ごとの議案、審議結果、請願・陳情、会議録、市議会だよりなどの資料一覧データです。",
              url: `${SITE_URL}/council-documents`,
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

    case "/themes":
      return makeResult(
        {
          path: "/themes",
          pageTitle: "テーマから探す",
          description: "延岡市議会の一般質問・質疑を、公式会議録本文から確認できたテーマ別に検索できます。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "テーマから探す" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-themes-jsonld",
              name: "延岡市議会 一般質問テーマ別データ",
              description: "延岡市議会の一般質問・質疑を、公式会議録本文から確認できたテーマ別に整理したデータです。",
              url: `${SITE_URL}/themes`,
              dateModified: lastmod,
            }),
          ],
        },
        options,
      );

    case "/executive-answers":
      return makeResult(
        {
          path: "/executive-answers",
          pageTitle: "市長・執行部答弁の検索",
          description: "延岡市長、副市長、教育長、部長などの答弁を、公式会議録本文から確認できた範囲で横断検索できます。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "市長・執行部答弁の検索" }],
          extraJsonLd: [
            datasetJsonLd({
              id: "dataset-executive-answers-jsonld",
              name: "延岡市長・執行部答弁データ",
              description: "延岡市長、副市長、教育長、部長などの答弁を、公式会議録本文から確認できた範囲で整理したデータです。",
              url: `${SITE_URL}/executive-answers`,
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
          description:
            "延岡市政見える化ポータルを運営する「のべおか市政データラボ」の運営目的、情報源、政治的中立性、訂正方針、個人情報の取り扱いについて説明します。",
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

    case "/data-status":
      return makeResult(
        {
          path: "/data-status",
          pageTitle: "データ収録状況",
          description:
            "延岡市政見える化ポータルが登録している議員・元議員・歴代市長・議案・条例・請願・陳情・政策・財政・一般質問等の収録件数と確認状況を、既存データから自動集計して表示します。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "データ収録状況" }],
        },
        options,
      );

    case "/methodology/activity-radar":
      return makeResult(
        {
          path: "/methodology/activity-radar",
          pageTitle: "議会活動データ（レーダーチャート）の算定方法",
          description:
            "議員詳細ページに表示している議会活動データ（レーダーチャート）の定義・計算式・欠損データの扱い・在職期間の扱いを説明します。議員の能力や優劣を評価するものではありません。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "議会活動データの算定方法" }],
        },
        options,
      );

    case "/council-activity":
      return makeResult(
        {
          path: "/council-activity",
          pageTitle: "延岡市議会 議員活動バロメーター",
          description:
            "延岡市議会議員の一般質問、議会内発言、請願・提案等、情報発信、出席状況を公開資料から可視化しています。議員の能力や政策の質を評価するものではありません。",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "議員活動バロメーター" }],
        },
        options,
      );

    case "/council-activity/history":
      return makeResult(
        {
          path: "/council-activity/history",
          pageTitle: "元議員の活動履歴（参考情報）",
          description:
            "現職ではない元延岡市議会議員について、在職期間内に確認できた一般質問・議会内発言・議案等の意思表示を公開資料から整理しています。現職議員との比較・総合順位付けは行っていません。",
          breadcrumbs: [
            { label: "ホーム", to: "/" },
            { label: "議員活動バロメーター", to: "/council-activity" },
            { label: "元議員の活動履歴" },
          ],
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

    case "/koho-search":
      // 検索結果はクエリごとに内容が変わり続けるため、常にnoindexにする。OCR結果を含む試験版。
      return makeResult(
        {
          path: "/koho-search",
          pageTitle: "広報のべおか文字起こし検索（試験版）",
          description: "広報のべおかバックナンバーをOCR（文字認識）した結果をキーワード検索できます。OCR結果は未確認の場合があります。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "広報のべおか文字起こし検索" }],
          skipWebPage: true,
        },
        options,
      );

    case "/bills/compare":
      // 選択した2議案によって内容が変わり続けるページのため、常にnoindexにする。
      return makeResult(
        {
          path: "/bills/compare",
          pageTitle: "議案の比較",
          description: "2つの議案を選んで、定例会・提出日・議決日・議決結果を比較できます。",
          robots: "noindex, follow",
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "議案ごとの賛否", to: "/bills/votes" }, { label: "議案の比較" }],
          skipWebPage: true,
        },
        options,
      );

    default:
      return undefined;
  }
}

/** /members/:id */
/** /council-activity/:memberId */
function councilActivityMemberSeo(id: string, options?: SeoOptions): SeoResult {
  const member = members.find((m) => m.id === id);
  if (!member) return notFound(`/council-activity/${id}`, "議員活動バロメーター");

  const verifiedSns = member.sns.filter((s) => s.verificationStatus === "verified").map((s) => s.url);
  const sameAs = [...(member.profileUrl ? [member.profileUrl] : []), ...verifiedSns];
  const url = `${SITE_URL}/council-activity/${id}`;

  return makeResult(
    {
      path: `/council-activity/${id}`,
      pageTitle: `${member.name}議員｜議員活動バロメーター`,
      description: `延岡市議会議員${member.name}氏の一般質問、議会内発言、議案等の意思表示、情報発信を公開資料から可視化しています。議員の能力や政策の質を評価するものではありません。`,
      image: memberOgImage(member.id),
      breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "議員活動バロメーター", to: "/council-activity" }, { label: member.name }],
      extraJsonLd: [personJsonLd("person-jsonld", member.name, url, sameAs, "延岡市議会", member.photoUrl)],
      mainEntity: { "@type": "Person", name: member.name, url },
    },
    options,
  );
}

function memberSeo(id: string, options?: SeoOptions): SeoResult {
  const member = members.find((m) => m.id === id);
  if (!member) {
    // MemberDetailPage.tsx（本文側）は id が現職議員に見つからない場合、formerMembers.json へ
    // フォールバックして本文を表示する（/members/former/:slug と同じ内容を /members/:id でも
    // 閲覧できる設計）。以前はこの分岐がSEOメタデータ側に無く、本文は正しく表示されるのに
    // title/descriptionが汎用文言・robotsがnoindexのままになっていた（Phase78 UI監査で発見）。
    // canonicalは重複コンテンツを避けるため /members/former/:slug 側に寄せる。
    const formerMember = formerMembers.find((m) => m.id === id);
    if (formerMember) {
      const profile = archiveMemberProfiles.find((p) => p.legacyFormerMemberId === id);
      const url = `${SITE_URL}/members/${id}`;
      const sameAs = profile?.sourceRefs.map((r) => r.sourceUrl).filter((u): u is string => Boolean(u)) ?? [];
      return makeResult(
        {
          path: `/members/${id}`,
          canonicalPath: profile ? `/members/former/${profile.slug}` : undefined,
          pageTitle: `${formerMember.name}｜元議員`,
          description: `延岡市議会の元議員${formerMember.name}氏について、公式資料で確認できた在職・活動の記録を掲載しています。`,
          breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "元議員", to: "/members/former" }, { label: formerMember.name }],
          extraJsonLd: [personJsonLd("person-jsonld", formerMember.name, url, sameAs)],
          mainEntity: { "@type": "Person", name: formerMember.name, url },
        },
        options,
      );
    }
    return notFound(`/members/${id}`, "議員情報");
  }

  const memberQuestions = generalQuestions.filter((q) => q.memberId === member.id);
  const memberHasBillVotes = billVotes.some((b) => (b.memberIdsWithVote ?? []).includes(member.id));

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
      extraJsonLd: [personJsonLd("person-jsonld", member.name, url, sameAs, "延岡市議会", member.photoUrl)],
      mainEntity: { "@type": "Person", name: member.name, url },
    },
    options,
  );
}

/**
 * /members/:memberId/questions/:speechId
 * isPublished:trueの発言データが存在する場合のみ実ページとして扱う。現時点では
 * councilSpeechSummaries.jsonにisPublished:trueのレコードが1件も無いため、常にnotFoundとなる
 * （サイトマップ・プリレンダリング対象にも含まれない。scripts/lib/public-routes.mjs参照）。
 */
function speechDetailSeo(memberId: string, speechId: string, options?: SeoOptions): SeoResult {
  const activeMember = members.find((m) => m.id === memberId);
  const formerMember = !activeMember ? formerMembers.find((m) => m.id === memberId) : undefined;
  const member = activeMember ?? formerMember;
  const speech = member && findPublishedSpeech(speechSummaryData, memberId, speechId);
  if (!member || !speech) return notFound(`/members/${memberId}/questions/${speechId}`, "一般質問・質疑の要約");

  const session = councilSessions.find((s) => s.id === speech.sessionId);
  const isVerified = speech.summaryStatus === "verified";
  const description = isVerified
    ? `${session?.title ?? speech.sessionId}で${member.name}議員が行った${speech.speechType}と、市の答弁を公式会議録に基づいて要約しています。`
    : `${session?.title ?? speech.sessionId}で${member.name}議員が行った${speech.speechType}について、公式会議録を基に確認できた内容を掲載しています。要約の一部は現在確認中です。`;
  const memberHref = activeMember
    ? `/members/${memberId}`
    : (() => {
        const profile = archiveMemberProfiles.find((p) => p.legacyFormerMemberId === memberId || p.legacyMemberId === memberId);
        return profile ? `/members/former/${profile.slug}` : "/members/former";
      })();

  return makeResult(
    {
      path: `/members/${memberId}/questions/${speechId}`,
      pageTitle: `${member.name}議員の${speech.speechType}｜${session?.title ?? speech.sessionId}`,
      description,
      ogType: "article",
      breadcrumbs: [
        { label: "ホーム", to: "/" },
        { label: "議員一覧", to: "/" },
        { label: member.name, to: memberHref },
        { label: speech.speechType },
      ],
      datePublished: speech.date ?? undefined,
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
      // questionDateは開催（予定）日であり、質問通告書ベースで会議録未公開の会期では
      // 未来日になりうる（datePublishedに未来日は不適切）。referenceDateは通告書自体の
      // 公表日で、常に過去日であるためこちらを使う。
      datePublished: item.referenceDate,
    },
    options,
  );
}

/** /themes/:themeSlug */
function themeDetailSeo(slug: string, options?: SeoOptions): SeoResult {
  const theme = themes.find((t) => t.slug === slug);
  if (!theme) return notFound(`/themes/${slug}`, "テーマ情報");

  const aggregate = aggregateSpeechesByTheme(speechSummaryData.members).find((a) => a.slug === slug);
  const questionCount = aggregate?.speechIds.length ?? 0;
  const description =
    questionCount > 0
      ? `${theme.description}公式会議録本文から確認できた質問件数：${questionCount}件。`
      : `${theme.description}現在、このテーマに関する質問は確認できていません。`;

  return makeResult(
    {
      path: `/themes/${slug}`,
      pageTitle: `${theme.name}に関する一般質問`,
      description,
      breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "テーマから探す", to: "/themes" }, { label: theme.name }],
      extraJsonLd: [
        datasetJsonLd({
          id: "dataset-theme-detail-jsonld",
          name: `延岡市議会 ${theme.name}に関する一般質問データ`,
          description: `延岡市議会の一般質問のうち、${theme.name}に分類された質問・答弁のデータです。`,
          url: `${SITE_URL}/themes/${slug}`,
          dateModified: options?.lastmod,
        }),
      ],
    },
    options,
  );
}

/** /mayors/:slug */
function mayorDetailSeo(slug: string, options?: SeoOptions): SeoResult {
  const archiveMayor = archiveMayors.find((m) => m.slug === slug);
  if (!archiveMayor) return notFound(`/mayors/${slug}`, "市長情報");

  const url = `${SITE_URL}/mayors/${slug}`;
  const sameAs = archiveMayor.sourceRefs.map((r) => r.sourceUrl).filter((u): u is string => Boolean(u));

  return makeResult(
    {
      path: `/mayors/${slug}`,
      pageTitle: `${archiveMayor.name}｜歴代市長`,
      description: `延岡市長${archiveMayor.name}氏の任期・経歴を公式資料で確認できた範囲で掲載しています。`,
      breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "歴代市長", to: "/mayors" }, { label: archiveMayor.name }],
      extraJsonLd: [personJsonLd("person-jsonld", archiveMayor.name, url, sameAs)],
      mainEntity: { "@type": "Person", name: archiveMayor.name, url },
    },
    options,
  );
}

/**
 * /timeline/:year。年度に該当データが無くても「該当データなし」を安全に表示するページのため、
 * archiveFiscalYearsに無い年度でもnotFoundにはしない（年の形式が不正な場合のみ通常のnotFoundに
 * フォールバックする。フォールバックはgetSeoForPath側のTIMELINE_YEAR_RE不一致で処理する）。
 */
function timelineYearSeo(yearText: string, options?: SeoOptions): SeoResult {
  const year = Number(yearText);
  return makeResult(
    {
      path: `/timeline/${year}`,
      pageTitle: `${year}年度の年表`,
      description: `${year}年度の市長任期・財政・一般質問・議案等を、公式資料で確認できた範囲で一覧表示します。`,
      breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "延岡市政の年表", to: "/timeline" }, { label: `${year}年度` }],
    },
    options,
  );
}

/** /policies/:slug */
function policyDetailSeo(slug: string, options?: SeoOptions): SeoResult {
  const policy = archivePolicies.find((p) => p.slug === slug);
  if (!policy) return notFound(`/policies/${slug}`, "政策情報");

  return makeResult(
    {
      path: `/policies/${slug}`,
      pageTitle: `${policy.title}｜政策`,
      description: policy.summary,
      breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "政策", to: "/policies" }, { label: policy.title }],
    },
    options,
  );
}

const COUNCIL_DOCUMENT_TYPE_LABELS: Record<ArchiveCouncilDocumentType, string> = {
  bill: "議案",
  ordinance: "条例",
  petition: "請願",
  request: "陳情",
};

const COUNCIL_DOCUMENT_BASE_PATHS: Record<ArchiveCouncilDocumentType, string> = {
  bill: "/bills",
  ordinance: "/ordinances",
  petition: "/petitions",
  request: "/requests",
};

/** /bills/:slug・/ordinances/:slug・/petitions/:slug・/requests/:slug 共通。 */
function councilDocumentDetailSeo(
  documentType: ArchiveCouncilDocumentType,
  slug: string,
  options?: SeoOptions,
): SeoResult {
  const basePath = COUNCIL_DOCUMENT_BASE_PATHS[documentType];
  const typeLabel = COUNCIL_DOCUMENT_TYPE_LABELS[documentType];
  const doc = archiveCouncilDocuments.find((d) => d.documentType === documentType && d.slug === slug);
  if (!doc) return notFound(`${basePath}/${slug}`, `${typeLabel}情報`);

  return makeResult(
    {
      path: `${basePath}/${slug}`,
      pageTitle: `${doc.title}｜${typeLabel}`,
      description: doc.summary,
      breadcrumbs: [
        { label: "ホーム", to: "/" },
        { label: `${typeLabel}アーカイブ`, to: basePath },
        { label: doc.title },
      ],
    },
    options,
  );
}

/**
 * /people/:slug のSEOで必要なのは人物名だけのため、buildPersonIndex()（活動件数の集計や
 * 統合タイムラインまで組み立てる重い処理）は呼ばず、人物一覧と同じ3つの情報源
 * （members.json／formerMembers.json／archiveMayors.json）から氏名だけを引く。
 * 対象人物の集合・氏名はbuildPersonIndex()と同一。
 */
function personDisplayName(personType: PersonType, id: string): string | undefined {
  if (personType === "member") return members.find((m) => m.id === id)?.name;
  if (personType === "former-member") return formerMembers.find((m) => m.id === id)?.name;
  return archiveMayors.find((m) => m.id === id)?.name;
}

/** /people/:slug */
function personDetailSeo(slug: string, options?: SeoOptions): SeoResult {
  const parsed = parsePersonSlug(slug);
  const personName = parsed ? personDisplayName(parsed.personType, parsed.id) : undefined;
  if (!parsed || !personName) return notFound(`/people/${slug}`, "人物情報");
  const person = { name: personName };

  return makeResult(
    {
      path: `/people/${slug}`,
      pageTitle: `${person.name}｜${personTypeLabel(parsed.personType)}`,
      description: `${person.name}（${personTypeLabel(parsed.personType)}）に関連する政策・議案・条例・請願・陳情を横断して確認できます。`,
      breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "人物から探す", to: "/people" }, { label: person.name }],
    },
    options,
  );
}

/** /members/former/:slug */
function memberFormerDetailSeo(slug: string, options?: SeoOptions): SeoResult {
  // archiveMemberProfiles.jsonは現職・元議員の両方を収録する（Phase35で現職分を追加）。
  // legacyMemberId（現職）が設定されたプロフィールは、このページのSEOメタデータ生成対象外とする
  // （現職議員がGoogle検索結果等で「元議員」と表示されるのを防ぐ）。
  const profile = archiveMemberProfiles.find((p) => p.slug === slug && !p.legacyMemberId);
  if (!profile) return notFound(`/members/former/${slug}`, "元議員情報");

  const url = `${SITE_URL}/members/former/${slug}`;
  const sameAs = profile.sourceRefs.map((r) => r.sourceUrl).filter((u): u is string => Boolean(u));

  return makeResult(
    {
      path: `/members/former/${slug}`,
      pageTitle: `${profile.name}｜元議員`,
      description: `延岡市議会の元議員${profile.name}氏について、公式資料で確認できた在職・活動の記録を掲載しています。`,
      breadcrumbs: [{ label: "ホーム", to: "/" }, { label: "元議員", to: "/members/former" }, { label: profile.name }],
      extraJsonLd: [personJsonLd("person-jsonld", profile.name, url, sameAs)],
      mainEntity: { "@type": "Person", name: profile.name, url },
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

  const isVerified = (bill.verificationStatus ?? "verified") === "verified";
  const description = isVerified
    ? `${bill.billNumber}「${bill.billTitle}」の概要、議決結果（${bill.result}）、議員別の賛否を掲載しています。`
    : `${bill.billNumber}「${bill.billTitle}」について、延岡市議会の公式資料を基に確認できた審議情報を掲載しています。一部の結果表記は現在確認中です。`;

  return makeResult(
    {
      path: `/bills/votes/${id}`,
      pageTitle: `${bill.billNumber}「${bill.billTitle}」｜採決結果・議員別賛否`,
      description,
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

/** /council-documents/:sessionId */
function councilSessionSeo(sessionId: string, options?: SeoOptions): SeoResult {
  const session = councilSessions.find((s) => s.id === sessionId);
  if (!session) return notFound(`/council-documents/${sessionId}`, "定例会情報");
  const visibleDocumentCount = publicDocuments(session.documents).length;
  // documentsが0件でも、資料自体が存在しないと確認できたわけではなく、単に本サイトが
  // まだPDF資料を収集・登録していないだけの会期（status:"要確認"の自動生成会期）がある。
  // 「（0件）を掲載しています」は「確認済みゼロ件」に読めてしまうため、未収集の場合は
  // 別の文言にする（CLAUDE.mdの「未確認データを0として扱わない」方針に沿う）。
  const documentsNotYetCollected = visibleDocumentCount === 0 && session.status === "要確認";

  const baseDescription = documentsNotYetCollected
    ? `${session.title}の会期情報です。議案、審議結果、請願・陳情、会議録、市議会だよりなどの公式PDF資料は、本サイトでは現在未収集です（資料が存在しないという意味ではありません）。`
    : `${session.title}の議案、審議結果、請願・陳情、会議録、市議会だよりなどの公式PDF資料（${visibleDocumentCount}件）を掲載しています。`;
  const description =
    session.summaryStatus === "verified"
      ? `${session.title}で審議された議案、審議結果および関連する公式資料を掲載しています。${baseDescription}`
      : session.summaryStatus && session.summaryStatus !== "unavailable"
        ? `${session.title}について、公式資料を基に確認できた議案、審議結果、資料等を掲載しています。会期概要の一部は現在確認中です。`
        : baseDescription;

  return makeResult(
    {
      path: `/council-documents/${sessionId}`,
      pageTitle: `${session.title}の議会資料`,
      description,
      breadcrumbs: [
        { label: "ホーム", to: "/" },
        { label: "定例会・議会資料", to: "/council-documents" },
        { label: session.title },
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
            author: { "@type": "Organization", "@id": organizationId, name: organizationName() },
            publisher: { "@type": "Organization", "@id": organizationId, name: organizationName() },
            isBasedOn: conference.sourceUrl,
            citation: conference.sourceUrl,
          },
        },
      ],
    },
    options,
  );
}

/** /political-funds/:id */
function politicalFundOrganizationSeo(id: string, options?: SeoOptions): SeoResult {
  const organization = politicalFundOrganizations.find((o) => o.id === id);
  if (!organization) return notFound(`/political-funds/${id}`, "政治団体が見つかりません");

  const reportCount = politicalFundReports.filter((r) => r.organizationId === organization.id).length;
  const description = `${organization.name}（${organization.organizationType}）の政治資金収支報告書を、${organization.disclosureAuthority}の公表資料に基づいて整理しています。`;

  return makeResult(
    {
      path: `/political-funds/${id}`,
      pageTitle: `${organization.name}の政治資金収支報告書`,
      description,
      breadcrumbs: [
        { label: "ホーム", to: "/" },
        { label: "政治資金収支報告書", to: "/political-funds" },
        { label: organization.name },
      ],
      extraJsonLd:
        reportCount > 0
          ? [
              datasetJsonLd({
                id: "dataset-political-fund-jsonld",
                name: `${organization.name} 政治資金収支報告書データ`,
                description,
                url: `${SITE_URL}/political-funds/${id}`,
                dateModified: options?.lastmod,
              }),
            ]
          : [],
    },
    options,
  );
}

/** /elections/:id */
function electionDetailSeo(id: string, options?: SeoOptions): SeoResult {
  const election = electionResults.find((e) => e.id === id);
  if (!election) return notFound(`/elections/${id}`, "選挙結果が見つかりません");

  const dateLabel =
    election.electionDatePrecision === "month"
      ? `${election.electionDate.split("-")[0]}年${Number(election.electionDate.split("-")[1])}月`
      : election.electionDate;
  const description = `${election.electionName}（${dateLabel}投票）の候補者名・党派・得票数・当落を、${election.sourceRefs[0]?.sourceOrganization ?? "公式資料"}の公表資料に基づいて整理しています。`;

  return makeResult(
    {
      path: `/elections/${id}`,
      pageTitle: `${election.electionName}（${dateLabel}）の結果`,
      description,
      breadcrumbs: [
        { label: "ホーム", to: "/" },
        { label: "選挙結果一覧", to: "/elections" },
        { label: `${election.electionName}（${dateLabel}）` },
      ],
    },
    options,
  );
}

/** /committees/:id */
function committeeDetailSeo(id: string, options?: SeoOptions): SeoResult {
  const committee = committees.find((c) => c.id === id);
  if (!committee) return notFound(`/committees/${id}`, "委員会が見つかりません");

  const description = `${committee.name}（${committee.type}）の委員名簿・委員長・副委員長・任期を、延岡市議会公式ホームページの公表資料に基づいて整理しています。`;

  return makeResult(
    {
      path: `/committees/${id}`,
      pageTitle: `${committee.name}の委員名簿`,
      description,
      breadcrumbs: [
        { label: "ホーム", to: "/" },
        { label: "委員会一覧", to: "/committees" },
        { label: committee.name },
      ],
    },
    options,
  );
}

const MEMBER_RE = /^\/members\/([^/]+)$/;
const COUNCIL_ACTIVITY_MEMBER_RE = /^\/council-activity\/([^/]+)$/;
const SPEECH_DETAIL_RE = /^\/members\/([^/]+)\/questions\/([^/]+)$/;
const QUESTION_RE = /^\/questions\/([^/]+)$/;
const THEME_DETAIL_RE = /^\/themes\/([^/]+)$/;
const PROMISE_RE = /^\/mayor\/policy-progress\/([^/]+)$/;
const BILL_VOTE_RE = /^\/bills\/votes\/([^/]+)$/;
const COUNCIL_SESSION_RE = /^\/council-documents\/([^/]+)$/;
const PRESS_CONFERENCE_RE = /^\/mayor\/press-conferences\/([^/]+)$/;
const POLITICAL_FUND_ORGANIZATION_RE = /^\/political-funds\/([^/]+)$/;
const COMMITTEE_DETAIL_RE = /^\/committees\/([^/]+)$/;
const ELECTION_DETAIL_RE = /^\/elections\/([^/]+)$/;
const MAYOR_DETAIL_RE = /^\/mayors\/([^/]+)$/;
const TIMELINE_YEAR_RE = /^\/timeline\/(\d{4})$/;
const MEMBER_FORMER_DETAIL_RE = /^\/members\/former\/([^/]+)$/;
const POLICY_DETAIL_RE = /^\/policies\/([^/]+)$/;
const BILL_ARCHIVE_DETAIL_RE = /^\/bills\/([^/]+)$/;
const ORDINANCE_DETAIL_RE = /^\/ordinances\/([^/]+)$/;
const PETITION_DETAIL_RE = /^\/petitions\/([^/]+)$/;
const REQUEST_DETAIL_RE = /^\/requests\/([^/]+)$/;
const PERSON_DETAIL_RE = /^\/people\/([^/]+)$/;

/**
 * 現在のURLパス（クエリ・ハッシュを除く）から、そのページのSEO情報を返す。
 * 未知のパスの場合も、404ページ用のSeoResult（noindex, nofollow）を返す（nullは返さない）。
 * optionsのlastmodは、プリレンダリング時にサイトマップと同じ値（public-routes.mjs）を渡すことで、
 * WebPage/DatasetのdateModifiedとサイトマップのlastmodを一致させる。クライアント側の通常のページ
 * 遷移ではlastmodを渡さないため、dateModifiedは省略される（初期HTML側はプリレンダリングで確定済み）。
 *
 * pathnameは、ルート判定（switch文・正規表現の完全一致）の前に必ずnormalizePathnameへ通す。
 * Cloudflare Pagesが末尾スラッシュなしURLを末尾スラッシュ付きURLへリダイレクトするため、
 * クライアント側で実際に読まれるlocation.pathnameは末尾スラッシュを含み得る
 * （例: "/compensation/"）。正規化しないと「未登録のURL」と誤判定し、robotsが
 * noindex, nofollowへ書き換わってしまう。
 */
export function getSeoForPath(pathname: string, options?: SeoOptions): SeoResult {
  const path = normalizePathname(pathname);

  const staticResult = staticPageSeo(path, options);
  if (staticResult) return staticResult;

  const speechDetailMatch = path.match(SPEECH_DETAIL_RE);
  if (speechDetailMatch) {
    return speechDetailSeo(safeDecodeURIComponent(speechDetailMatch[1]), safeDecodeURIComponent(speechDetailMatch[2]), options);
  }

  const memberFormerDetailMatch = path.match(MEMBER_FORMER_DETAIL_RE);
  if (memberFormerDetailMatch) return memberFormerDetailSeo(safeDecodeURIComponent(memberFormerDetailMatch[1]), options);

  const memberMatch = path.match(MEMBER_RE);
  if (memberMatch) return memberSeo(safeDecodeURIComponent(memberMatch[1]), options);

  const councilActivityMemberMatch = path.match(COUNCIL_ACTIVITY_MEMBER_RE);
  if (councilActivityMemberMatch) return councilActivityMemberSeo(safeDecodeURIComponent(councilActivityMemberMatch[1]), options);

  const questionMatch = path.match(QUESTION_RE);
  if (questionMatch) return questionSeo(safeDecodeURIComponent(questionMatch[1]), options);

  const themeDetailMatch = path.match(THEME_DETAIL_RE);
  if (themeDetailMatch) return themeDetailSeo(safeDecodeURIComponent(themeDetailMatch[1]), options);

  const promiseMatch = path.match(PROMISE_RE);
  if (promiseMatch) return promiseSeo(safeDecodeURIComponent(promiseMatch[1]), options);

  const billVoteMatch = path.match(BILL_VOTE_RE);
  if (billVoteMatch) return billVoteSeo(safeDecodeURIComponent(billVoteMatch[1]), options);

  const councilSessionMatch = path.match(COUNCIL_SESSION_RE);
  if (councilSessionMatch) return councilSessionSeo(safeDecodeURIComponent(councilSessionMatch[1]), options);

  const pressConferenceMatch = path.match(PRESS_CONFERENCE_RE);
  if (pressConferenceMatch) return pressConferenceSeo(safeDecodeURIComponent(pressConferenceMatch[1]), options);

  const politicalFundOrganizationMatch = path.match(POLITICAL_FUND_ORGANIZATION_RE);
  if (politicalFundOrganizationMatch) {
    return politicalFundOrganizationSeo(safeDecodeURIComponent(politicalFundOrganizationMatch[1]), options);
  }

  const committeeDetailMatch = path.match(COMMITTEE_DETAIL_RE);
  if (committeeDetailMatch) return committeeDetailSeo(safeDecodeURIComponent(committeeDetailMatch[1]), options);

  const electionDetailMatch = path.match(ELECTION_DETAIL_RE);
  if (electionDetailMatch) return electionDetailSeo(safeDecodeURIComponent(electionDetailMatch[1]), options);

  const mayorDetailMatch = path.match(MAYOR_DETAIL_RE);
  if (mayorDetailMatch) return mayorDetailSeo(safeDecodeURIComponent(mayorDetailMatch[1]), options);

  const timelineYearMatch = path.match(TIMELINE_YEAR_RE);
  if (timelineYearMatch) return timelineYearSeo(timelineYearMatch[1], options);

  const policyDetailMatch = path.match(POLICY_DETAIL_RE);
  if (policyDetailMatch) return policyDetailSeo(safeDecodeURIComponent(policyDetailMatch[1]), options);

  const billArchiveDetailMatch = path.match(BILL_ARCHIVE_DETAIL_RE);
  if (billArchiveDetailMatch) {
    return councilDocumentDetailSeo("bill", safeDecodeURIComponent(billArchiveDetailMatch[1]), options);
  }

  const ordinanceDetailMatch = path.match(ORDINANCE_DETAIL_RE);
  if (ordinanceDetailMatch) {
    return councilDocumentDetailSeo("ordinance", safeDecodeURIComponent(ordinanceDetailMatch[1]), options);
  }

  const petitionDetailMatch = path.match(PETITION_DETAIL_RE);
  if (petitionDetailMatch) {
    return councilDocumentDetailSeo("petition", safeDecodeURIComponent(petitionDetailMatch[1]), options);
  }

  const requestDetailMatch = path.match(REQUEST_DETAIL_RE);
  if (requestDetailMatch) {
    return councilDocumentDetailSeo("request", safeDecodeURIComponent(requestDetailMatch[1]), options);
  }

  const personDetailMatch = path.match(PERSON_DETAIL_RE);
  if (personDetailMatch) return personDetailSeo(safeDecodeURIComponent(personDetailMatch[1]), options);

  return notFound(path, "ページが見つかりません");
}
