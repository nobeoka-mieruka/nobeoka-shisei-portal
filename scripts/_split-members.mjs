import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import members from "../src/data/members.json" with { type: "json" };
import { matchSpeakerToMember } from "./lib/minutes-source.mjs";

const DAYS = ["R080623A", "R080624A", "R080625A"];
const IN = "data/minutes/june-transcript";
const OUT = "data/minutes/june-by-member";
mkdirSync(OUT, { recursive: true });

const summary = [];
for (const fileName of DAYS) {
  const rows = JSON.parse(readFileSync(`${IN}/${fileName}.json`, "utf8"));
  // 議員セグメントのmemberIdを解決し、連続する同一議員の区間を1つの一般質問ブロックにする
  let current = null;
  const blocks = [];
  for (const r of rows) {
    const m = r.speakerType === "member" ? matchSpeakerToMember(r.speaker, members) : null;
    if (m) {
      if (!current || current.memberId !== m.memberId) {
        current = { memberId: m.memberId, memberName: m.name, fileName, rows: [] };
        blocks.push(current);
      }
    }
    if (current) current.rows.push(r);
  }
  for (const b of blocks) {
    // 議長のみの末尾を落とす
    while (b.rows.length && b.rows[b.rows.length - 1].speakerType === "chair") b.rows.pop();
    const chars = b.rows.reduce((n, r) => n + (r.text?.length ?? 0), 0);
    writeFileSync(`${OUT}/${fileName}-${b.memberId}.json`, JSON.stringify(b, null, 1) + "\n", "utf8");
    summary.push({ file: `${fileName}-${b.memberId}`, memberId: b.memberId, memberName: b.memberName, segments: b.rows.length, chars });
  }
}
summary.forEach((s) => console.log(`${s.file} ${s.memberName} セグメント${s.segments} ${s.chars}字`));
console.log("ブロック数:", summary.length, "合計字数:", summary.reduce((n, s) => n + s.chars, 0));
