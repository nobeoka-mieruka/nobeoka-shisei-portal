import { Link, useLocation, useParams } from "react-router-dom";
import archiveMayorsData from "../data/archiveMayors.json";
import archiveMayorTermsData from "../data/archiveMayorTerms.json";
import archivePoliciesData from "../data/archivePolicies.json";
import type { ArchiveMayor, ArchiveMayorTerm, ArchivePolicy } from "../types/historicalArchive";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { BackLink } from "../components/BackLink";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { SourceRefList } from "../components/SourceRefList";
import { ClockIcon } from "../components/icons";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { formatJapaneseDate } from "../config/site";
import { formatArchiveDateWithPrecision, isActingMayorTerm, mayorRoleLabel, termsForMayor } from "../lib/archiveMayors";
import { buildCompareSearchParams } from "../lib/archiveCompare";
import { fiscalYearOfIsoDate } from "../lib/archiveTimeline";
import { civicTimelineEventsForPerson } from "../lib/civicTimeline";

const archiveMayors = archiveMayorsData as ArchiveMayor[];
const archiveMayorTerms = archiveMayorTermsData as ArchiveMayorTerm[];
const archivePolicies = archivePoliciesData as ArchivePolicy[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function MayorDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const mayor = archiveMayors.find((m) => m.slug === slug);

  if (!mayor) {
    return (
      <div className="space-y-4 px-4 py-4 sm:px-6">
        <BackLink to="/mayors" label="歴代市長一覧に戻る" />
        <p className="mt-4 rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
          指定された市長情報は見つかりませんでした。
        </p>
      </div>
    );
  }

  const terms = termsForMayor(archiveMayorTerms, mayor.id);
  const mayorById = new Map(archiveMayors.map((m) => [m.id, m]));
  const relatedPolicies = archivePolicies.filter((p) => p.ownerType === "mayor" && p.ownerId === mayor.id);
  const relatedEvents = civicTimelineEventsForPerson(mayor.id);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <BackLink to="/mayors" label="歴代市長一覧に戻る" />

      <section className="rounded-2xl bg-surface-container-low p-5 shadow-e1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-on-surface">{mayor.name}</h1>
          {mayor.isCurrentMayor && (
            <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
              現職
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-on-surface-variant">{mayor.nameKana || "読み：未確認"}</p>
        {mayor.alternateNames && mayor.alternateNames.length > 0 && (
          <p className="mt-1 text-xs text-on-surface-variant">別表記：{mayor.alternateNames.join("、")}</p>
        )}
        <p className="mt-2 text-xs text-on-surface-variant">
          生没年：
          {mayor.birthDate || mayor.deathDate
            ? `${mayor.birthDate ? formatJapaneseDate(mayor.birthDate) : "不明"}〜${mayor.deathDate ? formatJapaneseDate(mayor.deathDate) : mayor.status === "deceased" ? "不明" : ""}`
            : "資料未確認"}
          {mayor.birthplace ? `／出身地：${mayor.birthplace}` : ""}
        </p>
        {mayor.profile && <p className="mt-3 text-base leading-loose text-on-surface">{mayor.profile}</p>}
        {mayor.notes && <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{mayor.notes}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {mayor.isCurrentMayor && (
            <Link
              to="/mayor"
              className={`inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:opacity-90 ${linkClass}`}
            >
              現職市長の公約・市政方針を見る
            </Link>
          )}
          <Link
            to={`/compare/mayors?${buildCompareSearchParams([mayor.id]).toString()}`}
            className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
          >
            この市長を比較
          </Link>
          {terms[0] && (
            <Link
              to={`/timeline/${fiscalYearOfIsoDate(terms[0].termStart)}`}
              className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest ${linkClass}`}
            >
              この市長の任期を年表で見る
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">
          任期
          {terms.length > 0 && (
            <span className="ml-2 text-sm font-normal text-on-surface-variant">
              （確認済み{terms.length}期
              {terms.filter((t) => (t.termStartPrecision ?? "day") !== "day").length > 0
                ? `、うち日付精度が年・月単位のもの${terms.filter((t) => (t.termStartPrecision ?? "day") !== "day").length}期`
                : ""}
              ）
            </span>
          )}
        </h2>
        {terms.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">任期情報は確認中です。</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {terms.map((term) => {
              const previous = term.previousMayorId ? mayorById.get(term.previousMayorId) : undefined;
              const next = term.nextMayorId ? mayorById.get(term.nextMayorId) : undefined;
              return (
                <li key={term.id} className="rounded-lg border border-outline-variant p-3">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-on-surface">
                    <ClockIcon className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
                    {term.termNumber ? `第${term.termNumber}期　` : ""}
                    {formatArchiveDateWithPrecision(term.termStart, term.termStartPrecision, formatJapaneseDate)}〜
                    {formatArchiveDateWithPrecision(term.termEnd, term.termEndPrecision, formatJapaneseDate)}
                    {isActingMayorTerm(term) && (
                      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                        {mayorRoleLabel(term.mayorRole)}
                      </span>
                    )}
                  </p>
                  <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-2">
                    <div>
                      <dt className="inline">選挙日：</dt>
                      <dd className="inline">{term.electionDate ? formatJapaneseDate(term.electionDate) : "確認中"}</dd>
                    </div>
                    <div>
                      <dt className="inline">選挙区分：</dt>
                      <dd className="inline">{term.electionType ?? "確認中"}</dd>
                    </div>
                    <div>
                      <dt className="inline">退任理由：</dt>
                      <dd className="inline">{term.retirementReason ?? "確認中"}</dd>
                    </div>
                    <div>
                      <dt className="inline">就任当時人口：</dt>
                      <dd className="inline">
                        {term.populationAtStart != null ? `${term.populationAtStart.toLocaleString()}人` : "確認中"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">前任市長：</dt>
                      <dd className="inline">
                        {previous ? <Link to={`/mayors/${previous.slug}`} className={`text-primary hover:underline ${linkClass}`}>{previous.name}</Link> : "確認中"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">後任市長：</dt>
                      <dd className="inline">
                        {next ? <Link to={`/mayors/${next.slug}`} className={`text-primary hover:underline ${linkClass}`}>{next.name}</Link> : "確認中"}
                      </dd>
                    </div>
                  </dl>
                  {term.notes && <p className="mt-2 text-xs text-on-surface-variant">{term.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">関連政策（公約）</h2>
        {relatedPolicies.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {relatedPolicies.map((p) => (
              <li key={p.id}>
                <Link to={`/policies/${p.slug}`} className={`text-sm font-medium text-primary hover:underline ${linkClass}`}>
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : mayor.isCurrentMayor ? (
          <p className="mt-2 text-sm text-on-surface-variant">現時点で登録済みの公約はありません（0件）。</p>
        ) : (
          <p className="mt-2 text-sm text-on-surface-variant">
            当サイトの公約データベースは現職市長の任期のみを対象としており、歴代の市長の選挙公約・政策原文は収集していません（未収集）。0件確認済みという意味ではありません。
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          関連議案・関連条例・大型事業・災害対応等の詳細な出来事は、当サイトのデータ構造では市長単位に紐づけて管理する仕組みが今回のフェーズではまだ整備できていません（BLOCKED）。市政年表（
          {terms[0] ? (
            <Link to={`/timeline/${fiscalYearOfIsoDate(terms[0].termStart)}`} className={`text-primary hover:underline ${linkClass}`}>
              この市長の任期の年度
            </Link>
          ) : (
            "任期年度不明"
          )}
          ）で、同じ時期の議案・一般質問・財政データを横断的に確認できます。
        </p>
      </section>

      <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
        <h2 className="text-base font-semibold text-on-surface">市政上の主な出来事（在任中）</h2>
        {relatedEvents.length > 0 ? (
          <>
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
              延岡市公式ホームページの年表・資料をもとにした「
              <Link to={`/history?person=${mayor.id}`} className={`text-primary hover:underline ${linkClass}`}>
                市政年表
              </Link>
              」のうち、この市長の在任期間（確認できた任期）に含まれることが一次資料から確認できた出来事です（在任中に発生した出来事であり、この市長が実施した政策・実績を示すものではありません）。市庁舎・行政組織・災害・公共事業・教育福祉産業等を対象としており、網羅を保証するものではありません。
            </p>
            <ul className="mt-3 space-y-2">
              {relatedEvents.map((ev) => (
                <li key={ev.id} className="rounded-lg border border-outline-variant p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span className="font-medium text-on-surface">{ev.dateLabel}</span>
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-semibold text-on-surface-variant">
                      {ev.category}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-on-surface">{ev.title}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{ev.summary}</p>
                </li>
              ))}
            </ul>
            <Link
              to={`/history?person=${mayor.id}`}
              className={`mt-3 inline-block text-sm font-medium text-primary hover:underline ${linkClass}`}
            >
              市政年表でこの市長の在任期間の出来事だけを見る
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-on-surface-variant">
            当サイトの
            <Link to="/history" className={`mx-1 text-primary hover:underline ${linkClass}`}>
              市政年表
            </Link>
            のうち、この市長の在任期間に一次資料で明確に紐づけられた出来事は現在ありません（市政年表自体に出来事が掲載されていない、または在任期間との対応が資料から確定できないためで、在任中に何も無かったという意味ではありません）。
          </p>
        )}
      </section>

      {mayor.sourceRefs.length > 0 && (
        <section className="rounded-xl bg-surface-container-low p-4 shadow-e1 sm:p-5">
          <h2 className="text-base font-semibold text-on-surface">出典・確認状況</h2>
          <div className="mt-2">
            <SourceRefList refs={mayor.sourceRefs} />
          </div>
        </section>
      )}

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName={`${mayor.name}（歴代市長）`} />
      </div>
    </div>
  );
}
