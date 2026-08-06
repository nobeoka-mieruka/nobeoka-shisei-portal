import { Link, useLocation } from "react-router-dom";
import { sortedCommittees } from "../lib/committees";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const TYPE_DESCRIPTIONS: Record<string, string> = {
  常任委員会: "所管する分野の議案・請願等を専門的に審査する委員会です。",
  議会運営委員会: "本会議・委員会の運営や議会日程などを協議する委員会です。",
  特別委員会: "特定の事件・議案を審査するため、必要に応じて設置される委員会です。",
};

export function CommitteesPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const committees = sortedCommittees();

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">委員会一覧</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市議会の常任委員会・議会運営委員会・特別委員会について、延岡市議会公式ホームページが公表する委員名簿に基づいて整理しています。当サイトは公式サイトではありません。
        </p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        予算審査特別委員会・決算審査特別委員会・長期総合計画審査特別委員会など、定例会・臨時会ごとに議長を除く全議員で構成・設置される委員会は、委員名簿に個別掲載されないため、ここには含めていません（各委員会が審査した議案は「議案ごとの賛否」ページで確認できます）。
      </p>

      {(["常任委員会", "議会運営委員会", "特別委員会"] as const).map((type) => {
        const list = committees.filter((c) => c.type === type);
        if (list.length === 0) return null;
        return (
          <section key={type} className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-on-surface">{type}</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">{TYPE_DESCRIPTIONS[type]}</p>
            </div>
            <ul className="space-y-3">
              {list.map((committee) => {
                const chair = committee.members.find((m) => m.role === "委員長");
                return (
                  <li key={committee.id}>
                    <Link
                      to={`/committees/${committee.id}`}
                      className={`block rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high sm:p-5 ${linkClass}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-on-surface">{committee.name}</p>
                        <span className="shrink-0 rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
                          委員{committee.memberCount}名
                        </span>
                      </div>
                      {chair && (
                        <p className="mt-1 text-xs text-on-surface-variant">委員長：{chair.memberName}</p>
                      )}
                      <p className="mt-2 border-t border-outline-variant pt-2 text-sm text-primary">
                        委員名簿・審査議案を見る
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <CorrectionRequestButton pageName="委員会一覧" />
    </div>
  );
}
