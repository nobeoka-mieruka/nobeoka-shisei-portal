/**
 * 会議録検索システム（GetText3.exe）から取得済みの生HTML（Shift_JIS）ファイルを読み込み、
 * 本文・タイトルを抽出して正規化テキスト・メタデータJSONを出力する。
 * 再取得せずに抽出ロジックだけを見直したい場合に使う（scripts/lib/minutes-source.mjsの
 * parseSegmentTextHtml()を呼び出すだけの薄いCLI）。
 *
 * 使い方：
 *   node scripts/parse-nobeoka-minutes-html.mjs --input=data/minutes/raw/2026-02-25-m21-question.html
 */
import { readFileSync, writeFileSync } from "node:fs";
import iconv from "iconv-lite";
import { parseSegmentTextHtml, classifySpeakerLabel } from "./lib/minutes-source.mjs";

const args = process.argv.slice(2);
const inputPath = args.find((a) => a.startsWith("--input="))?.split("=")[1];
if (!inputPath) {
  console.error("[parse-nobeoka-minutes-html] --input=<生HTMLファイルのパス> を指定してください。");
  process.exit(1);
}

const buf = readFileSync(inputPath);
const html = iconv.decode(buf, "Shift_JIS");
const { text, title } = parseSegmentTextHtml(html);

// タイトルは「会議名 発言者ラベル」の形式（半角スペース区切り）。会議名部分と発言者ラベルを分離する。
const lastSpaceIndex = title.lastIndexOf(" ");
const meetingTitle = lastSpaceIndex >= 0 ? title.slice(0, lastSpaceIndex) : title;
const speakerLabel = lastSpaceIndex >= 0 ? title.slice(lastSpaceIndex + 1) : "";
const { speakerType } = classifySpeakerLabel(speakerLabel);

const result = { meetingTitle, speakerLabel, speakerType, text, textLength: text.length };
console.log(JSON.stringify(result, null, 2));

const outPath = inputPath.replace(/\.html$/i, ".parsed.json");
if (outPath !== inputPath) {
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`[parse-nobeoka-minutes-html] ${outPath} へ出力しました。`);
}
