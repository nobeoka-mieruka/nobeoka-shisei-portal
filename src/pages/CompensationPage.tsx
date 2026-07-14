import { useMemo } from "react";
import compensationData from "../data/compensationComparison.json";
import type { CompensationComparisonEntry } from "../types";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { SourceLink } from "../components/SourceLink";
import { LastUpdatedInfo } from "../components/LastUpdatedInfo";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { CompensationBarChart } from "../components/compensation/CompensationBarChart";
import { usePageTitle } from "../hooks/usePageTitle";
import { formatJapaneseDate } from "../config/site";
import { COMPENSATION_ROLES, calcAnnualEstimate, findRank, formatYen, getMonthly, rankByRole } from "../lib/compensation";

const comparison = compensationData as CompensationComparisonEntry[];
const NOBEOKA = "延岡市";

export function CompensationPage() {
  usePageTitle("市長・市議会議員の報酬");

  const nobeoka = comparison.find((c) => c.municipality === NOBEOKA);

  const rankings = useMemo(
    () =>
      COMPENSATION_ROLES.map((r) => {
        const ranked = rankByRole(comparison, r.key);
        return { role: r.key, label: r.label, rank: findRank(ranked, NOBEOKA) };
      }),
    [],
  );

  if (!nobeoka) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:px-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">市長・市議会議員の報酬</h1>
        <p className="mt-1 text-sm text-on-primary-container/80">
          延岡市長・議長・副議長・議員の月額報酬と、宮崎県内・近隣自治体との比較です（基準日：
          {formatJapaneseDate(nobeoka.referenceDate)}現在）。
        </p>
      </div>

      <SectionCard title="延岡市の報酬（現行月額）">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COMPENSATION_ROLES.map((r) => (
            <StatCard key={r.key} label={`${r.label} 給料・報酬月額`} value={formatYen(getMonthly(nobeoka, r.key))} compact />
          ))}
        </div>
        <p className="mt-3 text-xs text-on-surface-variant">
          市長は「給料」、議長・副議長・議員は「議員報酬」として支給される月額です。所得税等を差し引く前の額です。
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          {COMPENSATION_ROLES.map((r) => {
            const est = calcAnnualEstimate(nobeoka, r.key);
            return (
              <StatCard
                key={r.key}
                label={`${r.label} 年間支給見込額`}
                value={est.amount !== null ? formatYen(est.amount) : "算定不可"}
                hint={
                  est.amount !== null
                    ? "月額報酬と公表された支給月数による概算"
                    : "支給月数が公式資料で確認できないため未算定"
                }
                compact
              />
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
          年間支給見込額＝月額報酬×（12＋期末手当支給月数）で算定した概算です。交通費・旅費・政務活動費・共済費、および市長の退職手当は性質が異なるため含めていません。
        </p>
      </SectionCard>

      <SectionCard title="近隣4市中の順位（月額報酬）">
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          比較対象は延岡市・宮崎市・都城市・日向市の4市（基準日：{formatJapaneseDate(nobeoka.referenceDate)}
          現在の公表月額）です。月額報酬が高い順の順位で、同額の場合は同順位としています。
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rankings.map((r) => (
            <StatCard
              key={r.role}
              label={r.label}
              value={r.rank !== null ? `近隣4市中${r.rank}位` : "—"}
              compact
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="宮崎県内・全国での順位">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          全自治体の同一基準データを確認後に掲載予定です。一部の自治体データのみでは宮崎県内順位・全国順位を正しく算定できないため、現時点では推定値を掲載していません。
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <li className="rounded-lg border border-outline-variant p-3 text-sm text-on-surface-variant">
            宮崎県9市中の順位
            <span className="mt-1 block font-medium text-on-surface">準備中</span>
          </li>
          <li className="rounded-lg border border-outline-variant p-3 text-sm text-on-surface-variant">
            全国の類似団体中の順位
            <span className="mt-1 block font-medium text-on-surface">準備中</span>
          </li>
          <li className="rounded-lg border border-outline-variant p-3 text-sm text-on-surface-variant">
            全国の市区中の順位
            <span className="mt-1 block font-medium text-on-surface">準備中</span>
          </li>
        </ul>
      </SectionCard>

      <SectionCard title="自治体比較表">
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-xs text-on-surface-variant">
                <th className="py-2 pr-3 font-medium">自治体名</th>
                <th className="px-3 py-2 text-right font-medium">市長月額</th>
                <th className="px-3 py-2 text-right font-medium">議長月額</th>
                <th className="px-3 py-2 text-right font-medium">副議長月額</th>
                <th className="px-3 py-2 text-right font-medium">議員月額</th>
                <th className="px-3 py-2 text-left font-medium">期末手当</th>
                <th className="px-3 py-2 text-right font-medium">年間支給見込額（議員）</th>
                <th className="px-3 py-2 text-left font-medium">基準日</th>
                <th className="px-3 py-2 text-left font-medium">出典</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((c) => {
                const isNobeoka = c.municipality === NOBEOKA;
                const memberEstimate = calcAnnualEstimate(c, "member");
                return (
                  <tr
                    key={c.municipality}
                    className={`border-b border-outline-variant align-top last:border-0 ${
                      isNobeoka ? "border-l-4 border-l-primary bg-primary-container/30" : ""
                    }`}
                  >
                    <td className="py-3 pr-3 font-medium text-on-surface">{c.municipality}</td>
                    <td className="px-3 py-3 text-right text-on-surface">{formatYen(c.mayorMonthly)}</td>
                    <td className="px-3 py-3 text-right text-on-surface">{formatYen(c.chairMonthly)}</td>
                    <td className="px-3 py-3 text-right text-on-surface">{formatYen(c.viceChairMonthly)}</td>
                    <td className="px-3 py-3 text-right text-on-surface">{formatYen(c.memberMonthly)}</td>
                    <td className="px-3 py-3 text-on-surface-variant">
                      {c.councilBonusMonths !== null ? `${c.councilBonusMonths}か月分` : "資料未確認"}
                      {c.mayorBonusMonths !== null && c.mayorBonusMonths !== c.councilBonusMonths && (
                        <span className="block text-xs">（市長 {c.mayorBonusMonths}か月分）</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-on-surface">
                      {memberEstimate.amount !== null ? formatYen(memberEstimate.amount) : "算定不可"}
                    </td>
                    <td className="px-3 py-3 text-on-surface-variant">{formatJapaneseDate(c.referenceDate)}</td>
                    <td className="px-3 py-3">
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${c.sourceTitle}を新しいタブで開く`}
                        className="text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {c.sourceTitle}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 sm:hidden">
          {comparison.map((c) => {
            const isNobeoka = c.municipality === NOBEOKA;
            const memberEstimate = calcAnnualEstimate(c, "member");
            return (
              <div
                key={c.municipality}
                className={`rounded-xl border border-outline-variant p-4 ${
                  isNobeoka ? "border-l-4 border-l-primary bg-primary-container/30" : "bg-surface-container-low"
                }`}
              >
                <p className="font-semibold text-on-surface">{c.municipality}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-on-surface-variant">市長月額</dt>
                  <dd className="text-right text-on-surface">{formatYen(c.mayorMonthly)}</dd>
                  <dt className="text-on-surface-variant">議長月額</dt>
                  <dd className="text-right text-on-surface">{formatYen(c.chairMonthly)}</dd>
                  <dt className="text-on-surface-variant">副議長月額</dt>
                  <dd className="text-right text-on-surface">{formatYen(c.viceChairMonthly)}</dd>
                  <dt className="text-on-surface-variant">議員月額</dt>
                  <dd className="text-right text-on-surface">{formatYen(c.memberMonthly)}</dd>
                  <dt className="text-on-surface-variant">期末手当</dt>
                  <dd className="text-right text-on-surface">
                    {c.councilBonusMonths !== null ? `${c.councilBonusMonths}か月分` : "資料未確認"}
                  </dd>
                  <dt className="text-on-surface-variant">年間支給見込額（議員）</dt>
                  <dd className="text-right text-on-surface">
                    {memberEstimate.amount !== null ? formatYen(memberEstimate.amount) : "算定不可"}
                  </dd>
                  <dt className="text-on-surface-variant">基準日</dt>
                  <dd className="text-right text-on-surface">{formatJapaneseDate(c.referenceDate)}</dd>
                </dl>
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${c.sourceTitle}を新しいタブで開く`}
                  className="mt-2 inline-block text-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {c.sourceTitle}
                </a>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="月額報酬の比較（役職別グラフ）">
        <CompensationBarChart entries={comparison} />
        <p className="mt-4 text-xs leading-relaxed text-on-surface-variant">
          自治体ごとに人口、財政規模、職責、期末手当の算定方法などが異なるため、金額の高低だけで行政や議会を評価するものではありません。
        </p>
      </SectionCard>

      <SectionCard title="日向市の報酬改定に関する答申について">
        {(() => {
          const hyuga = comparison.find((c) => c.municipality === "日向市");
          if (!hyuga?.pendingProposal) return null;
          return (
            <div className="space-y-2">
              <span className="inline-block rounded-full bg-surface-variant px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
                改定案・未施行
              </span>
              <p className="text-sm leading-relaxed text-on-surface">{hyuga.pendingProposal.description}</p>
              {hyuga.pendingProposal.sourceUrl && (
                <SourceLink
                  url={hyuga.pendingProposal.sourceUrl}
                  label={hyuga.pendingProposal.sourceTitle ?? "根拠資料を見る"}
                />
              )}
            </div>
          );
        })()}
      </SectionCard>

      <SectionCard title="出典・参考資料">
        <ul className="space-y-3">
          {comparison.map((c) => (
            <li key={c.municipality} className="border-b border-outline-variant pb-3 last:border-0 last:pb-0">
              <p className="text-sm font-medium text-on-surface">{c.municipality}</p>
              <SourceLink url={c.sourceUrl} label={c.sourceTitle} verifiedAt={c.confirmedAt} className="mt-1" />
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{c.notes}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        掲載額は各自治体が公表する月額報酬・支給月数をもとにした概算であり、特定の自治体・議会・役職を批判または評価する目的のものではありません。
      </p>

      <LastUpdatedInfo verifiedAt={nobeoka.confirmedAt} updatedAt={nobeoka.confirmedAt} className="px-1" />

      <CorrectionRequestButton pageName="市長・市議会議員の報酬" />
    </div>
  );
}
