import { useMemo } from "react";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import mayorData from "../data/mayor.json";
import mayorPromisesData from "../data/mayorPromises.json";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import generalQuestionsData from "../data/generalQuestions.json";
import billVotesData from "../data/billVotes.json";
import councilSessionsData from "../data/councilSessions.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import financeData from "../data/financeDashboard.json";
import type {
  CouncilMember,
  Gender,
  Mayor,
  MayorPromisesData,
  GeneralQuestionItem,
  BillVoteItem,
  CouncilSession,
  CouncilSpeech,
  CouncilSpeechSummaryData,
  FormerMember,
  FinanceDashboardData,
} from "../types";
import type { ArchiveMayor, ArchiveMayorTerm } from "../types/historicalArchive";
import { getFaction } from "../lib/factions";
import { COUNCIL_STATUTORY_SEATS } from "../lib/constants";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { GlossaryNote } from "../components/GlossaryNote";
import { BarList, type BarListItem } from "../components/dashboard/BarList";
import { ProgressStat } from "../components/dashboard/ProgressStat";
import { usePageTitle } from "../hooks/usePageTitle";
import { LastUpdated } from "../components/LastUpdated";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { Link, useLocation } from "react-router-dom";
import { ChartBarIcon } from "../components/icons";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { coverageHint } from "../data/dataCoverage";
import { publicBills } from "../lib/billVotes";
import { allPublicSpeeches, questionLikeSpeeches, resolveMemberDisplayName } from "../lib/councilSpeeches";
import {
  aggregateConfirmedQuestionsByFiscalYear,
  aggregateConfirmedQuestionsByMember,
  aggregateConfirmedQuestionsByTopic,
  calculateGeneralQuestionStats,
  scheduledSessionBreakdownHint,
} from "../lib/generalQuestionStats";
import {
  LATEST_CONFIRMED_SESSION_HEADING,
  UPCOMING_SESSION_HEADING,
  councilSessionPhaseLabels,
  latestConfirmedCouncilSession,
} from "../lib/councilSessions";
import { UpcomingSessionsNotice } from "../components/council/UpcomingSessionsNotice";
import { termsForMayor, formatArchiveDateWithPrecision, isDayPreciseTerm, daysInOffice } from "../lib/archiveMayors";
import { committees as councilCommittees } from "../lib/committees";
import { COUNCIL_GLOSSARY } from "../lib/councilGlossary";
import {
  MAYOR_PROMISE_GLOSSARY,
  MAYOR_PROMISE_LEVELS,
  MAYOR_PROMISE_SCALE_NOTE,
  mayorPromiseCounts,
} from "../lib/mayorPromiseTerms";
import { FINANCE_GLOSSARY } from "../lib/financeGlossary";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const mayor = mayorData as Mayor;
const mayorPromises = (mayorPromisesData as MayorPromisesData).promises;
const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const billVotes = publicBills(billVotesData as BillVoteItem[]);
const councilSessions = councilSessionsData as CouncilSession[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const finance = financeData as FinanceDashboardData;
const questionStats = calculateGeneralQuestionStats(speechSummaryData.members, generalQuestions);
const confirmedQuestionMemberIds = new Set(
  questionLikeSpeeches(allPublicSpeeches(speechSummaryData.members)).map((s) => s.memberId),
);

// Phase185：現職市長の任期情報は、市長プロフィール（mayor.json）ではなく、日付精度まで
// 管理している延岡市政アーカイブ（archiveMayors.json／archiveMayorTerms.json）を単一情報源とする
// （MayorsPage.tsx等と同じ既存データ・既存関数を再利用し、就任日を独自に書き起こさない）。
const currentArchiveMayor = archiveMayors.find((m) => m.isCurrentMayor);
const currentMayorTerm = currentArchiveMayor
  ? termsForMayor(archiveMayorTerms, currentArchiveMayor.id).at(-1)
  : undefined;

// Phase185：会期一覧（councilSessions.json）のidは"YYYY-MM"または"YYYY-MM-extraordinary"形式で
// 常に開催年月の昇順になっているため、文字列の降順ソートで最新会期を取得できる
// （startDateが未確認の会期が多く、日付フィールドでは並べ替えられないため）。
// Phase203：同じ並べ替えを複数ページで書かないよう、src/lib/councilSessions.tsへ集約した。
// この会期は「公式資料（議案等審議結果）を確認できている直近の会期」であり、
// これから開催される会期（質問通告書だけが公開されている会期）とは別物として扱う。
const latestCouncilSession: CouncilSession | undefined = latestConfirmedCouncilSession(councilSessions);
const latestSessionBills = latestCouncilSession
  ? billVotes.filter((b) => b.sessionId === latestCouncilSession.id)
  : [];
const latestSessionBillsWithResult = latestSessionBills.filter((b) => b.result !== "確認中").length;

const PLACEHOLDER_PROFILE = "情報確認中";

/** financeDashboard.jsonは千円単位で金額を保持する（FinancePageと同じ規約）。未確認（undefined/null）は「確認中」。 */
function formatOkuFromThousandYen(thousandYen: number | null | undefined): string {
  if (thousandYen === null || thousandYen === undefined) return "確認中";
  return `約${(thousandYen / 100000).toFixed(1)}億円`;
}

const cityTaxRevenue = finance.revenue.find((r) => r.label === "市税");

const genderLabels: Record<Gender, string> = {
  male: "男性",
  female: "女性",
  other: "その他",
  undisclosed: "非公開",
  unknown: "不明",
};

/** Strips committee-officer suffixes (委員長 / 副委員長) and normalizes incidental
 * whitespace so the same committee isn't split into multiple bars by formatting
 * differences. The underlying data in members.json is never modified. */
function normalizeCommitteeName(committee: string): string {
  return committee.replace(/（(?:委員長|副委員長)）$/, "").replace(/\s+/g, "").trim();
}

export function DashboardPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();
  const total = members.length;
  const vacancySeats = Math.max(COUNCIL_STATUTORY_SEATS - total, 0);

  const ages = useMemo(
    () => members.map((m) => m.age).filter((a): a is number => typeof a === "number"),
    [],
  );

  const averageAge = ages.length > 0 ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null;
  const minAge = ages.length > 0 ? Math.min(...ages) : null;
  const maxAge = ages.length > 0 ? Math.max(...ages) : null;

  const factionCount = useMemo(() => {
    const ids = new Set(members.map((m) => m.factionId).filter((id) => id !== ""));
    return ids.size;
  }, []);

  const femaleCount = useMemo(() => members.filter((m) => m.gender === "female").length, []);

  const genderItems: BarListItem[] = useMemo(() => {
    const counts = new Map<Gender, number>();
    for (const m of members) {
      counts.set(m.gender, (counts.get(m.gender) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([gender, count]) => ({ key: gender, label: genderLabels[gender], count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const totalBills = billVotes.length;
  const billsWithResult = useMemo(() => billVotes.filter((b) => b.result !== "確認中").length, []);

  // 以下の一般質問の内訳（議員別・テーマ別・年度別・会派別）は、いずれも会議録本文で内容を
  // 確認済みの累計データ（councilSpeechSummaries.json、questionStats.confirmedCount件）を
  // 対象とする。会議録が未公開の会期の予定質問（generalQuestions.json）は、実際に登壇するか
  // 未確定のため、この内訳には含めない（別途「会議録未公開会期の予定質問」として区別して表示する。
  // Phase168：令和8年9月定例会追加で単一会期前提の文言から複数会期対応の文言に変更）。
  const questionRankingItems: BarListItem[] = useMemo(() => {
    return aggregateConfirmedQuestionsByMember(speechSummaryData.members, (memberId) =>
      resolveMemberDisplayName(memberId, members, formerMembers),
    )
      .map((item) => ({
        ...item,
        to: members.some((m) => m.id === item.key) ? `/members/${item.key}` : undefined,
      }))
      .slice(0, 10);
  }, []);

  const questionThemeItems: BarListItem[] = useMemo(
    () => aggregateConfirmedQuestionsByTopic(speechSummaryData.members).slice(0, 12),
    [],
  );

  const questionYearItems: BarListItem[] = useMemo(
    () => aggregateConfirmedQuestionsByFiscalYear(speechSummaryData.members, councilSessions),
    [],
  );

  // 会派は現職議員のみが持つ概念のため、元議員（fm01等）の確認済み質問はこの内訳の対象外とする。
  const questionFactionItems: BarListItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const speech of questionLikeSpeeches(allPublicSpeeches(speechSummaryData.members))) {
      const m = members.find((mm) => mm.id === speech.memberId);
      if (!m) continue;
      counts.set(m.factionId, (counts.get(m.factionId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([factionId, count]) => {
        const faction = getFaction(factionId);
        return { key: factionId || "__none__", label: faction.name, count, color: faction.color };
      })
      .sort((a, b) => b.count - a.count);
  }, []);

  const factionItems: BarListItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      counts.set(m.factionId, (counts.get(m.factionId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([factionId, count]) => {
        const faction = getFaction(factionId);
        return {
          key: factionId || "__none__",
          label: faction.name,
          count,
          color: faction.color,
          to: `/?faction=${encodeURIComponent(factionId)}`,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, []);

  const ageBrackets = useMemo(() => {
    const buckets: Record<string, number> = {
      "40歳未満": 0,
      "40代": 0,
      "50代": 0,
      "60代": 0,
      "70代": 0,
      "80歳以上": 0,
    };
    let unknown = 0;
    for (const m of members) {
      if (typeof m.age !== "number") {
        unknown += 1;
        continue;
      }
      if (m.age >= 80) buckets["80歳以上"] += 1;
      else if (m.age >= 70) buckets["70代"] += 1;
      else if (m.age >= 60) buckets["60代"] += 1;
      else if (m.age >= 50) buckets["50代"] += 1;
      else if (m.age >= 40) buckets["40代"] += 1;
      else buckets["40歳未満"] += 1;
    }
    const items: BarListItem[] = Object.entries(buckets).map(([label, count]) => ({
      key: label,
      label,
      count,
    }));
    if (unknown > 0) {
      items.push({ key: "unknown-age", label: "年齢未確認", count: unknown });
    }
    return items;
  }, []);

  const termBrackets = useMemo(() => {
    const buckets: Record<string, number> = {
      "1回": 0,
      "2回": 0,
      "3回": 0,
      "4回": 0,
      "5回": 0,
      "6回以上": 0,
    };
    let unknown = 0;
    for (const m of members) {
      if (typeof m.termCount !== "number") {
        unknown += 1;
        continue;
      }
      if (m.termCount >= 6) buckets["6回以上"] += 1;
      else if (m.termCount >= 1) buckets[`${m.termCount}回`] += 1;
    }
    const items: BarListItem[] = Object.entries(buckets).map(([label, count]) => ({
      key: label,
      label,
      count,
    }));
    if (unknown > 0) {
      items.push({ key: "unknown-term", label: "未確認", count: unknown });
    }
    return items;
  }, []);

  const committeeItems: BarListItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      for (const raw of m.committees) {
        const name = normalizeCommitteeName(raw);
        if (!name) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ key: label, label, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const completion = useMemo(() => {
    const voteMemberIds = new Set(billVotes.flatMap((b) => b.memberVotes.map((v) => v.memberId)));
    const photo = members.filter((m) => !!m.photoUrl).length;
    const profile = members.filter((m) => m.profile && m.profile !== PLACEHOLDER_PROFILE).length;
    const profileUrl = members.filter((m) => !!m.profileUrl).length;
    const sns = members.filter((m) => m.sns.length > 0).length;
    // 「一般質問あり」は、会議録で確認済みの累計データ（confirmedQuestionMemberIds）を基準とする。
    // 会議録未公開会期の予定質問（generalQuestions.json）だけを見ると、過去の会期で
    // 確認済みの質問がある議員まで「質問なし」と誤判定してしまうため使わない。
    const questions = members.filter((m) => confirmedQuestionMemberIds.has(m.id)).length;
    const votes = members.filter((m) => voteMemberIds.has(m.id)).length;
    const reports = members.filter((m) => m.reports.length > 0).length;
    return { photo, profile, profileUrl, sns, questions, votes, reports };
  }, []);

  // Phase185：市長の在任日数は「今日」に依存するため、他の集計と異なりコンポーネント内で
  // 都度算出する（MayorsPage.tsxのtodayIsoJst算出と同じJST変換方法に揃える）。
  const todayIsoJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const daysInOfficeCount =
    currentMayorTerm && isDayPreciseTerm(currentMayorTerm)
      ? daysInOffice(currentMayorTerm.termStart, todayIsoJst)
      : null;

  // Phase185：市長公約の進捗状況は、政策分野（mayor.pledges／mayorPromises.jsonのcategories、
  // 進捗状況を持たない）ではなく、進捗を個別に追跡している個別公約（mayorPromises.jsonの
  // promises＝MayorPromiseItem[]）を集計元とする。
  // Phase202：3階層の呼び名・件数はsrc/lib/mayorPromiseTerms.tsに集約し、直書きしない。
  const pledgeStatusItems: BarListItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of mayorPromises) {
      counts.set(p.statusLabel, (counts.get(p.statusLabel) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ key: label, label, count }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const latestDecidedBillDisplay = useMemo(() => {
    const dated = billVotes
      .filter((b): b is BillVoteItem & { votingDate: string } => !!b.votingDate)
      .sort((a, b) => b.votingDate.localeCompare(a.votingDate));
    const latest = dated[0];
    if (!latest) return undefined;
    return { date: latest.votingDate, title: latest.billTitle, result: latest.result, href: `/bills/votes/${latest.id}` };
  }, []);

  const latestConfirmedQuestionDisplay = useMemo(() => {
    const dated = questionLikeSpeeches(allPublicSpeeches(speechSummaryData.members))
      .map((s) => (s.date ? { speech: s, date: s.date } : null))
      .filter((x): x is { speech: CouncilSpeech; date: string } => x !== null)
      .sort((a, b) => b.date.localeCompare(a.date));
    const latest = dated[0];
    if (!latest) return undefined;
    return {
      date: latest.date,
      name: resolveMemberDisplayName(latest.speech.memberId, members, formerMembers),
      topicsLabel: latest.speech.topics.slice(0, 2).join("、") || "テーマ確認中",
      href: `/members/${latest.speech.memberId}/questions/${latest.speech.id}`,
    };
  }, []);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">ダッシュボード</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">現員{total}名の構成をひと目で確認できます。</p>
        <Link
          to="/finance"
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChartBarIcon className="h-4 w-4" />
          延岡市の財政を見る
        </Link>
      </div>

      {/* Phase185：最初の数十秒で「延岡市政で今何が起きているか」を把握できるよう、
          市長・議会・直近の動きの3枚を、詳細な内訳（下部の会派別人数等）より前に置く。
          数値はすべて既存データ（archiveMayors.json・archiveMayorTerms.json・
          mayorPromises.json・councilSessions.json・billVotes.json・councilSpeechSummaries.json）
          から自動算出し、固定値はハードコードしない。 */}
      <SectionCard title="市長">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="氏名" value={mayor.name} compact />
          <StatCard
            label="就任日"
            value={
              currentMayorTerm
                ? formatArchiveDateWithPrecision(currentMayorTerm.termStart, currentMayorTerm.termStartPrecision, formatJapaneseDate)
                : "確認中"
            }
            compact
          />
          <StatCard
            label="在任日数"
            value={daysInOfficeCount ?? "確認中"}
            unit={daysInOfficeCount !== null ? "日" : undefined}
            hint={daysInOfficeCount !== null ? "就任日を1日目として算出しています（毎日自動更新）。" : undefined}
          />
          <StatCard
            label={MAYOR_PROMISE_LEVELS.promise.statLabel}
            value={mayorPromiseCounts.promise}
            unit="件"
            hint={`${MAYOR_PROMISE_LEVELS.promise.definition}${MAYOR_PROMISE_SCALE_NOTE}`}
          />
        </div>
        {pledgeStatusItems.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-on-surface-variant">
              {MAYOR_PROMISE_LEVELS.promise.label}{mayorPromiseCounts.promise}件の進捗状況の内訳
            </p>
            <BarList items={pledgeStatusItems} unit="件" />
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-on-surface-variant">
          進捗状況は、市長本人の公表資料・延岡市の公開資料に基づく分類であり、当サイト独自の達成率評価ではありません。
        </p>
        {/* Phase197：単独で置かれた導線リンクは文章の一部ではないため、
            inline-flex＋min-h-11で44pxのタップ領域を確保する（表示文字は変えない）。 */}
        <Link to="/mayor/policy-progress" className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline">
          市長公約の進捗状況を詳しく見る
        </Link>
      </SectionCard>

      {/* Phase203：「公式資料を確認できている直近の会期」と「これから開催される会期」は
          別物のため、同じ見出しにまとめず、状態を明記して分けて表示する。
          会期名・件数・日付はすべて既存データ（councilSessions.json／generalQuestions.json）から取得する。 */}
      <SectionCard title="会期・委員会">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={LATEST_CONFIRMED_SESSION_HEADING}
            value={latestCouncilSession?.title ?? "確認中"}
            hint={`議案等審議結果などの公式資料を確認できている、いちばん新しい会期です（状態：${councilSessionPhaseLabels.completed}）。`}
            compact
          />
          <StatCard label="会期区分" value={latestCouncilSession?.sessionType ?? "確認中"} compact />
          <StatCard
            label="この会期の登録議案数"
            value={latestSessionBills.length}
            unit="件"
            hint={`うち議決結果が確認できた件数：${latestSessionBillsWithResult}件`}
          />
          <StatCard
            label="常任・特別委員会数"
            value={councilCommittees.length}
            unit="委員会"
            hint="議会運営委員会を含みます。予算・決算審査特別委員会等、会期ごとに設置される臨時の委員会は含みません。"
          />
        </div>
        {latestCouncilSession && questionStats.completedScheduledSessions.some((s) => s.sessionId === latestCouncilSession.id) && (
          <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
            {latestCouncilSession.title}は議決結果を確認済みですが、会議録本文はまだ公開されていません。この会期の一般質問は、質問通告書に基づく予定内容として掲載しています。
          </p>
        )}
        <UpcomingSessionsNotice sessions={questionStats.upcomingScheduledSessions} className="mt-4" />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {/* Phase197：折り返し行に並ぶ独立した導線リンク。44pxのタップ領域を確保する。 */}
          {latestCouncilSession && (
            <Link
              to={`/council-documents/${latestCouncilSession.id}`}
              className="inline-flex min-h-11 items-center text-primary underline"
            >
              この会期の資料を見る
            </Link>
          )}
          <Link to="/committees" className="inline-flex min-h-11 items-center text-primary underline">
            委員会の一覧を見る
          </Link>
        </div>
      </SectionCard>

      {(latestDecidedBillDisplay || latestConfirmedQuestionDisplay) && (
        <SectionCard title="最近の動き">
          <ul className="space-y-2">
            {latestDecidedBillDisplay && (
              <li className="rounded-xl bg-surface-container-low p-3.5 shadow-e1 sm:p-4">
                <Link to={latestDecidedBillDisplay.href} className="block rounded-lg">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span>{formatJapaneseDate(latestDecidedBillDisplay.date)}</span>
                    <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
                      議案
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-on-surface">
                    {latestDecidedBillDisplay.title}（{latestDecidedBillDisplay.result}）
                  </p>
                </Link>
              </li>
            )}
            {latestConfirmedQuestionDisplay && (
              <li className="rounded-xl bg-surface-container-low p-3.5 shadow-e1 sm:p-4">
                <Link to={latestConfirmedQuestionDisplay.href} className="block rounded-lg">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span>{formatJapaneseDate(latestConfirmedQuestionDisplay.date)}</span>
                    <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
                      一般質問
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-on-surface">
                    {latestConfirmedQuestionDisplay.name}議員（{latestConfirmedQuestionDisplay.topicsLabel}）
                  </p>
                </Link>
              </li>
            )}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
            会議録・議案審議結果として当サイトが確認できたもののうち、最も新しい日付のものです（発生順ではなく確認・登録順の場合があります）。
          </p>
        </SectionCard>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="定数" value={COUNCIL_STATUTORY_SEATS} unit="名" />
        <StatCard label="現員" value={total} unit="名" />
        <StatCard label="欠員" value={vacancySeats} unit="名" />
        <StatCard label="会派数" value={factionCount} unit="会派" hint={COUNCIL_GLOSSARY["会派"]} />
        <StatCard label="平均年齢" value={averageAge ?? "—"} unit={averageAge !== null ? "歳" : undefined} />
        <StatCard label="女性議員数" value={femaleCount} unit="名" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="一般質問（登壇・確認済み件数）"
          value={questionStats.confirmedCount}
          unit="件"
          hint={`議員1名が1回の登壇で行った質問・答弁のやり取り1回分を1件と数えています。収録済み${questionStats.collectedSessionCount}／対象${questionStats.targetSessionCount}会期`}
        />
        <StatCard
          label="質問項目数"
          value={questionStats.totalQuestionItemCount}
          unit="件"
          hint="1回の登壇（上記「登壇・確認済み件数」）で複数のテーマを質問することが多いため、内訳である質問項目数の方が多くなります。"
        />
        {questionStats.scheduledCount > 0 && (
          <StatCard
            label="会議録未公開会期の予定質問"
            value={questionStats.scheduledCount}
            unit="件"
            hint={scheduledSessionBreakdownHint(questionStats.scheduledSessions)}
          />
        )}
        {questionStats.upcomingScheduledSessions.length > 0 && (
          <StatCard
            label={UPCOMING_SESSION_HEADING}
            value={questionStats.upcomingScheduledSessions.map((s) => s.sessionName).join("、")}
            hint={`まだ開催されていない（または開催中の）会期です。上記「${LATEST_CONFIRMED_SESSION_HEADING}」とは別に数えており、議決結果・会議録はいずれも未確認です。${scheduledSessionBreakdownHint(questionStats.upcomingScheduledSessions)}`}
            compact
          />
        )}
        <StatCard label="登録済み議案数" value={totalBills} unit="件" hint={coverageHint("billVotes", totalBills)} />
        <StatCard
          label="採決情報が確認できた議案数"
          value={billsWithResult}
          unit="件"
          hint={`登録済み${totalBills}件のうち、議決結果（可決・否決等）が公式資料で確認できた件数です。`}
        />
        <StatCard
          label={`市長公約の${MAYOR_PROMISE_LEVELS.policyArea.statLabel}`}
          value={mayorPromiseCounts.policyArea}
          unit="件"
          hint={`現職市長（${mayor.name}）の${MAYOR_PROMISE_LEVELS.policyArea.label}の数です。${MAYOR_PROMISE_SCALE_NOTE}`}
        />
        <StatCard
          label={`市長公約の${MAYOR_PROMISE_LEVELS.measure.statLabel}`}
          value={mayorPromiseCounts.measure}
          unit="件"
          hint={`${MAYOR_PROMISE_LEVELS.measure.definition}${MAYOR_PROMISE_SCALE_NOTE}`}
        />
      </div>
      <GlossaryNote term={MAYOR_PROMISE_GLOSSARY.term} definition={MAYOR_PROMISE_GLOSSARY.definition} />

      {/* Phase123：市議会の構成に加え、延岡市全体の基礎データ（人口・財政）を1画面で概観できるように
          追加するセクション。数値はFinancePage（/finance）と同じfinanceDashboard.jsonを再利用し、
          データを二重管理しない。公式資料で確認できていない指標（高齢化率・出生数・死亡数・
          転入者数・転出者数）は、現時点で当サイトの収集データに存在しないため、0や架空値を
          表示せず「未収録」であることを明記するにとどめる。 */}
      <SectionCard title="延岡市の基礎データ（人口・財政）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          {finance.fiscalYearLabel}・基準日：{formatJapaneseDate(finance.referenceDate)}時点の値です。詳細な内訳・出典は
          <Link to="/finance" className="mx-1 text-primary underline">
            延岡市の財政
          </Link>
          で確認できます。
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label={`人口（${formatJapaneseDate(finance.populationTrend.latest.referenceDate)}現在）`}
            value={`${finance.populationTrend.latest.population.toLocaleString("ja-JP")}`}
            unit="人"
            compact
          />
          <StatCard
            label="一般会計総額（6月補正後）"
            value={formatOkuFromThousandYen(finance.generalAccount.totalThousandYen)}
            compact
          />
          <StatCard
            label="市税（歳入・6月補正後）"
            value={formatOkuFromThousandYen(cityTaxRevenue?.amountThousandYen)}
            compact
          />
          <StatCard
            label="基金全体（残高）"
            value={formatOkuFromThousandYen(finance.fundBalance.totalFunds.total)}
            hint={`${finance.fundBalance.totalFunds.fiscalYear}時点`}
            compact
          />
          <StatCard
            label="市債（歳入・発行予定額）"
            value={formatOkuFromThousandYen(finance.revenue.find((r) => r.label === "市債")?.amountThousandYen)}
            hint="年度末残高（ストック）ではなく、当年度に発行予定の金額（フロー）"
            compact
          />
          <StatCard
            label="経常収支比率"
            value={
              finance.financialIndicators?.currentBalanceRatioPercent != null
                ? `${finance.financialIndicators.currentBalanceRatioPercent}％`
                : "確認中"
            }
            hint={FINANCE_GLOSSARY["経常収支比率"]}
            compact
          />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-on-surface-variant">
          高齢化率・出生数・死亡数・転入者数・転出者数は、当サイトが確認できた公式資料に該当データが無いため、現時点では未収録です（0件という意味ではありません）。公式資料で確認でき次第、追加します。
        </p>
      </SectionCard>

      <SectionCard title="会派別人数">
        <GlossaryNote term="会派" definition={COUNCIL_GLOSSARY["会派"]} className="mb-3" />
        <BarList items={factionItems} />
      </SectionCard>

      <SectionCard title="男女別人数">
        <BarList items={genderItems} />
      </SectionCard>

      <SectionCard title="年齢構成">
        {(minAge !== null || maxAge !== null) && (
          <p className="mb-3 text-xs text-on-surface-variant">
            最年少 {minAge}歳／最高年齢 {maxAge}歳
          </p>
        )}
        <BarList items={ageBrackets} />
      </SectionCard>

      <SectionCard title="当選回数別人数">
        <BarList items={termBrackets} />
      </SectionCard>

      <SectionCard title="委員会別所属人数">
        <BarList items={committeeItems} />
      </SectionCard>

      <p className="px-1 text-xs text-on-surface-variant">
        以下の一般質問の内訳は、会議録本文で内容を確認済みの累計{questionStats.confirmedCount}件（対象
        {questionStats.targetSessionCount}会期中、収録済み{questionStats.collectedSessionCount}会期分）が対象です。
        会議録が未公開の会期の予定質問（{questionStats.scheduledCount}件）は含みません。その内訳は、開催済みで会議録の公開を待っている会期が
        {questionStats.completedScheduledCount}件、{UPCOMING_SESSION_HEADING}が{questionStats.upcomingScheduledCount}件です。
      </p>

      <SectionCard title="議員別一般質問確認件数（上位10名・確認済み分）">
        {questionRankingItems.length > 0 ? (
          <>
            <BarList items={questionRankingItems} unit="件" />
            <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
              件数は会議録で確認できた一般質問の集計であり、議員の能力・評価を示すものではありません。
            </p>
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">現在、公開資料を確認しながら順次追加しています。</p>
        )}
      </SectionCard>

      <SectionCard title="一般質問 テーマ別件数">
        {questionThemeItems.length > 0 ? (
          <BarList items={questionThemeItems} unit="件" />
        ) : (
          <p className="text-sm text-on-surface-variant">現在、公開資料を確認しながら順次追加しています。</p>
        )}
      </SectionCard>

      <SectionCard title="一般質問 年度別件数">
        {questionYearItems.length > 0 ? (
          <BarList items={questionYearItems} unit="件" />
        ) : (
          <p className="text-sm text-on-surface-variant">現在、公開資料を確認しながら順次追加しています。</p>
        )}
      </SectionCard>

      <SectionCard title="一般質問 会派別件数">
        {questionFactionItems.length > 0 ? (
          <BarList items={questionFactionItems} unit="件" />
        ) : (
          <p className="text-sm text-on-surface-variant">現在、公開資料を確認しながら順次追加しています。</p>
        )}
      </SectionCard>

      <SectionCard title="情報入力状況">
        <div className="space-y-4">
          <ProgressStat label="顔写真あり" count={completion.photo} total={total} />
          <ProgressStat label="プロフィール入力済み" count={completion.profile} total={total} />
          <ProgressStat label="公式プロフィールURLあり" count={completion.profileUrl} total={total} />
          <ProgressStat label="SNSあり" count={completion.sns} total={total} />
          <ProgressStat label="一般質問あり" count={completion.questions} total={total} />
          <ProgressStat label="議案賛否あり" count={completion.votes} total={total} />
          <ProgressStat label="活動レポートあり" count={completion.reports} total={total} />
        </div>
      </SectionCard>

      <LastUpdated />
    </div>
  );
}
