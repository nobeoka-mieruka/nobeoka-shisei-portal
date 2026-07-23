import { Link, useParams } from "react-router-dom";
import generalQuestionsData from "../data/generalQuestions.json";
import membersData from "../data/members.json";
import billVotesData from "../data/billVotes.json";
import mayorPromisesData from "../data/mayorPromises.json";
import type { BillVoteItem, CouncilMember, GeneralQuestionItem, MayorPromisesData } from "../types";
import { BackLink } from "../components/BackLink";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { SectionCard } from "../components/SectionCard";
import { FactionChip } from "../components/FactionChip";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { GlobeIcon, PlayIcon } from "../components/icons";
import { getFaction } from "../lib/factions";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";

const questions = generalQuestionsData as GeneralQuestionItem[];
const members = membersData as CouncilMember[];
const billVotes = billVotesData as BillVoteItem[];
const promisesData = mayorPromisesData as MayorPromisesData;

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function videoHref(item: GeneralQuestionItem): string {
  if (!item.videoUrl) return "";
  if (item.videoStartSeconds == null) return item.videoUrl;
  const sep = item.videoUrl.includes("?") ? "&" : "?";
  return `${item.videoUrl}${sep}t=${item.videoStartSeconds}s`;
}

export function GeneralQuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const item = questions.find((q) => q.id === id);

  usePageTitle();

  if (!item) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <BackLink to="/questions" label="一般質問データベースに戻る" />
        <div className="mt-4 space-y-4 rounded-xl bg-surface-container-low p-8 text-center">
          <p className="text-sm text-on-surface-variant">該当する一般質問が見つかりません</p>
          <Link
            to="/questions"
            className={`inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 ${linkClass}`}
          >
            一般質問データベースへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const member = members.find((m) => m.id === item.memberId);
  const faction = member ? getFaction(member.factionId) : undefined;

  const relatedBills = (item.relatedBillVoteIds ?? [])
    .map((billId) => billVotes.find((b) => b.id === billId))
    .filter((b): b is BillVoteItem => !!b);
  const relatedPromises = (item.relatedMayorPromiseIds ?? [])
    .map((promiseId) => promisesData.promises.find((p) => p.id === promiseId))
    .filter((p): p is (typeof promisesData.promises)[number] => !!p);

  const sourceLinks = [
    item.noticeUrl && { label: "質問通告書", url: item.noticeUrl },
    item.transcriptPdfUrl && { label: "会議録PDF", url: item.transcriptPdfUrl },
    item.transcriptUrl && { label: "会議録ページ", url: item.transcriptUrl },
    item.videoUrl && { label: "議会中継・録画", url: videoHref(item) },
    item.documentUrl && { label: "質問資料", url: item.documentUrl },
  ].filter((l): l is { label: string; url: string } => !!l);

  const sameSessionQuestions = questions
    .filter((q) => q.sessionName === item.sessionName)
    .sort((a, b) => (a.questionOrder ?? 0) - (b.questionOrder ?? 0));
  const idx = sameSessionQuestions.findIndex((q) => q.id === item.id);
  const prevQuestion = idx > 0 ? sameSessionQuestions[idx - 1] : undefined;
  const nextQuestion = idx >= 0 && idx < sameSessionQuestions.length - 1 ? sameSessionQuestions[idx + 1] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "ホーム", to: "/" },
          { label: "一般質問データベース", to: "/questions" },
          { label: item.memberName },
        ]}
      />
      <BackLink to="/questions" label="一般質問データベースに戻る" />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-on-primary-container/80">
          <span>{formatJapaneseDate(item.questionDate)}</span>
          <span>{item.sessionName}</span>
          <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-on-surface">{item.questionType}</span>
        </div>
        <h1 className="mt-2 text-lg font-semibold leading-snug text-on-primary-container sm:text-xl">{item.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link to={`/members/${item.memberId}`} className={`text-sm font-medium text-on-primary-container underline ${linkClass}`}>
            {item.memberName}議員
          </Link>
          {faction && <FactionChip faction={faction} />}
        </div>
      </div>

      <SectionCard title="質問内容（要約）">
        <p className="text-sm leading-relaxed text-on-surface">{item.summary}</p>
      </SectionCard>

      <SectionCard title="質問項目">
        {item.questionItems.length > 0 ? (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-on-surface">
            {item.questionItems.map((qi, i) => (
              <li key={i}>{qi}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-on-surface-variant">情報未登録</p>
        )}
      </SectionCard>

      <SectionCard title="市の答弁（要約）">
        {item.answerSummary ? (
          <div className="space-y-1.5">
            <p className="text-sm leading-relaxed text-on-surface">{item.answerSummary}</p>
            {(item.answerSpeaker || item.answerDepartment) && (
              <p className="text-xs text-on-surface-variant">
                {item.answerSpeaker && `答弁者：${item.answerSpeaker}`}
                {item.answerSpeaker && item.answerDepartment && "／"}
                {item.answerDepartment && `担当部署：${item.answerDepartment}`}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            会議録で答弁内容を確認できていないため、現時点では掲載していません。
          </p>
        )}
      </SectionCard>

      <SectionCard title="基本情報">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-on-surface-variant">年度</dt>
            <dd className="text-on-surface">{item.fiscalYear}</dd>
          </div>
          <div>
            <dt className="text-xs text-on-surface-variant">定例会・臨時会</dt>
            <dd className="text-on-surface">{item.sessionName}</dd>
          </div>
          {item.durationMinutes !== undefined && (
            <div>
              <dt className="text-xs text-on-surface-variant">質問時間</dt>
              <dd className="text-on-surface">約{item.durationMinutes}分</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-on-surface-variant">最終確認日</dt>
            <dd className="text-on-surface">{formatJapaneseDate(item.lastVerified)}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="関連情報">
        {relatedBills.length > 0 || relatedPromises.length > 0 || (item.relatedFinanceItems?.length ?? 0) > 0 ? (
          <ul className="space-y-2 text-sm">
            {relatedBills.map((bill) => (
              <li key={bill.id}>
                <Link to={`/bills/votes/${bill.id}`} className={`text-primary hover:underline ${linkClass}`}>
                  関連議案：{bill.billTitle}
                </Link>
              </li>
            ))}
            {relatedPromises.map((promise) => (
              <li key={promise.id}>
                <Link to={`/mayor/policy-progress/${promise.id}`} className={`text-primary hover:underline ${linkClass}`}>
                  関連する市長公約：{promise.promiseText}
                </Link>
              </li>
            ))}
            {item.relatedFinanceItems && item.relatedFinanceItems.length > 0 && (
              <li>
                <Link to="/finance" className={`text-primary hover:underline ${linkClass}`}>
                  関連する予算・財政情報：{item.relatedFinanceItems.join("、")}
                </Link>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">関連情報は登録されていません</p>
        )}
      </SectionCard>

      <SectionCard title="出典">
        {sourceLinks.length > 0 ? (
          <ul className="space-y-2">
            {sourceLinks.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${l.label}を新しいタブで開く`}
                  className={`inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
                >
                  {l.label === "議会中継・録画" ? <PlayIcon className="h-3.5 w-3.5" /> : <GlobeIcon className="h-3.5 w-3.5" />}
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${item.sourceTitle}を新しいタブで開く`}
                className={`inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
              >
                <GlobeIcon className="h-3.5 w-3.5" />
                {item.sourceTitle}
              </a>
            </li>
          </ul>
        ) : (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${item.sourceTitle}を新しいタブで開く`}
            className={`inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
          >
            <GlobeIcon className="h-3.5 w-3.5" />
            {item.sourceTitle}
          </a>
        )}
        <p className="mt-2 text-xs text-on-surface-variant">公表機関：{item.sourceOrganization}</p>
        {item.notes && <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{item.notes}</p>}
      </SectionCard>

      {(prevQuestion || nextQuestion) && (
        <div className="flex flex-wrap items-stretch justify-between gap-2">
          {prevQuestion ? (
            <Link
              to={`/questions/${prevQuestion.id}`}
              className={`min-w-0 flex-1 rounded-xl bg-surface-container-low p-3 text-sm shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
            >
              <span className="block text-xs text-on-surface-variant">同じ定例会の前の質問</span>
              <span className="block truncate font-medium text-on-surface">{prevQuestion.title}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {nextQuestion ? (
            <Link
              to={`/questions/${nextQuestion.id}`}
              className={`min-w-0 flex-1 rounded-xl bg-surface-container-low p-3 text-right text-sm shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
            >
              <span className="block text-xs text-on-surface-variant">同じ定例会の次の質問</span>
              <span className="block truncate font-medium text-on-surface">{nextQuestion.title}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </div>
      )}

      <CorrectionRequestButton pageName={`${item.memberName}議員の一般質問「${item.title}」`} />
    </div>
  );
}
