import { useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import membersData from "../data/members.json";
import formerMembersData from "../data/formerMembers.json";
import generalQuestionsData from "../data/generalQuestions.json";
import billVotesData from "../data/billVotes.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import memberSpeechAnalysisData from "../data/memberSpeechAnalysis.json";
import councilSessionsData from "../data/councilSessions.json";
import type {
  BillCategory,
  CouncilMember,
  FormerMember,
  GeneralQuestionItem,
  BillVoteItem,
  CouncilSpeechSummaryData,
  MemberSpeechAnalysisData,
  CouncilSession,
} from "../types";
import { getFaction } from "../lib/factions";
import {
  findMemberSpeechRecord,
  publicSpeeches,
  currentTermPublicSpeeches,
  aggregateMemberTopics,
  aggregateYearlySpeechCounts,
  findMemberSpeechAnalysis,
} from "../lib/councilSpeeches";
import { SpeechSummaryStatusBadge } from "../components/council/SpeechSummaryStatusBadge";
import { QuestionTopicChart } from "../components/council/QuestionTopicChart";
import { YearlySpeechTrendChart } from "../components/council/YearlySpeechTrendChart";
import { MemberSpeechAnalysisStatusBadge } from "../components/council/MemberSpeechAnalysisStatusBadge";
import { ActivityRadarSection } from "../components/council/ActivityRadarSection";
import {
  calculateAttendanceIndex,
  calculateInformationDisclosureIndex,
  calculateProposalActivityIndex,
  calculateQuestionActivityIndex,
  calculateSpeechActivityIndex,
  calculateVotingDisclosureIndex,
  eligibleSessionIdsFor,
} from "../lib/activityRadar";
import { councilSpeechPeriod } from "../config/councilSpeechPeriod";
import { Avatar } from "../components/Avatar";
import { FactionChip } from "../components/FactionChip";
import { SnsLinks } from "../components/SnsLinks";
import { SectionCard } from "../components/SectionCard";
import { BackLink } from "../components/BackLink";
import { EmptyState } from "../components/EmptyState";
import { FilterSelect } from "../components/FilterSelect";
import { VotingRecordsSection } from "../components/VotingRecordsSection";
import { publicBills } from "../lib/billVotes";
import { SourceList } from "../components/SourceList";
import { LastUpdatedInfo } from "../components/LastUpdatedInfo";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { BillVoteBadge } from "../components/bills/BillVoteBadge";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { GlobeIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";
import { buildCompareSearchParams } from "../lib/archiveCompare";
import { personSlug } from "../lib/people";

const members = membersData as CouncilMember[];
const formerMembers = formerMembersData as FormerMember[];
const councilSessions = councilSessionsData as CouncilSession[];
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];
const billVotes = publicBills(billVotesData as BillVoteItem[]);
// 議員別の賛否内訳（memberVotes）が1件でも登録されている議案数。現時点では全議案で0件のため、
// レーダーチャートの「議案等の意思表示」は全議員で対象記録なし（missing）として扱われる
// （議員個人が非公開なのではなく、サイト側にこのデータがまだ収録されていないため）。
const billsWithAnyMemberVoteDisclosed = billVotes.filter((b) => b.memberVotes.length > 0).length;
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const memberSpeechAnalysisList = (memberSpeechAnalysisData as MemberSpeechAnalysisData).members;
// councilSessions.jsonは既に「現在の議員任期（令和5年5月〜）」の会期のみを収録しているため、
// 収録対象期間（councilSpeechPeriod.from）より前の会期は構造上含まれていない。
const allSessionIdsInPeriod = (councilSessionsData as CouncilSession[]).map((s) => s.id);

const PLACEHOLDER_PROFILE = "情報確認中";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const member = members.find((m) => m.id === id);
  const formerMember = !member ? formerMembers.find((m) => m.id === id) : undefined;
  const seo = getSeoForPath(location.pathname);
  const selectedTopic = searchParams.get("questionTopic") ?? "";

  const setSelectedTopic = (topic: string) => {
    const next = new URLSearchParams(searchParams);
    if (topic) next.set("questionTopic", topic);
    else next.delete("questionTopic");
    setSearchParams(next, { replace: true });
  };

  const memberQuestions = member
    ? generalQuestions
        .filter((q) => q.memberId === member.id)
        .sort((a, b) => b.questionDate.localeCompare(a.questionDate))
    : [];
  const speechRecord = member ? findMemberSpeechRecord(speechSummaryData.members, member.id) : undefined;
  const publishedMemberSpeeches = publicSpeeches(speechRecord);
  const topicAggregates = useMemo(() => aggregateMemberTopics(publishedMemberSpeeches), [publishedMemberSpeeches]);
  const yearlyCounts = useMemo(
    () => aggregateYearlySpeechCounts(publishedMemberSpeeches, allSessionIdsInPeriod),
    [publishedMemberSpeeches],
  );
  const hasPendingSpeech = publishedMemberSpeeches.some((s) => s.summaryStatus !== "verified");
  const displayedSpeeches = selectedTopic
    ? publishedMemberSpeeches.filter((s) => s.topics.includes(selectedTopic))
    : publishedMemberSpeeches;
  const memberAnalysis = member ? findMemberSpeechAnalysis(memberSpeechAnalysisList, member.id) : undefined;
  const memberAllBillVotes = member
    ? billVotes
        .filter((b) => b.memberVotes.some((v) => v.memberId === member.id))
        .sort((a, b) => (b.votingDate ?? "").localeCompare(a.votingDate ?? ""))
    : [];
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

  const [voteYearFilter, setVoteYearFilter] = useState("all");
  const [voteCategoryFilter, setVoteCategoryFilter] = useState("all");

  const voteYearOptions = useMemo(
    () => Array.from(new Set(memberAllBillVotes.map((b) => b.fiscalYear))).sort((a, b) => b.localeCompare(a, "ja")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [member?.id],
  );
  const voteCategoryOptions = useMemo(
    () =>
      Array.from(new Set(memberAllBillVotes.map((b) => b.category).filter((c): c is BillCategory => !!c))).sort((a, b) =>
        a.localeCompare(b, "ja"),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [member?.id],
  );
  const memberBillVotes = memberAllBillVotes.filter(
    (b) =>
      (voteYearFilter === "all" || b.fiscalYear === voteYearFilter) &&
      (voteCategoryFilter === "all" || b.category === voteCategoryFilter),
  );

  usePageTitle();

  if (formerMember) {
    const formerSpeechRecord = findMemberSpeechRecord(speechSummaryData.members, formerMember.id);
    const formerSpeeches = publicSpeeches(formerSpeechRecord);
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <Breadcrumbs items={seo.breadcrumbs} />
        <BackLink to="/" label="議員一覧に戻る" />
        <div className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
          <span className="rounded-full bg-surface-container-lowest px-2.5 py-0.5 text-xs font-semibold text-on-surface">
            元議員（現職ではありません）
          </span>
          <h1 className="mt-2 text-2xl font-semibold text-on-surface">{formerMember.name}</h1>
          <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{formerMember.note}</p>
          {formerMember.sourceNote && (
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{formerMember.sourceNote}</p>
          )}
          {formerMember.lastVerified && (
            <p className="mt-2 text-xs text-on-surface-variant">確認日：{formatJapaneseDate(formerMember.lastVerified)}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/compare/members?${buildCompareSearchParams([personSlug("former-member", formerMember.id)]).toString()}`}
              className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
            >
              この議員を比較
            </Link>
            {formerMember.servedSessions[0] && (
              <Link
                to={`/timeline/${formerMember.servedSessions[0].slice(0, 4)}`}
                className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
              >
                年表で見る
              </Link>
            )}
          </div>
        </div>

        <SectionCard title="在職当時の一般質問・発言記録">
          {formerSpeeches.length === 0 ? (
            <p className="text-sm text-on-surface-variant">公開している発言記録はまだありません。</p>
          ) : (
            <ul className="space-y-2">
              {formerSpeeches.map((s) => {
                const session = councilSessions.find((cs) => cs.id === s.sessionId);
                return (
                  <li key={s.id}>
                    <Link
                      to={`/members/${formerMember.id}/questions/${s.id}`}
                      className={`block rounded-lg bg-surface-container-high p-3 text-sm text-primary hover:underline ${linkClass}`}
                    >
                      {session?.title ?? s.sessionId}
                      {s.date && `（${formatJapaneseDate(s.date)}）`}の{s.speechType}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
          この人物は現職議員ではないため、現職議員一覧・報酬比較の対象には含まれません。議員比較（`/compare/members`）では現職議員と横断して比較できます。当時（在職していた会期）の一般質問記録のみ、過去の議会活動の記録として掲載しています。
        </p>
      </div>
    );
  }

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

  // 議会活動データ（レーダーチャート）。議員の能力・優劣を示すものではなく、
  // 公開データの共通基準による指数化であることをコンポーネント側でも明示している。
  // 旧任期の発言（speech.term:"previous"、TASK-005系）を現職memberIdへ追加した場合でも、
  // 現任期のみを対象とする指数を汚染しないよう、currentTermPublicSpeechesで明示的に絞り込む。
  const radarEligibleSessions = eligibleSessionIdsFor({ isFormerMember: false });
  const currentTermSpeechesForRadar = currentTermPublicSpeeches(speechRecord);
  const radarMetrics = [
    calculateQuestionActivityIndex(currentTermSpeechesForRadar, radarEligibleSessions, member.updatedAt ?? member.verifiedAt),
    calculateSpeechActivityIndex(currentTermSpeechesForRadar, radarEligibleSessions, member.updatedAt ?? member.verifiedAt),
    calculateAttendanceIndex(),
    calculateVotingDisclosureIndex(memberAllBillVotes.length, billsWithAnyMemberVoteDisclosed),
    calculateProposalActivityIndex(),
    calculateInformationDisclosureIndex(
      [
        { label: "経歴", filled: isProfileConfirmed },
        { label: "所属会派", filled: !!member.factionId },
        { label: "所属委員会", filled: member.committees.length > 0 },
        { label: "当選回数", filled: !!member.termCount },
        { label: "公式ページ", filled: !!member.profileUrl },
        { label: "SNS", filled: member.sns.length > 0 },
        { label: "一般質問履歴", filled: memberQuestions.length > 0 || publishedMemberSpeeches.length > 0 },
        { label: "議案賛否履歴", filled: memberAllBillVotes.length > 0 },
      ],
      member.updatedAt ?? member.verifiedAt,
    ),
  ];

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <BackLink to="/" label="議員一覧に戻る" />
      <Breadcrumbs items={seo.breadcrumbs} />

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
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-on-surface">{member.profile}</p>
        ) : (
          <div className="mt-4 rounded-xl bg-surface-container-high p-4">
            <p className="text-sm font-medium text-on-surface">
              {member.profileUrl ? "プロフィール未掲載" : "プロフィールを作成中です"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
              公開資料を基にプロフィールを整理しています。詳しくは公式プロフィールをご覧ください。
            </p>
          </div>
        )}

        {member.profileUrl && (
          <a
            href={member.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.name}の公式プロフィールを新しいタブで開く`}
            className={`mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-primary-container px-4 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${linkClass}`}
          >
            <GlobeIcon className="h-4 w-4" />
            {isProfileConfirmed ? "公式プロフィール" : "公式プロフィールを見る"}
          </a>
        )}
        <SnsLinks links={member.sns} className="mt-4" />

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to={`/compare/members?${buildCompareSearchParams([personSlug("member", member.id)]).toString()}`}
            className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
          >
            この議員を比較
          </Link>
          <Link
            to="/timeline"
            className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
          >
            年表で見る
          </Link>
        </div>
      </section>

      <ActivityRadarSection
        metrics={radarMetrics}
        targetPeriodLabel="令和5年6月〜令和8年3月定例会（会議録取得済みの会期）"
        updatedAt={member.updatedAt ?? member.verifiedAt}
      />

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
        <p className="text-xs leading-relaxed text-on-surface-variant">
          質問通告書等に掲載された予定質問項目を基に整理しています。実際の発言内容や答弁は公式会議録をご確認ください。
        </p>
        {memberQuestions.length > 0 ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
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

        <div className="mt-4 border-t border-outline-variant pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-on-surface">一般質問・質疑の要約</h3>
            {publishedMemberSpeeches.length === 0 && <SpeechSummaryStatusBadge status="minutes-not-fetched" />}
          </div>
          {publishedMemberSpeeches.length > 0 ? (
            <>
              <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
                延岡市議会が公開している公式会議録を基に、本会議で行われた質問や質疑と、市長・部長・教育長等の答弁をAIで中立的に要約しています。議員や答弁内容への評価・論評は加えていません。正式な発言内容は、各項目の公式会議録をご確認ください。
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                収録対象：令和5年5月15日（令和5年第1回臨時会、現在の議員任期における最初の本会議）以降に開催された本会議
              </p>

              {speechRecord && (
                <div className="mt-3 rounded-lg bg-surface-container-high p-3">
                  <p className="text-xs font-medium text-on-surface">収録・解析状況</p>
                  <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-on-surface-variant sm:grid-cols-3">
                    <div>
                      <dt className="inline">解析済み：</dt>
                      <dd className="inline text-on-surface">{speechRecord.analyzedSessionCount}会期</dd>
                    </div>
                    <div>
                      <dt className="inline">質問・質疑を確認：</dt>
                      <dd className="inline text-on-surface">{speechRecord.sessionsWithSpeechCount}会期</dd>
                    </div>
                    <div>
                      <dt className="inline">発言確認なし：</dt>
                      <dd className="inline text-on-surface">{speechRecord.sessionsWithoutSpeechCount}会期</dd>
                    </div>
                    <div>
                      <dt className="inline">未解析：</dt>
                      <dd className="inline text-on-surface">{speechRecord.unfetchedSessionCount}会期</dd>
                    </div>
                    {speechRecord.lastAnalyzedAt && (
                      <div>
                        <dt className="inline">最終解析日：</dt>
                        <dd className="inline text-on-surface">{formatJapaneseDate(speechRecord.lastAnalyzedAt)}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
                    現在解析済みの会期に基づく暫定集計です。未解析の会期は集計に含まれていません。
                  </p>
                </div>
              )}

              {memberAnalysis && memberAnalysis.analysisStatus !== "not-analyzed" && (
                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-on-surface">AIによる質問内容の分析</h4>
                    <span className="text-[11px] text-on-surface-variant">（公式会議録に基づく中立的な整理）</span>
                    <MemberSpeechAnalysisStatusBadge status={memberAnalysis.analysisStatus} />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    前回市議会議員選挙の投票日である{councilSpeechPeriod.from.slice(0, 4)}年{Number(councilSpeechPeriod.from.slice(5, 7))}月{Number(councilSpeechPeriod.from.slice(8, 10))}日以降に開催された本会議の公式会議録を基に、AIが質問テーマや取り上げ方を整理しています。議員の能力、活動量、質問の良し悪し、政治的立場を評価するものではありません。未解析の会期は分析に含まれていません。
                  </p>
                  {memberAnalysis.analysisStatus === "pending" && (
                    <p className="mt-1 text-xs text-on-surface-variant">この分析は現在確認中の暫定掲載です。</p>
                  )}

                  {memberAnalysis.analysisStatus === "insufficient-data" ? (
                    <p className="mt-2 text-sm text-on-surface-variant">
                      現在解析済みの会議録が限られているため、質問傾向の分析に必要なデータが不足しています。
                    </p>
                  ) : (
                    <>
                      {memberAnalysis.overview && (
                        <p className="mt-2 text-sm leading-relaxed text-on-surface">{memberAnalysis.overview}</p>
                      )}

                      {memberAnalysis.mainTopics.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-on-surface">主に確認されたテーマ</p>
                          <ul className="mt-1 flex flex-wrap gap-1.5">
                            {memberAnalysis.mainTopics.map((t) => (
                              <li key={t.label}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedTopic(t.label)}
                                  className={`rounded-full bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant hover:bg-surface-container-highest ${linkClass}`}
                                >
                                  {t.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1 text-[11px] text-on-surface-variant">テーマ名をクリックすると、根拠となる質問・答弁を確認できます。</p>
                        </div>
                      )}

                      {memberAnalysis.recurringTopics.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-on-surface">複数会期で確認されたテーマ</p>
                          <ul className="mt-1 space-y-0.5 text-xs text-on-surface-variant">
                            {memberAnalysis.recurringTopics.map((t) => (
                              <li key={t.label}>
                                {t.label}　{t.sessionIds.length}会期
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {memberAnalysis.questionApproaches.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-on-surface">質問の主な取り上げ方</p>
                          <ul className="mt-1 space-y-0.5 text-xs text-on-surface-variant">
                            {memberAnalysis.questionApproaches.map((a) => (
                              <li key={a.label}>・{a.label}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {memberAnalysis.answerStatusCounts.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-on-surface">市側答弁で確認された状態</p>
                          <ul className="mt-1 space-y-0.5 text-xs text-on-surface-variant">
                            {memberAnalysis.answerStatusCounts.map((a) => (
                              <li key={a.label}>
                                ・{a.label}　{a.count}件
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {memberAnalysis.limitations.length > 0 && (
                        <div className="mt-3 rounded-lg bg-surface-container-high p-3">
                          <p className="text-xs font-medium text-on-surface">分析上の注意</p>
                          <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-on-surface-variant">
                            {memberAnalysis.limitations.map((l) => (
                              <li key={l}>・{l}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {topicAggregates.length > 0 && (
                <div className="mt-4 border-t border-outline-variant pt-3">
                  <h4 className="text-sm font-semibold text-on-surface">質問テーマの傾向</h4>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    {councilSpeechPeriod.from.slice(0, 4)}年{Number(councilSpeechPeriod.from.slice(5, 7))}月{Number(councilSpeechPeriod.from.slice(8, 10))}日以降に開催された本会議のうち、解析済みの公式会議録で各テーマに関する質問・質疑が確認された会期数を表示しています。同一会期で同じテーマを複数回取り上げた場合も、1会期として数えています。質問回数、活動量、議員の優劣を示すものではありません。
                  </p>
                  {hasPendingSpeech && (
                    <p className="mt-1 text-xs text-on-surface-variant">確認待ちのAI要約を含む暫定集計です。</p>
                  )}
                  <div className="mt-2">
                    <QuestionTopicChart topics={topicAggregates} onSelectTopic={setSelectedTopic} selectedTopic={selectedTopic} />
                  </div>
                </div>
              )}

              {yearlyCounts.length > 0 && (
                <div className="mt-4 border-t border-outline-variant pt-3">
                  <h4 className="text-sm font-semibold text-on-surface">年別の質問・質疑推移</h4>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    年別の数値は、解析済みの公式本会議録で質問・質疑が確認された会期数です。未解析の会期は含まれていません。
                  </p>
                  <YearlySpeechTrendChart counts={yearlyCounts} />
                </div>
              )}

              {topicAggregates.length > 0 && (
                <div className="mt-4 border-t border-outline-variant pt-3">
                  <h4 className="text-sm font-semibold text-on-surface">質問テーマ</h4>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    公式会議録本文から確認できた質問テーマです。タグを選択すると、該当する質問・答弁だけへ絞り込めます。
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {topicAggregates.map((t) => {
                      const isSelected = selectedTopic === t.topic;
                      return (
                        <li key={t.topic}>
                          <button
                            type="button"
                            onClick={() => setSelectedTopic(isSelected ? "" : t.topic)}
                            aria-pressed={isSelected}
                            className={`rounded-full px-3 py-1.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                              isSelected
                                ? "bg-primary text-on-primary"
                                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                            }`}
                          >
                            #{t.topic}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {selectedTopic && (
                    <button
                      type="button"
                      onClick={() => setSelectedTopic("")}
                      className={`mt-2 text-xs font-medium text-primary hover:underline ${linkClass}`}
                    >
                      絞り込みを解除
                    </button>
                  )}
                </div>
              )}

              <div className="mt-4 border-t border-outline-variant pt-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-on-surface">会期別の質問・答弁要約</h4>
                {selectedTopic && (
                  <button
                    type="button"
                    onClick={() => setSelectedTopic("")}
                    className={`text-xs font-medium text-primary hover:underline ${linkClass}`}
                  >
                    「{selectedTopic}」の絞り込みを解除
                  </button>
                )}
              </div>
              {displayedSpeeches.length === 0 ? (
                <p className="mt-2 text-xs text-on-surface-variant">「{selectedTopic}」に該当する会期別の質問・答弁は見つかりませんでした。</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {displayedSpeeches.map((s) => (
                    <li key={s.id} className="rounded-lg border border-outline-variant p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-on-surface-variant">
                          {s.date ? formatJapaneseDate(s.date) : "日付確認中"}／{s.meetingType}／{s.speechType}
                        </span>
                        <SpeechSummaryStatusBadge status={s.summaryStatus} />
                      </div>
                      {s.shortSummary && <p className="mt-1 text-sm text-on-surface">{s.shortSummary}</p>}
                      {s.topics.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {s.topics.map((t) => (
                            <span key={t} className="rounded-full bg-surface-container-lowest px-2 py-0.5 text-xs text-on-surface-variant">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <Link
                        to={`/members/${member.id}/questions/${s.id}`}
                        className={`mt-2 inline-block text-sm font-medium text-primary hover:underline ${linkClass}`}
                      >
                        質問・答弁の詳細を見る
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
              公式会議録本文を基にした質問・答弁の要約は、現在準備中です。現在掲載している一般質問情報には、質問通告書等を基に整理した予定質問項目が含まれます。正式な発言内容は、延岡市議会の公式会議録をご確認ください。
            </p>
          )}
        </div>
      </SectionCard>

      <VotingRecordsSection votes={member.votes} />

      <SectionCard title="議案・表決履歴">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          延岡市議会の公式資料で、{member.name}議員の個人別表決を確認できた案件を掲載しています。個人別の賛否が公開資料で確認できない案件は含まれません（推測では補いません）。件数は事実の集計であり、議員活動の評価・順位付けを目的としたものではありません。
        </p>
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
                <p className="text-xs text-on-surface-variant">棄権件数</p>
                <p className="mt-1 text-lg font-semibold text-on-surface">{memberVoteCounts.abstained ?? 0}件</p>
              </div>
              <div className="rounded-lg bg-surface-container-high p-3">
                <p className="text-xs text-on-surface-variant">退席件数</p>
                <p className="mt-1 text-lg font-semibold text-on-surface">{memberVoteCounts.departed ?? 0}件</p>
              </div>
              <div className="rounded-lg bg-surface-container-high p-3">
                <p className="text-xs text-on-surface-variant">欠席件数</p>
                <p className="mt-1 text-lg font-semibold text-on-surface">{memberVoteCounts.absent ?? 0}件</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <FilterSelect
                label="年度"
                value={voteYearFilter}
                onChange={setVoteYearFilter}
                options={voteYearOptions.map((y) => ({ value: y, label: y }))}
              />
              <FilterSelect
                label="案件分類"
                value={voteCategoryFilter}
                onChange={setVoteCategoryFilter}
                options={voteCategoryOptions.map((c) => ({ value: c, label: c }))}
              />
            </div>

            {memberBillVotes.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {memberBillVotes.map((bill) => {
                  const vote = bill.memberVotes.find((v) => v.memberId === member.id)!;
                  return (
                    <li key={bill.id} className="rounded-lg border border-outline-variant p-3">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
                        <span>{bill.votingDate ? formatJapaneseDate(bill.votingDate) : "議決日確認中"}</span>
                        <span aria-hidden>・</span>
                        <span>{bill.session}</span>
                        <span aria-hidden>・</span>
                        <span>{bill.billNumber}</span>
                        {bill.category && (
                          <>
                            <span aria-hidden>・</span>
                            <span>{bill.category}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <Link
                          to={`/bills/votes/${bill.id}`}
                          className={`min-w-0 flex-1 text-sm font-medium text-primary hover:underline ${linkClass}`}
                        >
                          {bill.billTitle}
                        </Link>
                        <BillVoteBadge vote={vote.vote} />
                      </div>
                      <p className="mt-1 text-xs text-on-surface-variant">議会全体の結果：{bill.result}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-on-surface-variant">条件に一致する案件は見つかりませんでした。</p>
            )}
          </>
        ) : (
          <EmptyState message="延岡市議会の公式資料で、この議員の個人別表決を確認できた案件は現在ありません。個人別表決は確認できません。" />
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
