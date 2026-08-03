/**
 * src/data/councilSpeechSummaries.json の初期化・整合性維持を行うスクリプト。
 *
 * 重要：このスクリプトは公式会議録本文の取得・解析は一切行わない（scripts/fetch-nobeoka-minutes.mjs
 * が将来担当する）。ここでは、既存の議員データ（members.json）・会期データ（councilSessions.json）
 * を基に、「まだ何も解析していない」という事実だけを正確に反映したレコードを用意する。
 *
 * 既に会議録本文の解析が進み、speechesに実データが入っている議員のレコードは一切上書きしない
 * （speeches.length > 0の議員はスキップする）。
 *
 * 使い方：
 *   node scripts/generate-speech-summary-scaffold.mjs [--dry-run]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const membersPath = join(root, "src", "data", "members.json");
const formerMembersPath = join(root, "src", "data", "formerMembers.json");
const sessionsPath = join(root, "src", "data", "councilSessions.json");
const outPath = join(root, "src", "data", "councilSpeechSummaries.json");

const isDryRun = process.argv.includes("--dry-run");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function emptyMemberRecord(memberId) {
  return {
    memberId,
    analysisPeriod: { from: null, to: null },
    scope: ["plenary"],
    analyzedSessionCount: 0,
    sessionsWithSpeechCount: 0,
    sessionsWithoutSpeechCount: 0,
    unavailableSessionCount: 0,
    unfetchedSessionCount: 0,
    lastAnalyzedAt: null,
    topicCounts: [],
    speeches: [],
  };
}

function main() {
  const members = readJson(membersPath);
  const formerMembers = existsSync(formerMembersPath) ? readJson(formerMembersPath) : [];
  const formerMemberIds = new Set(formerMembers.map((m) => m.id));
  const sessions = readJson(sessionsPath);
  const totalSessionCount = sessions.length;

  const existing = existsSync(outPath) ? readJson(outPath) : { version: 1, generatedAt: null, members: [] };
  const byMemberId = new Map(existing.members.map((m) => [m.memberId, m]));

  let touched = 0;
  for (const member of members) {
    const record = byMemberId.get(member.id);
    if (record && record.speeches.length > 0) {
      // 既に会議録本文から解析済みの発言データがある議員は上書きしない。
      continue;
    }
    // 未解析（レコードなし、またはspeeches:[]のまま）の議員は、現在の会期総数に合わせて
    // unfetchedSessionCountを更新する（会期が新しく追加されるたびに反映されるように）。
    const fresh = emptyMemberRecord(member.id);
    fresh.unfetchedSessionCount = totalSessionCount;
    const unchanged =
      record &&
      record.unfetchedSessionCount === totalSessionCount &&
      record.analyzedSessionCount === 0 &&
      record.sessionsWithSpeechCount === 0 &&
      record.sessionsWithoutSpeechCount === 0 &&
      record.unavailableSessionCount === 0;
    if (!unchanged) touched++;
    byMemberId.set(member.id, fresh);
  }

  // members.jsonに存在しない議員IDのレコードは残さない（削除された議員データの整合性維持）。
  // ただし、formerMembers.jsonに登録済みの元議員（過去会期の発言履歴として意図的に保持する
  // レコード）は、現職ではなくなっていてもここでは削除しない。
  const memberIds = new Set(members.map((m) => m.id));
  for (const id of [...byMemberId.keys()]) {
    if (!memberIds.has(id) && !formerMemberIds.has(id)) {
      byMemberId.delete(id);
      touched++;
    }
  }

  const formerMemberRecords = [...byMemberId.entries()]
    .filter(([id]) => formerMemberIds.has(id))
    .map(([, record]) => record);

  const nextData = {
    version: 1,
    generatedAt: existing.generatedAt,
    members: [...members.map((m) => byMemberId.get(m.id)).filter(Boolean), ...formerMemberRecords],
  };

  console.log(
    `[generate-speech-summary-scaffold] 対象議員: ${members.length}名 / 更新: ${touched}件 / 対象会期数: ${totalSessionCount}件`,
  );

  if (touched === 0) {
    console.log("[generate-speech-summary-scaffold] 変更はありません。");
    return;
  }
  if (isDryRun) {
    console.log("[generate-speech-summary-scaffold] --dry-run のため、ファイルは書き換えていません。");
    return;
  }
  writeFileSync(outPath, `${JSON.stringify(nextData, null, 2)}\n`, "utf8");
  console.log("[generate-speech-summary-scaffold] src/data/councilSpeechSummaries.json を更新しました。");
}

main();
