import { getLastUpdatedText } from "../lib/lastUpdated";

/**
 * サイト全体の「最終更新」（Gitコミット日時＝ビルド日時）に加えて、ページ固有の
 * 「データ確認日」（公式資料を実際に確認した日、各データのlastVerified等）を
 * 併記できるようにしたコンポーネント。dataAsOfLabel/dataAsOfを渡さない場合は
 * 従来どおりビルド日時のみを表示する（既存ページの見た目は変わらない）。
 * ビルド日時だけを「データの更新日」であるかのように見せないための対応。
 */
export function LastUpdated({
  className = "",
  dataAsOfLabel,
  dataAsOf,
}: {
  className?: string;
  /** 例: "歴代市長データの最終確認日"。dataAsOfとセットで指定する。 */
  dataAsOfLabel?: string;
  /** 例: "2026年8月5日"。整形済みの文字列をそのまま渡す（日付計算はページ側で行う）。 */
  dataAsOf?: string;
}) {
  return (
    <div className={`space-y-0.5 ${className}`}>
      {dataAsOfLabel && dataAsOf && (
        <p className="text-xs text-on-surface-variant">
          {dataAsOfLabel}：{dataAsOf}
        </p>
      )}
      <p className="text-xs text-on-surface-variant">サイトの最終更新（ビルド日時）：{getLastUpdatedText()}</p>
    </div>
  );
}
