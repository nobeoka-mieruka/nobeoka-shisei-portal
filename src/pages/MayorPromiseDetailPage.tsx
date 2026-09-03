import { Link, useLocation, useParams } from "react-router-dom";
import policyProgressData from "../data/mayorPolicyProgress.json";
import mayorPromisesData from "../data/mayorPromises.json";
import mayorPromiseMeasuresData from "../data/mayorPromiseMeasures.json";
import billVotesData from "../data/billVotes.json";
import generalQuestionsData from "../data/generalQuestions.json";
import { mayorPressConferences } from "../data/mayorPressConferences";
import type {
  BillVoteItem,
  GeneralQuestionItem,
  MayorPolicyProgressData,
  MayorPromiseDocument,
  MayorPromiseItem,
  MayorPromiseMeasureSnapshot,
  MayorPromisesData,
  MayorPromiseStatusLabel,
  PromiseEvidenceStatus,
} from "../types";
import { BackLink } from "../components/BackLink";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { LastUpdated } from "../components/LastUpdated";
import { MayorPromiseStatusBadge } from "../components/mayor/MayorPromiseStatusBadge";
import { MayorPromiseMeasureStatusBadge } from "../components/mayor/MayorPromiseMeasureStatusBadge";
import { shiftFiscalYearLabel } from "../lib/mayorPromiseMeasureStatus";
import { GlobeIcon, DocumentIcon, YenIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";
import { publicBills } from "../lib/billVotes";
import { MAYOR_PROMISE_LEVELS } from "../lib/mayorPromiseTerms";
import { humanizeDataNote } from "../lib/citizenTermLabels";

const CANDIDATE_STATUS_LABEL: Record<PromiseEvidenceStatus, string> = {
  confirmed: "確定",
  candidate: "関連候補",
  under_review: "調査中",
  not_found: "見つからず",
  unavailable: "資料未公開",
};

const promisesData = mayorPromisesData as MayorPromisesData;
const promiseMeasures = mayorPromiseMeasuresData as MayorPromiseMeasureSnapshot[];
const policyData = policyProgressData as MayorPolicyProgressData;
const billVotes = publicBills(billVotesData as BillVoteItem[]);
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** 未登録の任意項目を表示するときの共通文言。架空の値で埋めないためのプレースホルダー。 */
const UNREGISTERED = "情報未登録";

/**
 * Phase136：relatedBudget/relatedBillが未調査のまま「確認中」の2文字だけになっている場合の
 * フォールバック表示。空欄でも「確認中」の2文字だけでもなく、状態を具体的な文章で示す
 * （項目11）。データ側で既に詳しい説明文へ置き換え済みの場合はそのまま表示するため、
 * この関数は「確認中」という完全一致の値のときだけ働く。
 */
function relatedFieldDisplay(value: string, kind: "予算" | "議案"): string {
  if (value !== "確認中") return value;
  return `現在確認できる公式資料では、この公約に対応する個別の${kind}を特定できていません（「${kind}が存在しない」という意味ではありません）。`;
}

function isPdfUrl(url: string): boolean {
  return /\.pdf($|\?)/i.test(url);
}

interface EvidenceDoc extends MayorPromiseDocument {
  page?: string;
}

function collectEvidenceDocs(promise: MayorPromiseItem): EvidenceDoc[] {
  const docs: EvidenceDoc[] = [];
  for (const ref of promise.evidenceItems) {
    const doc = promisesData.documents.find((d) => d.key === ref.documentKey);
    if (doc) docs.push({ ...doc, page: ref.page });
  }
  return docs;
}

/**
 * 「進捗履歴」タイムライン1件分。公約の状態を区別して記録する2種類を扱う（Phase155）。
 *
 * - "baseline"：この公約データを登録した基準日（MayorPromiseItem.referenceDate）。
 *   個別の進捗更新イベントではなく、現在の公約原文・進捗状況・関連予算等が
 *   その日を基準に整理されていることを示す時点。
 * - "progress_update"：progressHistoryへ追加された、公表資料に基づく進捗確認の更新。
 *
 * 将来、公約原文（promiseText）自体の変更を記録するデータが追加された場合は、
 * ここに "promise_text_change" 種別を追加して区別する設計とする。現時点ではその
 * ようなデータは存在しないため、架空の履歴は作らず追加しない。
 */
type PromiseTimelineEntry = {
  kind: "baseline" | "progress_update";
  date: string;
  statusLabel: MayorPromiseStatusLabel;
  summary?: string;
  sourceTitle?: string;
  sourceUrl?: string;
};

/**
 * 公約1件分の「基準時点」と「進捗更新」を統合し、日付の新しい順に並べる。
 * 実際にデータが存在する時点のみを対象とし、存在しない時点（選挙時の公約発表日など、
 * announcedDateが未設定の場合）は追加しない。
 */
function buildPromiseTimeline(promise: MayorPromiseItem): PromiseTimelineEntry[] {
  const history = promise.progressHistory ?? [];
  const entries: PromiseTimelineEntry[] = history.map((h) => ({
    kind: "progress_update",
    date: h.date,
    statusLabel: h.statusLabel,
    summary: h.summary ?? h.note,
    sourceTitle: h.sourceTitle,
    sourceUrl: h.sourceUrl,
  }));

  // referenceDateがprogressHistoryのいずれかの日付と重複しない場合のみ、
  // 別途「基準時点」として追加する（同一日の二重表示を避ける）。
  const alreadyCovered = history.some((h) => h.date === promise.referenceDate);
  if (promise.referenceDate && !alreadyCovered) {
    entries.push({ kind: "baseline", date: promise.referenceDate, statusLabel: promise.statusLabel });
  }

  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function MayorPromiseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const promise = promisesData.promises.find((p) => p.id === id);
  const seo = getSeoForPath(location.pathname);

  usePageTitle();

  if (!promise) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <BackLink to="/mayor/policy-progress" label={`${MAYOR_PROMISE_LEVELS.promise.label}一覧に戻る`} />
        <div className="mt-4 space-y-4 rounded-xl bg-surface-container-low p-8 text-center">
          <p className="text-sm text-on-surface-variant">該当する公約が見つかりません</p>
          <Link
            to="/mayor/policy-progress"
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 ${linkClass}`}
          >
            公約一覧へ戻る
          </Link>
        </div>
      </div>
    );
  }

  const evidenceDocs = collectEvidenceDocs(promise);
  const measuresForPromise = promiseMeasures.filter((m) => m.promiseId === promise.id);
  const category = promisesData.categories.find((c) => c.id === promise.categoryId);
  const relatedBills = (promise.relatedBillVoteIds ?? [])
    .map((billId) => billVotes.find((b) => b.id === billId))
    .filter((b): b is BillVoteItem => !!b);
  const relatedQuestions = (promise.relatedQuestionIds ?? [])
    .map((questionId) => generalQuestions.find((q) => q.id === questionId))
    .filter((q): q is GeneralQuestionItem => !!q);
  const relatedPressConferences = (promise.relatedPressConferenceDates ?? [])
    .map((date) => mayorPressConferences.find((c) => c.date === date))
    .filter((c): c is (typeof mayorPressConferences)[number] => !!c);
  const promiseTimeline = buildPromiseTimeline(promise);
  const categoryPromises = promisesData.promises.filter((p) => p.categoryId === promise.categoryId);
  const idx = categoryPromises.findIndex((p) => p.id === promise.id);
  const prevPromise = idx > 0 ? categoryPromises[idx - 1] : undefined;
  const nextPromise = idx >= 0 && idx < categoryPromises.length - 1 ? categoryPromises[idx + 1] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/mayor/policy-progress" label={`${MAYOR_PROMISE_LEVELS.promise.label}一覧に戻る`} />

      {/* 公約の基本情報 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <MayorPromiseStatusBadge status={promise.statusLabel} />
          <Link
            to={category ? `/mayor/policy-progress#${category.anchor}` : "/mayor/policy-progress"}
            className={`text-xs text-on-primary-container/80 hover:underline ${linkClass}`}
          >
            {promise.categoryTitle}
          </Link>
        </div>
        <h1 className="mt-2 text-lg font-semibold leading-snug text-on-primary-container sm:text-xl">
          {promise.promiseText}
        </h1>
      </div>

      {/* 公約原文 */}
      <SectionCard title="公約原文">
        <p className="text-sm leading-relaxed text-on-surface">{promise.promiseText}</p>
      </SectionCard>

      {/* 市民向け概要 */}
      <SectionCard title="市民向け概要">
        <p className="text-sm leading-relaxed text-on-surface">{promise.citizenSummary ?? UNREGISTERED}</p>
      </SectionCard>

      {/* 現在の進捗 */}
      <SectionCard title="現在の進捗">
        {promise.progressSummary.length > 0 ? (
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-on-surface">
            {promise.progressSummary.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">
            現時点で公開資料から確認できた具体的な取組はありません（「情報が見つからない＝未着手」とは判定していません）。
          </p>
        )}
      </SectionCard>

      {/* 公約の現在地（個別施策、Phase148／年度ラベル・出典表示をPhase154で改善。Phase202で呼称を統一） */}
      {measuresForPromise.length > 0 && (
        <SectionCard title={`公約の現在地（${MAYOR_PROMISE_LEVELS.measure.label}）`}>
          <ul className="space-y-4">
            {measuresForPromise.map((m) => {
              const previousFyLabel = shiftFiscalYearLabel(m.fiscalYear, -1) ?? "前年度";
              return (
                <li key={m.measureId} className="border-b border-outline-variant pb-4 last:border-0 last:pb-0">
                  <p className="text-sm font-semibold text-on-surface">{m.measureTitle}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
                    <span className="font-medium text-on-surface">現在の状況：</span>
                    <MayorPromiseMeasureStatusBadge status={m.status} />
                  </div>
                  <dl className="mt-2 space-y-1.5 text-sm leading-relaxed text-on-surface-variant">
                    {m.previousYearResult && (
                      <div>
                        <dt className="inline font-medium text-on-surface">
                          【{previousFyLabel}】
                        </dt>
                        <dd className="inline">{m.previousYearResult}</dd>
                      </div>
                    )}
                    {(m.currentYearResult || m.currentYearPlan) && (
                      <div>
                        <dt className="inline font-medium text-on-surface">
                          【{m.fiscalYear}】
                        </dt>
                        <dd className="inline">
                          {m.currentYearResult && <>実施：{m.currentYearResult}</>}
                          {m.currentYearResult && m.currentYearPlan && <>／</>}
                          {m.currentYearPlan && <>予定：{m.currentYearPlan}</>}
                        </dd>
                      </div>
                    )}
                    {m.futureTarget && (
                      <div>
                        <dt className="inline font-medium text-on-surface">【今後】</dt>
                        <dd className="inline">{m.futureTarget}</dd>
                      </div>
                    )}
                    {m.quantitativeValue != null && (
                      <div>
                        <dt className="inline font-medium text-on-surface">数値：</dt>
                        <dd className="inline">
                          {m.quantitativeValue}
                          {m.quantitativeUnit ?? ""}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="mt-1.5 text-xs text-on-surface-variant">
                    <span className="font-medium text-on-surface">【出典】</span>
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${m.sourceTitle}を新しいタブで開く`}
                      className={`ml-1 inline-flex min-h-11 items-center gap-1 text-primary underline ${linkClass}`}
                    >
                      {m.sourceTitle}
                      {m.sourcePage && `（${m.sourcePage}）`}
                    </a>
                    　{formatJapaneseDate(m.snapshotDate)}現在
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-on-surface-variant">
            ここに示す「進捗」は公表資料に記載された事実の区分であり、当サイト独自の達成率・採点ではありません。
          </p>
        </SectionCard>
      )}

      {/* 判断根拠 */}
      <SectionCard title="判断根拠">
        <p className="text-sm leading-relaxed text-on-surface">{promise.notes ? humanizeDataNote(promise.notes) : UNREGISTERED}</p>
      </SectionCard>

      {/* 根拠資料一覧 */}
      <SectionCard title="根拠資料一覧">
        {evidenceDocs.length > 0 ? (
          <ul className="space-y-2.5">
            {evidenceDocs.map((doc) => {
              const pdf = isPdfUrl(doc.url);
              return (
                <li key={doc.key}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${doc.label}${doc.page ? `（${doc.page}）` : ""}を新しいタブで開く`}
                    className={`inline-flex flex-wrap items-center gap-1.5 rounded text-sm text-primary underline ${linkClass}`}
                  >
                    {pdf ? <DocumentIcon className="h-3.5 w-3.5 shrink-0" /> : <GlobeIcon className="h-3.5 w-3.5 shrink-0" />}
                    <span>
                      {doc.label}
                      {doc.page && `（${doc.page}）`}
                    </span>
                    {pdf && (
                      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
                        PDF
                      </span>
                    )}
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
                      {doc.sourceType}
                    </span>
                  </a>
                  {doc.publishedDate && (
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      資料公開日：{formatJapaneseDate(doc.publishedDate)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">根拠資料を確認中です</p>
        )}
      </SectionCard>

      {/* 予算措置・担当部署・発表日 */}
      <SectionCard title="関連情報">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-on-surface-variant">予算措置</dt>
            <dd className="mt-0.5 text-on-surface">{humanizeDataNote(relatedFieldDisplay(promise.relatedBudget, "予算"))}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-on-surface-variant">関連議案</dt>
            <dd className="mt-0.5 text-on-surface">{humanizeDataNote(relatedFieldDisplay(promise.relatedBill, "議案"))}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-on-surface-variant">担当部署</dt>
            <dd className="mt-0.5 text-on-surface">{promise.department ?? UNREGISTERED}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-on-surface-variant">発表日</dt>
            <dd className="mt-0.5 text-on-surface">
              {promise.announcedDate ? formatJapaneseDate(promise.announcedDate) : UNREGISTERED}
            </dd>
          </div>
        </dl>
      </SectionCard>

      {/* 関連事業候補：名称完全一致は無いが関連しうる候補（confirmedではなくcandidate等）。
          confirmedはこの配列では使用しない運用（validate-data.mjsで禁止）。確定情報は
          relatedBudget/relatedBillフィールドへ転記する。候補が1件も無い場合はセクション自体を
          表示しない。「公約達成」等の評価は絶対に表示しない。 */}
      {((promise.relatedBudgetCandidates?.length ?? 0) > 0 || (promise.relatedBillCandidates?.length ?? 0) > 0) && (
        <SectionCard title="関連事業候補（確定ではありません）">
          <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
            公約本文と名称が完全に一致する予算・議案は確認できていませんが、関連する可能性がある事業・議案の候補です。サイト独自の判定であり、公約の達成・未達成を示すものではありません。
          </p>
          <ul className="space-y-3">
            {[...(promise.relatedBudgetCandidates ?? []), ...(promise.relatedBillCandidates ?? [])].map((c) => (
              <li key={c.id} className="rounded-lg bg-surface-container-high p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-on-surface">{c.label}</span>
                  <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-semibold text-on-tertiary-container">
                    {CANDIDATE_STATUS_LABEL[c.status]}
                  </span>
                  {c.sourceType === "news" && (
                    <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface-variant">
                      報道（一次資料ではありません）
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">候補と判断した理由：{c.candidateReason}</p>
                <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-primary underline">
                  出典：{c.source}（{c.sourceDate}）
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* 関連議案・関連一般質問・関連記者会見（ID参照で確認できたもののみ表示） */}
      <SectionCard title="関連する議案・一般質問・記者会見">
        {relatedBills.length > 0 || relatedQuestions.length > 0 || relatedPressConferences.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {relatedBills.map((bill) => (
              <li key={bill.id}>
                <Link to={`/bills/votes/${bill.id}`} className={`text-primary underline ${linkClass}`}>
                  関連議案：{bill.billTitle}
                </Link>
              </li>
            ))}
            {relatedQuestions.map((q) => (
              <li key={q.id}>
                <Link to={`/questions/${q.id}`} className={`text-primary underline ${linkClass}`}>
                  関連する一般質問：{q.title}（{q.memberName}議員）
                </Link>
              </li>
            ))}
            {relatedPressConferences.map((c) => (
              <li key={c.date}>
                <Link to={`/mayor/press-conferences/${c.date}`} className={`text-primary underline ${linkClass}`}>
                  関連する市長記者会見：{c.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">関連情報は登録されていません</p>
        )}
      </SectionCard>

      {/* 関連する財政データ */}
      <SectionCard title="関連する財政データ">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          この公約に対応する個別の予算項目は、公式資料での特定ができ次第「予算措置」欄に反映します。延岡市全体の歳入・歳出、基金残高等は財政ダッシュボードで確認できます。
        </p>
        <Link
          to="/finance"
          className={`mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-primary underline ${linkClass}`}
        >
          <YenIcon className="h-3.5 w-3.5 shrink-0" />
          延岡市の財政データを見る
        </Link>
      </SectionCard>

      {/* 関連リンク */}
      {promise.relatedLinks && promise.relatedLinks.length > 0 && (
        <SectionCard title="関連リンク">
          <ul className="space-y-2">
            {promise.relatedLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${link.label}を新しいタブで開く`}
                  className={`inline-flex min-h-11 items-center gap-1.5 text-sm text-primary underline ${linkClass}`}
                >
                  <GlobeIcon className="h-3.5 w-3.5 shrink-0" />
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* 進捗履歴（Phase155：基準時点と進捗更新を区別して表示） */}
      <SectionCard title="進捗履歴">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          このセクションでは、「公約原文」自体が変更された場合と、公表資料に基づき進捗状況の確認が更新された場合を区別して記録します。現時点で公約原文の変更履歴は登録されていません（上記「公約原文」を参照）。以下は、この公約データの基準時点と、進捗確認が更新された時点の一覧です。
        </p>
        {promiseTimeline.length > 0 ? (
          <>
            <ol className="relative space-y-4 border-l border-outline-variant pl-4">
              {promiseTimeline.map((entry, i) => (
                <li key={i} className="relative">
                  <span
                    className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-outline"
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <time className="text-xs font-medium text-on-surface-variant">
                      {formatJapaneseDate(entry.date)}
                    </time>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        entry.kind === "baseline"
                          ? "bg-surface-container-high text-on-surface-variant"
                          : "bg-primary-container text-on-primary-container"
                      }`}
                    >
                      {entry.kind === "baseline" ? "基準時点" : "進捗更新"}
                    </span>
                    <MayorPromiseStatusBadge status={entry.statusLabel} />
                  </div>
                  {entry.kind === "baseline" ? (
                    <p className="mt-1 text-sm text-on-surface-variant">
                      この日を基準日として、公約の進捗状況・関連予算等のデータを整理しています（詳細は上記の各セクションを参照）。
                    </p>
                  ) : (
                    entry.summary && <p className="mt-1 text-sm text-on-surface">{humanizeDataNote(entry.summary)}</p>
                  )}
                  {entry.kind === "progress_update" && entry.sourceUrl && (
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${entry.sourceTitle ?? "根拠資料"}を新しいタブで開く`}
                      className={`mt-1 inline-flex min-h-11 items-center gap-1 text-xs text-primary underline ${linkClass}`}
                    >
                      <GlobeIcon className="h-3 w-3 shrink-0" />
                      {entry.sourceTitle ?? "根拠資料を見る"}
                    </a>
                  )}
                </li>
              ))}
            </ol>
            {promiseTimeline.length === 1 && promiseTimeline[0].kind === "baseline" && (
              <p className="mt-3 text-xs text-on-surface-variant">
                この基準日以降の進捗更新は、公開資料で確認でき次第追加します（最終確認日：
                {formatJapaneseDate(promise.lastVerified)}）。
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">
            この公約の詳細な変更履歴はまだ記録していません。現時点で確認できている状況は上記のとおりです（最終確認日：
            {formatJapaneseDate(promise.lastVerified)}）。
          </p>
        )}
      </SectionCard>

      {/* 確認日 */}
      <SectionCard title="確認日・更新日">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-on-surface-variant">最終確認日</dt>
            <dd className="mt-0.5 text-on-surface">{formatJapaneseDate(promise.lastVerified)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-on-surface-variant">最終更新日</dt>
            <dd className="mt-0.5 text-on-surface">
              {promise.siteUpdatedAt ? formatJapaneseDate(promise.siteUpdatedAt) : UNREGISTERED}
            </dd>
          </div>
        </dl>
      </SectionCard>

      {/* 注意事項 */}
      <SectionCard title="注意事項">
        <p className="text-xs leading-relaxed text-on-surface-variant">
          このページは、市長の公約、市長本人が公表した進捗資料、延岡市の施政方針・予算書などを基に公開情報を整理したものです。市長本人の自己評価と、延岡市が公表した事実は区別して表示しています。サイト独自の達成率・採点は行っておらず、根拠資料が確認できない場合に「未着手」と判定することもありません。掲載内容は、特定の政治家を支持、推薦、批判することを目的としたものではありません。詳しくは
          <Link to="/editorial-policy" className={`text-primary underline ${linkClass}`}>
            編集方針
          </Link>
          をご覧ください。
        </p>
      </SectionCard>

      {policyData.referenceUrl && (
        <p className="px-1 text-xs text-on-surface-variant">
          参考資料：
          <a
            href={policyData.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${policyData.referenceLabel}を新しいタブで開く`}
            className={`ml-1 text-primary underline ${linkClass}`}
          >
            {policyData.referenceLabel}
          </a>
        </p>
      )}

      {/* 同じカテゴリ内の前後の公約 */}
      {(prevPromise || nextPromise) && (
        <div className="flex flex-wrap items-stretch justify-between gap-2">
          {prevPromise ? (
            <Link
              to={`/mayor/policy-progress/${prevPromise.id}`}
              className={`min-w-0 flex-1 rounded-xl bg-surface-container-low p-3 text-sm shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
            >
              <span className="block text-xs text-on-surface-variant">同じ{MAYOR_PROMISE_LEVELS.policyArea.label}の前の{MAYOR_PROMISE_LEVELS.promise.label}</span>
              <span className="block truncate font-medium text-on-surface">{prevPromise.promiseText}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {nextPromise ? (
            <Link
              to={`/mayor/policy-progress/${nextPromise.id}`}
              className={`min-w-0 flex-1 rounded-xl bg-surface-container-low p-3 text-right text-sm shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
            >
              <span className="block text-xs text-on-surface-variant">同じ{MAYOR_PROMISE_LEVELS.policyArea.label}の次の{MAYOR_PROMISE_LEVELS.promise.label}</span>
              <span className="block truncate font-medium text-on-surface">{nextPromise.promiseText}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </div>
      )}

      {promise.lastVerified && (
        <LastUpdated dataAsOfLabel="この公約データの最終確認日" dataAsOf={formatJapaneseDate(promise.lastVerified)} />
      )}

      <CorrectionRequestButton pageName={promise.promiseText} />
    </div>
  );
}
