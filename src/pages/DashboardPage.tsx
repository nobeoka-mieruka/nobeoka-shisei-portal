import { useMemo } from "react";
import membersData from "../data/members.json";
import type { CouncilMember } from "../types";
import { getFaction } from "../lib/factions";
import { COUNCIL_STATUTORY_SEATS } from "../lib/constants";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { BarList, type BarListItem } from "../components/dashboard/BarList";
import { ProgressStat } from "../components/dashboard/ProgressStat";

const members = membersData as CouncilMember[];

const PLACEHOLDER_PROFILE = "情報確認中";

/** Strips committee-officer suffixes (委員長 / 副委員長) and normalizes incidental
 * whitespace so the same committee isn't split into multiple bars by formatting
 * differences. The underlying data in members.json is never modified. */
function normalizeCommitteeName(committee: string): string {
  return committee.replace(/（(?:委員長|副委員長)）$/, "").replace(/\s+/g, "").trim();
}

export function DashboardPage() {
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
    const photo = members.filter((m) => !!m.photoUrl).length;
    const profile = members.filter((m) => m.profile && m.profile !== PLACEHOLDER_PROFILE).length;
    const profileUrl = members.filter((m) => !!m.profileUrl).length;
    const sns = members.filter((m) => m.sns.length > 0).length;
    const questions = members.filter((m) => m.questions.length > 0).length;
    const votes = members.filter((m) => m.votes.length > 0).length;
    const reports = members.filter((m) => m.reports.length > 0).length;
    return { photo, profile, profileUrl, sns, questions, votes, reports };
  }, []);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">ダッシュボード</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">現員{total}名の構成をひと目で確認できます。</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="定数" value={COUNCIL_STATUTORY_SEATS} unit="名" />
        <StatCard label="現員" value={total} unit="名" />
        <StatCard label="欠員" value={vacancySeats} unit="名" />
        <StatCard label="会派数" value={factionCount} unit="会派" />
        <StatCard label="平均年齢" value={averageAge ?? "—"} unit={averageAge !== null ? "歳" : undefined} />
        <StatCard label="女性議員数" value={femaleCount} unit="名" />
      </div>

      <SectionCard title="会派別人数">
        <BarList items={factionItems} />
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
    </div>
  );
}
