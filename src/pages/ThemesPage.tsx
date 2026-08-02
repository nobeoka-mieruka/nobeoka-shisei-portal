import { Link, useLocation } from "react-router-dom";
import themesData from "../data/themes.json";
import councilSpeechSummariesData from "../data/councilSpeechSummaries.json";
import membersData from "../data/members.json";
import type { CouncilMember, CouncilSpeechSummaryData, Theme } from "../types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { LastUpdated } from "../components/LastUpdated";
import { CorrectionRequestButton } from "../components/CorrectionRequestButton";
import { aggregateSpeechesByTheme } from "../lib/councilSpeeches";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";

const themes = themesData as Theme[];
const speechSummaryData = councilSpeechSummariesData as CouncilSpeechSummaryData;
const members = membersData as CouncilMember[];

const linkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function ThemesPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const aggregates = aggregateSpeechesByTheme(speechSummaryData.members);
  const bySlug = new Map(aggregates.map((a) => [a.slug, a]));
  const coveredMemberIds = new Set(aggregates.flatMap((a) => a.memberIds));
  const coveredMemberNames = members.filter((m) => coveredMemberIds.has(m.id)).map((m) => m.name);

  return (
    <div className="px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />
      <div className="mb-5 mt-3 rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">テーマから探す（試験公開中）</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          延岡市議会の一般質問・質疑を、公式会議録本文から確認できたテーマ別に整理しています。件数は事実集計であり、質問内容の質や議員活動全体を評価するものではありません。
        </p>
      </div>

      <div className="mb-5 rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        {coveredMemberNames.length > 0 ? (
          <p>
            現在、公式会議録本文から質問・答弁を確認できているのは次の議員です：{coveredMemberNames.join("、")}。他の議員についても、順次確認・追加します。
          </p>
        ) : (
          <p>現在、公式会議録本文からの質問・答弁データを準備中です。確認が済み次第、順次追加します。</p>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {themes.map((theme) => {
          const aggregate = bySlug.get(theme.slug);
          const questionCount = aggregate?.speechIds.length ?? 0;
          const memberCount = aggregate?.memberIds.length ?? 0;
          return (
            <li key={theme.id}>
              <Link
                to={`/themes/${theme.slug}`}
                className={`block h-full rounded-xl bg-surface-container-low p-4 shadow-e1 transition hover:bg-surface-container-high ${linkClass}`}
              >
                <p className="text-base font-semibold text-on-surface">{theme.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{theme.description}</p>
                <p className="mt-2 text-xs text-on-surface-variant">
                  {questionCount > 0
                    ? `このテーマに関する質問件数：${questionCount}件（${memberCount}名の議員）`
                    : "現在、このテーマに関する質問は確認できていません（未収録の可能性があります）"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 px-1 text-xs leading-relaxed text-on-surface-variant">
        テーマは、会議録本文・質問要約に明記された語句を機械的に分類したものです。件数は会議録上の質問をテーマ別に分類した集計であり、質問内容の質、政策への貢献度、議員活動全体を評価するものではありません。
      </p>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="テーマから探す" />
      </div>
    </div>
  );
}
