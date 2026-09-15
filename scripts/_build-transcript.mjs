import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { listSpeakerSegments, fetchSegmentText, classifySpeakerLabel } from "./lib/minutes-source.mjs";
import { createHash } from "node:crypto";

const CODE = "48o046ot0cia1xvtw7";
const DAYS = ["R080623A", "R080624A", "R080625A"];
const NORM = "data/minutes/normalized";
const RAW = "data/minutes/raw";
const OUT = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1] ?? "data/minutes/june-transcript";
const fetchMissing = process.argv.includes("--fetch-missing");

const slug = (url) => createHash("sha1").update(url).digest("hex").slice(0, 12);
const urlFor = (fileName, pos) => `https://www.kensakusystem.jp/nobeoka/cgi-bin3/GetText3.exe?${CODE}/${fileName}/${pos}/10/1//0/0`;

// 既に取得済みの本文を pos で引けるようにする
const have = new Map();
for (const f of readdirSync(NORM).filter((f) => f.endsWith(".json"))) {
  try {
    const m = JSON.parse(readFileSync(`${NORM}/${f}`, "utf8"));
    if (DAYS.includes(m.fileName)) have.set(`${m.fileName}:${m.pos}`, f.replace(".json", ""));
  } catch {}
}

mkdirSync(OUT, { recursive: true });
let missing = 0;
let fetched = 0;
for (const fileName of DAYS) {
  const { segments } = await listSpeakerSegments({ code: CODE, fileName });
  const rows = [];
  for (const seg of segments) {
    const key = `${fileName}:${seg.pos}`;
    const { speakerType } = classifySpeakerLabel(seg.speakerLabel);
    let id = have.get(key);
    if (!id && fetchMissing && speakerType !== "chair") {
      const url = urlFor(fileName, seg.pos);
      id = slug(url);
      const result = await fetchSegmentText({ code: CODE, fileName, pos: seg.pos });
      writeFileSync(`${RAW}/${id}.html`, result.rawHtml, "utf8");
      writeFileSync(`${NORM}/${id}.txt`, result.text, "utf8");
      writeFileSync(
        `${NORM}/${id}.json`,
        JSON.stringify({ sourceUrl: url, fetchedAt: result.fetchedAt, title: result.title, fileName, pos: seg.pos, speakerLabel: seg.speakerLabel, textLength: result.text.length }, null, 2) + "\n",
        "utf8",
      );
      have.set(key, id);
      fetched++;
    }
    if (!id) {
      if (speakerType !== "chair") missing++;
      rows.push({ order: seg.order, pos: seg.pos, speaker: seg.speakerLabel, speakerType, text: null });
      continue;
    }
    rows.push({ order: seg.order, pos: seg.pos, speaker: seg.speakerLabel, speakerType, sourceUrl: urlFor(fileName, seg.pos), text: readFileSync(`${NORM}/${id}.txt`, "utf8") });
  }
  writeFileSync(`${OUT}/${fileName}.json`, JSON.stringify(rows, null, 1) + "\n", "utf8");
  const withText = rows.filter((r) => r.text).length;
  console.log(`${fileName}: 全${rows.length}セグメント / 本文あり${withText} / 議長等${rows.filter((r) => r.speakerType === "chair").length}`);
}
console.log(`本文欠落（議長以外）: ${missing}件 / 今回追加取得: ${fetched}件`);
