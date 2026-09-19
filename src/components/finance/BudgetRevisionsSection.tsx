import { Link } from "react-router-dom";
import { SectionCard } from "../SectionCard";
import { GlobeIcon } from "../icons";
import { formatJapaneseDate, toEraFiscalYearLabel } from "../../config/site";
import { TRUST_LEVEL_LABEL } from "../../lib/councilGlossary";
import {
  budgetBill,
  budgetRevisionsForYear,
  formatOkuFromThousand,
  formatThousandYen,
  fundingRows,
  latestRevisionWithProjects,
  memberVoteText,
  policyCategoryLabel,
} from "../../lib/budgetRevisions";
import type { BudgetRevision, BudgetSource } from "../../types/budgetRevision";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function pdfHref(source: BudgetSource): string {
  return `${source.url}#page=${source.pdfPage}`;
}

function SourceLink({ source, label }: { source: BudgetSource; label?: string }) {
  return (
    <a
      href={pdfHref(source)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${source.title}（PDF ${source.pdfPage}ページ）を新しいタブで開く`}
      className={`inline-flex min-h-11 items-center gap-1 text-primary underline ${linkClass}`}
    >
      <GlobeIcon className="h-3.5 w-3.5 shrink-0" />
      {label ?? source.title}（PDF {source.pdfPage}ページ）
    </a>
  );
}

function BillDecision({ billId, billNumber }: { billId: string; billNumber: string }) {
  const bill = budgetBill(billId);
  return (
    <span>
      <Link to={`/bills/votes/${billId}`} className={`text-primary underline ${linkClass}`}>
        {billNumber}
      </Link>
      {bill?.result ? `：${bill.result}` : "：議決結果確認中"}
      {bill?.votingDate ? `（${formatJapaneseDate(bill.votingDate)}議決）` : ""}
    </span>
  );
}

/** 年度内の予算の変化（当初予算→各補正→現在の予算額）。 */
function RevisionTimeline({ revisions }: { revisions: BudgetRevision[] }) {
  const general = revisions
    .map((r) => ({ r, a: r.accounts.find((a) => a.accountName === "一般会計") }))
    .filter((x): x is { r: BudgetRevision; a: NonNullable<typeof x.a> } => Boolean(x.a));
  const initial = general.find((x) => x.r.kind === "initial");
  const latest = general.at(-1);
  return (
    <>
      <ol className="space-y-2">
        {general.map(({ r, a }) => (
          <li key={r.id} id={`budget-revision-${r.id}`} className="rounded-lg border border-outline-variant p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-semibold text-on-surface">{r.label}</p>
              <p className="text-xs text-on-surface-variant">
                <BillDecision billId={a.billId} billNumber={a.billNumber} />
              </p>
            </div>
            <dl className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
              {r.kind === "initial" ? (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-on-surface-variant">当初予算額</dt>
                  <dd className="font-semibold text-on-surface">{formatThousandYen(a.afterThousandYen)}</dd>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-on-surface-variant">今回の補正額</dt>
                    <dd className="font-semibold text-on-surface">＋{formatThousandYen(a.supplementaryThousandYen ?? 0)}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-on-surface-variant">補正後の予算額</dt>
                    <dd className="text-on-surface">
                      {formatThousandYen(a.afterThousandYen)}（{formatOkuFromThousand(a.afterThousandYen)}）
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <p className="mt-1 text-xs">
              <SourceLink source={r.sources[a.sourceIndex]} label={`出典：${r.sources[a.sourceIndex].sourceType}`} />
            </p>
          </li>
        ))}
      </ol>
      {initial && latest && latest.r.kind === "supplementary" && (
        <p className="mt-3 rounded-lg bg-surface-container-high p-3 text-xs leading-relaxed text-on-surface-variant">
          当初予算 {formatThousandYen(initial.a.afterThousandYen)} から、{general.length - 1}回の補正を経て、
          {latest.r.label}後の一般会計予算額は <span className="font-semibold text-on-surface">{formatThousandYen(latest.a.afterThousandYen)}</span>
          です（補正額の累計 {formatThousandYen(latest.a.afterThousandYen - initial.a.afterThousandYen)}。累計は当サイトが各段階の数値から計算）。
        </p>
      )}
    </>
  );
}

/**
 * Phase261：当初予算・補正予算の段階別データと、補正予算の事業を「予算→事業→議案→議決」の順で表示する。
 * 金額は資料どおり千円単位（財政ページの既存表記）。議決結果・議員別賛否は議案データから引く。
 */
export function BudgetRevisionsSection({ fiscalYear }: { fiscalYear: number }) {
  const revisions = budgetRevisionsForYear(fiscalYear);
  const target = latestRevisionWithProjects(fiscalYear);
  if (revisions.length === 0) return null;
  const eraYear = toEraFiscalYearLabel(fiscalYear);
  const account = target?.accounts.find((a) => a.accountName === "一般会計") ?? target?.accounts[0];
  const bill = account ? budgetBill(account.billId) : undefined;
  const groups = target ? [...new Set(target.projects.map((p) => p.group))] : [];

  return (
    <>
      <SectionCard title={`${eraYear} 一般会計予算の変化（当初予算→補正予算）`}>
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          単位：千円。「当初予算」「今回の補正額」「補正後の予算額」は別々の数値です。各段階の議案と議決結果は、延岡市議会の議案データにリンクしています。
        </p>
        <RevisionTimeline revisions={revisions} />
        <p className="mt-2 text-xs text-on-surface-variant">
          資料の掲載ページ：
          <a
            href={revisions[0].listingPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex min-h-11 items-center text-primary underline ${linkClass}`}
          >
            延岡市「{eraYear}予算」
          </a>
        </p>
      </SectionCard>

      {target && account && (
        <SectionCard title={`${target.label}予算の事業`}>
          <div className="mb-3 rounded-lg bg-surface-container-high p-3 text-sm">
            <dl className="space-y-1">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-on-surface-variant">補正額（{account.accountName}）</dt>
                <dd className="font-semibold text-on-surface">{formatThousandYen(account.supplementaryThousandYen ?? 0)}</dd>
              </div>
              {account.funding && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-on-surface-variant">財源</dt>
                  <dd className="text-on-surface">{fundingRows(account.funding).map((f) => `${f.label} ${f.value}`).join("／")}</dd>
                </div>
              )}
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-on-surface-variant">議案・議決</dt>
                <dd className="text-on-surface">
                  <BillDecision billId={account.billId} billNumber={account.billNumber} />
                  {bill?.session ? `（${bill.session}）` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">議員ごとの賛否</dt>
                <dd className="text-xs leading-relaxed text-on-surface">{memberVoteText(bill)}</dd>
              </div>
            </dl>
          </div>

          {groups.map((group) => {
            const projects = target.projects.filter((p) => p.group === group);
            const total = target.projectGroupTotals.find((g) => g.group === group);
            return (
              <div key={group} className="mb-4 last:mb-0">
                <h3 className="text-sm font-semibold text-on-surface">
                  {group}
                  {total && <span className="ml-2 text-xs font-normal text-on-surface-variant">合計 {formatThousandYen(total.supplementaryThousandYen)}</span>}
                </h3>
                <ul className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {projects.map((p) => {
                    const source = target.sources[p.sourceIndex];
                    return (
                      <li key={p.id} id={`budget-project-${p.id}`} className="rounded-lg border border-outline-variant p-3">
                        <p className="text-sm font-semibold text-on-surface">
                          {p.name}
                          {p.isNew && (
                            <span className="ml-2 inline-block rounded bg-primary-container px-1.5 py-0.5 text-[11px] font-medium text-on-primary-container">
                              新規事業
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-on-surface-variant">担当：{p.department}</p>
                        {p.policyCategoryIds.length > 0 && (
                          <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="分野">
                            {p.policyCategoryIds.map((c) => (
                              <li key={c} className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant">
                                {policyCategoryLabel(c)}
                              </li>
                            ))}
                          </ul>
                        )}
                        <dl className="mt-2 space-y-2 text-sm">
                          <div>
                            <dt className="text-xs font-semibold text-on-surface-variant">何のためのお金？</dt>
                            <dd className="leading-relaxed text-on-surface">{p.purpose}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold text-on-surface-variant">誰が対象？</dt>
                            <dd className="leading-relaxed text-on-surface">{p.targets ?? "資料に対象者・対象施設の記載はありません"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold text-on-surface-variant">いくら？</dt>
                            <dd className="text-on-surface">
                              補正額 <span className="font-semibold">{formatThousandYen(p.supplementaryThousandYen)}</span>
                              {p.beforeThousandYen > 0 && (
                                <span className="text-xs text-on-surface-variant">
                                  （補正前 {formatThousandYen(p.beforeThousandYen)} → 補正後 {formatThousandYen(p.afterThousandYen)}）
                                </span>
                              )}
                              <span className="mt-0.5 block text-xs text-on-surface-variant">
                                財源：{fundingRows(p.funding).map((f) => `${f.label} ${f.value}`).join("／")}
                              </span>
                              {p.breakdown.length > 0 && (
                                <details className="mt-1 text-xs text-on-surface-variant">
                                  <summary className={`inline-flex min-h-11 cursor-pointer items-center text-primary underline ${linkClass}`}>
                                    内訳を見る（{p.breakdown.length}件）
                                  </summary>
                                  <ul className="mt-1 space-y-0.5">
                                    {p.breakdown.map((b) => (
                                      <li key={b.label} className="flex flex-wrap justify-between gap-x-3">
                                        <span>{b.label}</span>
                                        <span className="font-medium text-on-surface">{formatThousandYen(b.thousandYen)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold text-on-surface-variant">いつ決まった？・議会では？</dt>
                            <dd className="text-on-surface">
                              <BillDecision billId={account.billId} billNumber={account.billNumber} />
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold text-on-surface-variant">関連する公約・政策</dt>
                            <dd className="text-xs leading-relaxed text-on-surface">
                              {p.relatedPromiseIds.length > 0 ? (
                                p.relatedPromiseIds.map((id) => (
                                  <Link key={id} to={`/mayor/policy-progress/${id}`} className={`mr-2 text-primary underline ${linkClass}`}>
                                    関連する公約
                                  </Link>
                                ))
                              ) : (
                                "公式資料で関連が明記されたものはありません（内容が似ているだけでは関連付けていません）"
                              )}
                            </dd>
                          </div>
                        </dl>
                        <p className="mt-1 text-xs">
                          <SourceLink source={source} label="原文を見る（延岡市 概要書）" />
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          <div className="mt-3 border-t border-outline-variant pt-2 text-xs text-on-surface-variant">
            <SourceLink source={target.sources[0]} />
            <p className="mt-1">
              公表機関：延岡市
              {target.sources[0].documentDate && `／資料の作成日：${formatJapaneseDate(target.sources[0].documentDate)}`}
              ／当サイト確認日：{formatJapaneseDate(target.sources[0].retrievedAt)}
              ／資料区分：延岡市公式（{TRUST_LEVEL_LABEL[target.sources[0].trustLevel] ?? target.sources[0].trustLevel}）
            </p>
          </div>
        </SectionCard>
      )}
    </>
  );
}
