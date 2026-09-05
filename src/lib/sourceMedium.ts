/**
 * Phase228：出典欄に並ぶ資料を「報道」「事典・百科事典」と、それ以外（延岡市・延岡市議会・
 * 総務省等の公的資料）とで、表示上だけ区別するための判定。
 *
 * 背景：`SourceRefList` と `CompareSourceNotice` は、延岡市・延岡市議会の一次資料と、
 * 新聞記事・Wikipedia等を同じ「出典・確認状況」欄に同じ見た目で並べていた（実データで
 * 報道11件・事典27件）。当サイトの編集方針では報道は一次資料ではないため、
 * 一次資料と同列の「根拠資料」に見えてはならない。
 *
 * 方針：
 * ・データへ新しいフィールドを追加しない（既存データを一切書き換えない）。
 * ・既に登録済みの `sourceOrganization` / `sourceTitle` から表示層で分類する。
 *   `AnswererRole` と同じく「機械的に分類した計算結果であり、データとしては保存しない」方式。
 * ・判定できないものは分類しない（`unclassified`）。ラベルを付けないだけで、
 *   「一次資料である」と断定はしない。推測でラベルを付けない。
 * ・事典（Wikipedia・コトバンク）は記事内の参考文献として新聞名を挙げていることがあるため、
 *   報道より先に判定する（Wikipedia を「報道」と誤表示しない）。
 */

/** 資料の媒体区分。表示上の注意書きを出し分けるためだけに使う。 */
export type SourceMedium = "news" | "reference" | "unclassified";

/** 事典・百科事典（二次資料）。報道より先に判定する。 */
const REFERENCE_PATTERNS: RegExp[] = [/Wikipedia/i, /ウィキペディア/, /コトバンク/, /kotobank/i];

/** 報道機関。実データに登場する媒体を基準に、同種の全国紙・放送局を含めている。 */
const NEWS_PATTERNS: RegExp[] = [
  /宮崎日日新聞/,
  /Miyanichi\s*e-press/i,
  /夕刊デイリー/,
  /読売新聞/,
  /朝日新聞/,
  /毎日新聞/,
  /日本経済新聞/,
  /西日本新聞/,
  /産経新聞/,
  /共同通信/,
  /時事通信/,
  /Yahoo!ニュース/,
  /テレビ宮崎/,
  /NHK/,
];

/** 媒体区分ごとの表示ラベル。色ではなく文字で「一次資料ではない」ことを伝える。 */
export const SOURCE_MEDIUM_LABEL: Record<Exclude<SourceMedium, "unclassified">, string> = {
  news: "報道（一次資料ではありません）",
  reference: "事典・百科事典（一次資料ではありません）",
};

/** 分類に使う文字列。出典レコードの表記ゆれ（label のみ・sourceTitle のみ）に両対応する。 */
export interface SourceMediumInput {
  sourceOrganization?: string | null;
  sourceTitle?: string | null;
  label?: string | null;
}

/** 出典1件の媒体区分を、登録済みの公表機関名・資料名から機械的に判定する。 */
export function classifySourceMedium(ref: SourceMediumInput): SourceMedium {
  const text = [ref.sourceOrganization, ref.sourceTitle, ref.label].filter(Boolean).join(" ");
  if (text === "") return "unclassified";
  if (REFERENCE_PATTERNS.some((re) => re.test(text))) return "reference";
  if (NEWS_PATTERNS.some((re) => re.test(text))) return "news";
  return "unclassified";
}

/** 表示する注意書き。分類できない資料には何も表示しない（断定しない）。 */
export function sourceMediumLabel(ref: SourceMediumInput): string | null {
  const medium = classifySourceMedium(ref);
  return medium === "unclassified" ? null : SOURCE_MEDIUM_LABEL[medium];
}
