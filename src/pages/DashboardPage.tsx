import { useMemo } from "react";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import mayorData from "../data/mayor.json";
import generalQuestionsData from "../data/generalQuestions.json";
import billVotesData from "../data/billVotes.json";
import councilSessionsData from "../data/councilSessions.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import financeData from "../data/financeDashboard.json";
import type {
  CouncilMember,
  Gender,
  Mayor,
  GeneralQuestionItem,
  BillVoteItem,
  CouncilSession,
  CouncilSpeechSummaryData,
  FormerMember,
  FinanceDashboardData,
} from "../types";
import { getFaction } from "../lib/factions";
import { COUNCIL_STATUTORY_SEATS } from "../lib/constants";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
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
} from "../lib/generalQuestionStats";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const mayor = mayorData as Mayor;
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const billVotes = publicBills(billVotesData as BillVoteItem[]);
const councilSessions = councilSessionsData as CouncilSession[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const finance = financeData as FinanceDashboardData;
const questionStats = calculateGeneralQuestionStats(speechSummaryData.members, generalQuestions);
const confirmedQuestionMemberIds = new Set(
  questionLikeSpeeches(allPublicSpeeches(speechSummaryData.members)).map((s) => s.memberId),
);

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

  const totalPledges = mayor.pledges.length;
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
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChartBarIcon className="h-4 w-4" />
          延岡市の財政を見る
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="定数" value={COUNCIL_STATUTORY_SEATS} unit="名" />
        <StatCard label="現員" value={total} unit="名" />
        <StatCard label="欠員" value={vacancySeats} unit="名" />
        <StatCard label="会派数" value={factionCount} unit="会派" />
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
            hint={questionStats.scheduledSessions
              .map((s) => `${s.sessionName}：${s.count}件／質問通告書ベース${s.newsletterConfirmed ? "（市議会だよりで開催確認済み）" : ""}`)
              .join("　")}
          />
        )}
        <StatCard label="登録済み議案数" value={totalBills} unit="件" hint={coverageHint("billVotes", totalBills)} />
        <StatCard label="採決情報が確認できた議案数" value={billsWithResult} unit="件" />
        <StatCard label="市長公約の登録数" value={totalPledges} unit="件" />
      </div>

      {/* Phase123：市議会の構成に加え、延岡市全体の基礎データ（人口・財政）を1画面で概観できるように
          追加するセクション。数値はFinancePage（/finance）と同じfinanceDashboard.jsonを再利用し、
          データを二重管理しない。公式資料で確認できていない指標（高齢化率・出生数・死亡数・
          転入者数・転出者数）は、現時点で当サイトの収集データに存在しないため、0や架空値を
          表示せず「未収録」であることを明記するにとどめる。 */}
      <SectionCard title="延岡市の基礎データ（人口・財政）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          {finance.fiscalYearLabel}・基準日：{formatJapaneseDate(finance.referenceDate)}時点の値です。詳細な内訳・出典は
          <Link to="/finance" className="mx-1 text-primary hover:underline">
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
            compact
          />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-on-surface-variant">
          高齢化率・出生数・死亡数・転入者数・転出者数は、当サイトが確認できた公式資料に該当データが無いため、現時点では未収録です（0件という意味ではありません）。公式資料で確認でき次第、追加します。
        </p>
      </SectionCard>

      <SectionCard title="会派別人数">
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
        会議録が未公開の会期の予定質問（{questionStats.scheduledCount}件）は含みません。
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
