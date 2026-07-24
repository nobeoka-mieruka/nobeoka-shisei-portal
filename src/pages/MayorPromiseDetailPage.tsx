import { Link, useLocation, useParams } from "react-router-dom";
import policyProgressData from "../data/mayorPolicyProgress.json";
import mayorPromisesData from "../data/mayorPromises.json";
import billVotesData from "../data/billVotes.json";
import generalQuestionsData from "../data/generalQuestions.json";
import { mayorPressConferences } from "../data/mayorPressConferences";
import type {
  BillVoteItem,
  GeneralQuestionItem,
  MayorPolicyProgressData,
  MayorPromiseDocument,
  MayorPromiseItem,
  MayorPromisesData,
} from "../types";
import { BackLink } from "../components/BackLink";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { MayorPromiseStatusBadge } from "../components/mayor/MayorPromiseStatusBadge";
import { GlobeIcon, DocumentIcon, YenIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";

const promisesData = mayorPromisesData as MayorPromisesData;
const policyData = policyProgressData as MayorPolicyProgressData;
const billVotes = billVotesData as BillVoteItem[];
const generalQuestions = generalQuestionsData as GeneralQuestionItem[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** 未登録の任意項目を表示するときの共通文言。架空の値で埋めないためのプレースホルダー。 */
const UNREGISTERED = "情報未登録";

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

export function MayorPromiseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const promise = promisesData.promises.find((p) => p.id === id);
  const seo = getSeoForPath(location.pathname);

  usePageTitle();

  if (!promise) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <BackLink to="/mayor/policy-progress" label="公約一覧に戻る" />
        <div className="mt-4 space-y-4 rounded-xl bg-surface-container-low p-8 text-center">
          <p className="text-sm text-on-surface-variant">該当する公約が見つかりません</p>
          <Link
            to="/mayor/policy-progress"
            className={`inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container shadow-e1 transition hover:opacity-90 ${linkClass}`}
          >
            公約一覧へ戻る
          </Link>
        </div>
      </div>
    );
  }

  const evidenceDocs = collectEvidenceDocs(promise);
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
      <BackLink to="/mayor/policy-progress" label="公約一覧に戻る" />

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

      {/* 判断根拠 */}
      <SectionCard title="判断根拠">
        <p className="text-sm leading-relaxed text-on-surface">{promise.notes || UNREGISTERED}</p>
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
                    className={`inline-flex flex-wrap items-center gap-1.5 rounded text-sm text-primary hover:underline ${linkClass}`}
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
            <dd className="mt-0.5 text-on-surface">{promise.relatedBudget}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-on-surface-variant">関連議案（公約文中の言及）</dt>
            <dd className="mt-0.5 text-on-surface">{promise.relatedBill}</dd>
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

      {/* 関連議案・関連一般質問・関連記者会見（ID参照で確認できたもののみ表示） */}
      <SectionCard title="関連する議案・一般質問・記者会見">
        {relatedBills.length > 0 || relatedQuestions.length > 0 || relatedPressConferences.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {relatedBills.map((bill) => (
              <li key={bill.id}>
                <Link to={`/bills/votes/${bill.id}`} className={`text-primary hover:underline ${linkClass}`}>
                  関連議案：{bill.billTitle}
                </Link>
              </li>
            ))}
            {relatedQuestions.map((q) => (
              <li key={q.id}>
                <Link to={`/questions/${q.id}`} className={`text-primary hover:underline ${linkClass}`}>
                  関連する一般質問：{q.title}（{q.memberName}議員）
                </Link>
              </li>
            ))}
            {relatedPressConferences.map((c) => (
              <li key={c.date}>
                <Link to={`/mayor/press-conferences/${c.date}`} className={`text-primary hover:underline ${linkClass}`}>
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
          className={`mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
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
                  className={`inline-flex items-center gap-1.5 text-sm text-primary hover:underline ${linkClass}`}
                >
                  <GlobeIcon className="h-3.5 w-3.5 shrink-0" />
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* 進捗履歴 */}
      <SectionCard title="進捗履歴">
        {promise.progressHistory && promise.progressHistory.length > 0 ? (
          <ul className="space-y-3">
            {[...promise.progressHistory].reverse().map((h, i) => (
              <li key={i} className="border-b border-outline-variant pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-on-surface-variant">{formatJapaneseDate(h.date)}</span>
                  <MayorPromiseStatusBadge status={h.statusLabel} />
                </div>
                {(h.summary || h.note) && (
                  <p className="mt-1 text-sm text-on-surface">{h.summary ?? h.note}</p>
                )}
                {h.sourceUrl && (
                  <a
                    href={h.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${h.sourceTitle ?? "根拠資料"}を新しいタブで開く`}
                    className={`mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline ${linkClass}`}
                  >
                    <GlobeIcon className="h-3 w-3 shrink-0" />
                    {h.sourceTitle ?? "根拠資料を見る"}
                  </a>
                )}
              </li>
            ))}
          </ul>
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
            className={`ml-1 text-primary hover:underline ${linkClass}`}
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
              <span className="block text-xs text-on-surface-variant">同じカテゴリの前の公約</span>
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
              <span className="block text-xs text-on-surface-variant">同じカテゴリの次の公約</span>
              <span className="block truncate font-medium text-on-surface">{nextPromise.promiseText}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </div>
      )}

      <CorrectionRequestButton pageName={promise.promiseText} />
    </div>
  );
}
