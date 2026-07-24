/**
 * 各データベースの「収録範囲・整備状況」を一元管理する設定。
 *
 * 登録件数は既存JSONの配列長（.length）から呼び出し側が渡すため、ここでは持たない。
 * ここで管理するのは、件数だけでは伝わらない「対象期間」「整備中であること」の説明文のみ。
 * 分母が公式に確認できない「整備率（％）」は算出・表示しない。
 */
export interface DataCoverageEntry {
  /** 対象データの名称 */
  label: string;
  /** 現在の収録範囲（対象期間、定例会名など）。件数が1件以上のときのヒントに使う。 */
  scope: string;
  /** 件数が0件のときに表示する説明。省略時は「現在整備中」を使う。 */
  zeroCountNote?: string;
}

export const dataCoverage = {
  generalQuestions: {
    label: "一般質問",
    scope: "令和8年6月定例会",
  },
  billVotes: {
    label: "議案・採決結果",
    scope: "現在整備中",
    zeroCountNote: "現在、公式資料を確認しながらデータを整備しています。登録が完了した情報から順次公開します。",
  },
} as const satisfies Record<string, DataCoverageEntry>;

export type DataCoverageKey = keyof typeof dataCoverage;

/** StatCardのhint等に使う、1行の収録範囲・整備状況の説明文を返す。 */
export function coverageHint(key: DataCoverageKey, count: number): string {
  const entry: DataCoverageEntry = dataCoverage[key];
  if (count === 0) return entry.zeroCountNote ?? "現在整備中";
  return `収録範囲：${entry.scope}`;
}
