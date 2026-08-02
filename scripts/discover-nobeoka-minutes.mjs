/**
 * 延岡市議会会議録検索システムの、指定した西暦年における会期・本会議日一覧を自動取得する。
 * See.exeの年階層ナビゲーション（年→会期→本会議日）を自動化したもの
 * （scripts/lib/minutes-source.mjsのresolveYearTreedepth/listSessionsForYear/listMeetingDaysを使用）。
 *
 * 全年度の一括取得はまだ行わない（1回の実行につき1年度のみ対象とする）。
 *
 * 対象期間（src/config/councilSpeechPeriod.json）より前の本会議日は、一覧から除外する
 * （--fromで明示的に上書きしない限り、councilSpeechPeriod.fromが既定値）。年・会期単位の
 * ナビゲーション自体は、対象期間より前の年であっても構造解析のために内部的に行ってよい。
 *
 * 使い方：
 *   node scripts/discover-nobeoka-minutes.mjs --year=2026
 *   node scripts/discover-nobeoka-minutes.mjs --year=2023 --from=2023-04-23
 *   node scripts/discover-nobeoka-minutes.mjs --year=2026 --output=data/minutes/discovery-2026.json
 */
import { writeFileSync } from "node:fs";
import { listMeetingDays, listSessionsForYear, fileNameToIsoDate } from "./lib/minutes-source.mjs";
import { councilSpeechPeriod } from "./lib/council-speech-period.mjs";

const CODE = "48o046ot0cia1xvtw7";

const args = process.argv.slice(2);
const year = Number(args.find((a) => a.startsWith("--year="))?.split("=")[1]);
const outputPath = args.find((a) => a.startsWith("--output="))?.split("=")[1];
const from = args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? councilSpeechPeriod.from;

if (!year || Number.isNaN(year)) {
  console.error("[discover-nobeoka-minutes] --year=<西暦年> を指定してください（例: --year=2026）。");
  process.exit(1);
}

async function main() {
  console.log(`[discover-nobeoka-minutes] ${year}年の会期一覧を取得します...（対象期間: ${from}以降）`);
  const sessions = await listSessionsForYear({ code: CODE, year });
  console.log(`[discover-nobeoka-minutes] ${sessions.length}件の会期が見つかりました。`);

  const result = { year, from, sessions: [] };
  let excludedCount = 0;
  for (const session of sessions) {
    console.log(`[discover-nobeoka-minutes] ${session.label} の本会議日一覧を取得します...`);
    const days = await listMeetingDays({ code: CODE, sessionLabel: session.treedepth });
    const qualifyingDays = [];
    for (const d of days) {
      const isoDate = fileNameToIsoDate(d.fileName);
      if (isoDate && isoDate < from) {
        excludedCount++;
        continue;
      }
      qualifyingDays.push({
        fileName: d.fileName,
        date: isoDate,
        label: d.label,
        sourceUrl: `https://www.kensakusystem.jp/nobeoka/cgi-bin3/ResultFrame.exe?Code=${d.code}&fileName=${d.fileName}&startPos=0`,
      });
    }
    if (qualifyingDays.length > 0) {
      result.sessions.push({
        treedepth: session.treedepth,
        title: session.label,
        sessionNumber: session.sessionNumber,
        sessionType: session.sessionType,
        meetingDays: qualifyingDays,
      });
    }
    console.log(`  → ${qualifyingDays.length}会議日（対象期間より前のため除外: ${days.length - qualifyingDays.length}件）`);
  }
  if (excludedCount > 0) {
    console.log(`[discover-nobeoka-minutes] 対象期間（${from}以降）より前のため、合計${excludedCount}件の本会議日を一覧から除外しました。`);
  }

  console.log(JSON.stringify(result, null, 2));
  if (outputPath) {
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`[discover-nobeoka-minutes] ${outputPath} へ出力しました。`);
  }
}

await main();
