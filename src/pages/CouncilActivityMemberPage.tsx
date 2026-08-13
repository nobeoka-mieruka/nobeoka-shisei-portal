import { Link, useLocation, useParams } from "react-router-dom";
import membersData from "../data/members.json";
import type { CouncilMember } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { BackLink } from "../components/BackLink";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { Avatar } from "../components/Avatar";
import { FactionChip } from "../components/FactionChip";
import { SnsLinks } from "../components/SnsLinks";
import { ActivityRadarChart } from "../components/council/ActivityRadarChart";
import { YearlySpeechTrendChart } from "../components/council/YearlySpeechTrendChart";
import { getFaction } from "../lib/factions";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  activityTargetPeriodLabel,
  getAllCurrentMemberActivity,
  getMemberQuestionEvidence,
  getMemberVoteEvidence,
  metricByKey,
} from "../lib/councilActivityBarometer";
import { billVoteLabels, billVoteSymbols } from "../lib/billVotes";
import { committeesForMember, reportsForCommittee, billsForCommittee, committeeReportActivityForMember } from "../lib/committees";
import { formatJapaneseDate } from "../config/site";

const members = membersData as CouncilMember[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const STAR_METRICS = [
  { key: "question", label: "一般質問", unit: "%" },
  { key: "speech", label: "議会内発言", unit: "点" },
  { key: "voting", label: "議案等の意思表示", unit: "%" },
  { key: "disclosure", label: "情報発信・プロフィール充足度", unit: "%" },
  { key: "attendance", label: "出席状況", unit: "" },
  { key: "proposal", label: "請願・提案等", unit: "" },
] as const;

function StarRating({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-on-surface-variant">評価対象外（データ未収録）</span>;
  }
  const stars = Math.max(1, Math.min(5, Math.round(value / 20) || 1));
  return (
    <span aria-hidden="true" className="text-secondary">
      {"★".repeat(stars)}
      <span className="text-outline-variant">{"☆".repeat(5 - stars)}</span>
    </span>
  );
}

export function CouncilActivityMemberPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const member = members.find((m) => m.id === memberId);

  if (!member) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to="/council-activity" label="議員活動バロメーター一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された議員情報は見つかりませんでした。
        </p>
      </div>
    );
  }

  const entry = getAllCurrentMemberActivity().find((e) => e.member.id === member.id)!;
  const metrics = entry.metrics;
  const faction = getFaction(member.factionId);
  const targetPeriod = activityTargetPeriodLabel();
  const verifiedSns = member.sns.filter((s) => s.verificationStatus === "verified");
  const evidence = getMemberQuestionEvidence(member);
  const voteEvidence = getMemberVoteEvidence(member);
  const undisclosedBillCount = voteEvidence.totalBillCountSitewide - voteEvidence.disclosedBillCount;
  const memberCommittees = committeesForMember(member.id);
  const committeeReports = committeeReportActivityForMember(member.id);

  const factsSummary = [
    (() => {
      const q = metricByKey(metrics, "question");
      return q?.value !== null && q?.value !== undefined ? `一般質問実施率${Math.round(q.value)}%` : null;
    })(),
    (() => {
      const s = metricByKey(metrics, "speech");
      return s?.numerator !== undefined && s?.rawValue !== undefined ? `議会内発言（確認できた質問項目数${s.rawValue}件）` : null;
    })(),
    (() => {
      const v = metricByKey(metrics, "voting");
      return v?.numerator !== undefined ? `議案等の意思表示が確認できた議案${v.numerator}件` : null;
    })(),
    (() => {
      const d = metricByKey(metrics, "disclosure");
      return d?.numerator !== undefined ? `公式情報発信を含むプロフィール項目${d.numerator}／${d.denominator}件` : null;
    })(),
  ].filter((s): s is string => !!s);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entryLd) => (
        <JsonLd key={entryLd.id} id={entryLd.id} data={entryLd.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/council-activity" label="議員活動バロメーター一覧に戻る" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1">
          <div className="flex items-center gap-3">
            <Avatar name={member.name} photoUrl={member.photoUrl} size="lg" loading="eager" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-snug text-on-primary-container sm:text-2xl">{member.name}</h1>
              <p className="text-sm text-on-primary-container/80">{member.nameKana}</p>
              {faction && <FactionChip faction={faction} className="mt-1.5" />}
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-on-primary-container/80">
            <div>
              <dt className="inline">当選回数：</dt>
              <dd className="inline">{member.termCount ?? "確認中"}期</dd>
            </div>
            <div>
              <dt className="inline">所属委員会：</dt>
              <dd className="inline">{member.committees.length > 0 ? member.committees.join("、") : "確認中"}</dd>
            </div>
          </dl>
          <div className="mt-3">
            <SnsLinks links={member.sns} />
          </div>
          <Link
            to={`/members/${member.id}`}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
          >
            議員プロフィール全体を見る
          </Link>
        </div>

        <div className="rounded-2xl bg-surface-container-low p-5 shadow-e1">
          <p className="text-sm font-semibold text-on-surface">活動指標スコア（1〜5段階）</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            公開資料ベースの活動指数です。議員の能力・政策の質・人物評価を示すものではありません。
          </p>
          <div className="mt-2">
            <ActivityRadarChart metrics={metrics} />
          </div>
          <p className="mt-1 text-center text-xs text-on-surface-variant">対象期間：{targetPeriod}</p>
        </div>
      </div>

      <SectionCard title="事実要約">
        {factsSummary.length > 0 ? (
          <p className="text-sm leading-relaxed text-on-surface">{factsSummary.join("、")}が公開資料から確認されています。</p>
        ) : (
          <p className="text-sm text-on-surface-variant">現在、確認できる活動データがまだ十分にそろっていません。</p>
        )}
      </SectionCard>

      <SectionCard title="一般質問・議会内発言の詳細">
        <p className="text-xs leading-relaxed text-on-surface-variant">
          対象期間（{targetPeriod}）中の記録です。「登壇回数」「質問項目数」は異なる数え方のため区別しています。
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-container-high p-3">
            <dt className="text-xs text-on-surface-variant">
              登壇回数
              <span className="ml-1 text-[11px]">（本会議で一般質問・代表質問等のために発言した回数）</span>
            </dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{evidence.appearanceCount}回</dd>
          </div>
          <div className="rounded-lg bg-surface-container-high p-3">
            <dt className="text-xs text-on-surface-variant">
              質問項目数
              <span className="ml-1 text-[11px]">（全登壇を通じた個別質問項目の合計）</span>
            </dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">{evidence.questionItemCount}件</dd>
          </div>
          <div className="rounded-lg bg-surface-container-high p-3">
            <dt className="text-xs text-on-surface-variant">
              会期別実施状況
              <span className="ml-1 text-[11px]">（一般質問を行ったことが確認できた会期）</span>
            </dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {evidence.sessionIdsWithQuestion.length}／{evidence.targetSessionCount}会期
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high p-3">
            <dt className="text-xs text-on-surface-variant">答弁者の内訳（質問項目単位、重複あり）</dt>
            <dd className="mt-0.5 text-sm text-on-surface">
              市長答弁：{evidence.mayorAnsweredItemCount}件／執行部（市長以外）答弁：{evidence.executiveAnsweredItemCount}件
            </dd>
          </div>
        </dl>

        {evidence.yearlyTrend.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-on-surface">年度別推移</p>
            <YearlySpeechTrendChart counts={evidence.yearlyTrend} />
          </div>
        )}

        {evidence.topTopics.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-on-surface">主な質問テーマ</p>
            <p className="mt-1 text-xs text-on-surface-variant">この期間に取り上げた回数（会期単位）を事実として示すものです。特定分野への強さを評価するものではありません。</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {evidence.topTopics.map((t) => (
                <li key={t.topic} className="rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface">
                  {t.topic}：{t.sessionCount}会期で確認
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          to={`/members/${member.id}#questions`}
          className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline ${linkClass}`}
        >
          個別の一般質問・答弁の全件を見る →
        </Link>
      </SectionCard>

      <SectionCard title="議案への賛否（個人別に確認できたもの）">
        {voteEvidence.disclosedBillCount === 0 ? (
          <p className="text-sm text-on-surface-variant">
            この議員について、個人別賛否資料が公開されていないため確認できません（0件という意味ではありません）。
          </p>
        ) : (
          <>
            <p className="text-sm text-on-surface">
              個人別の賛否が確認できた議案：{voteEvidence.disclosedBillCount}件
              （内訳：
              {(Object.keys(billVoteLabels) as (keyof typeof billVoteLabels)[])
                .filter((k) => voteEvidence.breakdown[k])
                .map((k) => `${billVoteLabels[k]}${voteEvidence.breakdown[k]}件`)
                .join("、")}
              ）
            </p>
            <ul className="mt-2 space-y-1.5">
              {voteEvidence.recentBills.map((b) => (
                <li key={b.id} className="rounded-lg bg-surface-container-high px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/bills/votes/${b.id}`} className={`min-w-0 truncate text-on-surface hover:underline ${linkClass}`}>
                      {b.billNumber}　{b.billTitle}
                    </Link>
                    <span className="shrink-0 text-xs text-on-surface-variant">
                      <span aria-hidden="true">{billVoteSymbols[b.vote]}</span> {billVoteLabels[b.vote]}
                    </span>
                  </div>
                  {b.votingDate && <p className="mt-0.5 text-xs text-on-surface-variant">{formatJapaneseDate(b.votingDate)}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
        {undisclosedBillCount > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
            上記以外の議案（サイト全体で登録済みの{voteEvidence.totalBillCountSitewide}件中{undisclosedBillCount}件）は、個人別の賛否記録がまだ公開されていないため、この議員についても確認できません。「反対0件」等の意味ではありません。
          </p>
        )}
        <Link
          to={`/members/${member.id}#votes`}
          className={`mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline ${linkClass}`}
        >
          議案賛否の全件を見る →
        </Link>
      </SectionCard>

      <SectionCard title="所属委員会（参考情報）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          委員会そのものの会議録（開催日・出席委員・個別の発言全文）は、延岡市議会がまだ公表していないため収録できていません。活動指標スコアには含めず、所属・役職・関連議案・所管事務調査報告書のみを参考情報として掲載します。下記の「本会議での委員長・副委員長報告」は、委員会内部の発言ではなく、本会議で委員長・副委員長が審査結果を報告した記録です（会議録から氏名を機械的に確認・登録）。
        </p>
        {memberCommittees.length === 0 ? (
          <p className="text-sm text-on-surface-variant">現在の委員会名簿では、所属委員会を確認できていません。</p>
        ) : (
          <ul className="space-y-3">
            {memberCommittees.map((c) => {
              const role = c.members.find((m) => m.memberId === member.id)?.role ?? "委員";
              const reports = reportsForCommittee(c.id);
              const bills = billsForCommittee(c.name);
              return (
                <li key={c.id} className="rounded-lg border border-outline-variant p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link to={`/committees/${c.id}`} className={`font-medium text-on-surface hover:underline ${linkClass}`}>
                      {c.name}
                    </Link>
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">{role}</span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">{c.type}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    所属期間：{c.termStart ? formatJapaneseDate(c.termStart) : "確認中"}〜{c.termEnd ? formatJapaneseDate(c.termEnd) : "現在"}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    この委員会が付託先の議案：{bills.length}件／所管事務調査報告書：{reports.length}件
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {committeeReports.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-on-surface">本会議での委員長・副委員長報告（{committeeReports.length}件、会議録で確認済み）</p>
            <ul className="mt-2 space-y-1.5">
              {committeeReports.map((r) => (
                <li key={r.id} className="rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface">
                  {r.meetingDate ? formatJapaneseDate(r.meetingDate) : "日付確認中"}　{r.committeeName}
                  {r.role === "chair" ? "委員長" : "副委員長"}として報告
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className={`ml-2 text-primary hover:underline ${linkClass}`}>
                    会議録を見る
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard title="5つの指標の実数と算定方法">
        <ul className="space-y-3">
          {STAR_METRICS.map((def) => {
            const m = metrics.find((x) => x.key === def.key)!;
            return (
              <li key={def.key} className="rounded-lg border border-outline-variant p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-on-surface">{def.label}</span>
                  <StarRating value={m.value} />
                </div>
                <p className="mt-1 text-sm text-on-surface">
                  {m.value !== null
                    ? m.numerator != null && m.denominator != null
                      ? `${Math.round(m.value)}${def.unit}（${m.numerator}／${m.denominator}）`
                      : m.rawValue != null
                        ? `${m.rawValue}件相当（指数${Math.round(m.value)}点）`
                        : `${Math.round(m.value)}${def.unit}`
                    : "対象記録なし・データ整備中"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{m.description}</p>
                <p className="mt-1 text-xs text-on-surface-variant">算定方法：{m.methodNote}</p>
                <p className="mt-1 text-xs text-on-surface-variant">出典：{m.sourceLabel}</p>
                {m.updatedAt && <p className="mt-1 text-xs text-on-surface-variant">最終確認日：{m.updatedAt}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <Link
                    to="/methodology/activity-radar"
                    className={`font-medium text-primary hover:underline ${linkClass}`}
                  >
                    算定方法を見る →
                  </Link>
                  {(def.key === "question" || def.key === "speech") && (
                    <Link to={`/members/${member.id}#questions`} className={`font-medium text-primary hover:underline ${linkClass}`}>
                      元データ（一般質問・発言）を見る →
                    </Link>
                  )}
                  {def.key === "voting" && (
                    <Link to={`/members/${member.id}#votes`} className={`font-medium text-primary hover:underline ${linkClass}`}>
                      元データ（議案賛否）を見る →
                    </Link>
                  )}
                  {def.key === "disclosure" && verifiedSns.length > 0 && (
                    <Link to={`/members/${member.id}`} className={`font-medium text-primary hover:underline ${linkClass}`}>
                      確認済み公式SNSを見る →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard title="議員を比較する">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          他の議員と5指標を並べて比較できます。一覧ページで比較したい議員（最大3名）を選んでください。
        </p>
        <Link
          to="/council-activity"
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${linkClass}`}
        >
          議員活動バロメーター一覧・比較ページへ
        </Link>
      </SectionCard>

      <p className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        本ページは、公開資料から確認できる活動を一定の基準で整理したものです。議員の能力、政策の質、政治的立場、人物評価を示すものではありません。特定の政党・会派・議員・候補者・政治団体を支持、推薦、批判するものではありません。
      </p>

      <CorrectionRequestButton pageName={`${member.name}議員の活動バロメーター`} />

      <LastUpdated className="mt-2" />
    </div>
  );
}
