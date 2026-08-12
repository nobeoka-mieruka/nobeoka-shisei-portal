import { Link, useLocation } from "react-router-dom";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import archiveMemberProfilesData from "../data/archiveMemberProfiles.json";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import citySpecialPostsData from "../data/citySpecialPosts.json";
import archiveCouncilDocumentsData from "../data/archiveCouncilDocuments.json";
import billVotesData from "../data/billVotes.json";
import archivePoliciesData from "../data/archivePolicies.json";
import archiveFiscalYearsData from "../data/archiveFiscalYears.json";
import generalQuestionsData from "../data/generalQuestions.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import searchIndexData from "../data/searchIndex.json";
import committeesData from "../data/committees.json";
import committeeActivityReportsData from "../data/committeeActivityReports.json";
import politicalFundOrganizationsData from "../data/politicalFundOrganizations.json";
import politicalFundReportsData from "../data/politicalFundReports.json";
import kohoNobeokaIssuesData from "../data/kohoNobeokaIssues.json";
import electionResultsData from "../data/electionResults.json";
import { kohoOcrSearchIndex } from "../lib/kohoSearch";
import { similarMunicipalityFinance } from "../lib/similarMunicipalityFinance";
import type {
  CouncilMember,
  FormerMember,
  BillVoteItem,
  GeneralQuestionItem,
  CouncilSpeechSummaryData,
  CitySpecialPost,
  Committee,
  CommitteeActivityReport,
  PoliticalFundOrganization,
  PoliticalFundReport,
} from "../types";
import type { ArchiveMayor, ArchiveMayorTerm, ArchiveCouncilDocument, ArchivePolicy, ArchiveFiscalYear } from "../types/historicalArchive";
import type { ArchiveMemberProfile } from "../types/historicalArchive";
import type { KohoNobeokaIssue } from "../types/kohoNobeoka";
import type { ElectionResult } from "../types/election";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { LastUpdated } from "../components/LastUpdated";
import { SectionCard } from "../components/SectionCard";
import { ChartBarIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { allPublicSpeeches, questionLikeSpeeches } from "../lib/councilSpeeches";
import { calculateGeneralQuestionStats } from "../lib/generalQuestionStats";
import { blockedTaskStatusCounts } from "../lib/blockedTaskClassification";
import { documentTypeLabel } from "../lib/archiveCouncilDocuments";
import { simpleCompleteness, formatCoverageRate, type CompletenessMetric } from "../lib/completeness";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
// archiveMemberProfiles.jsonは現職・元議員の両方を収録する（Phase35で現職分を追加）。
// このページの「元議員（詳細プロフィール）」件数には元議員分のみを数える。
const archiveFormerMemberProfiles = (archiveMemberProfilesData as ArchiveMemberProfile[]).filter(
  (p) => !p.legacyMemberId,
);
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const citySpecialPosts = citySpecialPostsData as CitySpecialPost[];
const archiveCouncilDocuments = archiveCouncilDocumentsData as ArchiveCouncilDocument[];
const billVotes = billVotesData as BillVoteItem[];
const archivePolicies = archivePoliciesData as ArchivePolicy[];
const archiveFiscalYears = archiveFiscalYearsData as ArchiveFiscalYear[];
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const committees = committeesData as Committee[];
const committeeActivityReports = committeeActivityReportsData as CommitteeActivityReport[];
const politicalFundOrganizations = politicalFundOrganizationsData as PoliticalFundOrganization[];
const politicalFundReports = politicalFundReportsData as PoliticalFundReport[];
const kohoNobeokaIssues = kohoNobeokaIssuesData as KohoNobeokaIssue[];
const electionResults = electionResultsData as ElectionResult[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

interface DataDomain {
  label: string;
  count: number;
  unit: string;
  scope?: string;
  detail?: string;
  linkTo?: string;
  linkLabel?: string;
  fullyCovered?: boolean;
}

/**
 * 市民向けの一言ステータス（確認済み／一部収録／未収録）を、既存の集計値（count・
 * fullyCovered）だけから導く。新しい判定ロジックや推測は追加せず、既存フィールドの
 * 言い換え表示のみを行う。fullyCoveredが未設定（true/false判定に馴染まない分野）の
 * 場合はバッジを表示しない。
 */
function statusBadge(domain: DataDomain): { label: string; className: string } | null {
  if (domain.count === 0) {
    return { label: "未収録", className: "bg-surface-container-highest text-on-surface-variant" };
  }
  if (domain.fullyCovered === true) {
    return { label: "確認済み", className: "bg-primary-container text-on-primary-container" };
  }
  if (domain.fullyCovered === false) {
    return { label: "一部収録", className: "bg-secondary-container text-on-secondary-container" };
  }
  return null;
}

function DomainRow({ domain }: { domain: DataDomain }) {
  const badge = statusBadge(domain);
  return (
    <li className="rounded-lg border border-outline-variant p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-on-surface">
          {domain.label}
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
          )}
        </p>
        <p className="text-sm font-bold text-on-surface">
          {domain.count.toLocaleString()}
          <span className="ml-0.5 text-xs font-medium text-on-surface-variant">{domain.unit}</span>
        </p>
      </div>
      {domain.scope && <p className="mt-1 text-xs text-on-surface-variant">収録範囲：{domain.scope}</p>}
      {domain.detail && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-medium text-on-surface-variant hover:text-on-surface">
            詳しい内訳を見る
          </summary>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{domain.detail}</p>
        </details>
      )}
      {domain.linkTo && (
        <Link to={domain.linkTo} className={`mt-1.5 inline-block text-xs font-medium text-primary hover:underline ${linkClass}`}>
          {domain.linkLabel ?? "詳しく見る"} →
        </Link>
      )}
    </li>
  );
}

/**
 * 収録率を市民が一目で把握できるよう、パーセンテージだけでなく文字・記号も併用して表示する
 * （色だけに依存しない）。100%は「公式母数と照合して完全収録」の場合のみ表示される
 * （simpleCompleteness()が母数と一致した場合のみcompleteを返すため、推測で100%と
 * 表示することはない）。
 */
function coverageTier(metric: CompletenessMetric): { icon: string; label: string; className: string } {
  if (metric.coverageRate === null) {
    return { icon: "？", label: "母数未確認", className: "bg-surface-container-highest text-on-surface-variant" };
  }
  if (metric.status === "confirmed_zero") {
    return { icon: "✓", label: "確認済み0件", className: "bg-primary-container text-on-primary-container" };
  }
  if (metric.coverageRate >= 100) {
    return { icon: "✓", label: "完全収録", className: "bg-primary-container text-on-primary-container" };
  }
  if (metric.coverageRate >= 80) {
    return { icon: "△", label: "一部不足", className: "bg-secondary-container text-on-secondary-container" };
  }
  return { icon: "…", label: "収集中", className: "bg-tertiary-container text-on-tertiary-container" };
}

function CompletenessRow({ label, metric, note }: { label: string; metric: CompletenessMetric; note?: string }) {
  const tier = coverageTier(metric);
  return (
    <li className="rounded-lg border border-outline-variant p-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tier.className}`}>
          <span aria-hidden>{tier.icon}</span>
          {tier.label}
        </span>
      </div>
      <p className="mt-1 text-sm text-on-surface-variant">
        {metric.totalKnown === null ? (
          <>収録{metric.collected.toLocaleString()}件／収録率：{formatCoverageRate(metric)}</>
        ) : (
          <>
            収録{metric.collected.toLocaleString()}件／確認済み母数{metric.totalKnown.toLocaleString()}件／収録率：
            <span className="font-semibold text-on-surface">{formatCoverageRate(metric)}</span>
          </>
        )}
      </p>
      {note && <p className="mt-0.5 text-xs text-on-surface-variant">{note}</p>}
    </li>
  );
}

export function DataStatusPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const taskStatusCounts = blockedTaskStatusCounts();

  // --- 広報のべおかOCR・選挙アーカイブ（Phase68〜70で追加） ---
  const kohoTotalIssues = kohoNobeokaIssues.length;
  const kohoOcrCompletedIssues = kohoNobeokaIssues.filter((k) => k.ocrCompleted).length;
  const kohoOcrCompletedPages = kohoNobeokaIssues.reduce((sum, k) => sum + (k.ocrPageCount ?? 0), 0);
  const kohoDamagedIssues = kohoNobeokaIssues.filter((k) => k.sourceStatus?.code === "SOURCE_DAMAGED");
  const electionYears = electionResults.map((e) => Number(e.electionDate.slice(0, 4))).filter((y) => !Number.isNaN(y));
  const oldestElectionYear = electionYears.length > 0 ? Math.min(...electionYears) : null;
  const newestElectionYear = electionYears.length > 0 ? Math.max(...electionYears) : null;
  const electionPartialCount = electionResults.filter((e) => e.dataCompleteness?.candidateListConfirmed === false).length;
  const kohoSearchIndexCount = kohoOcrSearchIndex.length;
  const kohoSearchVerifiedCount = kohoOcrSearchIndex.filter((e) => e.verificationStatus === "verified").length;

  // --- 議員プロフィール収録率 ---
  const memberPhotoCount = members.filter((m) => !!m.photoUrl).length;
  const memberProfileCount = members.filter((m) => !!m.profile).length;
  const memberProfileUrlCount = members.filter((m) => !!m.profileUrl).length;
  const memberSnsCount = members.filter((m) => m.sns && m.sns.length > 0).length;
  const memberCommitteeCount = members.filter((m) => m.committees && m.committees.length > 0).length;
  const memberBillVoteMemberIds = new Set(billVotes.flatMap((b) => (b.memberVotes ?? []).map((v) => v.memberId)));
  const memberWithBillVoteCount = members.filter((m) => memberBillVoteMemberIds.has(m.id)).length;

  // --- 歴代市長 ---
  const electedMayorTerms = archiveMayorTerms.filter((t) => t.mayorRole !== "acting" && t.mayorRole !== "temporaryActing");
  const dayPreciseTerms = archiveMayorTerms.filter((t) => (t.termStartPrecision ?? "day") === "day");
  // src/data/archiveMayorTerms.json：validate-data.mjsの空白検出（2026-08-05時点）と一致させる手集計値。空白が解消され次第、更新すること。
  const mayorGapCount: number = 13;
  const mayorProfileConfirmed = archiveMayors.filter((m) => m.profile && m.profile.length > 0).length;

  // --- 議案・条例・請願・陳情（新アーカイブ層） ---
  const documentTypeCounts = (["bill", "ordinance", "petition", "request"] as const).map((t) => ({
    type: t,
    count: archiveCouncilDocuments.filter((d) => d.documentType === t).length,
  }));
  const resultConfirmedCount = archiveCouncilDocuments.filter((d) => !!d.result).length;
  const verifiedDocumentCount = archiveCouncilDocuments.filter((d) => d.verificationStatus === "verified").length;

  // --- 一般質問 ---
  // ページ間の件数不一致を防ぐため、トップページ・ダッシュボード・一般質問一覧と同じ
  // 共通集計関数（src/lib/generalQuestionStats.ts）を使う。
  const questionStats = calculateGeneralQuestionStats(speechSummaryData.members, generalQuestions);
  const confirmedQuestionMemberIds = new Set(
    questionLikeSpeeches(allPublicSpeeches(speechSummaryData.members)).map((s) => s.memberId),
  );
  const membersWithoutConfirmedQuestion = members.filter((m) => !confirmedQuestionMemberIds.has(m.id));

  // --- 財政 ---
  const fiscalYearsWithBudget = archiveFiscalYears.filter((f) => !!f.budget).length;
  const fiscalYearsWithPopulation = archiveFiscalYears.filter((f) => !!f.population).length;
  const fiscalYearsWithDebt = archiveFiscalYears.filter((f) => !!f.debt).length;
  const fiscalYearsWithFund = archiveFiscalYears.filter((f) => !!f.fund).length;
  const fiscalYearsWithFinance = archiveFiscalYears.filter((f) => !!f.finance).length;
  const fiscalYearRange =
    archiveFiscalYears.length > 0
      ? `${Math.min(...archiveFiscalYears.map((f) => f.fiscalYear))}年度〜${Math.max(...archiveFiscalYears.map((f) => f.fiscalYear))}年度`
      : "未登録";

  const people: DataDomain[] = [
    {
      label: "現職議員",
      count: members.length,
      unit: "名",
      scope: "現在の任期",
      detail: `顔写真：${memberPhotoCount}／${members.length}名／公式プロフィール：${memberProfileCount}／${members.length}名／公式サイト：${memberProfileUrlCount}／${members.length}名／SNS：${memberSnsCount}／${members.length}名／所属委員会登録：${memberCommitteeCount}／${members.length}名／一般質問（会議録確認済み）：${members.length - membersWithoutConfirmedQuestion.length}／${members.length}名／議案賛否（個人別）：${memberWithBillVoteCount}／${members.length}名`,
      linkTo: "/",
      linkLabel: "議員一覧を見る",
    },
    {
      label: "元議員（詳細プロフィール）",
      count: archiveFormerMemberProfiles.length,
      unit: "名",
      detail:
        formerMembers.length > archiveFormerMemberProfiles.length
          ? `簡易記録のみのformerMembers.json登録は${formerMembers.length}名。詳細プロフィール整備は開始段階です。`
          : undefined,
      linkTo: "/members/former",
      linkLabel: "元議員一覧を見る",
    },
    {
      label: "歴代市長",
      count: archiveMayors.length,
      unit: "名",
      scope: "1933年（市制施行）〜現在",
      detail: `任期${archiveMayorTerms.length}件（うち公選${electedMayorTerms.length}件・職務代理${archiveMayorTerms.length - electedMayorTerms.length}件）／日単位で確認済み${dayPreciseTerms.length}件／経歴記載あり${mayorProfileConfirmed}名／未確認の任期空白${mayorGapCount}件`,
      linkTo: "/mayors",
      linkLabel: "歴代市長一覧を見る",
      fullyCovered: mayorGapCount === 0,
    },
    {
      label: "副市長・教育長・行政委員会委員",
      count: citySpecialPosts.length,
      unit: "名",
      scope: "現職・直前の歴代（後任者が確認できた範囲）",
      detail:
        "副市長・教育長・監査委員・農業委員会委員に加え、選挙管理委員（4名）・補充員（4名）も本会議録で氏名を確認し掲載済みです。ただし選挙管理委員会の委員長は委員の互選で決まり、公開の本会議では確認できないため未掲載です。",
      linkTo: "/city-officials",
      linkLabel: "一覧を見る",
      fullyCovered: false,
    },
  ];

  const council: DataDomain[] = documentTypeCounts.map(({ type, count }) => ({
    label: documentTypeLabel(type),
    count,
    unit: "件",
    detail: `議決・審査結果確認済み：${archiveCouncilDocuments.filter((d) => d.documentType === type && d.result).length}件`,
    linkTo: `/${type === "bill" ? "bills" : type === "ordinance" ? "ordinances" : type === "petition" ? "petitions" : "requests"}`,
  }));

  const billVotesWithMemberVotes = billVotes.filter((b) => b.memberVotes && b.memberVotes.length > 0).length;
  const billVotesNotDisclosed = billVotes.filter((b) => b.individualVoteDisclosureStatus === "notDisclosed").length;
  const billVotesUnconfirmed = billVotes.length - billVotesWithMemberVotes - billVotesNotDisclosed;
  const billVotesVoteMethodKnown = billVotes.filter((b) => b.voteMethod).length;
  const billVotesCommitteeKnown = billVotes.filter((b) => b.committee).length;
  const billVotesProposerTypeKnown = billVotes.filter((b) => b.proposerType).length;
  const councilExtra: DataDomain = {
    label: "議案ごとの議決結果（既存機能）",
    count: billVotes.length,
    unit: "件",
    detail: `議決結果は${billVotes.length}件全てを登録済み。個人（議員ごと）の賛否内訳：公開あり${billVotesWithMemberVotes}件（記名投票等）／会議録で非公開と確認済み${billVotesNotDisclosed}件（起立採決等で個人名が記録されていないことを会議録で確認）／未確認${billVotesUnconfirmed}件（会議録を未確認）。品質項目の確認状況：提出者区分${billVotesProposerTypeKnown}／${billVotes.length}件・採決方法${billVotesVoteMethodKnown}／${billVotes.length}件・付託委員会${billVotesCommitteeKnown}／${billVotes.length}件（付託委員会が未確認の議案は、会期の会議録自体が延岡市議会「会議録検索システム」で未公開の会期に限られます。委員会付託を省略し本会議で直接議決された議案は「付託なし」として確認済みに含めています）。議案の詳細ページでは、提出から委員会審査・本会議採決までの流れを時系列で確認できます。上記の議案・条例・請願・陳情アーカイブとは別管理の既存データベースです。`,
    linkTo: "/bills/votes",
    linkLabel: "議案ごとの賛否を見る",
  };

  const committeesWithJurisdiction = committees.filter((c) => c.jurisdiction !== null).length;
  const councilCommittees: DataDomain = {
    label: "委員会（常任・議会運営・特別）",
    count: committees.length,
    unit: "件",
    scope: "現行の委員名簿（令和8年5月8日現在）",
    detail: `委員名簿・任期を登録済み。所管事項が確認できたもの：${committeesWithJurisdiction}／${committees.length}件（延岡市議会委員会条例の条文が未確認のため残りは「確認できず」と表示）。活動報告書（所管事務調査、令和5〜7年度）：${committeeActivityReports.length}件登録。`,
    linkTo: "/committees",
    linkLabel: "委員会一覧を見る",
    fullyCovered: committeesWithJurisdiction === committees.length,
  };

  const questions: DataDomain[] = [
    {
      label: "一般質問（会議録ベース・確認済み）",
      count: questionStats.confirmedCount,
      unit: "件",
      scope: "現任期（令和5年5月15日〜）＋旧任期（令和元年6月〜令和5年3月）",
      detail: `現任期の対象定例会${questionStats.targetSessionCount}会期中${questionStats.collectedSessionCount}会期を収録（旧任期分を含む件数は上記の${questionStats.confirmedCount}件）／確認済み質問がある現職議員：${members.length - membersWithoutConfirmedQuestion.length}／${members.length}名${membersWithoutConfirmedQuestion.length > 0 ? `（未確認：${membersWithoutConfirmedQuestion.map((m) => m.name).join("、")}）` : ""}`,
      linkTo: "/questions",
      linkLabel: "一般質問データベースを見る",
    },
    {
      label: "一般質問（質問通告書ベース・予定項目）",
      count: questionStats.scheduledCount,
      unit: "件",
      scope: questionStats.scheduledSessionName ?? "直近1会期",
      detail: "会議録公開前の暫定情報（質問通告書ベース）です。実際の質疑応答内容はまだ確認できていません。",
      linkTo: "/questions",
    },
  ];

  const policy: DataDomain[] = [
    {
      label: "政策・公約",
      count: archivePolicies.length,
      unit: "件",
      linkTo: "/policies",
    },
  ];

  // --- 政治資金 ---
  // 「完全確認」＝代表者・会計責任者・当該年分の収支報告書のいずれも確認済み。
  // 「一部確認」＝代表者・会計責任者等の一部メタデータのみ確認済み（収支金額は未確認）。
  // 「未確認」＝団体名・提出先以外、確認できた情報がない。
  const pfReportedOrgIds = new Set(politicalFundReports.map((r) => r.organizationId));
  const pfFullyConfirmed = politicalFundOrganizations.filter(
    (o) => o.representativeName && o.treasurerName && pfReportedOrgIds.has(o.id),
  ).length;
  const pfPartiallyConfirmed = politicalFundOrganizations.filter(
    (o) => (o.representativeName || o.treasurerName || pfReportedOrgIds.has(o.id)) && !(o.representativeName && o.treasurerName && pfReportedOrgIds.has(o.id)),
  ).length;
  const pfUnconfirmed = politicalFundOrganizations.length - pfFullyConfirmed - pfPartiallyConfirmed;
  const politicalFunds: DataDomain[] = [
    {
      label: "政治資金団体",
      count: politicalFundOrganizations.length,
      unit: "団体",
      scope: "宮崎県選挙管理委員会公表分（令和6年分収支報告書提出団体）",
      detail: `完全確認（代表者・会計責任者・当該年分収支のすべて確認済み）：${pfFullyConfirmed}団体／一部確認（団体名・提出先等の一部のみ）：${pfPartiallyConfirmed}団体／未確認：${pfUnconfirmed}団体。収支報告書PDFは画像スキャン形式のため、AI画像認識による読み取りを慎重に進めています（推測での金額登録はしていません）。`,
      linkTo: "/political-funds",
      linkLabel: "政治資金団体一覧を見る",
      fullyCovered: pfUnconfirmed === 0 && pfPartiallyConfirmed === 0,
    },
  ];

  const finance: DataDomain[] = [
    {
      label: "財政・人口・基金・市債（年度データ）",
      count: archiveFiscalYears.length,
      unit: "年度分",
      scope: fiscalYearRange,
      detail: `予算確認済み${fiscalYearsWithBudget}年度／人口確認済み${fiscalYearsWithPopulation}年度／市債確認済み${fiscalYearsWithDebt}年度／基金確認済み${fiscalYearsWithFund}年度／財政健全化判断比率確認済み${fiscalYearsWithFinance}年度`,
      linkTo: "/finance",
      linkLabel: "財政ページを見る",
    },
  ];

  const platform: DataDomain[] = [
    {
      label: "検索インデックス登録件数",
      count: searchIndexData.length,
      unit: "件",
      detail: "議員・元議員・市長・議案・条例・請願・陳情・政策・一般質問・財政データ等を横断的に検索対象としています。",
      linkTo: "/search",
      linkLabel: "サイト内検索を使う",
    },
    {
      label: "歴代市長の比較・年表",
      count: archiveMayors.length,
      unit: "名分が比較・年表で利用可能",
      linkTo: "/compare/mayors",
      linkLabel: "歴代市長を比較する",
    },
  ];

  // --- データ完全性ダッシュボード（Phase 17） ---
  // 「件数」と「収録率」を分離するため、母数（totalKnown）が一次資料から確認できている
  // 項目についてのみ収録率を算出する。新しい集計ロジックは追加せず、このページで既に
  // 計算済みの分子・分母（billVotesProposerTypeKnown等）をそのままsimpleCompleteness()へ渡す。
  const completenessRows: { label: string; metric: CompletenessMetric; note?: string }[] = [
    {
      label: "一般質問：現任期の対象定例会のうち会議録収録済み",
      metric: simpleCompleteness(questionStats.collectedSessionCount, questionStats.targetSessionCount),
      note: "母数は現議員任期の対象会期数（questionCollectionStatus.jsonで確認済み）",
    },
    {
      label: "議案：提出者区分の確認",
      metric: simpleCompleteness(billVotesProposerTypeKnown, billVotes.length),
    },
    {
      label: "議案：採決方法の確認",
      metric: simpleCompleteness(billVotesVoteMethodKnown, billVotes.length),
    },
    {
      label: "議案：付託委員会の確認",
      metric: simpleCompleteness(billVotesCommitteeKnown, billVotes.length),
      note: "未確認分は会議録未公開の会期のみ（委員会付託省略案件は「付託なし」として確認済みに計上）",
    },
    {
      label: "政治資金団体：代表者・会計責任者・当該年分収支の完全確認",
      metric: simpleCompleteness(pfFullyConfirmed, politicalFundOrganizations.length),
    },
    {
      label: "委員会：所管事項の確認",
      metric: simpleCompleteness(committeesWithJurisdiction, committees.length),
      note: "常任委員会3件と、設置時提案理由で目的が確認できた特別委員会1件は確認済み。議会運営委員会・他の特別委員会は、条例上、所管事項の個別列挙を持たない構造のため、この項目には該当しない",
    },
    {
      label: "財政：予算・決算（歳入歳出総額）の年度確認",
      metric: simpleCompleteness(fiscalYearsWithBudget, archiveFiscalYears.length),
    },
    {
      label: "財政：市債残高の年度確認",
      metric: simpleCompleteness(fiscalYearsWithDebt, archiveFiscalYears.length),
    },
    {
      label: "財政：基金残高の年度確認",
      metric: simpleCompleteness(fiscalYearsWithFund, archiveFiscalYears.length),
    },
    {
      label: "財政：財政健全化判断比率の年度確認",
      metric: simpleCompleteness(fiscalYearsWithFinance, archiveFiscalYears.length),
    },
    {
      label: "財政：人口の年度確認",
      metric: simpleCompleteness(fiscalYearsWithPopulation, archiveFiscalYears.length),
    },
    {
      label: "歴代市長：任期の日単位での確認",
      metric: simpleCompleteness(dayPreciseTerms.length, archiveMayorTerms.length),
      note: `未確認の任期空白：${mayorGapCount}件（主に戦前・戦時中の記録）`,
    },
    {
      label: "現職議員：公式プロフィール文の確認",
      metric: simpleCompleteness(memberProfileCount, members.length),
    },
    {
      label: "現職議員：公式サイトの確認",
      metric: simpleCompleteness(memberProfileUrlCount, members.length),
    },
  ];

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="h-6 w-6 shrink-0 text-on-primary-container" aria-hidden />
          <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">データ収録状況</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          当サイトが登録している各データの件数・収録範囲・確認状況を、既存データから自動集計して表示しています。件数は手入力ではなく、公開中のJSONデータから常に再計算しています。「登録済み」は「対象がすべて確認済み」を意味しません。分野ごとに、氏名・件名などの基本情報の収録状況と、経歴・政策・議決結果などの詳細項目の確認状況は別に扱っています。
        </p>
      </div>

      <SectionCard title="データ完全性ダッシュボード">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          「収録件数」だけでなく、一次資料で確認できた母数（対象会期数・議案件数・団体数など）に対する収録率を示します。母数が一次資料で確認できていない項目は「母数未確認」とし、100%と表示することはありません。
        </p>
        <ul className="space-y-2">
          {completenessRows.map((row) => (
            <CompletenessRow key={row.label} label={row.label} metric={row.metric} note={row.note} />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="人物">
        <ul className="space-y-2">
          {people.map((d) => (
            <DomainRow key={d.label} domain={d} />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="議会（議案・条例・請願・陳情）">
        <ul className="space-y-2">
          {council.map((d) => (
            <DomainRow key={d.label} domain={d} />
          ))}
          <DomainRow domain={councilExtra} />
          <DomainRow domain={councilCommittees} />
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          「議決・審査結果確認済み：{resultConfirmedCount}／{archiveCouncilDocuments.length}件」「出典確認済み（verified）：{verifiedDocumentCount}件」。議員個人の賛否記録は「議案ごとの議員別賛否（既存機能）」側で管理しており、混同していません。
        </p>
      </SectionCard>

      <SectionCard title="一般質問">
        <ul className="space-y-2">
          {questions.map((d) => (
            <DomainRow key={d.label} domain={d} />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="政策・財政・政治資金">
        <ul className="space-y-2">
          {[...policy, ...finance, ...politicalFunds].map((d) => (
            <DomainRow key={d.label} domain={d} />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="横断機能（検索・比較・年表）">
        <ul className="space-y-2">
          {platform.map((d) => (
            <DomainRow key={d.label} domain={d} />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="調査継続中の項目（未解決タスクの状況）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          「0件」と「まだ資料が公開されていない」を混同しないよう、当サイト運営上の未解決タスクを状況別に集計しています。市民向けデータの収録件数とは別の、編集作業の進行状況です。
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              ["WAITING_EXTERNAL", "公式資料の公開待ち"],
              ["MANUAL_REVIEW", "人手による追加調査が必要"],
              ["RESEARCH_EXHAUSTED", "調査を尽くしたが未確認（資料不存在の確定ではない）"],
              ["NOT_APPLICABLE", "対象外（サイト構成側の判断待ち等）"],
              ["BLOCKED_TECHNICAL", "技術的制約（OCR環境等）"],
              ["COMPLETED", "解決済み"],
            ] as [keyof ReturnType<typeof blockedTaskStatusCounts>, string][]
          ).map(([key, label]) => (
            <div key={key} className="rounded-lg bg-surface-container-low p-3">
              <dt className="text-xs text-on-surface-variant">{label}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-on-surface">{taskStatusCounts[key]}件</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title="広報のべおか・選挙アーカイブの調査状況">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          「広報のべおか」バックナンバー（PDF）は市の公式ホームページで確認できる範囲（2010年4月号〜最新号）を対象としています。文字を含む画像のため、そのままでは全文検索ができず、当サイトで少しずつ文字起こし（OCR）を進めています。
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">広報のべおか　対象号数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{kohoTotalIssues}号</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">うち文字起こし（OCR）着手済み</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{kohoOcrCompletedIssues}号</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">文字起こし済みページ数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{kohoOcrCompletedPages}ページ</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          文字起こし結果は下書き（未確認）の状態であり、元のPDF画像・PDF内蔵テキストと照合できたものだけを本番データ（財政・市政年表等の各ページ）へ反映しています。文字起こし対象の号数が増えたため、キーワード検索できる試験版画面（
          <Link to="/koho-search" className={`text-primary hover:underline ${linkClass}`}>
            広報のべおか文字起こし検索
          </Link>
          ）を公開していますが、検索結果の多くは未確認のOCR結果である点にご注意ください。
        </p>
        {kohoDamagedIssues.length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
            {kohoDamagedIssues.map((k) => `${k.issueYearMonth}号`).join("、")}
            について：{kohoDamagedIssues[0].sourceStatus?.note}
            （延岡市公式サイト・Webアーカイブ・国立国会図書館デジタルコレクション・宮崎県立図書館のオンライン蔵書検索など、オンラインで確認できる経路は確認しましたが、代替の資料は見つかりませんでした）。
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">文字起こし検索の対象件数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{kohoSearchIndexCount.toLocaleString("ja-JP")}件</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">うち元資料で確認済み</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{kohoSearchVerifiedCount}件</dd>
          </div>
        </dl>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">選挙結果の収録年代</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {oldestElectionYear != null && newestElectionYear != null ? `${oldestElectionYear}〜${newestElectionYear}年` : "確認中"}
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">うち候補者一覧が未確認の選挙</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{electionPartialCount}件</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          1999年より前の市長選挙は、就任年月までは市公式の年表で確認できていますが、候補者一覧・得票数・投票率は確認中です。市議会議員選挙は1999年より前の候補者別結果の一次資料を確認できておらず、未収録のままです（選挙自体が無かったという意味ではありません）。延岡市公式資料・選挙管理委員会資料・広報のべおかOCR・宮崎県資料・国立国会図書館等を確認しましたが、これ以上進める手がかりが得られておらず、上記「調査を尽くしたが未確認」の状態として扱っています。
        </p>
      </SectionCard>

      <SectionCard title="類似団体比較・市長公約の調査状況">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">類似団体（Ⅲ－３）</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{similarMunicipalityFinance.municipalities.length}自治体確認済み</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">市長公約</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">根拠資料調査中</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          類似団体（人口・産業構造が近い全国の自治体グループ）は、延岡市を含め59自治体を総務省公式資料から特定し、財政指標の比較データを掲載しています。市長公約は、公約本文と名称が完全一致する予算事業の候補は複数見つかっていますが、「確定（confirmed）」に必要な原本資料との照合がまだ済んでいないため、確定件数は0件のままです。0件は「根拠が無い」のではなく「照合作業が完了していない」という意味です。
        </p>
      </SectionCard>

      <p className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        「収録件数」は登録済みレコード数の事実集計であり、実際に存在するはずの全件数（分母）を当サイトが把握しているとは限りません。歴代市長の任期空白（{mayorGapCount}件）のように、収録済みの範囲内でも未確認の期間・項目があることを明示しています。0件と「未収録・未確認」は区別して表示しています。
      </p>

      <LastUpdated className="mt-4" dataAsOfLabel="この集計の対象データ確認日（最新値）" dataAsOf="2026年8月5日" />
    </div>
  );
}
