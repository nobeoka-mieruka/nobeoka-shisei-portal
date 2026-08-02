/**
 * 延岡市議会会議録検索システムの、指定した西暦年における会期・本会議日一覧を自動取得する。
 * See.exeの年階層ナビゲーション（年→会期→本会議日）を自動化したもの
 * （scripts/lib/minutes-source.mjsのresolveYearTreedepth/listSessionsForYear/listMeetingDaysを使用）。
 *
 * 全年度の一括取得はまだ行わない（1回の実行につき1年度のみ対象とする）。
 *
 * 使い方：
 *   node scripts/discover-nobeoka-minutes.mjs --year=2026
 *   node scripts/discover-nobeoka-minutes.mjs --year=2026 --output=data/minutes/discovery-2026.json
 */
import { writeFileSync } from "node:fs";
import { listMeetingDays, listSessionsForYear } from "./lib/minutes-source.mjs";

const CODE = "48o046ot0cia1xvtw7";

const args = process.argv.slice(2);
const year = Number(args.find((a) => a.startsWith("--year="))?.split("=")[1]);
const outputPath = args.find((a) => a.startsWith("--output="))?.split("=")[1];

if (!year || Number.isNaN(year)) {
  console.error("[discover-nobeoka-minutes] --year=<西暦年> を指定してください（例: --year=2026）。");
  process.exit(1);
}

async function main() {
  console.log(`[discover-nobeoka-minutes] ${year}年の会期一覧を取得します...`);
  const sessions = await listSessionsForYear({ code: CODE, year });
  console.log(`[discover-nobeoka-minutes] ${sessions.length}件の会期が見つかりました。`);

  const result = { year, sessions: [] };
  for (const session of sessions) {
    console.log(`[discover-nobeoka-minutes] ${session.label} の本会議日一覧を取得します...`);
    const days = await listMeetingDays({ code: CODE, sessionLabel: session.treedepth });
    result.sessions.push({
      treedepth: session.treedepth,
      title: session.label,
      sessionNumber: session.sessionNumber,
      sessionType: session.sessionType,
      meetingDays: days.map((d) => ({
        fileName: d.fileName,
        label: d.label,
        sourceUrl: `https://www.kensakusystem.jp/nobeoka/cgi-bin3/ResultFrame.exe?Code=${d.code}&fileName=${d.fileName}&startPos=0`,
      })),
    });
    console.log(`  → ${days.length}会議日`);
  }

  console.log(JSON.stringify(result, null, 2));
  if (outputPath) {
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`[discover-nobeoka-minutes] ${outputPath} へ出力しました。`);
  }
}

await main();
