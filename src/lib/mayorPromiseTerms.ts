import mayorPromisesData from "../data/mayorPromises.json";
// Phase202：このモジュールはsrc/lib/seo.ts（全ページが読み込む）からも参照されるため、
// 本文を含むmayorPromiseMeasures.json（約25KB）ではなく、IDだけの軽量インデックス
// （scripts/generate-data-indexes.mjsの生成物）を読む。件数は元データと完全に一致する
// （検証：scripts/test-data-index-consistency.mjs）。
import mayorPromiseMeasuresIndex from "../data/mayorPromiseMeasuresIndex.json";
import type { MayorPromisesData } from "../types";

/**
 * Phase202：市長公約まわりでサイト上に現れる3つの数字（政策分野・個別公約・個別施策）の
 * 名称・定義・件数を1か所に集約する。
 *
 * 背景：同じ「市長公約」という言葉のまま、ページによって数えている対象が異なる数字
 * （トップページ「登録済み市長公約数」＝政策分野の数、ダッシュボード「進捗を確認できる
 * 公約項目数」＝個別公約の数、公約進捗ページ「個別施策数」）が並んでおり、市民が
 * 「どれが本当の公約数なのか」を判断できない状態だった。
 *
 * 3つの階層の呼び名は、いずれも新しく作った言葉ではなく、既存の一次資料・既存データ・
 * 既存UIで実際に使われている呼称に合わせている。
 *
 * - 政策分野：延岡市の施政方針（令和8年度）本文に「私の公約である４つの政策」という
 *   記述があり（src/data/mayorPromises.json の 1-1.relatedBudgetCandidates 内で引用）、
 *   当サイトでも /mayor/policy-progress の絞り込みラベルが従来から「政策分野」。
 *   データ上の実体は mayorPromises.json の categories（＝ mayorPolicyProgress.json の
 *   policies、＝ mayor.json の pledges。3ファイルとも id は p1〜p4 で一致する）。
 * - 個別公約：src/types/index.ts・src/lib/seo.ts・更新履歴で従来から使用。
 *   データ上の実体は mayorPromises.json の promises。
 * - 個別施策：/mayor/policy-progress の集計カードラベル、および src/types/index.ts の
 *   MayorPromiseMeasureSnapshot（「個別施策・事業」）で従来から使用。データ上の実体は
 *   mayorPromiseMeasures.json（出典は延岡市「市長公約に関する取組み　令和8年度」）で、
 *   件数の算出にはその軽量インデックス mayorPromiseMeasuresIndex.json を使う。
 *
 * 件数は必ずここから参照し、画面・meta description・JSON-LD へ直書きしないこと
 * （退行防止チェックは scripts/test-count-consistency.mjs）。
 */

const promisesData = mayorPromisesData as MayorPromisesData;
const promiseMeasures = mayorPromiseMeasuresIndex;

/** 3階層それぞれの表示名。画面・meta description・JSON-LD はすべてこの語を使う。 */
export const MAYOR_PROMISE_LEVELS = {
  /** 公約の大きな区分（施政方針でいう「私の公約である４つの政策」）。 */
  policyArea: {
    label: "政策分野",
    statLabel: "政策分野数",
    definition:
      "市長が選挙時に掲げた公約の大きな区分です。延岡市の施政方針でも「私の公約である４つの政策」として説明されています。",
  },
  /** 進捗を1件ずつ追跡する単位。 */
  promise: {
    label: "個別公約",
    statLabel: "個別公約数",
    definition:
      "各政策分野に属する公約を1件ずつに分けたものです。当サイトが進捗状況・根拠資料を1件ずつ追跡している単位で、詳細ページもこの単位で用意しています。",
  },
  /** 公約に含まれる具体的な事業・取組み。 */
  measure: {
    label: "個別施策",
    statLabel: "個別施策数",
    definition:
      "1件の個別公約に含まれる具体的な事業・取組みです。延岡市が公表した「市長公約に関する取組み」で確認できた単位で、1件の個別公約に複数含まれることがあります。",
  },
} as const;

/**
 * 3階層の件数。すべて既存データからの自動算出で、固定値は持たない。
 * policyArea は mayorPromises.json の categories を単一情報源とする
 * （mayor.json の pledges・mayorPolicyProgress.json の policies と一致することは
 * scripts/test-count-consistency.mjs で検証する）。
 */
export const mayorPromiseCounts = {
  policyArea: promisesData.categories.length,
  promise: promisesData.promises.length,
  measure: promiseMeasures.length,
} as const;

/** 「政策分野4件 → 個別公約14件 → 個別施策33件」形式の短い要約。 */
export const MAYOR_PROMISE_SCALE_SUMMARY =
  `${MAYOR_PROMISE_LEVELS.policyArea.label}${mayorPromiseCounts.policyArea}件` +
  `→${MAYOR_PROMISE_LEVELS.promise.label}${mayorPromiseCounts.promise}件` +
  `→${MAYOR_PROMISE_LEVELS.measure.label}${mayorPromiseCounts.measure}件`;

/** 数字が3種類あることの説明文（カードのヒント・注記で共通利用する）。 */
export const MAYOR_PROMISE_SCALE_NOTE =
  `市長公約は3つの階層で数えています（${MAYOR_PROMISE_SCALE_SUMMARY}）。` +
  "数え方が違うだけで、どれか1つが正しい「公約数」というわけではありません。";

/** GlossaryNote（折りたたみ解説）用の見出しと本文。 */
export const MAYOR_PROMISE_GLOSSARY = {
  term: "市長公約の3つの数え方",
  definition:
    `${MAYOR_PROMISE_LEVELS.policyArea.label}（${mayorPromiseCounts.policyArea}件）：${MAYOR_PROMISE_LEVELS.policyArea.definition}` +
    `／${MAYOR_PROMISE_LEVELS.promise.label}（${mayorPromiseCounts.promise}件）：${MAYOR_PROMISE_LEVELS.promise.definition}` +
    `／${MAYOR_PROMISE_LEVELS.measure.label}（${mayorPromiseCounts.measure}件）：${MAYOR_PROMISE_LEVELS.measure.definition}` +
    " 当サイトが独自に達成率を算定したものではなく、公表資料の区切り方をそのまま数えたものです。",
} as const;
