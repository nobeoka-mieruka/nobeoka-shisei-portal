import { Link, useParams } from "react-router-dom";
import membersData from "../data/members.json";
import generalQuestionsData from "../data/generalQuestions.json";
import billVotesData from "../data/billVotes.json";
import type { CouncilMember, GeneralQuestionItem, BillVoteItem } from "../types";
import { getFaction } from "../lib/factions";
import { Avatar } from "../components/Avatar";
import { FactionChip } from "../components/FactionChip";
import { SnsLinks } from "../components/SnsLinks";
import { SectionCard } from "../components/SectionCard";
import { BackLink } from "../components/BackLink";
import { EmptyState } from "../components/EmptyState";
import { VotingRecordsSection } from "../components/VotingRecordsSection";
import { SourceList } from "../components/SourceList";
import { LastUpdatedInfo } from "../components/LastUpdatedInfo";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { BillVoteBadge } from "../components/bills/BillVoteBadge";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { GlobeIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate, SITE_URL } from "../config/site";
import { memberOgImage } from "../lib/ogImage";

const members = membersData as CouncilMember[];
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const billVotes = billVotesData as BillVoteItem[];

const PLACEHOLDER_PROFILE = "情報確認中";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const member = members.find((m) => m.id === id);

  const memberQuestions = member
    ? generalQuestions
        .filter((q) => q.memberId === member.id)
        .sort((a, b) => b.questionDate.localeCompare(a.questionDate))
    : [];
  const memberAllBillVotes = member
    ? billVotes
        .filter((b) => b.memberVotes.some((v) => v.memberId === member.id))
        .sort((a, b) => (b.votingDate ?? "").localeCompare(a.votingDate ?? ""))
    : [];
  const memberBillVotes = memberAllBillVotes.slice(0, 5);
  const memberVoteCounts = member
    ? memberAllBillVotes.reduce(
        (acc, b) => {
          const vote = b.memberVotes.find((v) => v.memberId === member.id)!.vote;
          acc[vote] = (acc[vote] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      )
    : {};

  const titleParts = ["プロフィール"];
  if (memberQuestions.length > 0) titleParts.push("一般質問");
  if (memberBillVotes.length > 0) titleParts.push("議案賛否");

  const descriptionParts = ["プロフィール", "所属会派", "所属委員会"];
  if (memberQuestions.length > 0) descriptionParts.push("一般質問");
  if (memberBillVotes.length > 0) descriptionParts.push("議案別の賛否");

  usePageTitle(
    member
      ? {
          title: `${member.name}議員｜${titleParts.join("・")}`,
          description: `延岡市議会議員${member.name}氏の${descriptionParts.join("、")}などを掲載しています。`,
          image: memberOgImage(member.id),
        }
      : { title: "議員情報", noindex: true },
  );

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
  const mainThemes = Array.from(new Set(memberQuestions.flatMap((q) => q.topics)));
  const latestQuestions = memberQuestions.slice(0, 3);

  const verifiedSns = member.sns.filter((s) => s.verificationStatus === "verified").map((s) => s.url);
  const sameAs = [...(member.profileUrl ? [member.profileUrl] : []), ...verifiedSns];

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <JsonLd
        id="person-jsonld"
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: member.name,
          url: `${SITE_URL}/members/${member.id}`,
          ...(sameAs.length > 0 ? { sameAs } : {}),
          memberOf: { "@type": "Organization", name: "延岡市議会" },
        }}
      />
      <BackLink to="/" label="議員一覧に戻る" />
      <Breadcrumbs
        items={[{ label: "ホーム", to: "/" }, { label: "議員一覧", to: "/" }, { label: member.name }]}
      />

      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar name={member.name} photoUrl={member.photoUrl} color={faction.color} size="xl" loading="eager" />
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
        <SnsLinks links={member.sns} className="mt-4" />
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

      <SectionCard title="一般質問">
        {memberQuestions.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-surface-container-high p-3">
                <p className="text-xs text-on-surface-variant">登録件数</p>
                <p className="mt-1 text-lg font-semibold text-on-surface">{memberQuestions.length}件</p>
              </div>
              <div className="rounded-lg bg-surface-container-high p-3">
                <p className="text-xs text-on-surface-variant">最新の質問日</p>
                <p className="mt-1 text-lg font-semibold text-on-surface">
                  {formatJapaneseDate(memberQuestions[0].questionDate)}
                </p>
              </div>
              {mainThemes.length > 0 && (
                <div className="col-span-2 rounded-lg bg-surface-container-high p-3 sm:col-span-1">
                  <p className="text-xs text-on-surface-variant">主なテーマ</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {mainThemes.slice(0, 4).map((t) => (
                      <span key={t} className="rounded-full bg-surface-container-lowest px-2 py-0.5 text-xs text-on-surface-variant">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ul className="mt-3 space-y-2">
              {latestQuestions.map((q) => (
                <li key={q.id} className="rounded-lg border border-outline-variant p-3">
                  <p className="text-xs text-on-surface-variant">
                    {formatJapaneseDate(q.questionDate)}／{q.sessionName}
                  </p>
                  <p className="mt-1 text-sm font-medium text-on-surface">{q.title}</p>
                </li>
              ))}
            </ul>

            <Link
              to={`/questions?member=${member.id}`}
              className={`mt-3 inline-block text-sm font-medium text-primary hover:underline ${linkClass}`}
            >
              この議員の一般質問をすべて見る
            </Link>
          </>
        ) : (
          <EmptyState message="現在登録されている一般質問データはありません。" />
        )}
      </SectionCard>

      <VotingRecordsSection votes={member.votes} />

      <SectionCard title="議案の賛否">
        {memberAllBillVotes.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-surface-container-high p-3">
                <p className="text-xs text-on-surface-variant">賛成件数</p>
                <p className="mt-1 text-lg font-semibold text-on-surface">{memberVoteCounts.approve ?? 0}件</p>
              </div>
              <div className="rounded-lg bg-surface-container-high p-3">
                <p className="text-xs text-on-surface-variant">反対件数</p>
                <p className="mt-1 text-lg font-semibold text-on-surface">{memberVoteCounts.oppose ?? 0}件</p>
              </div>
              <div className="rounded-lg bg-surface-container-high p-3">
                <p className="text-xs text-on-surface-variant">退席件数</p>
                <p className="mt-1 text-lg font-semibold text-on-surface">{memberVoteCounts.abstain ?? 0}件</p>
              </div>
              <div className="rounded-lg bg-surface-container-high p-3">
                <p className="text-xs text-on-surface-variant">欠席件数</p>
                <p className="mt-1 text-lg font-semibold text-on-surface">{memberVoteCounts.absent ?? 0}件</p>
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              {memberBillVotes.map((bill) => {
                const vote = bill.memberVotes.find((v) => v.memberId === member.id)!;
                return (
                  <li key={bill.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3">
                    <Link
                      to={`/bills/votes/${bill.id}`}
                      className={`min-w-0 flex-1 text-sm font-medium text-primary hover:underline ${linkClass}`}
                    >
                      {bill.billTitle}
                    </Link>
                    <BillVoteBadge vote={vote.vote} />
                  </li>
                );
              })}
            </ul>

            {memberAllBillVotes.length > memberBillVotes.length && (
              <Link
                to="/bills/votes"
                className={`mt-3 inline-block text-sm font-medium text-primary hover:underline ${linkClass}`}
              >
                議案を見る（すべての議案一覧へ）
              </Link>
            )}
          </>
        ) : (
          <EmptyState message="現在、公開資料を確認しながら順次追加しています。" />
        )}
      </SectionCard>

      {member.reports.length > 0 && (
        <SectionCard title={`活動レポート（${member.reports.length}件）`}>
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
        </SectionCard>
      )}

      {member.sources && member.sources.length > 0 && (
        <SectionCard title="出典・参考資料">
          <SourceList sources={member.sources} />
        </SectionCard>
      )}

      <LastUpdatedInfo verifiedAt={member.verifiedAt} updatedAt={member.updatedAt} className="px-1" />
      <LastUpdated className="px-1" />

      <CorrectionRequestButton pageName={member.name} />
    </div>
  );
}
