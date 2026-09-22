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
import { isPolicyTheme } from "../lib/topicClassificationMeta";

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
  // 「未分類」「その他」は政策テーマではない。前者は自動分類が当たらなかった状態、
  // 後者はキーワードが1つも定義されておらず分類先として選ばれない受け皿。
  // 政策テーマのカードに混ぜると、分類できていないことが1つの政策分野のように見える。
  const policyThemes = themes.filter((t) => isPolicyTheme(t.slug));
  const nonPolicyThemes = themes.filter((t) => !isPolicyTheme(t.slug));
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
        {policyThemes.map((theme) => {
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

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-on-surface">分類の状況</h2>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          テーマは、会議録の見出し語をキーワード辞書と照合して自動で分類しています（AIによる内容の判定は行っていません）。
          どのキーワードにも当たらない語句は、推測で分野を割り当てず「未分類」としています。未分類が多いことは、
          その分野の質問が少ないという意味ではなく、辞書に受け皿の語がまだ足りないことを示します。
        </p>
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {nonPolicyThemes.map((theme) => {
            const aggregate = bySlug.get(theme.slug);
            const questionCount = aggregate?.speechIds.length ?? 0;
            return (
              <li key={theme.id}>
                <Link
                  to={`/themes/${theme.slug}`}
                  className={`block h-full rounded-xl border border-outline-variant p-3 transition hover:bg-surface-container-high ${linkClass}`}
                >
                  <p className="text-sm font-semibold text-on-surface">{theme.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{theme.description}</p>
                  <p className="mt-1.5 text-xs text-on-surface-variant">
                    {questionCount > 0
                      ? `${questionCount}件の質問が、このどの分野にも分類されていません`
                      : "該当する質問はありません"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-6 px-1 text-xs leading-relaxed text-on-surface-variant">
        件数は会議録上の質問をテーマ別に分類した集計であり、質問内容の質、政策への貢献度、議員活動全体を評価するものではありません。分類の詳しい方法は
        <Link to="/methodology/council-activity" className={`mx-1 font-medium text-primary underline ${linkClass}`}>
          議会活動の記録の算定方法
        </Link>
        で説明しています。
      </p>

      <LastUpdated className="mt-4" />

      <div className="mt-4">
        <CorrectionRequestButton pageName="テーマから探す" />
      </div>
    </div>
  );
}
