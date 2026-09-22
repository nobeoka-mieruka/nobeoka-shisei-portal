import themesData from "../data/themes.json";
import type { Theme } from "../types";
import { TOPIC_NORMALIZATION_MAP, normalizeTopicLabel } from "./topicNormalization";

/**
 * 一般質問のテーマ分類について、「その分類が何を根拠に付いたのか」を持ち回すための語彙。
 *
 * 【なぜ必要か】
 * 会議録の見出し語（topics）は自由記述の日本語で、テーマへの割り当ては当サイトが
 * 機械的に行っている。画面に分類結果だけを出すと、市議会が公式に分類したかのように
 * 見えてしまう。どの分類がどの根拠で付いたのかを、表示側が区別できるようにする。
 *
 * 【現時点の事実】
 * 一般質問のテーマ分類に使っているのは、人が定義したキーワード辞書との文字列照合だけで、
 * AIによる内容判定は行っていない（そのため method は "keyword" か "rule-based" のみ）。
 * 将来AIを使う場合に備えて "ai" を語彙に置いてあるが、現在どこからも返さない。
 */
export type TopicClassificationMethod =
  /** 公式資料が分類を明示している（市議会・市が示した分類をそのまま使う）。 */
  | "official-document"
  /** 人が1件ずつ定めた対応表による（表記揺れの正規化辞書など）。 */
  | "rule-based"
  /** キーワード辞書との文字列照合による自動分類。 */
  | "keyword"
  /** 生成AIによる内容判定。現在は使用していない。 */
  | "ai";

/**
 * 分類の確からしさ。
 *
 * 数値の点数は付けない。機械的に判定できる条件だけで段階を決める
 * （「たぶん合っている」という主観を数字にしない）。
 */
export type TopicClassificationConfidence =
  /** 正規化後の語句が、キーワードと完全に一致した。 */
  | "exact"
  /** 正規化後の語句が、キーワードを部分的に含んでいた。 */
  | "partial"
  /** どのキーワードにも一致しなかった（分類していない）。 */
  | "none";

/**
 * 分類ロジックの版。
 *
 * キーワード辞書（themes.json の keywords）か正規化辞書を変更したら上げる。
 * 版が変われば過去の分類結果も変わりうることを、画面で説明するために持つ。
 */
export const TOPIC_CLASSIFICATION_VERSION = "2026-09-22";

export interface TopicClassification {
  /** 正規化後のテーマ語句。 */
  normalizedTopic: string;
  /** 正規化前の原語（正規化辞書が効いた場合のみ原語と異なる）。 */
  rawTopic: string;
  /** 分類先のテーマ slug。分類できなかった場合は null（"unclassified" を値として持たない）。 */
  themeSlug: string | null;
  method: TopicClassificationMethod;
  confidence: TopicClassificationConfidence;
  /** 一致したキーワード。根拠として画面に出せる。 */
  matchedKeyword: string | null;
  version: string;
}

const themes = themesData as Theme[];

/**
 * 分類の受け皿として用意されているが、内容を表すテーマではない slug。
 *
 * "unclassified" は「どのキーワードにも当たらなかった」という状態、
 * "other" はキーワードが1つも定義されておらず、照合では決して選ばれない。
 * この2つを他の政策テーマと同じ一覧に並べると、分類できていないことが
 * 1つの政策分野のように見えてしまうため、表示側で分けられるようにする。
 */
export const NON_POLICY_THEME_SLUGS: readonly string[] = ["unclassified", "other"];

export function isPolicyTheme(slug: string): boolean {
  return !NON_POLICY_THEME_SLUGS.includes(slug);
}

/**
 * テーマ語句1件を分類し、その根拠もあわせて返す。
 *
 * 既存の `classifyTopicToThemeSlug()` と同じ照合順（themes.json の配列順で先勝ち）を使う。
 * 分類結果そのものを変えないため、既存画面の件数は変わらない。
 */
export function classifyTopicWithEvidence(rawTopic: string): TopicClassification {
  const normalizedTopic = normalizeTopicLabel(rawTopic);
  const normalizedByDictionary = normalizedTopic !== rawTopic;

  for (const theme of themes) {
    for (const keyword of theme.keywords) {
      if (!normalizedTopic.includes(keyword)) continue;
      return {
        normalizedTopic,
        rawTopic,
        themeSlug: theme.slug,
        // 表記揺れ辞書が効いた語句は、人が1件ずつ定めた対応表を経由している。
        method: normalizedByDictionary ? "rule-based" : "keyword",
        confidence: normalizedTopic === keyword ? "exact" : "partial",
        matchedKeyword: keyword,
        version: TOPIC_CLASSIFICATION_VERSION,
      };
    }
  }

  return {
    normalizedTopic,
    rawTopic,
    themeSlug: null,
    method: normalizedByDictionary ? "rule-based" : "keyword",
    confidence: "none",
    matchedKeyword: null,
    version: TOPIC_CLASSIFICATION_VERSION,
  };
}

/** 市民向けの短い説明。「自動分類」であることを隠さない。 */
export const TOPIC_CLASSIFICATION_METHOD_LABELS_JA: Record<TopicClassificationMethod, string> = {
  "official-document": "公式資料の分類",
  "rule-based": "対応表による分類",
  keyword: "自動分類（キーワード）",
  ai: "自動分類（AI）",
};

export const TOPIC_CLASSIFICATION_CONFIDENCE_LABELS_JA: Record<TopicClassificationConfidence, string> = {
  exact: "キーワードと完全一致",
  partial: "キーワードを含む",
  none: "一致なし（分類していません）",
};

/** 正規化辞書に登録されている語句の数（説明文へ数値を直書きしないための単一情報源）。 */
export const TOPIC_NORMALIZATION_ENTRY_COUNT = Object.keys(TOPIC_NORMALIZATION_MAP).length;
