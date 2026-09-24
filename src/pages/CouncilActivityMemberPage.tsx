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
import { YearlySpeechTrendChart } from "../components/council/YearlySpeechTrendChart";
import { PersonTimeline } from "../components/council/PersonTimeline";
import { getPersonTimeline } from "../lib/personTimeline";
import { getFaction } from "../lib/factions";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  activityTargetPeriodLabel,
  getAllCurrentMemberActivity,
  getMemberActivityRecord,
  getMemberQuestionEvidence,
  getMemberVoteEvidence,
  metricByKey,
  seatNumberFromProfile,
  decisionSubmitterCountFor,
  informationChannelCount,
  electionVoteReferenceFor,
} from "../lib/councilActivityBarometer";
import type { RadarDataStatus } from "../lib/activityRadar";
import { billVoteLabels, billVoteSymbols } from "../lib/billVotes";
import {
  committeesForMember,
  reportsForCommittee,
  billsForCommittee,
  committeeReportActivityForMember,
  committeeSpeechKindLabel,
} from "../lib/committees";
import { formatJapaneseDate } from "../config/site";
import { VoteScopeNote } from "../components/bills/VoteScopeNote";

const members = membersData as CouncilMember[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** 「白背景・薄いグレー罫線・グラデーション無し」で統一するための、この2ページ専用のカードスタイル。 */
const flatCardClass = "border border-gray-200 bg-white shadow-e1 dark:border-outline-variant dark:bg-surface-container-low";

/**
 * ページ上部で先に示す、会期単位の公開記録（一般質問実施率とその分子・分母）。
 * 会期単位を先に置くのは、質問項目数の抽出量が会期ごとに大きく異なり、件数だけを
 * 先に見せると議員の活動ではなく当サイトの整備状況を見せてしまうため。
 */
const TOP_RECORD_KEYS = ["asked-rate", "asked-sessions", "question-items"] as const;

const STAR_METRICS = [
  { key: "question", label: "一般質問", unit: "%" },
  { key: "speech", label: "議会内発言", unit: "点" },
  { key: "voting", label: "議案等の意思表示", unit: "%" },
  { key: "disclosure", label: "情報発信・プロフィール充足度", unit: "%" },
  { key: "attendance", label: "出席状況", unit: "" },
  { key: "proposal", label: "請願・提案等", unit: "" },
] as const;

/**
 * 星（★）による5段階評価は「議員の能力や政策の質を評価するものではありません」という
 * このページ自体の方針（CLAUDE.mdの「独自採点を掲載しない」方針）と矛盾するため、
 * 数値の大小を示すだけの中立な充填バーに変更した（Phase89-98横断監査で発見・修正）。
 * 優劣を連想させる星アイコンは使わず、実数（下段に別途表示済み）を補助する視覚要素に留める。
 */
function ValueBar({ value, dataStatus }: { value: number | null; dataStatus?: RadarDataStatus }) {
  if (dataStatus === "not-applicable") {
    return <span className="text-xs text-on-surface-variant">対象外</span>;
  }
  if (value === null) {
    return <span className="text-xs text-on-surface-variant">割合としては算定しません</span>;
  }
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className="inline-flex w-24 items-center gap-1" aria-hidden="true">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
        <span className="block h-full rounded-full bg-secondary" style={{ width: `${percent}%` }} />
      </span>
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
  const activityRecord = getMemberActivityRecord(member);
  const topRecordValues = TOP_RECORD_KEYS.map((key) => activityRecord.values.find((v) => v.key === key)).filter(
    (v): v is (typeof activityRecord.values)[number] => !!v,
  );
  // 議長など、制度上一般質問を行わない期間は「0件」ではなく理由を添えて示す。
  const chairpersonNote = activityRecord.values.find((v) => v.availability === "not-applicable")?.availabilityNote;
  const faction = getFaction(member.factionId);
  const targetPeriod = activityTargetPeriodLabel();
  const verifiedSns = member.sns.filter((s) => s.verificationStatus === "verified");
  const evidence = getMemberQuestionEvidence(member);
  const voteEvidence = getMemberVoteEvidence(member);
  const undisclosedBillCount = voteEvidence.totalBillCountSitewide - voteEvidence.disclosedBillCount;
  const memberCommittees = committeesForMember(member.id);
  const committeeReports = committeeReportActivityForMember(member.id);
  const timeline = getPersonTimeline(member.id);
  const seatNumber = seatNumberFromProfile(member);
  const channelCount = informationChannelCount(member);
  const submitterCount = decisionSubmitterCountFor(member.id);
  const electionVote = electionVoteReferenceFor(member.id);

  const questionMetric = metricByKey(metrics, "question");
  const speechMetric = metricByKey(metrics, "speech");
  // rawValue が無いのは「会議録を取得できた会期が無い」状態であり、0件ではない。
  const speechCount = speechMetric?.rawValue ?? null;
  const questionNotApplicable = questionMetric?.dataStatus === "not-applicable";

  // 事実の要約のみを機械的に生成する（優秀／劣っている等の評価語は使用しない）。
  const factsSummary =
    questionMetric?.value !== null && questionMetric?.value !== undefined
      ? `一般質問実施率${Math.round(questionMetric.value)}%、議会内発言${speechCount ?? "未取得"}件、公式情報発信${channelCount}媒体、請願・提案等${submitterCount}件が公開資料から確認されています。`
      : questionNotApplicable
        ? `${questionMetric?.notApplicableReason ?? "制度上、一般質問実施率の算定対象外です。"}`
        : null;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entryLd) => (
        <JsonLd key={entryLd.id} id={entryLd.id} data={entryLd.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/council-activity" label="議員活動バロメーター一覧に戻る" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 上部左：氏名・ふりがな・議席番号・会派・写真・公式SNS/公式サイトリンク */}
        <div className={`rounded-2xl p-5 ${flatCardClass}`}>
          <div className="flex items-center gap-3">
            <Avatar name={member.name} photoUrl={member.photoUrl} size="lg" loading="eager" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-snug text-on-surface sm:text-2xl">{member.name}</h1>
              <p className="text-sm text-on-surface-variant">{member.nameKana}</p>
              {faction && <FactionChip faction={faction} className="mt-1.5" />}
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-on-surface-variant">
            <div>
              <dt className="inline">議席番号：</dt>
              <dd className="inline">{seatNumber ? `${seatNumber}番` : "確認中"}</dd>
            </div>
            <div>
              <dt className="inline">当選回数：</dt>
              <dd className="inline">{member.termCount ?? "確認中"}期</dd>
            </div>
            <div className="col-span-2">
              <dt className="inline">所属委員会：</dt>
              <dd className="inline">{member.committees.length > 0 ? member.committees.join("、") : "確認中"}</dd>
            </div>
          </dl>
          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-outline-variant">
            <p className="text-xs font-medium text-on-surface-variant">公式SNS・公式サイト</p>
            <div className="mt-1.5">
              <SnsLinks links={member.sns} />
            </div>
            {member.profileUrl && (
              <a
                href={member.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-1.5 inline-flex min-h-11 items-center text-xs font-medium text-primary underline ${linkClass}`}
              >
                延岡市議会公式プロフィールページ →
              </a>
            )}
          </div>
          <Link
            to={`/members/${member.id}`}
            className={`mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
          >
            議員プロフィール全体を見る
          </Link>
        </div>

        {/* 上部右：会期単位で確認できた記録・選挙時得票（参考情報） */}
        <div className={`rounded-2xl p-5 ${flatCardClass}`}>
          <p className="text-sm font-semibold text-on-surface">公開記録から確認できた議会活動</p>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
            会議録で確認できた事実の記録です。複数の項目を合算した総合点や議員の順位付けは行っていません。
          </p>
          <dl className="mt-3 space-y-2">
            {topRecordValues.map((v) => (
              <div key={v.key} className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-xs text-on-surface-variant">{v.label}</dt>
                <dd className="text-sm font-semibold text-on-surface">
                  {v.value === null ? "―" : `${v.value.toLocaleString("ja-JP")}${v.unit}`}
                  {v.numerator != null && v.denominator != null && (
                    <span className="ml-1 text-xs font-normal text-on-surface-variant">
                      （{v.numerator}／{v.denominator}）
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {chairpersonNote && (
            <p className="mt-2 rounded-lg bg-surface-container-high px-3 py-2 text-xs leading-relaxed text-on-surface-variant">
              {chairpersonNote}
            </p>
          )}
          <p className="mt-2 text-center text-xs text-on-surface-variant">対象期間：{targetPeriod}</p>
          {electionVote && (
            <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs text-on-surface-variant dark:bg-surface-container-high">
              参考情報：{electionVote.electionName}（{electionVote.electionDateLabel}）得票数
              <span className="font-medium text-on-surface">{electionVote.votes.toLocaleString()}票</span>
              {!Number.isInteger(electionVote.votes) && "（按分票を含む）"}
            </p>
          )}
        </div>
      </div>

      <SectionCard title="事実要約">
        {factsSummary ? (
          <p className="text-sm leading-relaxed text-on-surface">{factsSummary}</p>
        ) : (
          <p className="text-sm text-on-surface-variant">現在、確認できる活動データがまだ十分にそろっていません。</p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
          請願・提案等の件数は、本会議での決議提出者として会議録で確認できた件数に限ります（条例案・請願・意見書等の提出者は含みません）。
        </p>
      </SectionCard>

      <SectionCard title="公開資料から数えた実数" className={flatCardClass}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-gray-200 p-3 dark:border-outline-variant">
            <p className="text-xs text-on-surface-variant">一般質問</p>
            <p className="mt-1 text-lg font-semibold text-on-surface">
              {/* 「制度上の対象外（議長など）」を「まだ調べていない」と同じ言葉にしない。 */}
              {questionMetric?.value !== null && questionMetric?.value !== undefined
                ? `${Math.round(questionMetric.value)}%`
                : questionNotApplicable
                  ? "対象外"
                  : "確認中"}
            </p>
            <Link to="/methodology/council-activity" className={`mt-1 inline-block text-xs font-medium text-primary underline ${linkClass}`}>
              算定方法を見る →
            </Link>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-outline-variant">
            <p className="text-xs text-on-surface-variant">発言量</p>
            <p className="mt-1 text-lg font-semibold text-orange-700 dark:text-orange-300">
              {speechCount === null ? "未取得" : `${speechCount.toLocaleString("ja-JP")}件`}
            </p>
            <Link to="/methodology/council-activity" className={`mt-1 inline-block text-xs font-medium text-primary underline ${linkClass}`}>
              算定方法を見る →
            </Link>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-outline-variant">
            <p className="text-xs text-on-surface-variant">請願・提案</p>
            <p className="mt-1 text-lg font-semibold text-orange-700 dark:text-orange-300">{submitterCount}件</p>
            <Link to="/methodology/council-activity" className={`mt-1 inline-block text-xs font-medium text-primary underline ${linkClass}`}>
              算定方法を見る →
            </Link>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-outline-variant">
            <p className="text-xs text-on-surface-variant">情報発信</p>
            <p className="mt-1 text-lg font-semibold text-on-surface">{channelCount}媒体</p>
            <Link to="/methodology/council-activity" className={`mt-1 inline-block text-xs font-medium text-primary underline ${linkClass}`}>
              算定方法を見る →
            </Link>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-outline-variant">
            <p className="text-xs text-on-surface-variant">出席状況</p>
            <p className="mt-1 text-lg font-semibold text-on-surface-variant">確認中</p>
            <Link to="/methodology/council-activity" className={`mt-1 inline-block text-xs font-medium text-primary underline ${linkClass}`}>
              算定方法を見る →
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="一般質問・議会内発言の詳細">
        <p className="text-xs leading-relaxed text-on-surface-variant">
          対象期間（{targetPeriod}）中の記録です。「登壇回数」「質問項目数」は異なる数え方のため区別しています。
        </p>
        {/* 制度上そもそも一般質問を行わない議員に、0回・0件・0／13会期を並べない。 */}
        {questionNotApplicable && (
          <p className="mt-2 rounded-lg bg-surface-container-high px-3 py-2 text-xs leading-relaxed text-on-surface-variant">
            {questionMetric?.notApplicableReason ??
              "制度上、一般質問実施率の算定対象外です。"}
            この議員については、以下の件数を実績として読まないでください。
          </p>
        )}
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-container-high p-3">
            <dt className="text-xs text-on-surface-variant">
              登壇回数
              <span className="ml-1 text-[11px]">（本会議で一般質問・代表質問等のために発言した回数）</span>
            </dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {questionNotApplicable ? "対象外" : `${evidence.appearanceCount}回`}
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high p-3">
            <dt className="text-xs text-on-surface-variant">
              質問項目数
              <span className="ml-1 text-[11px]">（全登壇を通じた個別質問項目の合計）</span>
            </dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {questionNotApplicable ? "対象外" : `${evidence.questionItemCount}件`}
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high p-3">
            <dt className="text-xs text-on-surface-variant">
              会期別実施状況
              <span className="ml-1 text-[11px]">（一般質問を行ったことが確認できた会期）</span>
            </dt>
            <dd className="mt-0.5 text-lg font-semibold text-on-surface">
              {questionNotApplicable
                ? "対象外"
                : `${evidence.sessionIdsWithQuestion.length}／${evidence.targetSessionCount}会期`}
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high p-3">
            <dt className="text-xs text-on-surface-variant">答弁者の内訳（質問項目単位、重複あり）</dt>
            <dd className="mt-0.5 text-sm text-on-surface">
              {questionNotApplicable
                ? "対象外"
                : `市長答弁：${evidence.mayorAnsweredItemCount}件／執行部（市長以外）答弁：${evidence.executiveAnsweredItemCount}件`}
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
          className={`mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline ${linkClass}`}
        >
          個別の一般質問・答弁の全件を見る →
        </Link>
      </SectionCard>

      <SectionCard title="議案への賛否（個人別に確認できたもの）">
        <VoteScopeNote className="mb-3" />
        {voteEvidence.disclosedBillCount === 0 ? (
          <p className="text-sm text-on-surface-variant">
            この議員について、個人別の賛否を確認できた議案はまだありません（0件という意味ではありません）。
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
                  {b.recordedVoteDate && <p className="mt-0.5 text-xs text-on-surface-variant">{formatJapaneseDate(b.recordedVoteDate)}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
        {undisclosedBillCount > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
            上記以外の議案（サイト全体で登録済みの{voteEvidence.totalBillCountSitewide}件中{undisclosedBillCount}件）について、この議員の賛否は確認できていません。内訳は2種類あります。
            {voteEvidence.notDisclosedBillCountSitewide}件は起立採決などで、会議録に議員一人ひとりの賛否が記載されていないことを確認済みです。
            残る{voteEvidence.unconfirmedBillCountSitewide}件は、採決の方式までは分かっているものの、個人別の賛否を当サイトがまだ確認できていないもので、公開されていないと断定したものではありません。
            いずれも「反対0件」等の意味ではありません。
          </p>
        )}
        <Link
          to={`/members/${member.id}#votes`}
          className={`mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline ${linkClass}`}
        >
          議案賛否の全件を見る →
        </Link>
      </SectionCard>

      <SectionCard title="所属委員会（参考情報）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          委員会そのものの会議録（開催日・出席委員・個別の発言全文）は、複数の公開資料経路を調査しましたが、延岡市議会が一般公開していることを確認できていません（存在しないと断定するものではありません）。議会活動の記録には含めず、所属・役職・関連議案・所管事務調査報告書のみを参考情報として掲載します。下記の「本会議での委員長・副委員長報告」は、委員会内部の発言ではなく、本会議で委員長・副委員長が行った審査結果の報告・調査の報告・活動の報告・提案理由の説明の記録です（会議録から氏名を機械的に確認・登録し、発言の冒頭から種類を示しています）。
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
                  {/* 委員会単位の記録。所属していることを、本人がその議案の審査に関わった記録として見せない。 */}
                  <p className="mt-1 text-xs text-on-surface-variant">
                    委員会全体の記録（当サイトに登録された全期間の件数。本人の審査への関与を示すものではありません）：
                    付託された議案 {bills.length}件／所管事務調査報告書{" "}
                    {reports.length > 0 ? `${reports.length}件` : "当サイトへの登録なし（0件という意味ではありません）"}
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
                  {r.role === "chair" ? "委員長" : "副委員長"}として{committeeSpeechKindLabel(r)}
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className={`ml-2 text-primary underline ${linkClass}`}>
                    会議録を見る
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard title="活動タイムライン">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          選挙・任期・委員会所属・一般質問・議会内発言・議案への賛否を、公開資料から確認できた範囲で時系列にまとめたものです。イベントが無い期間を「活動なし」の意味では表示していません（単に該当する公開資料が確認できていない期間です）。
        </p>
        {timeline.length > 0 ? (
          <PersonTimeline events={timeline} />
        ) : (
          <p className="text-sm text-on-surface-variant">この議員について、タイムラインの元になる公開資料をまだ確認できていません。</p>
        )}
      </SectionCard>

      <SectionCard title="項目ごとの実数と算定方法（詳細）">
        <ul className="space-y-3">
          {STAR_METRICS.map((def) => {
            const m = metrics.find((x) => x.key === def.key)!;
            return (
              <li key={def.key} className="rounded-lg border border-outline-variant p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-on-surface">{def.label}</span>
                  <ValueBar value={m.value} dataStatus={m.dataStatus} />
                </div>
                <p className="mt-1 text-sm text-on-surface">
                  {m.dataStatus === "not-applicable"
                    ? "対象外"
                    : m.numerator != null && m.denominator != null
                      ? `${m.numerator}／${m.denominator}${m.value !== null ? `（${Math.round(m.value)}${def.unit}）` : ""}`
                      : m.rawValue != null
                        ? `${m.rawValue.toLocaleString("ja-JP")}件`
                        : m.value !== null
                          ? `${Math.round(m.value)}${def.unit}`
                          : "対象記録なし・データ整備中"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{m.description}</p>
                <p className="mt-1 text-xs text-on-surface-variant">算定方法：{m.methodNote}</p>
                <p className="mt-1 text-xs text-on-surface-variant">出典：{m.sourceLabel}</p>
                {m.updatedAt && <p className="mt-1 text-xs text-on-surface-variant">最終確認日：{m.updatedAt}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <Link
                    to="/methodology/council-activity"
                    className={`font-medium text-primary underline ${linkClass}`}
                  >
                    算定方法を見る →
                  </Link>
                  {(def.key === "question" || def.key === "speech") && (
                    <Link to={`/members/${member.id}#questions`} className={`font-medium text-primary underline ${linkClass}`}>
                      元データ（一般質問・発言）を見る →
                    </Link>
                  )}
                  {def.key === "voting" && (
                    <Link to={`/members/${member.id}#votes`} className={`font-medium text-primary underline ${linkClass}`}>
                      元データ（議案賛否）を見る →
                    </Link>
                  )}
                  {def.key === "disclosure" && verifiedSns.length > 0 && (
                    <Link to={`/members/${member.id}`} className={`font-medium text-primary underline ${linkClass}`}>
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
          className={`mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container transition hover:opacity-90 ${linkClass}`}
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
