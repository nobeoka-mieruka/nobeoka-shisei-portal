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
  /** 件数ではなく範囲そのものを値として見せる項目（例：財政指標の対象年度）の短い表記。 */
  headline?: string;
}

export const dataCoverage = {
  generalQuestions: {
    // ここでいう「一般質問」は質問通告書ベースの予定（generalQuestions.json）のこと。
    // 会議録本文を確認して登録した分（councilSpeechSummaries.json）とは別の集合なので、
    // 収録範囲も予定側の会期だけを書く。
    label: "一般質問",
    scope: "令和8年6月・9月定例会（質問通告書に基づく予定。会議録の公開後に内容を確認）",
  },
  billVotes: {
    // ここでいう収録範囲は「議案・議決結果」の範囲。会議録や一般質問の収録範囲とは別なので、
    // 議決結果を取得した会期を、会議録まで収録済みであるかのように書かないこと。
    // 会期を追加したら必ずここも更新する（scripts/test-count-consistency.mjs が実データと突き合わせる）。
    label: "議案・採決結果",
    scope: "令和元年6月〜令和8年9月の会期分（議決結果のみ。会議録・一般質問の収録範囲は別に表示）",
    zeroCountNote: "現在、公式資料を確認しながらデータを整備しています。登録が完了した情報から順次公開します。",
  },
  financeIndicators: {
    // 財政指標は資料の種類ごとに公表時期が違い、同じ「最新」でも対象年度がそろわない。
    // 健全化判断比率は決算の翌年度9月頃、財政力指数・経常収支比率は財政状況資料集
    // （翌々年度3月頃）が出るまで確定しない。両方の年度を並べて示す。
    // archiveFiscalYears.json は500KBを超えるため画面から直接読み込まず、ここに文字列で持つ。
    // 実データとの食い違いは scripts/test-count-consistency.mjs が検出する。
    label: "財政指標",
    headline: "令和7年度決算",
    scope:
      "健全化判断比率（実質公債費比率・将来負担比率など）は令和7年度決算まで、財政力指数・経常収支比率は令和6年度決算までを収録しています。" +
      "公表される時期が資料ごとに違うため、対象年度はそろっていません。議案・議決結果や会議録の収録範囲とも対象が異なります。",
  },
} as const satisfies Record<string, DataCoverageEntry>;

export type DataCoverageKey = keyof typeof dataCoverage;

/** StatCardのhint等に使う、1行の収録範囲・整備状況の説明文を返す。 */
export function coverageHint(key: DataCoverageKey, count: number): string {
  const entry: DataCoverageEntry = dataCoverage[key];
  if (count === 0) return entry.zeroCountNote ?? "現在整備中";
  return `収録範囲：${entry.scope}`;
}
