/**
 * 公開済み議案のうち、条例名などが実質的に同じ議案が複数の定例会にまたがって存在する場合、
 * 「改正の系譜」の比較候補（relationStatus: "suggested"）を機械的に生成する。
 *
 * 名称が似ているだけで同一条例と断定しないよう、判定は「制定・改正等の定型語を除いた
 * 中核名称が完全一致する場合のみ」に限定している（部分一致・あいまい一致は行わない）。
 * 生成した候補は必ず"suggested"のままとし、"confirmed"への変更は人が
 * （データを直接編集して）行う。このスクリプトはconfirmedを上書きしない。
 *
 * 実行: node scripts/suggest-bill-relations.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const billVotesPath = join(root, "src", "data", "billVotes.json");
const isDryRun = process.argv.includes("--dry-run");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** 制定・改正等の定型語を取り除き、条例等の中核名称だけを取り出す。 */
function coreName(title) {
  return title
    .replace(/（.*?）/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/の一部を改正する条例(の制定)?/g, "")
    .replace(/条例の制定/g, "条例")
    .replace(/の制定/g, "")
    .replace(/を改正する条例/g, "条例")
    .trim();
}

const billVotes = readJson(billVotesPath);
// 条例（改正履歴の比較に意味がある分類）で、公開済みのものだけを対象にする。
const candidates = billVotes.filter((b) => b.category === "条例" && (b.publicationStatus === undefined || b.publicationStatus === "published"));

const groups = new Map();
for (const b of candidates) {
  const key = coreName(b.billTitle ?? "");
  if (!key || key.length < 4) continue; // 短すぎる名称は誤判定の危険があるため対象外
  const list = groups.get(key) ?? [];
  list.push(b);
  groups.set(key, list);
}

let suggestedCount = 0;
let groupCount = 0;
for (const [key, group] of groups) {
  // 同じ議案（同一sessionId）内の重複や、既にconfirmed/rejected判定済みのものはそのままにする。
  const bySession = new Map();
  for (const b of group) bySession.set(b.sessionId, b);
  if (bySession.size < 2) continue; // 異なる定例会に2件以上ないと「改正の系譜」として意味がない

  const sorted = [...bySession.values()].sort((a, b) => (a.votingDate ?? "").localeCompare(b.votingDate ?? ""));
  groupCount++;
  for (let i = 0; i < sorted.length; i++) {
    const bill = sorted[i];
    if (bill.relationStatus === "confirmed" || bill.relationStatus === "rejected") continue; // 人の判断を上書きしない
    const others = sorted.filter((b) => b.id !== bill.id).map((b) => b.id);
    bill.relatedBillIds = others;
    if (i > 0) bill.revisionOfBillId = sorted[i - 1].id;
    bill.relationStatus = "suggested";
    suggestedCount++;
  }
  console.log(`[suggest-bill-relations] "${key}"：${sorted.map((b) => b.id).join(" → ")}`);
}

if (!isDryRun) writeJson(billVotesPath, billVotes);
console.log(
  `[suggest-bill-relations] ${isDryRun ? "(dry-run) " : ""}候補グループ=${groupCount} 更新した議案=${suggestedCount}`,
);
