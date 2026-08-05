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
import type {
  CouncilMember,
  FormerMember,
  BillVoteItem,
  GeneralQuestionItem,
  CouncilSpeechSummaryData,
  CitySpecialPost,
} from "../types";
import type { ArchiveMayor, ArchiveMayorTerm, ArchiveCouncilDocument, ArchivePolicy, ArchiveFiscalYear } from "../types/historicalArchive";
import type { ArchiveMemberProfile } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { LastUpdated } from "../components/LastUpdated";
import { SectionCard } from "../components/SectionCard";
import { ChartBarIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { allPublicSpeeches, questionLikeSpeeches } from "../lib/councilSpeeches";
import { calculateGeneralQuestionStats } from "../lib/generalQuestionStats";
import { documentTypeLabel } from "../lib/archiveCouncilDocuments";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const archiveMemberProfiles = archiveMemberProfilesData as ArchiveMemberProfile[];
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const citySpecialPosts = citySpecialPostsData as CitySpecialPost[];
const archiveCouncilDocuments = archiveCouncilDocumentsData as ArchiveCouncilDocument[];
const billVotes = billVotesData as BillVoteItem[];
const archivePolicies = archivePoliciesData as ArchivePolicy[];
const archiveFiscalYears = archiveFiscalYearsData as ArchiveFiscalYear[];
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;

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

function DomainRow({ domain }: { domain: DataDomain }) {
  return (
    <li className="rounded-lg border border-outline-variant p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-on-surface">{domain.label}</p>
        <p className="text-sm font-bold text-on-surface">
          {domain.count.toLocaleString()}
          <span className="ml-0.5 text-xs font-medium text-on-surface-variant">{domain.unit}</span>
        </p>
      </div>
      {domain.scope && <p className="mt-1 text-xs text-on-surface-variant">収録範囲：{domain.scope}</p>}
      {domain.detail && <p className="mt-0.5 text-xs text-on-surface-variant">{domain.detail}</p>}
      {domain.linkTo && (
        <Link to={domain.linkTo} className={`mt-1.5 inline-block text-xs font-medium text-primary hover:underline ${linkClass}`}>
          {domain.linkLabel ?? "詳しく見る"} →
        </Link>
      )}
    </li>
  );
}

export function DataStatusPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

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
      count: archiveMemberProfiles.length,
      unit: "名",
      detail:
        formerMembers.length > archiveMemberProfiles.length
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
      scope: "現職のみ（議会同意議案で就任が確認できた範囲）",
      detail:
        "選挙管理委員会は、委員全員の氏名を確実に特定できる公式資料を確認できていないため未掲載です。",
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
  const councilExtra: DataDomain = {
    label: "議案ごとの議決結果（既存機能）",
    count: billVotes.length,
    unit: "件",
    detail: `議決結果は${billVotes.length}件全てを登録済み。個人（議員ごと）の賛否内訳を登録済みの件数：${billVotesWithMemberVotes}件（0件と「未収録」は区別しています。上記の議案・条例・請願・陳情アーカイブとは別管理の既存データベースです）。`,
    linkTo: "/bills/votes",
    linkLabel: "議案ごとの賛否を見る",
  };

  const questions: DataDomain[] = [
    {
      label: "一般質問（会議録ベース・確認済み）",
      count: questionStats.confirmedCount,
      unit: "件",
      scope: "令和5年5月15日〜令和8年3月定例会",
      detail: `対象定例会${questionStats.targetSessionCount}会期中${questionStats.collectedSessionCount}会期を収録／確認済み質問がある現職議員：${members.length - membersWithoutConfirmedQuestion.length}／${members.length}名${membersWithoutConfirmedQuestion.length > 0 ? `（未確認：${membersWithoutConfirmedQuestion.map((m) => m.name).join("、")}）` : ""}`,
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

  const finance: DataDomain[] = [
    {
      label: "財政・人口・基金・市債（年度データ）",
      count: archiveFiscalYears.length,
      unit: "年度分",
      scope: fiscalYearRange,
      detail: `予算確認済み${fiscalYearsWithBudget}年度／人口確認済み${fiscalYearsWithPopulation}年度／市債確認済み${fiscalYearsWithDebt}年度／基金確認済み${fiscalYearsWithFund}年度`,
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

      <SectionCard title="政策・財政">
        <ul className="space-y-2">
          {[...policy, ...finance].map((d) => (
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

      <p className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        「収録件数」は登録済みレコード数の事実集計であり、実際に存在するはずの全件数（分母）を当サイトが把握しているとは限りません。歴代市長の任期空白（{mayorGapCount}件）のように、収録済みの範囲内でも未確認の期間・項目があることを明示しています。0件と「未収録・未確認」は区別して表示しています。
      </p>

      <LastUpdated className="mt-4" dataAsOfLabel="この集計の対象データ確認日（最新値）" dataAsOf="2026年8月5日" />
    </div>
  );
}
