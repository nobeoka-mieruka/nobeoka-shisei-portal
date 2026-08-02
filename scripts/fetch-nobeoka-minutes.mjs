/**
 * 公式会議録本文の取得インターフェースを確認するためのCLI。
 *
 * 重要：現時点ではscripts/lib/minutes-source.mjsが未実装のスタブのため、このコマンドを実行しても
 * 実際に会議録本文が取得されることはない（常にstatus: "not-fetched"を返す）。
 * 会議録取得機能を実装する際は、まずこのCLIから呼び出しているfetchMinutesForSpeech()の中身を
 * 実装すること。docs/council-speech-summary-pipeline.md を参照。
 *
 * 使い方：
 *   node scripts/fetch-nobeoka-minutes.mjs --session=2026-06 --member=m24
 */
import { fetchMinutesForSpeech } from "./lib/minutes-source.mjs";

const args = process.argv.slice(2);
const sessionId = args.find((a) => a.startsWith("--session="))?.split("=")[1];
const memberId = args.find((a) => a.startsWith("--member="))?.split("=")[1];
const meetingDate = args.find((a) => a.startsWith("--date="))?.split("=")[1] ?? null;
const meetingNumber = args.find((a) => a.startsWith("--meeting-number="))?.split("=")[1] ?? null;
const officialSearchUrl = args.find((a) => a.startsWith("--url="))?.split("=")[1] ?? "https://www.kensakusystem.jp/nobeoka/";

if (!sessionId || !memberId) {
  console.error("[fetch-nobeoka-minutes] --session=<会期ID> --member=<議員ID> を指定してください。");
  console.error("例: node scripts/fetch-nobeoka-minutes.mjs --session=2026-06 --member=m24");
  process.exit(1);
}

const result = await fetchMinutesForSpeech({ sessionId, meetingDate, meetingNumber, officialSearchUrl, memberId });

console.log("[fetch-nobeoka-minutes] 会議録取得インターフェースは未実装です（常にnot-fetchedを返します）。");
console.log(JSON.stringify(result, null, 2));

if (result.status === "not-fetched") {
  console.log(
    "[fetch-nobeoka-minutes] scripts/lib/minutes-source.mjs の fetchMinutesForSpeech() を実装すると、実際の取得処理に置き換わります。",
  );
}
