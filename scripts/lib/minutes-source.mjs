/**
 * 公式会議録本文（延岡市議会会議録検索システム: https://www.kensakusystem.jp/nobeoka/ 等）を
 * 取得するための、将来実装するインターフェースの定義のみを行うモジュール。
 *
 * 現時点では実装しない（このモジュールは常に status: "not-fetched" を返すスタブ）。
 * 理由：
 * - 取得元がセッションCode方式のCGI（例: cgi-bin3/Search2.exe?Code=...&sTarget=2）であり、
 *   単純な固定URLでは本文へたどり着けない（検索フォームの送信・セッション維持が必要）。
 * - 対象議員の発言範囲を誤って切り出すと、実際には発言していない内容を発言したものとして
 *   掲載してしまうリスクがあるため、本文取得・発言者切り出しのロジックは慎重に設計・検証してから
 *   実装する必要がある。
 *
 * 実装時の注意（このスタブを実装に置き換える際に守ること）：
 * - Cookie・セッショントークン・APIキー等の秘密情報をリポジトリへコミットしない。
 * - 取得元の利用条件を確認し、過度な連続アクセスを行わない（間隔を空ける・キャッシュする）。
 * - 取得済み本文（生テキスト）は、公式サイトの著作物であることを踏まえた保存方針を
 *   docs/council-speech-summary-pipeline.md に従って決める。
 */

/**
 * @typedef {object} MinutesFetchInput
 * @property {string} sessionId councilSessions.jsonのid
 * @property {string|null} meetingDate ISO形式。開催日が未確定の場合はnull
 * @property {string|null} meetingNumber 例: "第2号"
 * @property {string} officialSearchUrl 会議録検索システム側の検索起点URL
 * @property {string} memberId 既存議員データのid
 */

/**
 * @typedef {object} MinutesFetchResult
 * @property {"official-minutes-html"|"official-minutes-pdf"} sourceType
 * @property {string} sourceUrl
 * @property {string|null} fetchedAt ISO形式。未取得の場合はnull
 * @property {string|null} rawTextPath 取得した生テキストの保存先（未取得の場合はnull）
 * @property {string|null} normalizedTextPath ヘッダー・フッター等を除去した後のテキストの保存先
 * @property {"not-fetched"|"fetched"|"error"} status
 */

/**
 * 会議録本文の取得を試みる（現在は常に未実装スタブ）。
 * @param {MinutesFetchInput} input
 * @returns {Promise<MinutesFetchResult>}
 */
export async function fetchMinutesForSpeech(input) {
  if (!input?.sessionId || !input?.memberId) {
    throw new Error("fetchMinutesForSpeech: sessionId と memberId は必須です");
  }
  return {
    sourceType: "official-minutes-html",
    sourceUrl: input.officialSearchUrl ?? "",
    fetchedAt: null,
    rawTextPath: null,
    normalizedTextPath: null,
    status: "not-fetched",
  };
}
