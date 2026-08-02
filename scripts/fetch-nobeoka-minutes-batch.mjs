/**
 * 指定した年度の本会議日を自動列挙し、議員（members.json）が発言している発言セグメントと、
 * その直後の答弁セグメントの本文をまとめて取得・保存するアクセス制御付きバッチ取得ツール。
 *
 * このスクリプトは「原文の取得・保存」だけを行う。要約の作成やcouncilSpeechSummaries.jsonへの
 * 登録は行わない（質問と答弁の対応付けには依然として人（またはAI）による個別確認が必要なため）。
 *
 * アクセス制御：
 * - 同時取得数は常に1（並列取得しない。scripts/lib/minutes-source.mjsの設計上そもそも並列不可）
 * - リクエスト間隔は最低2秒（scripts/lib/minutes-source.mjsのthrottleに準拠）
 * - --limit で取得する発言セグメント数の上限を指定（未指定時は10、暴走防止のため）
 * - --dry-run で、実際に本文取得する前に対象一覧だけを確認できる
 * - 取得済み（出力ファイルが既に存在する）セグメントは再取得しない（途中再開が可能）
 *
 * 対象期間（src/config/councilSpeechPeriod.json）より前の本会議日は取得対象にしない
 * （--fromで明示的に上書きしない限り、councilSpeechPeriod.fromが既定値）。
 *
 * 使い方：
 *   node scripts/fetch-nobeoka-minutes-batch.mjs --year=2026 --limit=10 --dry-run
 *   node scripts/fetch-nobeoka-minutes-batch.mjs --year=2026 --limit=10
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import members from "../src/data/members.json" with { type: "json" };
import {
  listSessionsForYear,
  listMeetingDays,
  listSpeakerSegments,
  fetchSegmentText,
  matchSpeakerToMember,
  classifySpeakerLabel,
  looksGarbled,
  fileNameToIsoDate,
} from "./lib/minutes-source.mjs";
import { councilSpeechPeriod } from "./lib/council-speech-period.mjs";

const CODE = "48o046ot0cia1xvtw7";

const args = process.argv.slice(2);
const year = Number(args.find((a) => a.startsWith("--year="))?.split("=")[1]);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "10");
const isDryRun = args.includes("--dry-run");
const outputDir = args.find((a) => a.startsWith("--output="))?.split("=")[1] ?? "data/minutes";
const from = args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? councilSpeechPeriod.from;

if (!year || Number.isNaN(year)) {
  console.error("[fetch-nobeoka-minutes-batch] --year=<西暦年> を指定してください（例: --year=2026）。");
  process.exit(1);
}
if (!Number.isFinite(limit) || limit <= 0) {
  console.error("[fetch-nobeoka-minutes-batch] --limitは1以上の数値で指定してください。");
  process.exit(1);
}

function slug(url) {
  return createHash("sha1").update(url).digest("hex").slice(0, 12);
}

async function main() {
  console.log(`[fetch-nobeoka-minutes-batch] ${year}年の会期を検索します...（対象期間: ${from}以降）`);
  const sessions = await listSessionsForYear({ code: CODE, year });
  console.log(`[fetch-nobeoka-minutes-batch] ${sessions.length}件の会期が見つかりました。`);

  /** @type {{sessionTitle: string, fileName: string, dayLabel: string, memberSegment: object, answerSegment: object|null, memberId: string}[]} */
  const targets = [];
  let excludedDays = 0;

  for (const session of sessions) {
    if (targets.length >= limit) break;
    const days = await listMeetingDays({ code: CODE, sessionLabel: session.treedepth });
    for (const day of days) {
      if (targets.length >= limit) break;
      const isoDate = fileNameToIsoDate(day.fileName);
      if (isoDate && isoDate < from) {
        excludedDays++;
        continue;
      }
      const { segments } = await listSpeakerSegments({ code: CODE, fileName: day.fileName });
      for (let i = 0; i < segments.length; i++) {
        if (targets.length >= limit) break;
        const seg = segments[i];
        const { speakerType } = classifySpeakerLabel(seg.speakerLabel);
        if (speakerType !== "member") continue;
        const match = matchSpeakerToMember(seg.speakerLabel, members);
        if (!match) continue; // 発言者確認中（speaker-identification-pending相当）のため対象外
        // 同一議員の連続セグメントは1回目のみを対象にする（多くの場合、直後が答弁）
        const prev = segments[i - 1];
        if (prev && matchSpeakerToMember(prev.speakerLabel, members)?.memberId === match.memberId) continue;

        const next = segments[i + 1];
        const nextIsAnswer = next && classifySpeakerLabel(next.speakerLabel).speakerType !== "member" && classifySpeakerLabel(next.speakerLabel).speakerType !== "chair";
        targets.push({
          sessionTitle: session.label,
          fileName: day.fileName,
          dayLabel: day.label,
          memberSegment: seg,
          answerSegment: nextIsAnswer ? next : null,
          memberId: match.memberId,
        });
      }
    }
  }

  if (excludedDays > 0) {
    console.log(`[fetch-nobeoka-minutes-batch] 対象期間（${from}以降）より前のため、${excludedDays}件の本会議日を除外しました。`);
  }
  console.log(`\n[fetch-nobeoka-minutes-batch] 取得対象（上限${limit}件）: ${targets.length}件`);
  for (const t of targets) {
    console.log(
      `  - ${t.sessionTitle} ${t.dayLabel} / ${t.memberId}（${t.memberSegment.speakerLabel}, pos=${t.memberSegment.pos}）→ 答弁: ${t.answerSegment ? `${t.answerSegment.speakerLabel}(pos=${t.answerSegment.pos})` : "直後に自動判定できず（手動確認が必要）"}`,
    );
  }

  if (isDryRun) {
    console.log("\n[fetch-nobeoka-minutes-batch] --dry-run のため、本文取得は行いませんでした。");
    return;
  }

  const rawDir = join(outputDir, "raw");
  const normalizedDir = join(outputDir, "normalized");
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(normalizedDir, { recursive: true });

  let fetched = 0;
  let skipped = 0;
  for (const t of targets) {
    for (const seg of [t.memberSegment, t.answerSegment].filter(Boolean)) {
      const url = `https://www.kensakusystem.jp/nobeoka/cgi-bin3/GetText3.exe?${CODE}/${t.fileName}/${seg.pos}/10/1//0/0`;
      const id = slug(url);
      const metaPath = join(normalizedDir, `${id}.json`);
      if (existsSync(metaPath)) {
        skipped++;
        continue;
      }
      console.log(`[fetch-nobeoka-minutes-batch] 取得中: ${t.fileName} pos=${seg.pos}（${seg.speakerLabel}）`);
      const result = await fetchSegmentText({ code: CODE, fileName: t.fileName, pos: seg.pos });
      const garbled = looksGarbled(result.text);
      if (garbled) console.warn(`[fetch-nobeoka-minutes-batch] 警告: 文字化けの疑いがあります（${url}）`);

      writeFileSync(join(rawDir, `${id}.html`), result.rawHtml, "utf8");
      writeFileSync(join(normalizedDir, `${id}.txt`), result.text, "utf8");
      writeFileSync(
        join(normalizedDir, `${id}.json`),
        `${JSON.stringify(
          {
            sourceUrl: url,
            fetchedAt: result.fetchedAt,
            title: result.title,
            sessionTitle: t.sessionTitle,
            fileName: t.fileName,
            meetingDate: fileNameToIsoDate(t.fileName),
            pos: seg.pos,
            speakerLabel: seg.speakerLabel,
            memberId: seg === t.memberSegment ? t.memberId : undefined,
            textLength: result.text.length,
            looksGarbled: garbled,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      fetched++;
    }
  }

  console.log(`\n[fetch-nobeoka-minutes-batch] 完了: 新規取得${fetched}件 / スキップ（取得済み）${skipped}件`);
  console.log(
    "[fetch-nobeoka-minutes-batch] 取得した本文は data/minutes/ 配下に保存されました。要約の作成・councilSpeechSummaries.jsonへの登録は、内容を確認しながら別途行ってください（本スクリプトは自動要約・自動登録は行いません）。",
  );
}

await main();
