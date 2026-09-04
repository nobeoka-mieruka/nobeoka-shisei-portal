import { useLocation, Link } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import { activityTargetPeriodLabel, getAllCurrentMemberActivity, getEvidenceAvailabilitySummary } from "../lib/councilActivityBarometer";
import { evidenceAvailabilityLabel, evidenceAvailabilityDescription } from "../lib/evidenceAvailability";

/**
 * 議会活動データ（レーダーチャート）の算定方法ページ。
 *
 * Phase95で、各指標の透明性を高めるため以下の構造化項目を追加した：
 * indicatorId・targetPeriod・sourceTypes・missingDataPolicy・exclusionRule・completenessNote
 * （lastCalculatedAtは指標一律ではなく議員ごとに異なるため、個人ページ側〔各指標カード〕で表示する）。
 * 数値は既存の`src/lib/activityRadar.ts`・`councilActivityBarometer.ts`から都度再計算しており、
 * このページに独自の集計ロジックは持たない（既存ロジックを壊さないため）。
 */
const AXES = [
  {
    indicatorId: "question",
    label: "一般質問",
    definition: "在職中に会議録を取得・確認できた定例会のうち、一般質問・代表質問等を行ったことが確認できた会期の割合。",
    formula: "確認できた質問会期数 ÷ 対象会期数 × 100",
    sourceTypes: "一次資料（会議録本文）",
    source: "会議録本文（会議録の発言要約データ）",
    targetPeriod: "現職議員：会議録取得済みの全会期／元議員：在職・発言を確認できた会期のみ",
    missingDataPolicy: "対象会期数が0（＝在職・会議録取得済みの会期が無い）の場合のみ「対象記録なし」とする。0点として扱わない。",
    exclusionRule: "会議録が未公開の会期は分母からも分子からも除外する（「質問しなかった」とみなさない）。",
  },
  {
    indicatorId: "speech",
    label: "議会内発言",
    definition:
      "発言（一般質問等）が確認できた会期の割合と、確認できた質問項目数を組み合わせた指数。長文・多数項目の発言だけが有利にならないよう、項目数は上限20件で対数変換して頭打ちにしている。",
    formula: "（発言確認会期数÷対象会期数×50）＋（質問項目数を上限20件でlog正規化した値×50）",
    sourceTypes: "一次資料（会議録本文）",
    source: "会議録本文（会議録の発言要約データ）",
    targetPeriod: "一般質問と同じ（現職議員：会議録取得済みの全会期／元議員：在職・発言を確認できた会期のみ）",
    missingDataPolicy: "対象会期数が0の場合のみ「対象記録なし」とする。0点として扱わない。",
    exclusionRule: "会議録が未公開の会期は分母からも分子からも除外する。",
  },
  {
    indicatorId: "attendance",
    label: "出席状況",
    definition: "本会議・委員会ごとの出席記録を確認できた割合。",
    formula: "出席回数 ÷ 出席対象会議数 × 100",
    sourceTypes: "現時点で該当なし（一次資料未収録）",
    source: "出席記録（本サイトは現時点で個別の出席記録を収録していないため、常に「対象記録なし」）",
    targetPeriod: "（データ未収録のため算定対象期間なし）",
    missingDataPolicy: "本サイトが個別出席記録を一切収録していないため、全議員が常に「対象記録なし」（missing）。0点にはしない。",
    exclusionRule: "該当なし。",
  },
  {
    indicatorId: "voting",
    label: "議案等の意思表示",
    definition:
      "公開されている記名採決のうち、賛成・反対・棄権・欠席等の意思表示が確認できた議案の割合。賛成・反対どちらであるかを評価するものではない。",
    formula: "意思表示を確認できた議案数 ÷ 対象議案数 × 100（賛否の内容は得点化しない）",
    sourceTypes: "一次資料（議案ごとの賛否・会議録）",
    source: "議案ごとの賛否（議案賛否データ）",
    targetPeriod: "議員個人の賛否内訳（memberVotes）が登録されている議案が対象",
    missingDataPolicy:
      "対象議案が0件（＝その議員について意思表示が確認できた議案が1件も無い）の場合は「対象記録なし」とする。0点として扱わない。",
    exclusionRule: "個人別の賛否内訳が登録されていない議案（起立採決など）は、分母（対象議案数）に含めない。",
  },
  {
    indicatorId: "proposal",
    label: "請願・提案等",
    definition: "議案提出、修正案提出、請願・陳情の紹介、賛成・反対討論、動議、要望・政策提案、委員長報告等が確認できた件数。",
    formula: "確認できた提案・討論等の件数を基に算定（現在データ整備中）",
    sourceTypes: "現時点で該当なし（一次資料未収録）",
    source: "議案・条例・請願・陳情アーカイブ（現時点では議員別の提案者情報が未収録のため「対象記録なし」）",
    targetPeriod: "（データ未収録のため算定対象期間なし）",
    missingDataPolicy: "議員別の提案者・紹介議員情報を一切収録していないため、全議員が常に「対象記録なし」（missing）。0点にはしない。",
    exclusionRule: "該当なし。",
  },
  {
    indicatorId: "disclosure",
    label: "情報発信・プロフィール充足度",
    definition:
      "議員本人の能力・活動量ではなく、ポータル上で確認できるプロフィール情報（経歴、所属会派、所属委員会、当選回数、公式ページ・SNS、一般質問履歴、議案賛否履歴等）の充足状況。SNSを利用していないこと自体を低評価とするものではない。",
    formula: "確認できた項目数 ÷ 確認対象項目数 × 100",
    sourceTypes: "一次資料＋準一次資料（議員プロフィール・本人確認済みSNS）",
    source: "議員プロフィール（現職議員データ・元議員データ・議員プロフィールデータ等）",
    targetPeriod: "現時点のプロフィール情報（期間の概念はなし）",
    missingDataPolicy: "確認対象項目自体が定義できない場合のみ「対象記録なし」。通常は必ず0〜100の実値が算定される（未記入も「確認した結果」として扱う）。",
    exclusionRule: "該当なし。",
  },
] as const;

const DATA_STATUS_JA: Record<string, string> = {
  confirmed_zero: "確認済みで0件",
  not_collected: "一次資料未収録",
  unavailable: "資料非公開",
  under_review: "調査中",
  not_applicable: "指標対象外",
};

export function MethodologyActivityRadarPage() {
  const location = useLocation();
  const seo = getSeoForPath(location.pathname);
  usePageTitle();

  const entries = getAllCurrentMemberActivity();
  const targetPeriod = activityTargetPeriodLabel();
  const completenessByIndicator = AXES.map((axis) => {
    const complete = entries.filter((e) => e.metrics.find((m) => m.key === axis.indicatorId)?.dataStatus === "complete").length;
    const partial = entries.filter((e) => e.metrics.find((m) => m.key === axis.indicatorId)?.dataStatus === "partial").length;
    const missing = entries.filter((e) => e.metrics.find((m) => m.key === axis.indicatorId)?.dataStatus === "missing").length;
    return { ...axis, complete, partial, missing, total: entries.length };
  });
  const evidenceSummary = getEvidenceAvailabilitySummary();

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
          議員詳細ページ・議員活動バロメーターに表示している「議会活動データ」レーダーチャートの定義・計算式・データの扱いを説明します。
        </p>
        <p className="mt-1 text-xs text-on-primary-container/80">現在の算定対象期間：{targetPeriod}</p>
      </div>

      <SectionCard title="このチャートは人物評価ではありません">
        <p className="text-sm leading-relaxed text-on-surface">
          このレーダーチャートは、議員の優劣、能力、人物評価、推薦順位を示すものではありません。既存の一次情報・公開データを、項目ごとに共通基準で0〜100へ機械的に換算し、「公開情報から確認できる活動状況」を可視化しているだけです。独自の総合点、ランキング、順位、星評価、優秀・不十分などの判定は一切行っていません。
        </p>
      </SectionCard>

      <SectionCard title="「0点」と「対象外」は別物です">
        <p className="text-sm leading-relaxed text-on-surface">
          本サイトでは、次の状態を明確に区別しています。0件（該当する活動が確認された結果として本当に0件）を、資料が無いために評価できない「対象外」と混同して表示することはありません。
        </p>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          内部的には「算定可能（complete、下表の実数はこの状態で0件だった場合も含む＝confirmed_zero）」「一部データのみ（partial）」「対象記録なし（missing、一次資料未収録＝not_collected／資料非公開＝unavailable／指標対象外＝not_applicable などが含まれます）」の3区分で管理しており、missing系の詳細な内訳は各指標の「欠損データの扱い」欄で個別に説明しています。
        </p>
        <ul className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-on-surface-variant sm:grid-cols-2">
          {Object.entries(DATA_STATUS_JA).map(([key, label]) => (
            <li key={key} className="rounded-lg bg-surface-container-high px-2.5 py-1.5">
              <span className="font-mono text-[10px] text-on-surface-variant">{key}</span>：{label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          レーダーチャート上でも、資料が確認できない指標は0点の位置に描画せず、外周に破線のマーカーのみを表示します（塗りつぶし多角形には含めません）。数値表示部分も「0」ではなく「対象記録なし」と明記します。
        </p>
      </SectionCard>

      <SectionCard title="「確認済み」「一部公開」「公開資料未確認」「公開待ち」の意味">
        <p className="text-sm leading-relaxed text-on-surface">
          <Link to="/council-activity" className="font-medium text-primary underline">
            議員活動バロメーター
          </Link>
          や
          <Link to="/data-status" className="font-medium text-primary underline">
            データ収録状況
          </Link>
          ページでは、指標が「対象記録なし」になっている理由を、次の4つの状態文言で市民向けに説明しています。これらはスコアではなく、資料の収録状況の説明です。資料が公開されていない項目を0点として扱うことはありません。
        </p>
        <dl className="mt-3 space-y-2 text-xs leading-relaxed text-on-surface-variant">
          {(["confirmed", "partial", "research_exhausted", "waiting_external"] as const).map((code) => (
            <div key={code} className="rounded-lg bg-surface-container-high px-3 py-2">
              <dt className="font-medium text-on-surface">
                {evidenceAvailabilityLabel(code)}
                <span className="ml-1 font-normal text-on-surface-variant">（{code}）</span>
              </dt>
              <dd>{evidenceAvailabilityDescription(code)}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-3 grid grid-cols-1 gap-1.5 text-xs text-on-surface-variant sm:grid-cols-2">
          {evidenceSummary.map((item) => (
            <li key={item.key} className="rounded-lg border border-outline-variant px-2.5 py-1.5">
              <span className="font-medium text-on-surface">{item.label}</span>：{item.statusText}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="6つの指標の定義・計算式・出典・データ収録状況">
        {/* Phase214：内部コード（indicatorId）を凡例なしで置かない。何の記号かを先に説明する。 */}
        <p className="mb-3 text-xs leading-relaxed text-on-surface-variant">
          各指標の右上にある「算定用の記号（algorithm ID）」は、当サイトが計算処理の中でその指標を指すために使っている英字の名前です（question＝一般質問、speech＝議会内発言、attendance＝出席状況、voting＝議案等の意思表示、proposal＝請願・提案等、disclosure＝情報発信・プロフィール充足度）。点数や順位を表すものではありません。当サイトの記録に出てくる他の記号・番号の読み方は
          <Link to="/data-status" className="mx-1 font-medium text-primary underline">
            データ収録状況ページの凡例
          </Link>
          にまとめています。
        </p>
        <ul className="space-y-4">
          {completenessByIndicator.map((axis) => (
            <li key={axis.indicatorId} className="rounded-lg border border-outline-variant p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-on-surface">{axis.label}</p>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant">
                  算定用の記号（algorithm ID）：{axis.indicatorId}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{axis.definition}</p>
              <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium text-on-surface">計算式：</dt>
                  <dd className="inline">{axis.formula}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-on-surface">資料種別：</dt>
                  <dd className="inline">{axis.sourceTypes}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-on-surface">対象期間：</dt>
                  <dd className="inline">{axis.targetPeriod}</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-on-surface">出典：</dt>
                  <dd className="inline">{axis.source}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                <span className="font-medium text-on-surface">欠損データの扱い：</span>
                {axis.missingDataPolicy}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                <span className="font-medium text-on-surface">除外ルール：</span>
                {axis.exclusionRule}
              </p>
              <p className="mt-2 rounded-md bg-surface-container-high px-2.5 py-1.5 text-xs text-on-surface-variant">
                現職議員{axis.total}名中：算定可能{axis.complete}名／一部データのみ{axis.partial}名／対象記録なし{axis.missing}名
                （このページを開くたびに既存データから自動再集計しています）
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="在職期間の扱い">
        <p className="text-sm leading-relaxed text-on-surface">
          全議員を同じ固定期間で比較すると、任期途中の議員や過去の議員が不利になるため、議員ごとの在職期間を考慮しています。
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-on-surface-variant">
          <li>現職議員：現在の議員任期は全員が同一の選挙日であるため、公式会議録の取得・確認が完了している全ての定例会（現在：{targetPeriod}）を対象期間とします。</li>
          <li>
            元議員：公式資料で在職・発言を確認できた会期（元議員データの「在職した会期」）のみを対象期間とします。これは「確認できた在職会期数」であり、実際の在職期間全体を保証するものではない点に注意してください。
          </li>
          <li>会議録が未公開の会期（例：直近の定例会で会議録がまだ公開されていない場合）は、分母からも分子からも除外し、「質問しなかった」とは扱いません。</li>
        </ul>
      </SectionCard>

      <SectionCard title="現在データが不足している項目">
        <p className="text-sm leading-relaxed text-on-surface">
          「出席状況」「請願・提案等」の2項目は、本サイトが現時点でこれらの一次データ（個別の出席記録、議員別の提案者情報）を収録できていないため、全ての議員で「対象記録なし」と表示されます。「議案等の意思表示」は、議員個人の議案賛否内訳（memberVotes）が登録されている議案が現時点で記名投票1件（令和5年7月臨時会、当時27名分）のみのため、この1議案についてのみ判定できます。現職議員{entries.length}名は全員この記名投票の対象だったため{entries.length}名とも算定可能ですが、対象議案が1件のみである点にご留意ください。これは議員個人の活動が確認できないという意味ではなく、本サイトのデータ整備がまだ追いついていないことを示しています。データが収録され次第、順次反映します。
        </p>
      </SectionCard>

      <SectionCard title="一覧・個人ページに表示している「実数」の補足">
        <p className="text-sm leading-relaxed text-on-surface">
          議員活動バロメーターの一覧・個人ページには、上記6指標の0〜100点の指数とは別に、次の「実数」も表示しています。いずれも新しい採点・順位ロジックではなく、既存の一次資料をそのまま数え上げたものです。
        </p>
        <dl className="mt-3 space-y-2 text-xs leading-relaxed text-on-surface-variant">
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">発言件数</dt>
            <dd>
              「議会内発言」指数の算定に使っている、確認できた質問項目数（rawValue）そのものです。指数化する前の件数を、順位や比較に使いたい場合の実数として表示しています。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">提出者件数（決議）</dt>
            <dd>
              本会議での決議（決議案）の提出者として会議録で確認できた件数です。延岡市議会全体の議員提出決議は計8件あり、うち7件は提出者を特定できましたが、1件（2021年6月定例会）は会議録から個人名を確認できませんでした。条例案・請願・意見書等の提出者、請願・陳情の紹介議員は対象に含みません（別途「紹介議員件数」として「確認中」と表示しています）。0件はこの決議8件の範囲で提出者として確認できなかったことを示す確定値（confirmed_zero）であり、活動が無いという意味ではありません。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">情報発信媒体数</dt>
            <dd>本人確認済み（verified）のSNS・Web媒体数に、議会公式プロフィールページを加えた実数です。「情報発信・プロフィール充足度」指数（0〜100点）の分子とは項目の数え方が異なります。</dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">議席番号</dt>
            <dd>議員詳細ページ（現職議員データ）の確認済みプロフィール本文に記載されている議席番号をそのまま表示しています。新しい調査は行っていません。</dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">選挙時得票（参考情報）</dt>
            <dd>令和5年4月23日執行の延岡市議会議員選挙における得票数（選挙結果データ）です。活動指標スコアには一切含めていません。</dd>
          </div>
        </dl>
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
