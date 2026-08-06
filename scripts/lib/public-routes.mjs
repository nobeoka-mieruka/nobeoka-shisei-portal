/**
 * サイトマップ・プリレンダリング・公開前チェックが対象とする実在URLの単一情報源。
 * ここで定義したURLだけが、ビルド時に静的HTMLとして生成され、サイトマップへ載る。
 *
 * - 存在しない詳細ID、下書き、リダイレクト専用URL（/bills）の索引対象化、
 *   検索結果ページ（/search）の索引対象化はしない。
 * - /bills, /search は「実在するが索引対象ではないページ」として、
 *   サイトマップには含めず、プリレンダリング対象には含める（直接アクセスで404にしないため）。
 * - lastmodは scripts/lib/lastmod.mjs の優先順位（データ内の日付→更新履歴→
 *   データファイルのGit更新日→サイト全体の最終更新日）に従って解決する。
 *   ビルドした日を無条件に設定することはしない。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { maxValidDate, resolveLastmod } from "./lastmod.mjs";
import { councilSpeechPeriod } from "./council-speech-period.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = join(__dirname, "..", "..");

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

/**
 * mayorPressConferences.tsはTypeScriptモジュールのため、このスクリプト（.mjs）からは
 * 直接importできない。ビルド専用のTSコンパイラ等を新たに追加せず、ソースの配列リテラル
 * 部分だけを抽出して安全に評価する。対象ファイルの書式が変わった場合は、抽出できた件数が
 * 0件になり警告を出すのみで、ビルド全体は止めない。
 */
function readMayorPressConferences() {
  const filePath = join(root, "src", "data", "mayorPressConferences.ts");
  let src;
  try {
    src = readFileSync(filePath, "utf8");
  } catch {
    console.warn(
      "[public-routes] src/data/mayorPressConferences.ts が読み込めませんでした。記者会見詳細ページは対象に含めません。",
    );
    return [];
  }

  const pdfBaseMatch = src.match(/const PDF_BASE\s*=\s*("(?:[^"\\]|\\.)*");/);
  const pdfBase = pdfBaseMatch ? JSON.parse(pdfBaseMatch[1]) : "";

  const arrayMatch = src.match(/export const mayorPressConferences:[^=]*=\s*(\[[\s\S]*?\n\]);/);
  if (!arrayMatch) {
    console.warn("[public-routes] mayorPressConferences配列を抽出できませんでした。記者会見詳細ページは対象に含めません。");
    return [];
  }

  try {
    // eslint-disable-next-line no-new-func
    const build = new Function("PDF_BASE", `"use strict"; return (${arrayMatch[1]});`);
    return build(pdfBase);
  } catch (err) {
    console.warn(`[public-routes] mayorPressConferencesの解析に失敗しました: ${err.message}`);
    return [];
  }
}

/** 実在する公開ページのみ。下書き・存在しないURL・検索結果（/search）は含めない。 */
export const STATIC_INDEXABLE_PAGES = [
  "/",
  "/mayor",
  "/mayor/policy-progress",
  "/mayor/entertainment-expenses",
  "/mayor/press-conferences",
  "/mayors",
  "/city-officials",
  "/policies",
  "/people",
  "/bills",
  "/ordinances",
  "/petitions",
  "/requests",
  "/members/former",
  "/members/history",
  "/finance",
  "/finance/budget",
  "/finance/debt",
  "/finance/funds",
  "/compare",
  "/timeline",
  "/dashboard",
  "/compensation",
  "/city-guide",
  "/bills/votes",
  "/council-documents",
  "/questions",
  "/themes",
  "/executive-answers",
  "/about",
  "/editorial-policy",
  "/contact",
  "/terms",
  "/updates",
  "/data-status",
  "/methodology/activity-radar",
  "/political-funds",
  "/committees",
  "/history",
];

/**
 * 実在し直接アクセス可能だが、索引対象（サイトマップ・robots index）には含めないページ。
 * /search … 入力内容によって表示が変わり続けるため常にnoindex。
 */
export const STATIC_NOINDEX_PAGES = [
  "/search",
  "/bills/compare",
  "/compare/mayors",
  "/compare/members",
  "/compare/policies",
  "/compare/finance",
  "/compare/population",
  "/compare/budget",
  "/compare/debt",
  "/compare/funds",
];

function loadData() {
  const members = readJson("src/data/members.json");
  const formerMembers = readJson("src/data/formerMembers.json");
  // rejected・error（誤抽出として却下、または抽出エラー）のみサイトマップ・プリレンダリング対象から除く。
  // pendingReview等（確認待ち）は「確認待ち」表示を伴って一般公開するため対象に含める。
  const billVotes = readJson("src/data/billVotes.json").filter(
    (b) => b.publicationStatus !== "rejected" && b.publicationStatus !== "error",
  );
  const councilSessions = readJson("src/data/councilSessions.json");
  const mayorPromises = readJson("src/data/mayorPromises.json");
  const generalQuestions = readJson("src/data/generalQuestions.json");
  const mayorPressConferences = readMayorPressConferences();
  const mayor = readJson("src/data/mayor.json");
  const financeDashboard = readJson("src/data/financeDashboard.json");
  const mayorEntertainmentExpenses = readJson("src/data/mayorEntertainmentExpenses.json");
  const compensationComparison = readJson("src/data/compensationComparison.json");
  const cityGuideEntries = readJson("src/data/cityGuideEntries.json");
  const mayorPolicyProgress = readJson("src/data/mayorPolicyProgress.json");
  const updateHistory = readJson("src/data/updateHistory.json");
  const councilSpeechSummaries = readJson("src/data/councilSpeechSummaries.json");
  const themes = readJson("src/data/themes.json");
  const archiveMayors = readJson("src/data/archiveMayors.json");
  const archiveMayorTerms = readJson("src/data/archiveMayorTerms.json");
  const archiveFiscalYears = readJson("src/data/archiveFiscalYears.json");
  const archiveMemberProfiles = readJson("src/data/archiveMemberProfiles.json");
  const archivePolicies = readJson("src/data/archivePolicies.json");
  const archiveCouncilDocuments = readJson("src/data/archiveCouncilDocuments.json");
  const politicalFundOrganizations = readJson("src/data/politicalFundOrganizations.json");
  const politicalFundReports = readJson("src/data/politicalFundReports.json");
  const citySpecialPosts = readJson("src/data/citySpecialPosts.json");
  const committees = readJson("src/data/committees.json");
  const committeeActivityReports = readJson("src/data/committeeActivityReports.json");
  const civicTimelineEvents = readJson("src/data/civicTimelineEvents.json");
  return {
    members,
    formerMembers,
    billVotes,
    councilSessions,
    mayorPromises,
    generalQuestions,
    mayorPressConferences,
    mayor,
    financeDashboard,
    mayorEntertainmentExpenses,
    compensationComparison,
    cityGuideEntries,
    mayorPolicyProgress,
    updateHistory,
    councilSpeechSummaries,
    themes,
    archiveMayors,
    archiveMayorTerms,
    archiveFiscalYears,
    archiveMemberProfiles,
    archivePolicies,
    archiveCouncilDocuments,
    politicalFundOrganizations,
    politicalFundReports,
    citySpecialPosts,
    committees,
    committeeActivityReports,
    civicTimelineEvents,
  };
}

/**
 * src/lib/archiveTimeline.ts の fiscalYearOfIsoDate と同じ定義（会計年度は4月始まり）。
 * このスクリプト（.mjs）からはビルド前のsrc/配下TypeScriptを直接importできないためミラー実装する。
 */
function fiscalYearOfIsoDate(iso) {
  const [year, month] = iso.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

/** archiveFiscalYears.json内の全sourceRefsから、確認可能な日付だけを平坦化して集める。 */
function archiveFiscalYearDates(archiveFiscalYears) {
  return archiveFiscalYears.flatMap((y) => [
    y.verifiedAt,
    ...(y.population?.sourceRefs?.map((r) => r.sourcePublishedDate) ?? []),
    ...(y.budget?.sourceRefs?.map((r) => r.sourcePublishedDate) ?? []),
    ...(y.debt?.balance?.sourceRefs?.map((r) => r.sourcePublishedDate) ?? []),
    ...(y.fund?.balance?.sourceRefs?.map((r) => r.sourcePublishedDate) ?? []),
    ...(y.finance?.sourceRefs?.map((r) => r.sourcePublishedDate) ?? []),
  ]);
}

/**
 * 公開済み（isPublished: true）かつ収録対象期間（src/config/councilSpeechPeriod.json）内の
 * 一般質問・質疑要約のみを{memberId, speech}の形で返す。期間より前のデータは、万一登録されて
 * いても（validate-data.mjsが本来エラーにするが、念のための多重防御として）サイトマップ・
 * プリレンダリング対象から除外する。ただしisFormerMember:true（旧任期のみ在職した元議員、
 * TASK-005系）のレコードは、この現任期カットオフの対象外とする。
 */
function publishedSpeeches(councilSpeechSummaries) {
  return councilSpeechSummaries.members.flatMap((m) =>
    m.speeches
      .filter((s) => s.isPublished && s.date && (m.isFormerMember || s.term === "previous" || s.date >= councilSpeechPeriod.from))
      .map((s) => ({ memberId: m.memberId, speech: s })),
  );
}

/** 固定ページごとのlastmod解決ルール。 */
function staticPageLastmod(path, data) {
  switch (path) {
    case "/":
      return resolveLastmod(path, [], [
        "src/data/members.json",
        "src/data/mayor.json",
        "src/data/billVotes.json",
        "src/data/generalQuestions.json",
        "src/data/mayorPromises.json",
      ]);
    case "/mayor":
      return resolveLastmod(path, [data.mayor.verifiedAt, data.mayor.updatedAt], ["src/data/mayor.json"]);
    case "/mayor/policy-progress":
      return resolveLastmod(
        path,
        [data.mayorPolicyProgress.referenceDate, maxValidDate((data.mayorPromises.promises ?? []).map((p) => p.lastVerified))],
        ["src/data/mayorPolicyProgress.json", "src/data/mayorPromises.json"],
      );
    case "/mayor/entertainment-expenses":
      return resolveLastmod(path, [data.mayorEntertainmentExpenses.lastVerified], ["src/data/mayorEntertainmentExpenses.json"]);
    case "/mayor/press-conferences":
      return resolveLastmod(
        path,
        [maxValidDate(data.mayorPressConferences.map((c) => c.verifiedAt))],
        ["src/data/mayorPressConferences.ts"],
      );
    case "/mayors":
      return resolveLastmod(
        path,
        [maxValidDate(data.archiveMayors.flatMap((m) => [m.lastVerifiedAt, ...m.sourceRefs.map((r) => r.sourcePublishedDate)]))],
        ["src/data/archiveMayors.json", "src/data/archiveMayorTerms.json"],
      );
    case "/city-officials":
      return resolveLastmod(
        path,
        [maxValidDate(data.citySpecialPosts.map((p) => p.lastVerifiedAt))],
        ["src/data/citySpecialPosts.json"],
      );
    case "/policies":
      return resolveLastmod(
        path,
        [
          maxValidDate(
            data.archivePolicies.flatMap((p) => [p.lastVerifiedAt, ...p.sourceRefs.map((r) => r.sourcePublishedDate)]),
          ),
        ],
        ["src/data/archivePolicies.json", "src/data/archivePolicyCategories.json"],
      );
    case "/bills":
    case "/ordinances":
    case "/petitions":
    case "/requests": {
      const typeByPath = { "/bills": "bill", "/ordinances": "ordinance", "/petitions": "petition", "/requests": "request" };
      const docs = data.archiveCouncilDocuments.filter((d) => d.documentType === typeByPath[path]);
      return resolveLastmod(
        path,
        [maxValidDate(docs.flatMap((d) => [d.decisionDate, ...d.sourceRefs.map((r) => r.sourcePublishedDate)]))],
        ["src/data/archiveCouncilDocuments.json"],
      );
    }
    case "/people":
      return resolveLastmod(
        path,
        [],
        ["src/data/members.json", "src/data/formerMembers.json", "src/data/archiveMayors.json", "src/data/archivePolicies.json", "src/data/archiveCouncilDocuments.json"],
      );
    case "/members/former":
      return resolveLastmod(
        path,
        [
          maxValidDate(
            data.archiveMemberProfiles.flatMap((p) => [p.lastVerifiedAt, ...p.sourceRefs.map((r) => r.sourcePublishedDate)]),
          ),
        ],
        ["src/data/archiveMemberProfiles.json", "src/data/archiveMemberTerms.json", "src/data/archiveMemberAffiliations.json"],
      );
    case "/members/history":
      return resolveLastmod(
        path,
        [],
        ["src/data/archiveMemberProfiles.json", "src/data/archiveMemberTerms.json", "src/data/formerMembers.json"],
      );
    case "/finance":
      return resolveLastmod(path, [data.financeDashboard.lastVerified], ["src/data/financeDashboard.json"]);
    case "/finance/budget":
    case "/finance/debt":
    case "/finance/funds":
      return resolveLastmod(
        path,
        [maxValidDate(archiveFiscalYearDates(data.archiveFiscalYears))],
        ["src/data/archiveFiscalYears.json"],
      );
    case "/compare":
      return resolveLastmod(
        path,
        [maxValidDate(archiveFiscalYearDates(data.archiveFiscalYears))],
        ["src/data/archiveMayors.json", "src/data/archiveMayorTerms.json", "src/data/archiveFiscalYears.json"],
      );
    case "/timeline":
      return resolveLastmod(
        path,
        [maxValidDate(archiveFiscalYearDates(data.archiveFiscalYears))],
        ["src/data/archiveMayors.json", "src/data/archiveMayorTerms.json", "src/data/archiveFiscalYears.json"],
      );
    case "/dashboard":
      return resolveLastmod(path, [], ["src/data/members.json", "src/data/billVotes.json", "src/data/mayorPromises.json"]);
    case "/compensation":
      return resolveLastmod(
        path,
        [maxValidDate(data.compensationComparison.map((c) => c.confirmedAt))],
        ["src/data/compensationComparison.json"],
      );
    case "/city-guide":
      return resolveLastmod(
        path,
        [maxValidDate(data.cityGuideEntries.map((e) => e.lastChecked))],
        ["src/data/cityGuideEntries.json"],
      );
    case "/bills/votes":
      return resolveLastmod(path, [maxValidDate(data.billVotes.map((b) => b.lastVerified))], ["src/data/billVotes.json"]);
    case "/council-documents":
      return resolveLastmod(
        path,
        [maxValidDate(data.councilSessions.map((s) => s.lastVerified))],
        ["src/data/councilSessions.json"],
      );
    case "/questions":
      return resolveLastmod(
        path,
        [maxValidDate(data.generalQuestions.map((q) => q.lastVerified))],
        ["src/data/generalQuestions.json"],
      );
    case "/themes":
    case "/executive-answers":
      return resolveLastmod(
        path,
        [maxValidDate(publishedSpeeches(data.councilSpeechSummaries).map(({ speech }) => speech.verifiedAt ?? speech.date))],
        ["src/data/councilSpeechSummaries.json", "src/data/themes.json"],
      );
    case "/about":
      return resolveLastmod(path, [], ["src/pages/AboutPage.tsx", "src/config/operator.ts"]);
    case "/editorial-policy":
      return resolveLastmod(path, [], ["src/pages/EditorialPolicyPage.tsx"]);
    case "/contact":
      return resolveLastmod(path, [], ["src/pages/ContactPage.tsx"]);
    case "/terms":
      return resolveLastmod(path, [], ["src/pages/TermsPage.tsx"]);
    case "/updates":
      return resolveLastmod(path, [maxValidDate(data.updateHistory.map((u) => u.date))], ["src/data/updateHistory.json"]);
    case "/data-status":
      return resolveLastmod(
        path,
        [],
        [
          "src/data/members.json",
          "src/data/formerMembers.json",
          "src/data/archiveMemberProfiles.json",
          "src/data/archiveMayors.json",
          "src/data/archiveMayorTerms.json",
          "src/data/archiveCouncilDocuments.json",
          "src/data/billVotes.json",
          "src/data/archivePolicies.json",
          "src/data/archiveFiscalYears.json",
          "src/data/generalQuestions.json",
          "src/data/councilSpeechSummaries.json",
          "src/data/questionCollectionStatus.json",
          "src/data/searchIndex.json",
        ],
      );
    case "/methodology/activity-radar":
      return resolveLastmod(path, [], ["src/lib/activityRadar.ts", "src/pages/MethodologyActivityRadarPage.tsx"]);
    case "/political-funds":
      return resolveLastmod(
        path,
        [maxValidDate(data.politicalFundOrganizations.map((o) => o.verifiedAt))],
        ["src/data/politicalFundOrganizations.json", "src/data/politicalFundReports.json"],
      );
    case "/committees":
      return resolveLastmod(
        path,
        [maxValidDate(data.committees.map((c) => c.lastVerifiedAt))],
        ["src/data/committees.json"],
      );
    case "/history":
      return resolveLastmod(
        path,
        [maxValidDate(data.civicTimelineEvents.map((e) => e.lastVerifiedAt))],
        ["src/data/civicTimelineEvents.json"],
      );
    default:
      return undefined;
  }
}

/** サイトマップに載せる索引対象URL（{path, lastmod}[]）。 */
export function getIndexableRoutes() {
  const data = loadData();
  const { members, billVotes, councilSessions, mayorPromises, generalQuestions, mayorPressConferences, councilSpeechSummaries } = data;
  const urls = [];

  for (const path of STATIC_INDEXABLE_PAGES) {
    urls.push({ path, lastmod: staticPageLastmod(path, data) });
  }
  for (const m of members) {
    urls.push({ path: `/members/${m.id}`, lastmod: resolveLastmod(`/members/${m.id}`, [m.updatedAt, m.verifiedAt], ["src/data/members.json"]) });
  }
  for (const b of billVotes) {
    urls.push({ path: `/bills/votes/${b.id}`, lastmod: resolveLastmod(`/bills/votes/${b.id}`, [b.lastVerified], ["src/data/billVotes.json"]) });
  }
  for (const s of councilSessions) {
    urls.push({
      path: `/council-documents/${s.id}`,
      lastmod: resolveLastmod(`/council-documents/${s.id}`, [s.lastVerified], ["src/data/councilSessions.json"]),
    });
  }
  for (const p of mayorPromises.promises ?? []) {
    urls.push({
      path: `/mayor/policy-progress/${p.id}`,
      lastmod: resolveLastmod(`/mayor/policy-progress/${p.id}`, [p.lastVerified], ["src/data/mayorPromises.json"]),
    });
  }
  for (const q of generalQuestions) {
    urls.push({
      path: `/questions/${q.id}`,
      lastmod: resolveLastmod(`/questions/${q.id}`, [q.lastVerified, q.questionDate], ["src/data/generalQuestions.json"]),
    });
  }
  for (const c of mayorPressConferences) {
    urls.push({
      path: `/mayor/press-conferences/${c.date}`,
      lastmod: resolveLastmod(`/mayor/press-conferences/${c.date}`, [c.verifiedAt, c.date], ["src/data/mayorPressConferences.ts"]),
    });
  }
  for (const o of data.politicalFundOrganizations) {
    const path = `/political-funds/${o.id}`;
    const reports = data.politicalFundReports.filter((r) => r.organizationId === o.id);
    urls.push({
      path,
      lastmod: resolveLastmod(
        path,
        [o.verifiedAt, maxValidDate(reports.map((r) => r.verifiedAt))],
        ["src/data/politicalFundOrganizations.json", "src/data/politicalFundReports.json"],
      ),
    });
  }
  for (const c of data.committees) {
    const path = `/committees/${c.id}`;
    const reports = data.committeeActivityReports.filter((r) => r.committeeId === c.id);
    urls.push({
      path,
      lastmod: resolveLastmod(
        path,
        [c.lastVerifiedAt, maxValidDate(reports.map((r) => r.lastVerifiedAt))],
        ["src/data/committees.json", "src/data/committeeActivityReports.json"],
      ),
    });
  }
  for (const { memberId, speech } of publishedSpeeches(councilSpeechSummaries)) {
    const path = `/members/${memberId}/questions/${speech.id}`;
    urls.push({ path, lastmod: resolveLastmod(path, [speech.verifiedAt, speech.date], ["src/data/councilSpeechSummaries.json"]) });
  }
  for (const m of data.archiveMayors) {
    const path = `/mayors/${m.slug}`;
    urls.push({
      path,
      lastmod: resolveLastmod(
        path,
        [m.lastVerifiedAt, maxValidDate(m.sourceRefs.map((r) => r.sourcePublishedDate))],
        ["src/data/archiveMayors.json", "src/data/archiveMayorTerms.json"],
      ),
    });
  }
  for (const p of data.archiveMemberProfiles) {
    const path = `/members/former/${p.slug}`;
    urls.push({
      path,
      lastmod: resolveLastmod(
        path,
        [p.lastVerifiedAt, maxValidDate(p.sourceRefs.map((r) => r.sourcePublishedDate))],
        ["src/data/archiveMemberProfiles.json", "src/data/archiveMemberTerms.json", "src/data/archiveMemberAffiliations.json"],
      ),
    });
  }
  for (const p of data.archivePolicies) {
    const path = `/policies/${p.slug}`;
    urls.push({
      path,
      lastmod: resolveLastmod(
        path,
        [p.lastVerifiedAt, maxValidDate(p.sourceRefs.map((r) => r.sourcePublishedDate))],
        ["src/data/archivePolicies.json"],
      ),
    });
  }
  for (const m of data.members) {
    const path = `/people/member-${m.id}`;
    urls.push({ path, lastmod: resolveLastmod(path, [m.updatedAt, m.verifiedAt], ["src/data/members.json"]) });
  }
  for (const fm of data.formerMembers) {
    const path = `/people/former-member-${fm.id}`;
    urls.push({ path, lastmod: resolveLastmod(path, [fm.lastVerified], ["src/data/formerMembers.json"]) });
  }
  for (const m of data.archiveMayors) {
    const path = `/people/mayor-${m.id}`;
    urls.push({
      path,
      lastmod: resolveLastmod(
        path,
        [m.lastVerifiedAt, maxValidDate(m.sourceRefs.map((r) => r.sourcePublishedDate))],
        ["src/data/archiveMayors.json"],
      ),
    });
  }
  const COUNCIL_DOCUMENT_BASE_PATHS = { bill: "/bills", ordinance: "/ordinances", petition: "/petitions", request: "/requests" };
  for (const d of data.archiveCouncilDocuments) {
    const path = `${COUNCIL_DOCUMENT_BASE_PATHS[d.documentType]}/${d.slug}`;
    urls.push({
      path,
      lastmod: resolveLastmod(
        path,
        [d.decisionDate, maxValidDate(d.sourceRefs.map((r) => r.sourcePublishedDate))],
        ["src/data/archiveCouncilDocuments.json"],
      ),
    });
  }
  for (const t of data.themes) {
    const path = `/themes/${t.slug}`;
    urls.push({
      path,
      lastmod: resolveLastmod(
        path,
        [maxValidDate(publishedSpeeches(councilSpeechSummaries).map(({ speech }) => speech.verifiedAt ?? speech.date))],
        ["src/data/councilSpeechSummaries.json", "src/data/themes.json"],
      ),
    });
  }
  for (const y of data.archiveFiscalYears) {
    const path = `/timeline/${y.fiscalYear}`;
    const overlappingMayorTermDates = data.archiveMayorTerms
      .filter((t) => t.termStart <= `${y.fiscalYear + 1}-03-31` && (t.termEnd === null || t.termEnd >= `${y.fiscalYear}-04-01`))
      .flatMap((t) => t.sourceRefs.map((r) => r.sourcePublishedDate));
    urls.push({
      path,
      lastmod: resolveLastmod(
        path,
        [...archiveFiscalYearDates([y]), ...overlappingMayorTermDates],
        ["src/data/archiveFiscalYears.json", "src/data/archiveMayorTerms.json", "src/data/generalQuestions.json", "src/data/archiveCouncilDocuments.json", "src/data/archivePolicies.json"],
      ),
    });
  }
  // archiveFiscalYears.jsonに存在しない年度でも、archiveMayorTerms.jsonの任期開始・終了が
  // その年度にかかる場合はページを生成する（TimelineYearPage.tsxは財政データが無い年度でも
  // 市長任期のみで表示できる設計のため）。生成しないと、/timeline・市長詳細ページの
  // 「年表で見る」リンクが実在しないURLを指してしまう（プリレンダリング対象外＝本番404）。
  const financeCoveredFiscalYears = new Set(data.archiveFiscalYears.map((y) => y.fiscalYear));
  const mayorTermFiscalYears = new Set();
  for (const t of data.archiveMayorTerms) {
    mayorTermFiscalYears.add(fiscalYearOfIsoDate(t.termStart));
    if (t.termEnd) mayorTermFiscalYears.add(fiscalYearOfIsoDate(t.termEnd));
  }
  for (const fiscalYear of mayorTermFiscalYears) {
    if (financeCoveredFiscalYears.has(fiscalYear)) continue;
    const path = `/timeline/${fiscalYear}`;
    const overlappingMayorTermDates = data.archiveMayorTerms
      .filter((t) => t.termStart <= `${fiscalYear + 1}-03-31` && (t.termEnd === null || t.termEnd >= `${fiscalYear}-04-01`))
      .flatMap((t) => t.sourceRefs.map((r) => r.sourcePublishedDate));
    urls.push({
      path,
      lastmod: resolveLastmod(path, overlappingMayorTermDates, ["src/data/archiveMayorTerms.json"]),
    });
  }
  // 旧任期一般質問アーカイブ（councilSpeechSummaries.json、term:"previous"またはisFormerMember:trueの発言）が
  // カバーする会計年度も、財政データ・市長任期のいずれにも該当しない場合はページを生成する。
  // 元議員詳細ページ（MemberFormerDetailPage.tsx）の「年表で見る」リンクが、発言日から算出した年度を
  // 指すため、その年度のページが実在しないとプリレンダリング対象外＝本番404になる。
  const speechCoveredFiscalYears = new Set();
  for (const member of data.councilSpeechSummaries.members ?? []) {
    for (const speech of member.speeches ?? []) {
      if (!speech.date) continue;
      if (speech.term === "previous" || member.isFormerMember) {
        speechCoveredFiscalYears.add(fiscalYearOfIsoDate(speech.date));
      }
    }
  }
  for (const fiscalYear of speechCoveredFiscalYears) {
    if (financeCoveredFiscalYears.has(fiscalYear) || mayorTermFiscalYears.has(fiscalYear)) continue;
    const path = `/timeline/${fiscalYear}`;
    urls.push({
      path,
      lastmod: resolveLastmod(path, [], ["src/data/councilSpeechSummaries.json"]),
    });
  }

  const dedupedByPath = new Map();
  for (const u of urls) {
    if (!dedupedByPath.has(u.path)) dedupedByPath.set(u.path, u);
  }
  return [...dedupedByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * プリレンダリング対象URL（索引対象URL ＋ 実在するがnoindexのページ）。
 * これらすべてに対して静的HTMLを生成し、直接アクセスが404にならないようにする。
 */
export function getPrerenderRoutes() {
  const indexable = getIndexableRoutes();
  const noindex = STATIC_NOINDEX_PAGES.map((path) => ({ path }));
  // MemberDetailPage.tsx（/members/:id）は、現職議員に一致しない場合formerMembers.jsonへ
  // フォールバックして元議員の簡易ビューを表示する設計のため、そのURLもプリレンダリング対象へ含める
  // （404を防ぐため。議員別賛否（BillVoteMemberEntry.memberId）が元議員IDを参照する場合の
  // リンク先として使われる）。ただし元議員の正規URLは/members/former/:slugであり、重複コンテンツを
  // 避けるためサイトマップ・索引対象（getIndexableRoutes）には含めず、noindexとして生成のみ行う。
  const data = loadData();
  const formerMemberFallback = data.formerMembers.map((fm) => ({ path: `/members/${fm.id}` }));
  return [...indexable, ...noindex, ...formerMemberFallback].sort((a, b) => a.path.localeCompare(b.path));
}

/** 公開前チェック（release-check）が確認すべきURL一覧。プリレンダリング対象と同じ。 */
export function getReleaseCheckRoutes() {
  return getPrerenderRoutes();
}
