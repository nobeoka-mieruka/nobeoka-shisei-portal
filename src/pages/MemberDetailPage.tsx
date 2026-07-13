import { useParams } from "react-router-dom";
import membersData from "../data/members.json";
import type { CouncilMember } from "../types";
import { getFaction } from "../lib/factions";
import { Avatar } from "../components/Avatar";
import { FactionChip } from "../components/FactionChip";
import { SnsLinks } from "../components/SnsLinks";
import { SectionCard } from "../components/SectionCard";
import { BackLink } from "../components/BackLink";
import { VoteResultBadge } from "../components/VoteResultBadge";
import { EmptyState } from "../components/EmptyState";
import { PlayIcon, GlobeIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";

const members = membersData as CouncilMember[];

const PLACEHOLDER_PROFILE = "情報確認中";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const member = members.find((m) => m.id === id);

  usePageTitle(member ? member.name : "議員情報");

  if (!member) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <BackLink to="/" label="議員一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          議員情報が見つかりませんでした。
        </p>
      </div>
    );
  }

  const faction = getFaction(member.factionId);
  const isProfileConfirmed = member.profile !== PLACEHOLDER_PROFILE;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <BackLink to="/" label="議員一覧に戻る" />

      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar name={member.name} photoUrl={member.photoUrl} color={faction.color} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-on-surface">{member.name}</h1>
            <p className="text-sm text-on-surface-variant">{member.nameKana}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <FactionChip faction={faction} size="md" />
              {member.termCount && (
                <span className="text-sm text-on-surface-variant">当選{member.termCount}回</span>
              )}
              {member.age && (
                <span className="text-sm text-on-surface-variant">
                  {member.age}歳
                  {member.ageAsOf && <span className="text-xs">（{member.ageAsOf}）</span>}
                </span>
              )}
            </div>
          </div>
        </div>

        {isProfileConfirmed ? (
          <p className="mt-4 text-sm leading-relaxed text-on-surface">{member.profile}</p>
        ) : (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1.5 text-xs text-on-surface-variant">
            プロフィールは情報確認中です
          </p>
        )}

        {member.profileUrl && (
          <a
            href={member.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.name}の公式プロフィールを新しいタブで開く`}
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${linkClass}`}
          >
            <GlobeIcon className="h-4 w-4" />
            公式プロフィール
          </a>
        )}
        {member.sns.length > 0 && <SnsLinks links={member.sns} className="mt-4" />}
      </section>

      <SectionCard title="所属委員会">
        {member.committees.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {member.committees.map((committee) => (
              <span
                key={committee}
                className="rounded-full bg-surface-container-high px-3 py-1 text-sm text-on-surface-variant"
              >
                {committee}
              </span>
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </SectionCard>

      <SectionCard title={`一般質問一覧（${member.questions.length}件）`}>
        {member.questions.length > 0 ? (
          <ul className="space-y-3">
            {member.questions.map((q) => (
              <li key={q.id} className="rounded-lg border border-outline-variant p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                  <span>{q.date}</span>
                  <span aria-hidden>・</span>
                  <span>{q.session}</span>
                </div>
                <p className="mt-1 font-medium text-on-surface">{q.title}</p>
                {q.summary && <p className="mt-1 text-sm text-on-surface-variant">{q.summary}</p>}
                {q.videoUrl && (
                  <a
                    href={q.videoUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${q.title}の質問動画を新しいタブで開く`}
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-3 py-1.5 text-xs font-medium text-on-tertiary-container transition hover:opacity-90 ${linkClass}`}
                  >
                    <PlayIcon className="h-4 w-4" />
                    質問動画を見る
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </SectionCard>

      <SectionCard title={`議案賛否一覧（${member.votes.length}件）`}>
        {member.votes.length > 0 ? (
          <ul className="space-y-2">
            {member.votes.map((v) => (
              <li
                key={v.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span>{v.date}</span>
                    <span aria-hidden>・</span>
                    <span>{v.session}</span>
                    {v.billNumber && (
                      <>
                        <span aria-hidden>・</span>
                        <span>{v.billNumber}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-on-surface">{v.billName}</p>
                  {v.note && <p className="mt-1 text-xs text-on-surface-variant">{v.note}</p>}
                </div>
                <VoteResultBadge result={v.result} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </SectionCard>

      <SectionCard title={`活動レポート（${member.reports.length}件）`}>
        {member.reports.length > 0 ? (
          <ul className="space-y-3">
            {member.reports.map((r) => (
              <li key={r.id} className="rounded-lg border border-outline-variant p-3">
                <div className="text-xs text-on-surface-variant">{r.date}</div>
                <p className="mt-1 font-medium text-on-surface">{r.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{r.body}</p>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${r.title}の詳細を新しいタブで開く`}
                    className={`mt-2 inline-block text-sm font-medium text-primary hover:underline ${linkClass}`}
                  >
                    詳しく見る
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </SectionCard>
    </div>
  );
}
