import { Link, useLocation, useParams } from "react-router-dom";
import { getCommittee, billsForCommittee, reportsForCommittee } from "../lib/committees";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { SourceLink } from "../components/SourceLink";
import { LastUpdatedInfo } from "../components/LastUpdatedInfo";
import { BackLink } from "../components/BackLink";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { getSeoForPath } from "../lib/seo";
import type { CommitteeRole } from "../types";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const ROLE_ORDER: Record<CommitteeRole, number> = { 委員長: 0, 副委員長: 1, 委員: 2 };

function formatDateOrRaw(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatJapaneseDate(value) : value;
}

/** "令和6年度"等の和暦年度表記から、並び替え用の数値を取り出す（表示自体は元の文字列のまま使う）。 */
function eraYearNumber(label: string | undefined): number {
  const m = label?.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

export function CommitteeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const committee = id ? getCommittee(id) : undefined;
  const seo = getSeoForPath(location.pathname);

  usePageTitle();

  if (!committee) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <BackLink to="/committees" label="委員会一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された委員会の情報は見つかりませんでした。
        </p>
      </div>
    );
  }

  const orderedMembers = [...committee.members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const reviewedBills = billsForCommittee(committee.name);
  const activityReports = reportsForCommittee(committee.id);

  const billsByFiscalYear = new Map<string, typeof reviewedBills>();
  for (const bill of reviewedBills) {
    const key = bill.fiscalYear ?? "年度不明";
    const group = billsByFiscalYear.get(key);
    if (group) group.push(bill);
    else billsByFiscalYear.set(key, [bill]);
  }
  const fiscalYearGroups = [...billsByFiscalYear.entries()].sort(
    (a, b) => eraYearNumber(b[0]) - eraYearNumber(a[0]),
  );
  const distinctSessionCount = new Set(reviewedBills.map((b) => b.sessionId).filter(Boolean)).size;
  const seiganCount = reviewedBills.filter((b) => b.category === "請願").length;
  const chinjoCount = reviewedBills.filter((b) => b.category === "陳情").length;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <span className="inline-flex rounded-full bg-surface-container-lowest px-2.5 py-0.5 text-xs font-semibold text-on-surface">
          {committee.type}
        </span>
        <h1 className="mt-2 text-xl font-semibold leading-relaxed text-on-primary-container break-words sm:text-2xl">
          {committee.name}
        </h1>
        <p className="mt-1 text-sm text-on-primary-container/80">委員{committee.memberCount}名</p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        出典：延岡市議会公式ホームページが公表する委員名簿等の公表資料。当サイトは公式サイトではありません。
      </p>

      <SectionCard title="基本情報">
        <dl className="divide-y divide-outline-variant text-sm">
          <div className="flex items-center justify-between gap-2 py-1.5">
            <dt className="text-on-surface-variant">区分</dt>
            <dd className="font-medium text-on-surface">{committee.type}</dd>
          </div>
          {committee.jurisdiction ? (
            <div className="flex items-center justify-between gap-2 py-1.5">
              <dt className="text-on-surface-variant">所管事項</dt>
              <dd className="text-right font-medium text-on-surface">{committee.jurisdiction}</dd>
            </div>
          ) : (
            <div className="py-1.5">
              <dt className="text-on-surface-variant">所管事項</dt>
              <dd className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                {committee.type === "常任委員会" ? (
                  <>
                    延岡市議会委員会条例の該当条文を確認できておらず、確定できていません（最終確認日：
                    {formatDateOrRaw(committee.lastVerifiedAt)}）。新たな一次資料を確認でき次第、更新します。
                  </>
                ) : (
                  <>
                    常任委員会（延岡市議会委員会条例第2条第2項）とは異なり、条例上、所管事項が個別に列挙されていません（延岡市例規集で条文本文を確認済み・最終確認日：
                    {formatDateOrRaw(committee.lastVerifiedAt)}）。詳しい理由は下記の説明を参照してください。
                  </>
                )}
              </dd>
            </div>
          )}
          {(committee.termStart || committee.termEnd) && (
            <div className="flex items-center justify-between gap-2 py-1.5">
              <dt className="text-on-surface-variant">任期</dt>
              <dd className="font-medium text-on-surface">
                {committee.termStart ? formatDateOrRaw(committee.termStart) : "確認中"}
                {" 〜 "}
                {committee.termEnd ? formatDateOrRaw(committee.termEnd) : "確認中"}
              </dd>
            </div>
          )}
          {committee.establishedDate && (
            <div className="flex items-center justify-between gap-2 py-1.5">
              <dt className="text-on-surface-variant">設置日</dt>
              <dd className="font-medium text-on-surface">{formatDateOrRaw(committee.establishedDate)}</dd>
            </div>
          )}
        </dl>
        {committee.notes && <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">{committee.notes}</p>}
      </SectionCard>

      <SectionCard title="委員名簿">
        <ul className="divide-y divide-outline-variant text-sm">
          {orderedMembers.map((m) => (
            <li key={m.memberId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link
                to={`/members/${m.memberId}`}
                className={`font-medium text-primary hover:underline ${linkClass}`}
              >
                {m.memberName}
              </Link>
              <span className="shrink-0 rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-semibold text-on-surface">
                {m.role}
              </span>
              {m.appointedNote && (
                <p className="w-full text-xs text-on-surface-variant">{m.appointedNote}</p>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="審査した議案">
        {reviewedBills.length === 0 ? (
          <p className="rounded-lg bg-surface-container-high/70 px-3 py-2.5 text-xs leading-relaxed text-on-surface-variant">
            当サイトのデータベースで、本委員会が付託先として確認できた議案はまだ登録されていません。
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-on-surface-variant">
              合計{reviewedBills.length}件（{distinctSessionCount}会期分）
              {(seiganCount > 0 || chinjoCount > 0) &&
                `、うち請願${seiganCount}件・陳情${chinjoCount}件を含む`}
              。委員会単独の開催日・開催回数は
              公式資料で公表されていないため、ここでは議案が審査された定例会・臨時会の会期数で示しています。
            </p>
            <div className="space-y-4">
              {fiscalYearGroups.map(([fiscalYear, bills]) => (
                <div key={fiscalYear}>
                  <h3 className="text-xs font-semibold text-on-surface-variant">
                    {fiscalYear}（{bills.length}件）
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {bills.map((bill) => (
                      <li key={bill.id}>
                        <Link
                          to={`/bills/votes/${bill.id}`}
                          className={`block rounded-lg border border-outline-variant p-3 transition hover:bg-surface-container-high ${linkClass}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                            <p className="text-xs text-on-surface-variant">
                              {(bill.category === "請願" || bill.category === "陳情") && (
                                <span className="mr-1.5 rounded bg-secondary-container px-1.5 py-0.5 text-[11px] font-semibold text-on-secondary-container">
                                  {bill.category}
                                </span>
                              )}
                              {bill.billNumber}
                              {bill.votingDate ? `（${formatDateOrRaw(bill.votingDate)}）` : ""}
                            </p>
                            {bill.result && (
                              <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface">
                                本会議：{bill.result}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 font-medium text-on-surface">{bill.billTitle}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {activityReports.length > 0 && (
        <SectionCard title="活動報告書（所管事務調査）">
          <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
            延岡市議会公式ホームページが公表する、本委員会が年度ごとに選んだ調査テーマの視察・調査まとめです。
            議案の審査記録ではありません。
          </p>
          <ul className="space-y-2">
            {activityReports.map((report) => (
              <li key={report.id} className="rounded-lg border border-outline-variant p-3">
                <p className="text-xs text-on-surface-variant">令和{report.fiscalYear - 2018}年度</p>
                <p className="mt-0.5 font-medium text-on-surface">{report.title}</p>
                <SourceLink url={report.url} label="報告書PDFを見る" className="mt-2" />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="根拠資料">
        <ul className="space-y-2">
          {committee.sourceRefs.map((ref) => (
            <li key={ref.url}>
              <SourceLink url={ref.url} label={ref.label} />
            </li>
          ))}
        </ul>
        {committee.minutesSearchUrl && (
          <SourceLink url={committee.minutesSearchUrl} label="会議録検索システムで確認する" className="mt-3" />
        )}
      </SectionCard>

      <LastUpdatedInfo verifiedAt={committee.lastVerifiedAt} className="px-1" />

      <CorrectionRequestButton pageName={committee.name} />
    </div>
  );
}
