import { useLocation, Link } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { getAllFormerMemberActivity } from "../lib/formerMemberActivity";

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 元議員の活動履歴（参考情報）ページ（Phase116）。
 *
 * 【重要な設計方針】
 * - 現職議員の一覧比較ページ（/council-activity）とは完全に別画面とし、同一の表・ソート機能に
 *   混在させない。現職と元議員の対象期間・対象会期が異なるため、総合順位・単純な優劣比較は
 *   一切行わない（ソート機能自体を設けない）。
 * - 在職期間外の会期は「対象外」であり、欠席・0点として扱わない
 *   （`eligibleSessionIdsFor({isFormerMember:true, servedSessions})`が既に会期を絞り込んでいる）。
 * - 一般質問・議会内発言・議案等の意思表示の3指標のみ掲載する（出席状況・請願提案等・情報発信は
 *   元議員側のデータ構造上、今回は対象外＝not_applicableとして明示する）。
 */
export function CouncilActivityHistoryPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const entries = getAllFormerMemberActivity();

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-xl bg-primary-container p-4 text-on-primary-container">
        <h1 className="text-lg font-bold">元議員の活動履歴（参考情報）</h1>
        <p className="mt-1 text-xs text-on-primary-container/80">対象：現職ではない元議員{entries.length}名</p>
      </div>

      <p className="rounded-xl bg-surface-container-low p-3 text-xs leading-relaxed text-on-surface-variant">
        このページは、公開資料から確認できた元議員の活動記録を、在職期間内に限定して整理したものです。議員の能力、政策の質、政治的立場、人物評価を示すものではありません。
        <Link to="/council-activity" className={`font-medium text-primary underline ${linkClass}`}>
          現職議員の活動比較ページ
        </Link>
        とは対象期間・対象会期が異なるため、現職議員との数値の単純比較・総合順位付けはできません（本ページでは並べ替え機能を設けていません）。詳しい算定方法は
        <Link to="/methodology/activity-radar" className={`font-medium text-primary underline ${linkClass}`}>
          こちら
        </Link>
        。
      </p>

      <ul className="space-y-4">
        {entries.map((e) => (
          <li key={e.formerMemberId}>
            <SectionCard title={e.formerMemberName.replace(/\s+/g, "")}>
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                {e.formerMemberNameKana && <span>{e.formerMemberNameKana}</span>}
                <span>在職を確認できた会期：{e.servedSessionCount}会期（{e.servedPeriodLabel}）</span>
                <span>うち会議録取得済み：{e.eligibleSessionCount}会期</span>
              </div>

              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {e.metrics.map((m) => (
                  <div key={m.key} className="rounded-lg bg-surface-container-low p-3">
                    <dt className="text-xs text-on-surface-variant">{m.label}</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-on-surface">{m.value === null ? "対象記録なし" : `${m.value}%`}</dd>
                    <dd className="mt-1 text-xs leading-relaxed text-on-surface-variant">{m.description}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-3 text-xs font-medium text-on-surface-variant">今回対象としていない指標</p>
              <ul className="mt-1 space-y-1 text-xs leading-relaxed text-on-surface-variant">
                {e.notApplicableIndicators.map((n) => (
                  <li key={n.key}>
                    <span className="font-medium text-on-surface">{n.label}：</span>
                    {n.reason}
                  </li>
                ))}
              </ul>

              <Link
                to={`/members/former/${e.formerMemberId}`}
                className={`mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline ${linkClass}`}
              >
                プロフィール・発言記録の詳細を見る →
              </Link>
            </SectionCard>
          </li>
        ))}
      </ul>

      <p className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        このページは、延岡市政見える化ポータルの編集方針（特定の政党・会派・議員・候補者・政治団体を支持、推薦、批判しない）に基づいて作成しています。数値の算定に誤りや改善の余地があるとお気づきの場合は、下記からお知らせください。
      </p>

      <CorrectionRequestButton pageName="元議員の活動履歴" />

      <LastUpdated className="mt-2" />
    </div>
  );
}
