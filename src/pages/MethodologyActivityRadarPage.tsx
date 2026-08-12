import { useLocation } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";

const AXES = [
  {
    label: "一般質問",
    definition: "在職中に会議録を取得・確認できた定例会のうち、一般質問・代表質問等を行ったことが確認できた会期の割合。",
    formula: "確認できた質問会期数 ÷ 対象会期数 × 100",
    source: "会議録本文（councilSpeechSummaries.json）",
  },
  {
    label: "議会発言",
    definition:
      "発言（一般質問等）が確認できた会期の割合と、確認できた質問項目数を組み合わせた指数。長文・多数項目の発言だけが有利にならないよう、項目数は上限20件で対数変換して頭打ちにしている。",
    formula: "（発言確認会期数÷対象会期数×50）＋（質問項目数を上限20件でlog正規化した値×50）",
    source: "会議録本文（councilSpeechSummaries.json）",
  },
  {
    label: "出席状況",
    definition: "本会議・委員会ごとの出席記録を確認できた割合。",
    formula: "出席回数 ÷ 出席対象会議数 × 100",
    source: "出席記録（本サイトは現時点で個別の出席記録を収録していないため、常に「対象記録なし」）",
  },
  {
    label: "議案等の意思表示",
    definition:
      "公開されている記名採決のうち、賛成・反対・棄権・欠席等の意思表示が確認できた議案の割合。賛成・反対どちらであるかを評価するものではない。",
    formula: "意思表示を確認できた議案数 ÷ 対象議案数 × 100（賛否の内容は得点化しない）",
    source:
      "議案ごとの賛否（billVotes.json）。2026-08時点で議員個人の賛否内訳（memberVotes）が登録済みなのは記名投票1件（27名分）のみのため、その27名以外の議員は「対象記録なし」となる。",
  },
  {
    label: "提案・討論等",
    definition: "議案提出、修正案提出、請願・陳情の紹介、賛成・反対討論、動議、要望・政策提案、委員長報告等が確認できた件数。",
    formula: "確認できた提案・討論等の件数を基に算定（現在データ整備中）",
    source: "議案・条例・請願・陳情アーカイブ（現時点では議員別の提案者情報が未収録のため「対象記録なし」）",
  },
  {
    label: "情報公開",
    definition:
      "議員本人の能力・活動量ではなく、ポータル上で確認できるプロフィール情報（経歴、所属会派、所属委員会、当選回数、公式ページ・SNS、一般質問履歴、議案賛否履歴等）の充足状況。SNSを利用していないこと自体を低評価とするものではない。",
    formula: "確認できた項目数 ÷ 確認対象項目数 × 100",
    source: "議員プロフィール（members.json・formerMembers.json・archiveMemberProfiles.json等）",
  },
];

export function MethodologyActivityRadarPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">
          議会活動データ（レーダーチャート）の算定方法
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          議員詳細ページに表示している「議会活動データ」レーダーチャートの定義・計算式・データの扱いを説明します。
        </p>
      </div>

      <SectionCard title="このチャートは人物評価ではありません">
        <p className="text-sm leading-relaxed text-on-surface">
          このレーダーチャートは、議員の優劣、能力、人物評価、推薦順位を示すものではありません。既存の一次情報・公開データを、項目ごとに共通基準で0〜100へ機械的に換算し、「公開情報から確認できる活動状況」を可視化しているだけです。独自の総合点、ランキング、順位、星評価、優秀・不十分などの判定は一切行っていません。
        </p>
      </SectionCard>

      <SectionCard title="6つの指標の定義・計算式・出典">
        <ul className="space-y-4">
          {AXES.map((axis) => (
            <li key={axis.label} className="rounded-lg border border-outline-variant p-3">
              <p className="text-sm font-semibold text-on-surface">{axis.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{axis.definition}</p>
              <p className="mt-2 text-xs text-on-surface-variant">計算式：{axis.formula}</p>
              <p className="mt-1 text-xs text-on-surface-variant">出典：{axis.source}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="欠損データの扱い">
        <p className="text-sm leading-relaxed text-on-surface">
          データが存在しない・不十分な項目は、0点として描画しません。「対象記録なし」「一部データのみ収録」として区別し、チャート上は欠損している軸をつなぐ塗りつぶし線を描かず、外周に破線のマーカーのみを表示します。全ての項目でデータが不足している場合は、チャート自体を表示せず「現在、この議員のレーダーチャートを作成できるだけの公開データがそろっていません。データは順次整備しています。」と案内します。
        </p>
      </SectionCard>

      <SectionCard title="在職期間の扱い">
        <p className="text-sm leading-relaxed text-on-surface">
          全議員を同じ固定期間で比較すると、任期途中の議員や過去の議員が不利になるため、議員ごとの在職期間を考慮しています。
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-on-surface-variant">
          <li>
            現職議員：現在の議員任期（令和5年4月23日執行の延岡市議会議員選挙）は全員が同一の選挙日であるため、公式会議録の取得・確認が完了している全ての定例会（現時点で12会期、令和5年6月〜令和8年3月）を対象期間とします。
          </li>
          <li>
            元議員：公式資料で在職・発言を確認できた会期（`formerMembers.json`の`servedSessions`）のみを対象期間とします。これは「確認できた在職会期数」であり、実際の在職期間全体を保証するものではない点に注意してください。
          </li>
          <li>会議録が未公開の会期（例：直近の定例会で会議録がまだ公開されていない場合）は、分母からも分子からも除外し、「質問しなかった」とは扱いません。</li>
        </ul>
      </SectionCard>

      <SectionCard title="現在データが不足している項目">
        <p className="text-sm leading-relaxed text-on-surface">
          「出席状況」「提案・討論等」の2項目は、本サイトが現時点でこれらの一次データ（個別の出席記録、議員別の提案者情報）を収録できていないため、全ての議員で「対象記録なし」と表示されます。「議案等の意思表示」は、議員別の議案賛否内訳（memberVotes）が記名投票1件（27名分）のみ登録済みのため、その27名以外の議員では「対象記録なし」となります。これは議員個人の活動が確認できないという意味ではなく、本サイトのデータ整備がまだ追いついていないことを示しています。データが収録され次第、順次反映します。
        </p>
      </SectionCard>

      <SectionCard title="市議会全体の平均値（参考線）">
        <p className="text-sm leading-relaxed text-on-surface">
          将来的に平均値を参考線として表示する場合も、同一在職期間ではなく各議員の対象可能期間を考慮し、欠損者を0として平均へ含めず、「優秀な基準」として提示しません。表示・非表示は利用者が切り替えられるようにします。
        </p>
      </SectionCard>

      <p className="rounded-xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
        このページは、延岡市政見える化ポータルの編集方針（特定の政党・会派・議員・候補者・政治団体を支持、推薦、批判しない）に基づいて作成しています。数値の算定に誤りや改善の余地があるとお気づきの場合は、情報提供・訂正依頼からお知らせください。
      </p>

      <LastUpdated className="mt-4" />
    </div>
  );
}
