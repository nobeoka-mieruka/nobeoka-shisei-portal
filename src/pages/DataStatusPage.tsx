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
// Phase193：ここで使うのは登録件数だけのため、約2.9MBのsearchIndex.json本体ではなく、
// 同時に生成される件数のみのメタデータを読み込む（件数はsearchIndex.jsonと常に一致する）。
import searchIndexMetaData from "../data/searchIndexMeta.json";
import committeesData from "../data/committees.json";
import committeeActivityReportsData from "../data/committeeActivityReports.json";
import politicalFundOrganizationsData from "../data/politicalFundOrganizations.json";
import politicalFundReportsData from "../data/politicalFundReports.json";
import kohoNobeokaIssuesData from "../data/kohoNobeokaIssues.json";
import electionResultsData from "../data/electionResults.json";
import { kohoOcrSearchIndex } from "../lib/kohoSearch";
import { similarMunicipalityFinance } from "../lib/similarMunicipalityFinance";
import { getAllCurrentMemberActivity, getEvidenceAvailabilitySummary, metricByKey } from "../lib/councilActivityBarometer";
import { summarizeVoteClassification, countBillsWithKnownProposerType } from "../lib/billVotes";
import { getBillExplanationLevel } from "../lib/billSummaryQuality";
import { getAllFormerMembers } from "../lib/formerMemberActivity";
import { getPeopleDataStatus } from "../lib/people";
import committeeReportActivityData from "../data/committeeReportActivity.json";
import archiveCouncilLeadershipData from "../data/archiveCouncilLeadership.json";
import archiveCommitteeMembersData from "../data/archiveCommitteeMembers.json";
import councilSessionsData from "../data/councilSessions.json";
import { sessionSummaryStatusLabels } from "../lib/councilSessions";
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
import type {
  ArchiveMayor,
  ArchiveMayorTerm,
  ArchiveCouncilDocument,
  ArchivePolicy,
  ArchiveFiscalYear,
  ArchiveCouncilLeadershipTerm,
} from "../types/historicalArchive";
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
import { isDayPreciseTerm } from "../lib/archiveMayors";
import {
  hasBudgetData,
  hasPopulationData,
  hasDebtData,
  hasFundData,
  hasFinanceRatioData,
  hasInitialBudgetAmount,
  hasOrdinaryAccountBondBalance,
  hasGeneralAccountBondBalance,
  hasAnyFundBalance,
  hasAnyFinanceRatio,
  hasGeneralAccountSettlement,
  hasFinalBudgetAmount,
  hasSpecialAccountBudget,
  hasBondBalanceIncludingEnterprise,
  hasBondBalancePerCapita,
  hasAnyRevenueBreakdown,
  fiscalYearGapNote,
} from "../lib/archiveFinance";
import {
  simpleCompleteness,
  formatCoverageRate,
  COMPLETENESS_STATUS_LABELS,
  type CompletenessMetric,
  type CompletenessStatus,
} from "../lib/completeness";
import dataQualitySummaryData from "../data/dataQualitySummary.json";
import {
  FORMER_MEMBER_DATA_TIER_LABELS,
  FORMER_MEMBER_DATA_TIER_DESCRIPTIONS,
  FORMER_MEMBER_DATA_TIER_DISCLAIMER,
} from "../lib/formerMemberActivity";

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

// TASK-080：scripts/generate-quality-summary.mjsが生成するsrc/data/dataQualitySummary.jsonの
// 形（出典検証・外部リンク到達性・件数不整合チェックの集計値。ビルド時に既存の
// validate:sources／reports/external-link-check.jsonから再集計、新しい検証ロジックの追加なし）。
interface DataQualitySummary {
  generatedAt: string;
  sourceHealth: { errors: number | null; warnings: number | null; info: number | null; note: string };
  linkHealth: {
    generatedAt: string;
    totalChecked: number;
    ok: number;
    redirect: number;
    notFound404: number;
    serverError: number;
    broken: { url: string; files: string[]; category: string; status: number | null }[];
    excludedBackupOnlyReferences: number;
    note: string;
  } | null;
  countConsistencyChecks: { label: string; status: string; note: string }[];
}
const dataQualitySummary = dataQualitySummaryData as DataQualitySummary;

interface DataDomain {
  label: string;
  count: number;
  unit: string;
  scope?: string;
  detail?: string;
  linkTo?: string;
  linkLabel?: string;
  fullyCovered?: boolean;
  /**
   * TASK-080：count===0の場合に何を意味するかを明示する（confirmed_zero＝確認済み0件／
   * not_collected＝未収録／under_review＝調査中／not_available＝資料なし等）。
   * 省略時は従来どおり「未収録」として扱うが、0件が「調査済みでゼロと確認済み」なのか
   * 「まだ収集していないだけ」なのかを区別できる場合は必ず指定すること
   * （「0件だけの表示」を残さない方針、ユーザー指示Phase 2相当）。
   */
  zeroStatus?: CompletenessStatus;
}

/**
 * 市民向けの一言ステータスを、src/lib/completeness.tsのCompletenessStatus語彙（既存の
 * 「完全収録／一部収録／確認済み0件／未収録／一次資料未公開／母数未確認／調査中」7区分）で
 * 統一して表示する。新しい判定ロジックや推測は追加せず、既存フィールド（count・
 * fullyCovered・zeroStatus）の言い換え表示のみを行う。
 */
const STATUS_BADGE_STYLE: Record<CompletenessStatus, { icon: string; className: string }> = {
  complete: { icon: "✓", className: "bg-primary-container text-on-primary-container" },
  confirmed_zero: { icon: "✓", className: "bg-primary-container text-on-primary-container" },
  partial: { icon: "△", className: "bg-secondary-container text-on-secondary-container" },
  under_review: { icon: "…", className: "bg-tertiary-container text-on-tertiary-container" },
  not_collected: { icon: "－", className: "bg-surface-container-highest text-on-surface-variant" },
  not_available: { icon: "×", className: "bg-surface-container-highest text-on-surface-variant" },
  unknown: { icon: "？", className: "bg-surface-container-highest text-on-surface-variant" },
};

function badgeFromStatus(status: CompletenessStatus): { label: string; icon: string; className: string } {
  const style = STATUS_BADGE_STYLE[status];
  return { label: COMPLETENESS_STATUS_LABELS[status], icon: style.icon, className: style.className };
}

function statusBadge(domain: DataDomain): { label: string; icon: string; className: string } | null {
  if (domain.count === 0) {
    // zeroStatus未指定の項目は、確認できた事実がまだ「未収録」だけであることを示す
    // 従来の既定値を維持する（推測で確認済み0件等へ格上げしない）。
    return badgeFromStatus(domain.zeroStatus ?? "not_collected");
  }
  if (domain.fullyCovered === true) return badgeFromStatus("complete");
  if (domain.fullyCovered === false) return badgeFromStatus("partial");
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
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
              <span aria-hidden>{badge.icon}</span>
              {badge.label}
            </span>
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
 * 表示することはない）。TASK-080：DomainRowのstatusBadge()と同じCompletenessStatus語彙
 * （badgeFromStatus）を再利用し、ページ内でバッジ表現を統一する。
 */
function coverageTier(metric: CompletenessMetric): { icon: string; label: string; className: string } {
  return badgeFromStatus(metric.status);
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

  // --- 議員活動バロメーター（Phase99）：レーダーチャート等の見た目だけでは伝わらない
  // 「どこまでデータが揃っているか」を機械集計する。市民が「全部揃っている」と誤解しないための表示。
  const activityEntries = getAllCurrentMemberActivity();
  const formerMemberCount = getAllFormerMembers().length;
  const peopleStatus = getPeopleDataStatus();
  const activityTargetCount = activityEntries.length;
  const countWithCompleteMetric = (key: string) =>
    activityEntries.filter((e) => metricByKey(e.metrics, key)?.dataStatus === "complete").length;
  const activityQuestionConfirmed = countWithCompleteMetric("question");
  const activitySpeechConfirmed = countWithCompleteMetric("speech");
  const activityVotingConfirmed = countWithCompleteMetric("voting");
  const activityCommitteeAffiliationConfirmed = activityEntries.filter((e) => e.member.committees.length > 0).length;
  const activityAllMissingCount = activityEntries.filter((e) => e.metrics.every((m) => m.dataStatus !== "complete")).length;
  const activityFullCompleteCount = activityEntries.filter((e) => e.metrics.every((m) => m.dataStatus === "complete")).length;
  const activityPartialCount = activityTargetCount - activityAllMissingCount - activityFullCompleteCount;
  const committeeReportMemberIds = new Set(committeeReportActivityData.events.map((e) => e.memberId));
  const committeeReportToPlenaryConfirmedMembers = committeeReportMemberIds.size;
  const committeeReportToPlenaryTotalEvents = committeeReportActivityData.events.length;
  const evidenceSummary = getEvidenceAvailabilitySummary();

  // --- 議員プロフィール収録率 ---
  const memberPhotoCount = members.filter((m) => !!m.photoUrl).length;
  const memberProfileCount = members.filter((m) => !!m.profile).length;
  const memberProfileUrlCount = members.filter((m) => !!m.profileUrl).length;
  const memberSnsCount = members.filter((m) => m.sns && m.sns.length > 0).length;
  const memberCommitteeCount = members.filter((m) => m.committees && m.committees.length > 0).length;
  const memberBillVoteMemberIds = new Set(billVotes.flatMap((b) => (b.memberVotes ?? []).map((v) => v.memberId)));
  const memberWithBillVoteCount = members.filter((m) => memberBillVoteMemberIds.has(m.id)).length;
  // TASK-071：「議員との紐付け人数」（＝個人別賛否が1件以上記録されている議員数）と、
  // 「個人別賛否が確認できた議案そのものの件数」は別の集計軸。前者だけを表示すると
  // 「26/26名」＝「全議案の賛否が取得済み」と誤解されるため、必ず両方を併記する。
  const individualVoteConfirmedBillCount = billVotes.filter((b) => (b.memberVotes ?? []).length > 0).length;

  // --- 歴代市長 ---
  const electedMayorTerms = archiveMayorTerms.filter((t) => t.mayorRole !== "acting" && t.mayorRole !== "temporaryActing");
  const dayPreciseTerms = archiveMayorTerms.filter(isDayPreciseTerm);
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
  // 以下は「サブオブジェクト自体が存在するか」（＝この軸で調査に着手済みか）の集計。
  // 年度の一部だけ確認できた場合でもtrueになるため、フィールド単位の完成度とは別軸として扱う
  // （Phase137：「年度は収録済みだが項目未確認」を区別するため、下のfiscalYearsWith*Field系を新設）。
  const fiscalYearsWithBudget = archiveFiscalYears.filter(hasBudgetData).length;
  const fiscalYearsWithPopulation = archiveFiscalYears.filter(hasPopulationData).length;
  const fiscalYearsWithDebt = archiveFiscalYears.filter(hasDebtData).length;
  const fiscalYearsWithFund = archiveFiscalYears.filter(hasFundData).length;
  const fiscalYearsWithFinance = archiveFiscalYears.filter(hasFinanceRatioData).length;
  // Phase137：フィールド単位の完成度（年度×項目）。具体的な数値フィールドが実際に埋まっている
  // 年度数を数える。歳入歳出総額はhasBudgetData（70/70、常にtrueで「予算に着手した年度」を
  // 意味するに過ぎない）とは別の指標として扱う。
  const fiscalYearsWithTotalRevenue = archiveFiscalYears.filter((y) => y.budget?.totalRevenueYen != null).length;
  const fiscalYearsWithInitialBudget = archiveFiscalYears.filter(hasInitialBudgetAmount).length;
  const fiscalYearsWithBondBalance = archiveFiscalYears.filter(hasOrdinaryAccountBondBalance).length;
  const fiscalYearsWithFundBalanceField = archiveFiscalYears.filter(hasAnyFundBalance).length;
  const fiscalYearsWithFinanceRatioField = archiveFiscalYears.filter(hasAnyFinanceRatio).length;
  // Phase168：Phase165で新規確認したgeneralAccountBondBalanceYen（市債残高・一般会計区分）・
  // generalAccountSettlementYen（一般会計決算額）は、個別ページ（FinanceDebtPage・
  // FinanceBudgetPage等）には表示済みだったが、この完全性ダッシュボードの指標行には
  // 反映されていなかったため追加した。
  const fiscalYearsWithGeneralAccountBondBalance = archiveFiscalYears.filter(hasGeneralAccountBondBalance).length;
  const fiscalYearsWithGeneralAccountSettlement = archiveFiscalYears.filter(hasGeneralAccountSettlement).length;
  // Phase177：Phase165で新規確認した37件のフィールドのうち、Phase168（上記2指標）で
  // まだ反映されていなかった残り5項目を追加する。個別ページには表示済みだが、この
  // 完全性ダッシュボードには未反映だった（データ実値は変更しない、表示・集計ロジックのみ追加）。
  const fiscalYearsWithFinalBudget = archiveFiscalYears.filter(hasFinalBudgetAmount).length;
  const fiscalYearsWithSpecialAccountBudget = archiveFiscalYears.filter(hasSpecialAccountBudget).length;
  const fiscalYearsWithBondBalanceIncludingEnterprise = archiveFiscalYears.filter(hasBondBalanceIncludingEnterprise).length;
  const fiscalYearsWithBondBalancePerCapita = archiveFiscalYears.filter(hasBondBalancePerCapita).length;
  const fiscalYearsWithRevenueBreakdown = archiveFiscalYears.filter(hasAnyRevenueBreakdown).length;
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
      detail: `顔写真：${memberPhotoCount}／${members.length}名／公式プロフィール：${memberProfileCount}／${members.length}名／公式サイト：${memberProfileUrlCount}／${members.length}名／SNS：${memberSnsCount}／${members.length}名／所属委員会登録：${memberCommitteeCount}／${members.length}名／一般質問（会議録確認済み）：${members.length - membersWithoutConfirmedQuestion.length}／${members.length}名／議案賛否・議員との紐付け（1件以上の個人別賛否が記録されている議員数。全議案の賛否が取得済みという意味ではありません）：${memberWithBillVoteCount}／${members.length}名／個人別賛否が確認できた議案そのものの件数：${individualVoteConfirmedBillCount}／${billVotes.length}件`,
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

  // TASK-072：documentTypeLabel(type)（「議案」「条例」等の裸の名称）をそのままラベルにすると、
  // 下のcouncilExtra（1,177件の議案・採決データベース）と同じ「議案」という語で桁違いの件数が
  // 並んでしまい、何を1件として数えているのか分からず矛盾に見える。「詳細アーカイブ化済み」を
  // 明示して、どちらも同じ集計方法だと誤解されないようにする。
  const council: DataDomain[] = documentTypeCounts.map(({ type, count }) => ({
    label: `詳細アーカイブ化済み${documentTypeLabel(type)}`,
    count,
    unit: "件",
    detail: `延岡市議会公式資料をもとに、提出から審査・議決までの経緯を1件ずつ詳しく調べて記録した件数です（延岡市議会に提出された${documentTypeLabel(type)}全件の一覧ではありません）。議決・審査結果確認済み：${archiveCouncilDocuments.filter((d) => d.documentType === type && d.result).length}件`,
    linkTo: `/${type === "bill" ? "bills" : type === "ordinance" ? "ordinances" : type === "petition" ? "petitions" : "requests"}`,
  }));

  const voteClassification = summarizeVoteClassification(billVotes);
  const billVotesVoteMethodKnown = billVotes.filter((b) => b.voteMethod).length;
  const billVotesCommitteeKnown = billVotes.filter((b) => b.committee).length;
  const billVotesProposerTypeKnown = countBillsWithKnownProposerType(billVotes);
  // Phase144項目34・35：「出典が紐付いていること」と「一次資料本文に基づく詳しい説明があること」は
  // 別の確認段階（src/lib/billSummaryQuality.ts）のため、別の行として分けて表示する
  // （同じ「確認済み」という言葉でまとめない）。
  const billVotesDetailedExplanationCount = billVotes.filter((b) => getBillExplanationLevel(b) === 3).length;
  // Phase152項目5：市民向けには内部コード（Level1/2/3等）を出さず、議案総数／出典確認済み／
  // 本文確認済み／詳細説明確認済み／追加確認中の5段階を実データから動的に算出して表示する。
  const billVotesSourceLinkedCount = billVotes.filter((b) => Boolean(b.sourceFilePath || b.sourceDocumentId)).length;
  const billVotesBodyVerifiedCount = billVotes.filter((b) => getBillExplanationLevel(b) >= 2).length;
  const billVotesAdditionalConfirmingCount = billVotes.length - billVotesBodyVerifiedCount;
  const councilExtra: DataDomain = {
    label: "議案・採決データベース",
    count: billVotes.length,
    unit: "件",
    detail: `議案総数${billVotes.length}件のうち、出典（審議結果PDF等）確認済み${billVotesSourceLinkedCount}件／一次資料本文（会議録の提案理由説明等）を確認済み${billVotesBodyVerifiedCount}件／その本文に基づく詳細な説明あり${billVotesDetailedExplanationCount}件／詳しい内容は追加確認中${billVotesAdditionalConfirmingCount}件です（「追加確認中」は情報が無いという意味ではなく、議案名・議決結果・出典は確認済みで、議案固有の詳しい提案理由等をまだ整理できていない状態です）。議決結果は${billVotes.length}件全てを登録済み。個人（議員ごと）の賛否内訳（採決方式と公開状況を別軸に整理）：個人別に公開${voteClassification.byDisclosure.individual}件（記名投票等）／採決方式は判明しているが個人別は未確認${voteClassification.byDisclosure.aggregate}件（起立採決・簡易採決等で、会議録には方式の記載はあるが個人別の内訳までは未調査）／個人別は非公開と確認済み${voteClassification.byDisclosure.not_disclosed}件（会議録で非公開と確認済み）／採決方式・公開状況とも不明${voteClassification.byDisclosure.unknown}件（会議録自体が未公開）。品質項目の確認状況：提出者区分${billVotesProposerTypeKnown}／${billVotes.length}件・採決方法${billVotesVoteMethodKnown}／${billVotes.length}件・付託委員会${billVotesCommitteeKnown}／${billVotes.length}件（付託委員会が未確認の議案は、会期の会議録自体が延岡市議会「会議録検索システム」で未公開の会期に限られます。委員会付託を省略し本会議で直接議決された議案は「付託なし」として確認済みに含めています）。議案の詳細ページでは、提出から委員会審査・本会議採決までの流れを時系列で確認できます。上記の議案・条例・請願・陳情アーカイブとは別管理の既存データベースです。`,
    linkTo: "/bills/votes",
    linkLabel: "議案ごとの賛否を見る",
  };

  const committeesWithJurisdiction = committees.filter((c) => c.jurisdiction !== null).length;
  const countConsistencyUnresolved = dataQualitySummary.countConsistencyChecks.filter(
    (c) => !c.status.startsWith("fixed"),
  ).length;
  // Phase183：過去の委員構成データ（Phase174・180で2003〜2022年の複数任期分を新規登録）の
  // 収録範囲を、直書きの「2023〜2025年」ではなくデータから動的に算出する（DataStatusPage監査で
  // 発見。データが増えるたびに文言を手で書き換えなくて済むようにする）。
  const committeeMembershipHistory = archiveCommitteeMembersData as { termStart: string }[];
  const committeeMembershipHistoryCount = committeeMembershipHistory.length;
  const committeeMembershipHistoryYears = [
    ...new Set(committeeMembershipHistory.map((r) => Number(r.termStart.slice(0, 4)))),
  ].sort((a, b) => a - b);
  const committeeMembershipHistoryYearRange =
    committeeMembershipHistoryYears.length > 0
      ? `${committeeMembershipHistoryYears[0]}〜${committeeMembershipHistoryYears[committeeMembershipHistoryYears.length - 1]}年`
      : "未収録";
  // 統一地方選挙は4年ごと（改選臨時会は2003・2007・2011・2015・2019〜2026年の毎年5月）に
  // 行われるため、収録済み年から欠けている改選年のみを「未確認」として列挙する（推測で埋めない）。
  const committeeMembershipHistoryExpectedTermYears = [2003, 2007, 2011, 2015];
  const committeeMembershipHistoryUnconfirmedYears = committeeMembershipHistoryExpectedTermYears
    .filter((y) => !committeeMembershipHistoryYears.includes(y))
    .join("・");

  const councilCommittees: DataDomain = {
    label: "委員会（常任・議会運営・特別）",
    count: committees.length,
    unit: "件",
    scope: "現行の委員名簿（令和8年5月8日現在）",
    // 「所管事項が確認できたもの：n／m件」の括弧内説明は、未確認の委員会が実際に残っている
    // 場合のみ表示する。かつては延岡市議会委員会条例の条文が未確認で一部委員会の所管事項を
    // 特定できていなかったが、その後全件確認できたため、旧来の説明文が「6/6件確認済み」表示と
    // 矛盾したまま残っていた（DataStatusPage監査で発見）。
    detail: `委員名簿・任期を登録済み。所管事項が確認できたもの：${committeesWithJurisdiction}／${committees.length}件${
      committeesWithJurisdiction < committees.length
        ? "（延岡市議会委員会条例の条文が未確認のため残りは「確認できず」と表示）"
        : "（延岡市議会委員会条例の条文と照合し、全委員会の所管事項を確認済み）"
    }。活動報告書（所管事務調査、令和5〜7年度）：${committeeActivityReports.length}件登録。過去（現行任期より前）の委員長・副委員長・委員の在任履歴：会議録で確認できた${committeeMembershipHistoryCount}件（${committeeMembershipHistoryYearRange}の統一地方選挙後改選臨時会分${committeeMembershipHistoryUnconfirmedYears ? `。${committeeMembershipHistoryUnconfirmedYears}年の各任期は未収録・調査中` : "。統一地方選挙後の各任期は空白なく収録済み"}。委員会条例制定〈昭和45年＝1970年〉〜会議録検索システム収録開始〈平成12年＝2000年〉の約30年間は同システムで確認不能のため未収録のまま）。`,
    linkTo: "/committees",
    linkLabel: "委員会一覧を見る",
    fullyCovered: committeesWithJurisdiction === committees.length,
  };

  // Phase183：会期要約の確認状況（Phase163・175・179で計19会期がunavailableから
  // partially-verifiedへ改善）を、「未収録9件」のような粗い表示ではなく、確認済み／一部確認済み／
  // 未確認の内訳が分かる形で公開する（内部識別子UNR-060等は表示せず、既存のsessionSummaryStatusLabels
  // 語彙で統一）。
  const councilSessionsList = councilSessionsData as { summaryStatus?: keyof typeof sessionSummaryStatusLabels }[];
  const sessionSummaryStatusCounts = councilSessionsList.reduce<Record<string, number>>((acc, s) => {
    const key = s.summaryStatus ?? "unavailable";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const councilSessionSummaryDomain: DataDomain = {
    label: "会期ごとの要約（確認状況）",
    count: councilSessionsList.length,
    unit: "会期",
    scope: "収録済み全会期（平成12年〜令和8年）",
    detail: `${(Object.entries(sessionSummaryStatusCounts) as [string, number][])
      .sort(([a], [b]) => (a === "verified" ? -1 : b === "verified" ? 1 : a.localeCompare(b)))
      .map(([status, count]) => `${sessionSummaryStatusLabels[status as keyof typeof sessionSummaryStatusLabels] ?? status}：${count}会期`)
      .join("／")}。「一部確認済み」は、公式資料（議案等審議結果PDF・国立国会図書館所蔵の会議録書誌等）で会期の実在・日程は確認できたが、会議録本文までは確認できていない状態で、市への確認や図書館での資料閲覧が必要な段階です。`,
    linkTo: "/council-documents",
    linkLabel: "会期一覧を見る",
    fullyCovered: (sessionSummaryStatusCounts.verified ?? 0) === councilSessionsList.length,
  };

  const councilLeadership = archiveCouncilLeadershipData as ArchiveCouncilLeadershipTerm[];
  const councilLeadershipDomain: DataDomain = {
    label: "歴代議長・副議長",
    count: councilLeadership.length,
    unit: "件",
    scope: "延岡市史（市制80周年記念10年史）で日単位の在任期間つきで確認できた2001〜2012年分のみ",
    detail: `歴代議長${councilLeadership.filter((t) => t.role === "議長").length}件（第47〜52代）・歴代副議長${councilLeadership.filter((t) => t.role === "副議長").length}件（第50〜60代）。延岡市議会創設（初代）〜2001年以前、および2012年以降の分は現時点で未収録（「議長不在」ではなく「調査中」）。`,
    linkTo: "/committees/leadership-history",
    linkLabel: "歴代議長・副議長を見る",
    fullyCovered: false,
  };

  // TASK-083：用語をトップページ・ダッシュボード（HomePage.tsx／DashboardPage.tsx）の
  // StatCard labelと完全一致させる（「一般質問（登壇・確認済み件数）」「質問項目数」
  // 「会議録未公開会期の予定質問」）。ページごとに別の言い回し（登壇件数／確認済み発言数等）を
  // 使わないことで、同じ数値が別の名称に見えないようにする（Phase168：令和8年9月定例会追加で
  // 会期名が「最新会期」単数から複数会期対応の現在の文言に変わったため、本コメントも追従）。
  const questions: DataDomain[] = [
    {
      label: "一般質問（登壇・確認済み件数）",
      count: questionStats.confirmedCount,
      unit: "件",
      scope: "現任期（令和5年5月15日〜）＋旧任期（令和元年6月〜令和5年3月）",
      detail: `議員1名が1回の登壇で行った質問・答弁のやり取り1回分を1件と数えています。現任期の対象定例会${questionStats.targetSessionCount}会期中${questionStats.collectedSessionCount}会期を収録（旧任期分を含む件数は上記の${questionStats.confirmedCount}件）／確認済み質問がある現職議員：${members.length - membersWithoutConfirmedQuestion.length}／${members.length}名${membersWithoutConfirmedQuestion.length > 0 ? `（未確認：${membersWithoutConfirmedQuestion.map((m) => m.name).join("、")}）` : ""}`,
      linkTo: "/questions",
      linkLabel: "一般質問データベースを見る",
    },
    {
      label: "質問項目数",
      count: questionStats.totalQuestionItemCount,
      unit: "件",
      scope: "現任期（令和5年5月15日〜）＋旧任期（令和元年6月〜令和5年3月）",
      detail: `1回の登壇（上記「一般質問（登壇・確認済み件数）」${questionStats.confirmedCount}件）で複数のテーマを質問することが多いため、内訳である質問項目数の方が多くなります。両者は異なる集計単位であり、どちらか一方に統一していません。`,
      linkTo: "/questions",
      linkLabel: "一般質問データベースを見る",
    },
    {
      label: "会議録未公開会期の予定質問",
      count: questionStats.scheduledCount,
      unit: "件",
      scope:
        questionStats.scheduledSessions.length > 0
          ? questionStats.scheduledSessions.map((s) => s.sessionName).join("、")
          : "該当会期なし",
      detail:
        questionStats.scheduledSessions.length > 0
          ? questionStats.scheduledSessions
              .map((s) =>
                s.newsletterConfirmed
                  ? `${s.sessionName}（${s.count}件）：会議録は未公開ですが、「のべおか市議会だより」で開催・実施は確認済みです（TASK-079）。個々の質問項目・答弁内容は会議録公開後に確認します。`
                  : `${s.sessionName}（${s.count}件）：会議録公開前の暫定情報（質問通告書ベース）です。実際の質疑応答内容はまだ確認できていません。`,
              )
              .join(" ")
          : "該当する会期はありません。",
      linkTo: "/questions",
    },
  ];

  const policy: DataDomain[] = [
    {
      // トップページの「登録済み市長公約数」は現職市長（三浦市長）の公約のみを数えており
      // （mayor.pledges.length）、こちらは歴代の政策・公約アーカイブ全体の件数のため、
      // 単純に「政策・公約」とだけ表示すると同じ言葉で桁の違う数字に見えてしまう。
      // 集計対象が異なることを明示する（DataStatusPage監査で発見）。
      label: "政策・公約データ（歴代分を含む総数）",
      count: archivePolicies.length,
      unit: "件",
      scope: "歴代の市長・市政の政策・公約アーカイブ全体。現職市長の公約のみの件数はトップページ「登録済み市長公約数」を参照",
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
      detail: `予算確認済み${fiscalYearsWithBudget}年度／人口確認済み${fiscalYearsWithPopulation}年度／市債確認済み${fiscalYearsWithDebt}年度／基金確認済み${fiscalYearsWithFund}年度／財政健全化判断比率確認済み${fiscalYearsWithFinance}年度。総務省「決算カード」オンライン公開の最古年度は平成13年度＝FY2001（2026-08-17確認）ですが、昭和63年度（1988年度）〜平成12年度（2000年度）分は総務省「地方財政状況調査」（e-Stat）から歳入総額・歳出総額のみ別途確認済みです（この期間の市債・基金・財政健全化判断比率・当初予算等は未確認、CD-ROM等の物理媒体調査は未実施）。それ以前の年度は、延岡市史・宮崎県統計年鑑等の一次資料で確認できた単年度のみ個別に登録しています（未収録の年度は0ではなく「未確認」です）。${fiscalYearGapNote(archiveFiscalYears) ?? ""}`,
      linkTo: "/finance",
      linkLabel: "財政ページを見る",
    },
  ];

  const platform: DataDomain[] = [
    {
      label: "検索インデックス登録件数",
      count: searchIndexMetaData.entryCount,
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
      label: "議案：一次資料本文に基づく詳しい説明の作成",
      metric: simpleCompleteness(billVotesDetailedExplanationCount, billVotes.length),
      note: "議案名・議決結果・出典（審議結果PDF等）は全1,177件で確認済みです。ここでの「確認済み」は、会議録等の本文を人が読んで作成した独自の説明があることを指します（残りは、件名・議決結果・出典から機械的に組み立てた定型の説明です）。",
    },
    {
      label: "政治資金団体：代表者・会計責任者・当該年分収支の完全確認",
      metric: simpleCompleteness(pfFullyConfirmed, politicalFundOrganizations.length),
    },
    {
      label: "委員会：所管事項の確認",
      metric: simpleCompleteness(committeesWithJurisdiction, committees.length),
      note: "常任委員会3件は延岡市議会委員会条例の個別列挙、議会運営委員会1件は地方自治法第109条第3項の一般規定、特別委員会2件は設置時の提案理由により、所管事項をそれぞれ確認済み（6／6件。Phase44で表記を実態に合わせて修正）",
    },
    {
      label: "財政：年度レコードの登録（この軸で調査に着手した年度）",
      metric: simpleCompleteness(fiscalYearsWithBudget, archiveFiscalYears.length),
      note: "この行は「年度レコードが存在するか」のみを示し、以下の項目別の行が実際の数値の有無を示します（Phase137で分離）。",
    },
    {
      label: "財政：歳入総額（決算ベース）の年度確認",
      metric: simpleCompleteness(fiscalYearsWithTotalRevenue, archiveFiscalYears.length),
    },
    {
      label: "財政：一般会計当初予算額の年度確認",
      metric: simpleCompleteness(fiscalYearsWithInitialBudget, archiveFiscalYears.length),
      note: "Phase137で平成19〜令和8年度分（20年度）を延岡市「当初予算の概要」の年度別推移表から新規確認しました。",
    },
    {
      label: "財政：市債残高（普通会計）の年度確認",
      metric: simpleCompleteness(fiscalYearsWithBondBalance, archiveFiscalYears.length),
      note: "市債残高は資料により「一般会計」「普通会計」等、基準が異なります。ここでは登録年度数が最も多い普通会計ベースを集計しています（他の基準の残高は個別ページでご確認ください）。",
    },
    {
      label: "財政：市債残高（一般会計）の年度確認",
      metric: simpleCompleteness(fiscalYearsWithGeneralAccountBondBalance, archiveFiscalYears.length),
      note: "上記の普通会計ベースとは定義が異なる別集計です（Phase165でFY2019〜2024分を新規確認、財政の市債ページでご確認いただけます）。",
    },
    {
      label: "財政：基金残高（いずれかの区分）の年度確認",
      metric: simpleCompleteness(fiscalYearsWithFundBalanceField, archiveFiscalYears.length),
    },
    {
      label: "財政：一般会計決算額（歳出決算ベース）の年度確認",
      metric: simpleCompleteness(fiscalYearsWithGeneralAccountSettlement, archiveFiscalYears.length),
      note: "予算額（当初・補正後）とは別の、決算が確定した金額です（Phase165でFY2019〜2024分を新規確認、財政の予算ページでご確認いただけます）。",
    },
    {
      label: "財政：一般会計補正後（最終）予算額の年度確認",
      metric: simpleCompleteness(fiscalYearsWithFinalBudget, archiveFiscalYears.length),
      note: "当初予算・決算額とは別の集計です。Phase177で完全性ダッシュボードへ追加しました（財政の予算ページでご確認いただけます）。",
    },
    {
      label: "財政：特別会計予算額の年度確認",
      metric: simpleCompleteness(fiscalYearsWithSpecialAccountBudget, archiveFiscalYears.length),
      note: "一般会計とは別会計の予算額です。Phase165でFY2020〜2025分を新規確認しましたが、Phase177まで完全性ダッシュボードへ未反映でした。",
    },
    {
      label: "財政：市債残高（企業会計を含む全会計）の年度確認",
      metric: simpleCompleteness(fiscalYearsWithBondBalanceIncludingEnterprise, archiveFiscalYears.length),
      note: "一般会計・普通会計ベースとは定義が異なる別集計です（水道・下水道等の企業債残高を合算）。Phase165でFY2021〜2024分を新規に算出・登録しましたが、Phase177まで完全性ダッシュボードへ未反映でした。",
    },
    {
      label: "財政：市債残高（市民1人当たり）の年度確認",
      metric: simpleCompleteness(fiscalYearsWithBondBalancePerCapita, archiveFiscalYears.length),
      note: "財政の市債ページの年度別一覧には既に表示されている項目です。Phase177で完全性ダッシュボードへ追加しました。",
    },
    {
      label: "財政：歳入内訳（地方税・地方交付税・国庫支出金・県支出金のいずれか）の年度確認",
      metric: simpleCompleteness(fiscalYearsWithRevenueBreakdown, archiveFiscalYears.length),
      note: "歳入総額（決算ベース）の内訳項目です。4項目すべてが揃っているとは限りません。Phase177で完全性ダッシュボードへ追加しました。",
    },
    {
      label: "財政：財政健全化判断比率（いずれかの指標）の年度確認",
      metric: simpleCompleteness(fiscalYearsWithFinanceRatioField, archiveFiscalYears.length),
      note: "財政力指数・経常収支比率・実質公債費比率・将来負担比率のうち、いずれか1つでも確認できた年度数です。4指標すべてが揃っているとは限りません。",
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

      {/* Phase140項目4：完成率の羅列に入る前に、このページで分かることを3点で要約する。 */}
      <div className="rounded-xl border border-primary/30 bg-primary-container/40 p-4 sm:p-5">
        <p className="text-sm font-semibold text-on-surface">このページで分かること</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-on-surface">
          <li>当サイトが議員・議案・財政などの分野ごとに、何件のデータを収録しているか</li>
          <li>そのうち、市公式サイトや議案書などの一次資料でどこまで確認できているか（下記の「収録率」）</li>
          <li>まだ確認できていない部分は何か、なぜ確認できていないか（資料が未公表／調査中など）</li>
        </ul>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        <span className="font-semibold text-on-surface">一次資料の調査状況：</span>
        延岡市公式ホームページが公開する「延岡市史（市制80周年記念10年史）」（全939ページ）を、歴代市長・歴代議長副議長・人口・財政等の既存データに誤りや空白がないか横断的に確認するために調査しました。ページ単位の確認：939／939ページ（100%、2026-08-29時点）。これは資料本文を最後まで確認したという意味であり、記載内容をすべてデータベース化したという意味ではありません。確認した結果、他の公式資料と照合できた範囲から順次データへ反映しています（例：
        <Link to="/committees/leadership-history" className="mx-1 text-primary hover:underline">
          歴代議長・副議長（2001〜2012年分）
        </Link>
        を新たに掲載）。反映が済んでいない事項は「未収録」「調査中」等で明示し、未反映＝0件とは扱っていません。調査で使用する資料の種類や、確認できない情報の扱い方は
        <Link to="/editorial-policy#research-method" className="mx-1 text-primary hover:underline">
          編集方針（古い年代・未公開資料の調べ方）
        </Link>
        でご覧いただけます。
      </p>

      <SectionCard title="データ完全性ダッシュボード">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          「収録件数」だけでなく、一次資料で確認できた母数（対象会期数・議案件数・団体数など）に対する収録率を示します。例えば「収録12件／確認済み母数13件／収録率92%」は、「一次資料で対象と確認できた13件のうち、当サイトで12件を収録している」という意味です（世の中に存在するすべての対象のうち92%という意味ではありません）。母数が一次資料で確認できていない項目は「母数未確認」とし、100%と表示することはありません。
        </p>
        <ul className="space-y-2">
          {completenessRows.map((row) => (
            <CompletenessRow key={row.label} label={row.label} metric={row.metric} note={row.note} />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="出典・リンクの健全性（品質監査）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          出典の形式・外部リンクの到達性・画面表示の件数が実データとずれていないかを機械的に監査した結果です。新しい判定基準は追加せず、既存の<code>validate:sources</code>・外部リンク監査キャッシュを集計しています。
        </p>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">出典不足（出典タイトル欠落等）</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {dataQualitySummary.sourceHealth.warnings ?? "確認不可"}件
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">リンク切れ（現行サイトで使用中のデータのみ）</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {dataQualitySummary.linkHealth ? dataQualitySummary.linkHealth.broken.length : "未計測"}
              {dataQualitySummary.linkHealth && `／${dataQualitySummary.linkHealth.totalChecked}件中`}
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">件数不整合（画面表示とデータ件数のずれ）</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {countConsistencyUnresolved}件
              {dataQualitySummary.countConsistencyChecks.length > 0 &&
                `（把握済み${dataQualitySummary.countConsistencyChecks.length}件のうち解消済み${dataQualitySummary.countConsistencyChecks.length - countConsistencyUnresolved}件）`}
            </dd>
          </div>
        </dl>
        {dataQualitySummary.linkHealth && dataQualitySummary.linkHealth.broken.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-on-surface-variant hover:text-on-surface">
              リンク切れの内訳を見る（{dataQualitySummary.linkHealth.broken.length}件）
            </summary>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-on-surface-variant">
              {dataQualitySummary.linkHealth.broken.map((b) => (
                <li key={b.url} className="break-all rounded border border-outline-variant p-2">
                  <span className="font-medium text-on-surface">
                    {b.category === "not_found_404" ? "404 Not Found" : `サーバーエラー（${b.status ?? "不明"}）`}
                  </span>
                  ：{b.url}（{b.files.join("、")}）
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          {dataQualitySummary.linkHealth?.note}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">
          監査実施日：外部リンク＝{dataQualitySummary.linkHealth?.generatedAt.slice(0, 10) ?? "未計測"}／出典検証＝ビルド時に毎回再計算
        </p>
      </SectionCard>

      <SectionCard title="人物">
        <ul className="space-y-2">
          {people.map((d) => (
            <DomainRow key={d.label} domain={d} />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="議会（議案・条例・請願・陳情）">
        <p className="mb-2 text-xs leading-relaxed text-on-surface-variant">
          「議案・採決データベース」（{billVotes.length}件）と「詳細アーカイブ化済み議案」（{documentTypeCounts.find((d) => d.type === "bill")?.count ?? 0}件）は、同じ「議案」でも数え方が異なる別々の集計です。前者は議案ごとの議決結果を機械的に登録した一覧、後者はその中から提出経緯・審査過程まで人手で詳しく調べて記録したものです。条例・請願・陳情についても同様に、「詳細アーカイブ化済み」は全件一覧ではありません。
        </p>
        <ul className="space-y-2">
          <DomainRow domain={councilExtra} />
          {council.map((d) => (
            <DomainRow key={d.label} domain={d} />
          ))}
          <DomainRow domain={councilCommittees} />
          <DomainRow domain={councilLeadershipDomain} />
          <DomainRow domain={councilSessionSummaryDomain} />
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          「議決・審査結果確認済み：{resultConfirmedCount}／{archiveCouncilDocuments.length}件」「出典確認済み（verified）：{verifiedDocumentCount}件」（いずれも詳細アーカイブ側の内訳）。議員個人の賛否記録は「議案・採決データベース」側で管理しており、混同していません。
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
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          この調査は、当サイトからの追加の問い合わせは行っていませんが、市民の方が次に確認先を検討される際の参考として、再開条件を記録しています：延岡市立図書館・宮崎県立図書館の郷土資料コーナーでの現物確認／国立国会図書館個人送信サービスでの『延岡市史』（1949・1963・1983・1993年版）内の確認／延岡市選挙管理委員会事務局（Tel: 0982-22-7026）への照会／延岡市議会事務局（Tel: 0982-22-7029）への照会。同じオンライン検索を理由なく繰り返さないよう、既に確認済みの情報源（延岡市公式サイト・選挙管理委員会公式ページ・宮崎県統計年鑑・国立国会図書館デジタルコレクション・地域報道アーカイブ）はいずれも見つからなかったことを記録済みです。
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

      <SectionCard title="議員活動バロメーターの収録状況">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          <Link to="/council-activity" className="font-medium text-primary hover:underline">
            議員活動バロメーター
          </Link>
          のレーダーチャートは、指標によって収録状況が異なります。このグラフだけを見て「全データが揃っている」と誤解しないよう、確認できている人数を集計しています。
        </p>
        <dl className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {evidenceSummary.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2">
              <dt className="text-sm text-on-surface">{item.label}</dt>
              <dd className="shrink-0 text-sm font-semibold text-on-surface-variant">{item.statusText}</dd>
            </div>
          ))}
        </dl>
        <p className="mb-4 text-xs leading-relaxed text-on-surface-variant">
          「公開資料から確認できず」は0件・未着手という意味ではなく、複数の公開資料経路を調査したうえで確認できていないことを示します（詳細は各項目の説明・
          <Link to="/methodology/activity-radar" className="font-medium text-primary hover:underline">
            算定方法ページ
          </Link>
          をご覧ください）。
        </p>

        <div className="mb-4 rounded-lg bg-surface-container-low p-3">
          <p className="text-sm font-medium text-on-surface">現職議員と元議員の収録範囲</p>
          <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-on-surface-variant">現職議員</dt>
              <dd className="text-sm text-on-surface">
                {activityTargetCount}名（
                <Link to="/council-activity" className="font-medium text-primary hover:underline">
                  議員活動バロメーター
                </Link>
                で一覧・比較を掲載）
              </dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">元議員（現職ではない）</dt>
              <dd className="text-sm text-on-surface">
                {formerMemberCount}名（
                <Link to="/council-activity/history" className="font-medium text-primary hover:underline">
                  元議員の活動履歴
                </Link>
                に在職期間内の記録のみ掲載。現職との総合順位・単純比較は行っていません）
              </dd>
            </div>
          </dl>
        </div>

        <p className="mb-2 text-xs font-medium text-on-surface-variant">指標別の詳しい内訳（人数ベース）</p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">対象議員</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{activityTargetCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">一般質問：算定可能</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{activityQuestionConfirmed}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">議会内発言：算定可能</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{activitySpeechConfirmed}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">議案等の意思表示：算定可能</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{activityVotingConfirmed}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">所属委員会：確認済み</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{activityCommitteeAffiliationConfirmed}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">本会議での委員長・副委員長報告：確認人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{committeeReportToPlenaryConfirmedMembers}名（計{committeeReportToPlenaryTotalEvents}件）</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">6指標すべて算定可能</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{activityFullCompleteCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">一部の指標のみ算定可能</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{activityPartialCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">6指標とも対象記録なしの議員</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{activityAllMissingCount}名</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          「出席状況」「請願・提案等」は複数の公開資料経路を調査しましたが一次資料を確認できていないため、現時点で全{activityTargetCount}名が「対象記録なし」です（0点として扱ってはいません）。委員会そのものの会議録（開催日・出席委員・個別発言全文）は延岡市議会が一般公開していることを確認できていないため、委員会内部の発言・質疑は活動指標スコアに含めていません。「本会議での委員長・副委員長報告」は、委員会内部の発言ではなく、本会議で委員長・副委員長が審査結果を報告した記録を会議録から機械的に確認・登録したもので、これも参考情報にとどめ活動指標スコアには含めていません（内部エラーではなく、公開資料の収録状況としての説明です）。詳しい算定方法は
          <Link to="/methodology/activity-radar" className="font-medium text-primary hover:underline">
            こちら
          </Link>
          。
        </p>
      </SectionCard>

      <SectionCard title="人物データ収録状況">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          現職議員・元議員・歴代市長を横断した、人物データの収録状況です。「収録人数」は本サイトが登録済みの人数であり、延岡市議会に実際に在職した歴代議員の総数（本サイトが未把握の人物を含みうる）とは異なります。
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">現職議員人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.currentMemberCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">元議員収録人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.formerMemberCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">歴代市長人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.mayorCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">人物ID総数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.totalPersonIdCount}件</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">選挙履歴紐付け人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {peopleStatus.electionLinkedCount}／{peopleStatus.currentMemberCount + peopleStatus.formerMemberCount}名
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">一般質問紐付け人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {peopleStatus.generalQuestionLinkedCount}／{peopleStatus.currentMemberCount + peopleStatus.formerMemberCount}名
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">議会発言紐付け人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {peopleStatus.speechLinkedCount}／{peopleStatus.currentMemberCount + peopleStatus.formerMemberCount}名
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">個人別賛否紐付け人数（議員）</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {peopleStatus.voteLinkedCount}／{peopleStatus.currentMemberCount + peopleStatus.formerMemberCount}名
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">個人別賛否確認済み（議案）</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {individualVoteConfirmedBillCount}／{billVotes.length}件
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">委員会履歴紐付け人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {peopleStatus.committeeLinkedCount}／{peopleStatus.currentMemberCount + peopleStatus.formerMemberCount}名
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">未確認人物ID数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.unconfirmedPersonCount}件</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          「個人別賛否紐付け人数（議員）」は、1件以上の議案で個人別の賛否が記録されている議員の人数です。これが{peopleStatus.currentMemberCount + peopleStatus.formerMemberCount}名中{peopleStatus.voteLinkedCount}名（26名全員等）になっていても、「全議案について全議員の賛否が取得済み」という意味ではありません。実際に個人別の賛否が確認できている議案の件数は「個人別賛否確認済み（議案）」（{individualVoteConfirmedBillCount}／{billVotes.length}件）の方をご覧ください。議案単位の内訳（個人別に公開・採決方式のみ判明・非公開と確認済み・不明）は
          <Link to="/bills/votes" className="font-medium text-primary hover:underline">
            議案ごとの賛否
          </Link>
          のページで確認できます。
        </p>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          「未確認人物ID数」は、選挙・一般質問・議会発言・議案賛否・委員会のいずれの根拠も確認できていない人物IDの件数です（0件は、登録済みの全員について何らかの根拠を確認できていることを意味します）。人物の詳細は
          <Link to="/people" className="font-medium text-primary hover:underline">
            人物から探す
          </Link>
          からご覧いただけます。
        </p>

        <p className="mb-2 mt-4 text-xs font-medium text-on-surface-variant">
          現在データベースに収録している元議員{peopleStatus.formerMemberCount}名の内訳（延岡市議会に実際に在職した歴代議員の総数ではありません）
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">任期確認人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.formerMemberTermConfirmedCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">党派履歴確認人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.formerMemberPartyConfirmedCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">委員会確認人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.formerMemberCommitteeConfirmedCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">一般質問確認人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.formerMemberGeneralQuestionConfirmedCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">議会発言確認人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.formerMemberSpeechConfirmedCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">賛否確認人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.formerMemberVoteConfirmedCount}名</dd>
          </div>
          <div className="rounded-lg bg-surface-container-low p-3">
            <dt className="text-xs text-on-surface-variant">選挙記録のみ確認人数</dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{peopleStatus.formerMemberElectionOnlyCount}名</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          「任期確認」は選挙当選日ではなく、就任日を示す独立した公式資料で確認できた場合のみカウントしています（選挙当選日を任期開始日として代用していません）。「選挙記録のみ確認人数」は、当選の事実は確認できているものの、正式な任期・議会活動の記録がまだ確認できていない人数であり、その方の議会活動が少なかったことを意味するものではありません。
        </p>

        <p className="mb-2 mt-4 text-xs font-medium text-on-surface-variant">元議員のデータ充足レベル別人数</p>
        <p className="mb-2 text-xs leading-relaxed text-on-surface-variant">{FORMER_MEMBER_DATA_TIER_DISCLAIMER}</p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["A", "B", "C", "D"] as const).map((tier) => (
            <div key={tier} className="rounded-lg bg-surface-container-low p-3" title={FORMER_MEMBER_DATA_TIER_DESCRIPTIONS[tier]}>
              <dt className="text-xs text-on-surface-variant">{FORMER_MEMBER_DATA_TIER_LABELS[tier]}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-on-surface">
                {tier === "A"
                  ? peopleStatus.formerMemberTierACount
                  : tier === "B"
                    ? peopleStatus.formerMemberTierBCount
                    : tier === "C"
                      ? peopleStatus.formerMemberTierCCount
                      : peopleStatus.formerMemberTierDCount}
                名
              </dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title="議会事務局への確認候補（本サイトからの問い合わせは行っていません）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          本サイトが複数の公開資料経路を調査しても確認できなかった項目の一覧です。市民の方が延岡市議会事務局（Tel: 0982-22-7029）へ直接確認・情報公開請求等を検討される際の参考としてまとめています。本サイトから議会事務局への問い合わせは行っていません。
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-on-surface">
          <li>本会議の議員別の出席・欠席状況（一次資料での名簿の有無）</li>
          <li>委員会内部（常任・特別・議会運営委員会）の会議録・個別発言記録の一般公開の有無</li>
          <li>議案に対する個人別の採決記録（記名投票以外の採決方法での議員別内訳）</li>
          <li>過去年度分の会議録（PDF等、会議録検索システム未収録分）の公開状況</li>
          <li>請願・陳情の紹介議員の氏名（請願者本人ではなく、議会へ取り次いだ議員）</li>
          <li>令和8年5月臨時会・6月定例会の会議録の公開時期（公式資料の公開待ちとして分類中の項目、計{taskStatusCounts.WAITING_EXTERNAL ?? 0}件）</li>
        </ul>
      </SectionCard>

      <p className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        「収録件数」は登録済みレコード数の事実集計であり、実際に存在するはずの全件数（分母）を当サイトが把握しているとは限りません。歴代市長の任期空白（{mayorGapCount}件）のように、収録済みの範囲内でも未確認の期間・項目があることを明示しています。0件と「未収録・未確認」は区別して表示しています。
      </p>

      {/*
        このページは多数のデータファイル（財政・選挙・市長・議員等）を横断集計しており、
        単一の「対象データ確認日（最新値）」を安全に算出する手段がない（ファイルごとに
        lastVerified等のフィールド名・粒度が異なる）。以前は日付を固定文字列で決め打ち
        していたため、更新のたびに実態と乖離した古い日付を表示し続ける状態になっていた
        （Phase86 UI監査で発見）。dataAsOfLabel/dataAsOfを渡さない場合、LastUpdatedは
        ビルド日時のみを表示する設計になっているため、誤った確認日を示すより
        ビルド日時のみの表示に留める。
      */}
      <LastUpdated className="mt-4" />
    </div>
  );
}
