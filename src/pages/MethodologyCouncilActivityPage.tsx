import { useLocation, Link } from "react-router-dom";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { JsonLd } from "../components/JsonLd";
import { SectionCard } from "../components/SectionCard";
import { LastUpdated } from "../components/LastUpdated";
import { usePageTitle } from "../hooks/usePageTitle";
import { getSeoForPath } from "../lib/seo";
import {
  activityTargetPeriodLabel,
  currentTermNamedVoteBillCount,
  getAllCurrentMemberActivity,
  getEvidenceAvailabilitySummary,
  isCouncilChairperson,
} from "../lib/councilActivityBarometer";
import { evidenceAvailabilityLabel, evidenceAvailabilityDescription } from "../lib/evidenceAvailability";
import { classifyTopicToThemeSlug } from "../lib/themeClassification";
import { TOPIC_CLASSIFICATION_VERSION } from "../lib/topicClassificationMeta";
import { AXIS_STATUS_LABELS_JA, buildCouncilActivityProfile } from "../lib/councilActivityProfile";
import { debateTargetPeriodLabel, getMemberActivityRecord } from "../lib/councilActivityBarometer";
import { formatJapaneseDate } from "../config/site";
import billProposalRolesData from "../data/billProposalRoles.json";
import committeeReportActivityData from "../data/committeeReportActivity.json";
import speechSummaryData from "../data/councilSpeechSummaries.json";
import councilDebateSpeechesData from "../data/councilDebateSpeeches.json";
import { QUESTION_LIKE_SPEECH_TYPES } from "../lib/questionLikeSpeechTypes";

/**
 * 議会活動の記録（公開された一次資料から確認できた事実）の算定方法ページ。
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
    missingDataPolicy: "対象会期数が0（＝在職・会議録取得済みの会期が無い）の場合のみ「対象記録なし」とする。0件として扱わない。",
    exclusionRule: "会議録が未公開の会期は分母からも分子からも除外する（「質問しなかった」とみなさない）。",
  },
  {
    indicatorId: "speech",
    label: "議会内発言",
    definition:
      "会議録で確認できた質問項目の実数。会期ごとに要約を抽出できた量が異なるため、件数の多い少ないをそのまま活動量の差とは読めない。割合には換算せず、実数のまま示す。",
    formula: "確認できた質問項目数（実数。0〜100の指数へは換算しない）",
    sourceTypes: "一次資料（会議録本文）",
    source: "会議録本文（会議録の発言要約データ）",
    targetPeriod: "一般質問と同じ（現職議員：会議録取得済みの全会期／元議員：在職・発言を確認できた会期のみ）",
    missingDataPolicy: "会議録を未取得の会期がある場合、その分の項目は数に含まれない（「質問しなかった」という意味ではない）。",
    exclusionRule: "会議録が未公開・未取得の会期は集計対象に含めない。",
  },
  {
    indicatorId: "attendance",
    label: "出席状況",
    definition:
      "本会議・委員会に議員一人ひとりが出席したかどうかは、数値にしていません。議員別の出席・欠席名簿を、複数の公開資料経路を調査しましたが確認できていないためです（延岡市議会が公表していないと断定するものではありません）。",
    formula: "算定していません。出席率・出席回数のいずれも表示しません。",
    sourceTypes: "議員別の出席・欠席を示す一次資料を確認できていない",
    source:
      "記名投票が行われた議案では、投票した議員の氏名が会議録・「のべおか市議会だより」に記録されています。ただしこれはその日その議案の投票に加わった記録であり、会期全体の出席状況ではないため、出席として数えていません。",
    targetPeriod: "（算定していないため対象期間なし）",
    missingDataPolicy: "全議員を「対象記録なし」とします。欠席が0件という意味でも、出席が0件という意味でもありません。",
    exclusionRule: "該当なし（算定自体を行っていないため）。",
  },
  {
    indicatorId: "voting",
    label: "議案等の意思表示",
    definition:
      "公開されている記名採決のうち、賛成・反対・棄権・欠席等の意思表示が確認できた議案の数を、対象議案数とあわせて示します。割合を0〜100の値へ換算して他の項目と並べることはしません。賛成・反対どちらであるかを評価するものでもありません。",
    formula: "意思表示を確認できた議案数／対象議案数（分子・分母をそのまま示す。賛否の内容は数値化しない）",
    sourceTypes: "一次資料（議案ごとの賛否・会議録）",
    source: "議案ごとの賛否（議案賛否データ）",
    targetPeriod: "議員個人の賛否内訳（memberVotes）が登録されている議案が対象",
    missingDataPolicy:
      "対象議案が0件（＝その議員について意思表示が確認できた議案が1件も無い）の場合は「対象記録なし」とする。0件として扱わない。",
    exclusionRule: "個人別の賛否内訳が登録されていない議案（起立採決など）は、分母（対象議案数）に含めない。",
  },
  {
    indicatorId: "proposal",
    label: "請願・提案等",
    definition:
      "会議録に議員名が記載されていて個人に帰属できるものだけを、実数のまま掲載しています。対象は「決議の提出者」と「本会議での委員長・副委員長報告」の2種類で、これらを合成した割合や点数は算定していません。",
    formula: "算定していません。確認できた件数をそれぞれ別の実数として表示します。",
    sourceTypes: "一次資料（会議録本文）",
    source: "議員提出決議の提案理由説明（決議の提出者）、本会議での委員長・副委員長報告（会議録から氏名を機械的に確認・登録）",
    targetPeriod: "会議録本文を取得・確認できた会期",
    missingDataPolicy:
      "条例案・意見書等の提出者と、請願・陳情の紹介議員は、議員別に収録できていないため「確認中」と表示します。0件ではありません。レーダー用の指標としては全議員を「対象記録なし」とします。",
    exclusionRule:
      "委員会での質疑は会議録の委員長報告に「委員より」とだけ記録され、誰の発言かを特定できないため、件数に加えず「個人別の記録なし」として扱います。",
  },
  {
    indicatorId: "disclosure",
    label: "情報発信・プロフィール充足度",
    definition:
      "議員本人の能力・活動量ではなく、ポータル上で確認できるプロフィール情報（経歴、所属会派、所属委員会、当選回数、公式ページ・SNS、一般質問履歴、議案賛否履歴等）の充足状況。SNSを利用していないこと自体を低評価とするものではない。",
    formula: "確認できた項目数／確認対象項目数（分子・分母をそのまま示す）",
    sourceTypes: "一次資料＋準一次資料（議員プロフィール・本人確認済みSNS）",
    source: "議員プロフィール（現職議員データ・元議員データ・議員プロフィールデータ等）",
    targetPeriod: "現時点のプロフィール情報（期間の概念はなし）",
    missingDataPolicy: "確認対象項目自体が定義できない場合のみ「対象記録なし」。通常は必ず分子・分母が確定する（未記入も「確認した結果」として扱う）。",
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

export function MethodologyCouncilActivityPage() {
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
  // 7軸の定義は、議員ページと同じ関数から取る（説明と実装がずれないようにする）。
  // 軸ごとの説明は議員によって変わらないため、代表として1名分を使う。
  const profileAxes = entries.length
    ? buildCouncilActivityProfile(
        entries[0].member,
        getMemberActivityRecord(entries[0].member),
        targetPeriod,
        entries.length,
        debateTargetPeriodLabel(),
      )
    : [];
  const chairpersonEntries = entries.filter((e) => isCouncilChairperson(e.member));
  // 討論の収録状況。件数は手書きせず、データから数える。
  const debateData = councilDebateSpeechesData as unknown as {
    generatedAt?: string;
    speeches: { memberId: string | null; stance: "for" | "against" | "mixed" | "unclear"; stanceTarget?: string }[];
  };
  const debateSummary = {
    total: debateData.speeches.length,
    current: debateData.speeches.filter((d) => d.memberId).length,
    verifiedAt: debateData.generatedAt ?? null,
    stance: {
      for: debateData.speeches.filter((d) => d.stance === "for").length,
      against: debateData.speeches.filter((d) => d.stance === "against").length,
      mixed: debateData.speeches.filter((d) => d.stance === "mixed").length,
      unclear: debateData.speeches.filter((d) => d.stance === "unclear").length,
    },
    unspecified: debateData.speeches.filter((d) => d.stanceTarget === "unspecified").length,
  };
  // 「請願・提案等」で個人に帰属できている記録の件数。手書きせず実データから数える。
  const decisionSubmitterRecordCount = (billProposalRolesData as { roles: { role: string }[] }).roles.filter(
    (r) => r.role === "submitter",
  ).length;
  const committeeReportRecordCount = (committeeReportActivityData as { events: { memberId?: string }[] }).events.filter(
    (e) => !!e.memberId,
  ).length;
  // テーマ分類の到達率は、手書きの数値を置かずにこのページで都度数える（辞書を更新すれば自動で変わる）。
  const topicClassification = (() => {
    let total = 0;
    let unclassified = 0;
    for (const m of (speechSummaryData as { members: { speeches: { speechType: string; topics?: string[] }[] }[] }).members) {
      for (const sp of m.speeches) {
        if (!QUESTION_LIKE_SPEECH_TYPES.has(sp.speechType)) continue;
        for (const t of sp.topics ?? []) {
          total += 1;
          if (classifyTopicToThemeSlug(t) === "unclassified") unclassified += 1;
        }
      }
    }
    return { total, unclassified, rate: total > 0 ? Math.round((unclassified / total) * 100) : null };
  })();

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      {seo.jsonLd.map((entry) => (
        <JsonLd key={entry.id} id={entry.id} data={entry.data} />
      ))}
      <Breadcrumbs items={seo.breadcrumbs} />

      <div className="rounded-2xl bg-gradient-to-br from-primary-container to-surface-container-low p-5 shadow-e1 sm:p-6">
        <h1 className="text-xl font-semibold text-on-primary-container sm:text-2xl">
          議会活動の記録の算定方法
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-on-primary-container/80">
          議員詳細ページ・議員活動バロメーターに表示している議会活動の記録について、対象資料・対象期間・算定方法・欠損の扱いを説明します。複数の項目を合算した総合点や議員の順位付けは行っていません。
        </p>
        <p className="mt-1 text-xs text-on-primary-container/80">現在の算定対象期間：{targetPeriod}</p>
      </div>

      <SectionCard title="このページの目的">
        <p className="text-sm leading-relaxed text-on-surface">
          延岡市議会等が公開する一次資料から確認できる事実を、全議員に共通の基準で整理し、算定方法と根拠を公開するためのページです。
          市民が数値をそのまま受け取るのではなく、元の一次資料まで辿って自分で確かめられるようにすることを目的にしています。
        </p>
        <p className="mt-3 rounded-lg bg-surface-container-high p-3 text-sm leading-relaxed text-on-surface">
          ここに掲載している記録は、<strong>政策内容への賛否</strong>、<strong>賛成・反対の方向</strong>、
          <strong>議員個人の人格・能力</strong>を評価するものではありません。
          複数の項目を合計した総合点、議員の順位付け、平均より上か下かという評価は一切行っていません。
        </p>
      </SectionCard>

      <SectionCard title="延岡市議会基本条例との関係">
        <p className="text-sm leading-relaxed text-on-surface">
          何を記録として整理するかは、延岡市議会基本条例が議会・議員に定めている役割を出発点にしています。
          条例に根拠を求めるのは、当サイトが独自に「議員とはこうあるべきだ」と決めないためです。
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-on-surface-variant">
          <li>一般質問の実施状況・再質問は、第2条第1号（市長等が行う市政の運営状況を公正に監視、評価すること）に対応します。</li>
          <li>政策テーマは、第2条第2号（政策の立案・決定・執行・評価における論点、争点を明らかにすること）に対応します。</li>
          <li>
            条例のうち「議会は」を主語とする条文（第5条〜第22条の大半）は、議会全体としての責務を定めたものです。
            これらを議員一人ひとりの記録へ割り振ることはしていません。会派や委員会、議会全体の活動を個人の実績に按分しないためです。
          </li>
          <li>
            敬老会・地域の祭り・草刈り・清掃活動・冠婚葬祭・個人的なボランティア・SNSでの発信などは、
            条例が定める議会・議員の職務ではないため、記録の対象にしていません。行っていないという意味ではありません。
          </li>
        </ul>
      </SectionCard>

      <SectionCard title="一般質問の実施状況（会期単位）の算定方法">
        <p className="text-sm leading-relaxed text-on-surface">
          議員個人に確実に帰属し、全議員を同じ条件で数えられるのは、現時点では「その会期に本会議で質問に立ったかどうか」です。質問項目数や再質問数は、会議録から要約を取り込めた量に左右され、会期によって1登壇あたりの記録量が大きく異なります。そのため会期単位を中心に置き、件数は参考の実数として併記しています。
        </p>
        <dl className="mt-3 space-y-2 text-xs leading-relaxed text-on-surface-variant">
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">対象資料</dt>
            <dd>延岡市議会の公式会議録（本会議）本文のみ。報道、SNS、後援会資料などの二次資料は使いません。</dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">対象期間</dt>
            <dd>{targetPeriod}（会議録本文を取得・確認できた定例会のみ）。</dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">一般質問実施率</dt>
            <dd>
              一般質問を行った会期数 ÷ 一般質問が可能だった会期数 × 100。質問の回数・長さ・内容の良し悪しは含みません。画面には必ず分子と分母を並べて表示します。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">再質問の確認率</dt>
            <dd>
              再質問を会議録で確認できた質問項目数 ÷ 質問項目の総数 × 100。答弁を受けて重ねて質問した記録があるかどうかだけを数えており、やり取りの内容は評価しません。質問項目が0件の会期しかない場合は0%とせず、算定しません。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">議長在任期間の扱い</dt>
            <dd>
              議長は会議の進行役を務めるため一般質問を行わない慣例があります。議長在任期間は実施率の分母から除き、0%ではなく「対象外」と表示します（現在：現職議員{entries.length}名中{chairpersonEntries.length}名）。活動が少ないという意味ではありません。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">欠損の扱い</dt>
            <dd>
              会議録が未公開・未取得の会期は、分母にも分子にも入れません。「確認した結果0件」と「まだ確認できていない」「公式資料が未公表」「個人別の記録がない」「制度上の対象外」は、画面上でも別々の言葉で表示し、どれも0件としては扱いません。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">個人への帰属ルール</dt>
            <dd>
              会議録に発言者として氏名が記載されている記録だけを、その議員の記録として数えます。委員会の質疑のように「委員より」とだけ記録され誰の発言か特定できないものは、件数に加えず「個人別の記録なし」として扱います。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">テーマの分類方法</dt>
            <dd>
              会議録の見出し語を、あらかじめ人が定義したテーマ辞書のキーワードと文字列で照合しているだけで、AIによる内容の判定は行っていません。どのキーワードにも一致しない語句は推測で分類せず「未分類」とします
              {topicClassification.rate !== null &&
                `（現在：${topicClassification.total.toLocaleString("ja-JP")}語句中${topicClassification.unclassified.toLocaleString("ja-JP")}語句・約${topicClassification.rate}%が未分類）`}
              。テーマそのものに重要度の差は付けません。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">更新のタイミング</dt>
            <dd>新しい会議録を取り込むたびに再計算されます。このページの数値も、開くたびに既存データから自動で集計しています。最終更新日はページ末尾に表示しています。</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="議会活動プロフィールの算定方法">
        <p className="text-sm leading-relaxed text-on-surface">
          各議員のページに表示している{profileAxes.length}つの軸について、条例との関係、何を測っているか、何を測っていないか、算定式、除外条件、
          一次資料、更新方法を公開します。第三者が同じ一次資料から再計算できることを目標にしています。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          当初は延岡市議会基本条例に示された役割をそのまま7つの軸にしていましたが、一次資料を調べた結果、
          「請願・陳情の紹介」「予算・決算特別委員会」「委員会での役職と報告」の3つは、全議員に同じ算定方法を
          適用できないことが分かったため、軸から外しました。請願の紹介議員は公開資料に定型掲載されておらず、
          予算・決算特別委員会は議長を除く全議員が委員で委員会内の質疑が匿名、委員長報告は役職に就いた議員にしか
          発生しません（実データでは26名中13名が0件でした）。いずれも記録そのものは各議員のページの
          「議会での活動」に、確認できた範囲で掲載しています。
        </p>
        <p className="mt-2 rounded-lg bg-surface-container-high p-3 text-sm leading-relaxed text-on-surface">
          この指標は、議員の能力、人格、優秀さ、政治的立場を評価するものではありません。
          公開一次資料から確認できる活動記録を、共通ルールで整理したものです。
          軸を合計した総合点、偏差値、順位づけは作成していません。
        </p>
        <ul className="mt-3 space-y-3">
          {profileAxes.map((axis) => (
            <li key={axis.key} className="rounded-lg border border-outline-variant p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-on-surface">
                  {axis.order}. {axis.label}
                </p>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant">
                  {axis.measurement ? "割合を算定する軸" : AXIS_STATUS_LABELS_JA[axis.status]}
                </span>
              </div>
              <dl className="mt-2 space-y-1 text-xs leading-relaxed text-on-surface-variant">
                {[
                  ["条例との関係", axis.roleInOrdinance],
                  ["今回観測している活動", axis.observedActivity],
                  ["何を測っているか", axis.measures],
                  ["何を測っていないか", axis.doesNotMeasure],
                  ["使用データ", axis.dataUsed],
                  [
                    "算定式",
                    axis.measurement
                      ? `${axis.measurement.numeratorLabel} ÷ ${axis.measurement.denominatorLabel} × 100`
                      : "割合としては算定していません。",
                  ],
                  ["分子", axis.numeratorRule],
                  ["分母", axis.denominatorRule],
                  ["上限の意味", axis.upperBoundMeaning],
                  ["除外条件", axis.notApplicableRule],
                  ["算定の可否", axis.reason],
                  ["欠損時の扱い", axis.missingRule],
                  ["個人への帰属", axis.individualAttribution],
                  ["対象期間", axis.targetPeriodLabel],
                  ["更新方法", axis.updateRule],
                  ["最終確認日", axis.lastCheckedAt ? formatJapaneseDate(axis.lastCheckedAt) : "記録なし"],
                ].map(([term, value]) => (
                  <div key={term}>
                    <dt className="inline font-medium text-on-surface">{term}：</dt>
                    <dd className="inline">{value}</dd>
                  </div>
                ))}
                <div key="sources">
                  <dt className="inline font-medium text-on-surface">一次資料：</dt>
                  <dd className="inline">
                    {axis.sourceRefs.map((ref, i) => (
                      <span key={ref.label}>
                        {i > 0 && "、"}
                        {ref.url ? (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            {ref.label}
                          </a>
                        ) : (
                          ref.label
                        )}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="本会議の討論の扱い">
        <p className="text-sm leading-relaxed text-on-surface">
          討論は、議案の採決の前に議員が登壇して賛成・反対の理由を述べるものです。会議録に発言者の氏名が記録されるため、
          個人に帰属できる数少ない記録として扱っています。現在、{debateSummary.total}件（うち現職議員{debateSummary.current}件）を収録し、
          すべてを会議録の原文と照合しています（最終照合日：{debateSummary.verifiedAt ? formatJapaneseDate(debateSummary.verifiedAt) : "記録なし"}）。
        </p>
        <dl className="mt-3 space-y-2 text-xs leading-relaxed text-on-surface-variant">
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">討論として数えるもの</dt>
            <dd>
              議長が「これより討論に入ります」と宣告してから「討論を終わります」と宣告するまでの間に、議員が登壇して行った発言。
              議長・副議長など議事進行役の発言（「採決に移ります」「起立多数」など）と、登壇せず自席から述べた発言（議長への応答、議事進行の質問など）は数えません。
              議長の制止を挟んで同じ議員が続けた発言は、1件の討論として扱います。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">対象とする会期</dt>
            <dd>
              一般質問と同じ定例会の範囲に加え、その間に開かれた臨時会も含めます（臨時会でも討論が行われるため）。
              議長が「討論なしと認めます」と宣告し、討論が行われなかった会期は、分母に入れません。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">賛成・反対の表示</dt>
            <dd>
              立場は、本人が本文で明言している場合だけ表示し、判断の根拠にした本文の言い回しを必ず添えます。
              賛成{debateSummary.stance.for}件・反対{debateSummary.stance.against}件・原案と修正案で立場が分かれるもの{debateSummary.stance.mixed}件・
              読み取れないもの{debateSummary.stance.unclear}件です。読み取れないものは推測で埋めず、そのまま表示します。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">修正案が出ている議題</dt>
            <dd>
              修正案が出ている議題では、同じ「反対」でも原案への反対と修正案への反対があり、向きが正反対になります
              （修正案への反対は、原案を支持する立場です）。そのため、本人が冒頭または結びで「原案に」「修正案に」と名指しした場合だけ、
              「原案に賛成の立場」「修正案に反対の立場」のように対象まで表示します。名指しが無いもの（{debateSummary.unspecified}件）は、
              対象を補わず「原案・修正案のどちらに対するものかは本文から特定できません」と表示します。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">討論しなかった議員の賛否</dt>
            <dd>
              延岡市議会の採決の多くは起立採決で、会議録に議員一人ひとりの賛否は記録されません。
              討論に立たなかったことから賛否を推測することはしません。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">照合の方法</dt>
            <dd>
              発言ごとの出典ページを開き、会議名・開催日・発言者・本文が記録と一致すること、立場の根拠が1つの発言の中にそのまま存在することを確かめています。
              あわせて、会議日ごとに抽出をやり直して同じ結果になることを確認しています（HTTP 200 で開けるだけでなく、目的の発言であることまで確認）。
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="政策分野と継続テーマの扱い">
        <p className="text-sm leading-relaxed text-on-surface">
          政策分野は、会議録の見出し語（自由記述の日本語）を、人があらかじめ定義したキーワード辞書と文字列で照合して分類しています。
          生成AIによる内容の判定は行っていません。分野の数や広さを点数にすることはせず、どの分野を取り上げたかを一覧として示すだけです。
        </p>
        <dl className="mt-3 space-y-2 text-xs leading-relaxed text-on-surface-variant">
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">分類の根拠（classificationMethod）</dt>
            <dd>
              分類が何によって付いたのかを、公式資料の分類／人が定めた対応表／キーワードによる自動分類／AIによる自動分類の4つに区別して保持しています。
              現在使っているのは後ろから2番目までで、AIによる分類は使用していません。画面では自動分類であることを明記します。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">確からしさ（classificationConfidence）</dt>
            <dd>
              主観的な点数は付けません。見出し語がキーワードと完全に一致したか、一部に含んでいたか、どれにも当たらなかったかという、
              機械的に判定できる3段階だけを持ちます。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">分類の版（classificationVersion）</dt>
            <dd>
              キーワード辞書や表記揺れの対応表を変更したときに版を上げます（現在の版：{TOPIC_CLASSIFICATION_VERSION}）。
              版が変われば過去の分類結果も変わりうるため、いつ時点の分類かを区別できるようにしています。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">分類していない語句</dt>
            <dd>
              どのキーワードにも当たらない語句は、推測で分野を割り当てず「分類していない見出し語」として別に数えます
              {topicClassification.rate !== null &&
                `（現在：${topicClassification.total.toLocaleString("ja-JP")}語句中${topicClassification.unclassified.toLocaleString("ja-JP")}語句・約${topicClassification.rate}%）`}
              。多いことは、その分野の質問が少ないという意味ではなく、辞書に受け皿の語がまだ足りないことを示します。
            </dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">継続テーマ</dt>
            <dd>
              2つ以上の会期で確認できたテーマだけを「継続」として扱います。同じ会期の中で複数回質問した場合は継続に数えません。
              テーマ名・扱った会期数・最初に確認できた会期・最新の会期を、そのまま事実として表示します。テーマ同士の重要度は比べません。
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="途中就任・辞職・欠員の扱い">
        <p className="text-sm leading-relaxed text-on-surface">
          在職していなかった会期は、分母にも分子にも入れません。欠席や実績ゼロとしては扱いません。
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-on-surface-variant">
          <li>
            現職議員{entries.length}名は全員、令和5年4月23日執行の市議会議員選挙で同時に就任しているため、
            対象期間に差はありません。任期途中で就任した現職議員は現在いません。
          </li>
          <li>
            任期の途中で辞職した議員は、現職議員の一覧から外れます。その議員の記録は元議員のページで、
            在職を確認できた会期だけを対象期間として表示します。
          </li>
          <li>
            欠員が生じている期間について、他の議員の分母を増減させることはありません。
          </li>
        </ul>
      </SectionCard>

      <SectionCard title="「0件」と「対象外」は別物です">
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
          議員1人の活動を複数の軸でまとめて描くレーダーチャートは、個人に帰属できる一次資料が十分にそろうまで公開しません（軸の大半が「対象記録なし」のまま描くと、資料が無いことが活動が少ないことのように見えてしまうためです）。数値表示部分も「0」ではなく「対象記録なし」と明記します。
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
          ページでは、指標が「対象記録なし」になっている理由を、次の4つの状態文言で市民向けに説明しています。これらは点数ではなく、資料の収録状況の説明です。資料が公開されていない項目を0件として扱うことはありません。
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

      <SectionCard title="項目ごとの定義・計算式・出典・データ収録状況">
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
          「出席状況」は、議員別の出席・欠席名簿を複数の公開資料経路で調査しましたが確認できていないため、数値にしていません（全議員で「対象記録なし」）。「請願・提案等」は、会議録に議員名が記載されている記録（決議の提出者{decisionSubmitterRecordCount}件、本会議での委員長・副委員長報告{committeeReportRecordCount}件）を実数として掲載していますが、条例案・意見書等の提出者と請願・陳情の紹介議員は議員別に収録できていないため、指標としては「対象記録なし」のまま扱っています。「議案等の意思表示」は、議員個人の議案賛否内訳が登録されている議案が、現在の任期では{currentTermNamedVoteBillCount}件（記名投票）のみのため、その範囲でしか判定できません。現職議員{entries.length}名は全員この記名投票の対象だったため{entries.length}名とも算定できますが、対象議案がごく少数である点にご留意ください。なお、現在の任期より前に行われた記名投票は、当時まだ在職していなかった議員が不利に見えてしまうため、この項目の対象に含めていません。これは議員個人の活動が確認できないという意味ではなく、本サイトのデータ整備がまだ追いついていないことを示しています。データが収録され次第、順次反映します。
        </p>
      </SectionCard>

      <SectionCard title="一覧・個人ページに表示している「実数」の補足">
        <p className="text-sm leading-relaxed text-on-surface">
          議員活動バロメーターの一覧・個人ページには、上記の項目とあわせて次の「実数」も表示しています。いずれも新しい採点・順位ロジックではなく、既存の一次資料をそのまま数え上げたものです。
        </p>
        <dl className="mt-3 space-y-2 text-xs leading-relaxed text-on-surface-variant">
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">発言件数</dt>
            <dd>
              会議録で確認できた質問項目数そのものです。0〜100の指数へ換算したり、他の項目と合算したりはしていません。
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
            <dd>本人確認済み（verified）のSNS・Web媒体数に、議会公式プロフィールページを加えた実数です。「情報発信・プロフィール充足度」の割合の分子とは項目の数え方が異なります。</dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">議席番号</dt>
            <dd>議員詳細ページ（現職議員データ）の確認済みプロフィール本文に記載されている議席番号をそのまま表示しています。新しい調査は行っていません。</dd>
          </div>
          <div className="rounded-lg bg-surface-container-high px-3 py-2">
            <dt className="font-medium text-on-surface">選挙時得票（参考情報）</dt>
            <dd>令和5年4月23日執行の延岡市議会議員選挙における得票数（選挙結果データ）です。議会活動の記録には一切含めていません。</dd>
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
