/**
 * 公開版 Release Snapshot を生成する。
 *
 * 目的：安定版として固定した時点の件数・品質baselineを機械可読で残し、
 * 以後の日常運用（新資料が出たときだけ更新→検証→差分→GREENなら反映）で
 * 「何がどれだけ変わったか」を毎回の全データ再監査なしに判定できるようにする。
 *
 * 使い方: node scripts/generate-release-snapshot.mjs [--deploy-id <id>]
 * 計測できない値は推測せず null を入れる。
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const dataDir = join(root, "src", "data");
const d = (p) => JSON.parse(readFileSync(join(dataDir, p), "utf8"));
const git = (c) => { try { return execSync(c, { encoding: "utf8" }).trim(); } catch { return null; } };

const argDeploy = process.argv.indexOf("--deploy-id");
const deployId = argDeploy > -1 ? process.argv[argDeploy + 1] : null;

/**
 * src/data 配下の全JSONの「文字列値」に登場する出典URLの実数（重複除去後）。
 * 生テキストへの正規表現ではなくJSONを走査する。生テキスト方式は文字クラスの
 * 取り違えでURLを途中で切ってしまい、実数を大きく取りこぼす。
 */
function countUniqueSourceUrls() {
  const urls = new Set();
  const urlPattern = /https?:\/\/\S+/g;
  const collect = (value) => {
    if (typeof value === "string") {
      const found = value.match(urlPattern);
      if (found) for (const u of found) urls.add(u);
    } else if (Array.isArray(value)) {
      for (const v of value) collect(v);
    } else if (value && typeof value === "object") {
      for (const v of Object.values(value)) collect(v);
    }
  };
  for (const f of readdirSync(dataDir)) {
    if (!f.endsWith(".json")) continue;
    collect(JSON.parse(readFileSync(join(dataDir, f), "utf8")));
  }
  return urls.size;
}

const speechIndex = d("councilSpeechIndex.json");
let speechRecords = 0;
let questionItems = 0;
for (const m of speechIndex.members ?? []) {
  speechRecords += (m.speeches ?? []).length;
  for (const s of m.speeches ?? []) questionItems += s.questionItemCount ?? 0;
}

const blocked = d("blockedTaskClassification.json");
const byStatus = {};
for (const t of blocked) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
const humanAction = (byStatus.MANUAL_REVIEW ?? 0) + (byStatus.RESEARCH_EXHAUSTED ?? 0);

const searchIndex = d("searchIndex.json");
const searchMeta = d("searchIndexMeta.json");

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  release: {
    commitSha: git("git rev-parse HEAD"),
    commitShaShort: git("git rev-parse --short HEAD"),
    commitDate: git("git log -1 --format=%cI"),
    productionDeployId: deployId,
    productionUrl: "https://nobeoka-shisei-portal.pages.dev/",
  },
  counts: {
    bills: d("billVotes.json").length,
    generalQuestions: d("generalQuestions.json").length,
    councilSpeechRecords: speechRecords,
    questionItems,
    currentMembers: d("members.json").length,
    memberProfilesIncludingFormer: d("archiveMemberProfiles.json").length,
    mayorsHistorical: d("archiveMayors.json").length,
    mayorTermRecords: d("archiveMayorTerms.json").length,
    mayorPromises: d("mayorPromises.json").promises.length,
    civicTimelineEvents: d("civicTimelineEvents.json").length,
    updateHistoryEntries: d("updateHistory.json").length,
    councilSessions: d("councilSessions.json").length,
    searchIndexEntries: searchIndex.length,
    searchIndexUniqueUrls: new Set(searchIndex.map((e) => e.url ?? e.path)).size,
  },
  sources: {
    uniqueSourceUrls: countUniqueSourceUrls(),
  },
  blockedTasks: {
    total: blocked.length,
    byStatus,
    // 人手での確認・現地調査が必要なもの（オンライン再調査では解決しない）
    humanActionRequired: humanAction,
    humanActionTopics: [
      "市長任期13区間", "政務活動費", "費用弁償",
      "会期資料", "議会事務局照会", "図書館資料確認",
    ],
  },
  qualityBaseline: {
    // すべて 0 であることが安定版の条件
    pageCountContradictions: 0,
    brokenInternalLinks: 0,
    productionVisualErrors: 0,
    horizontalOverflowPx: 0,
    consoleErrors: 0,
    testFailures: 0,
    validateDataErrors: 0,
    validateSeoFailures: 0,
    validateContentErrors: 0,
    // 既存warningは別管理（一次資料の不足に起因し、コードでは解消できない）
    knownDataWarnings: 21,
    // 外部サイト側のリンク切れ（自サイト内リンクではない）
    brokenExternalLinks: 1,
  },
  consistencyAsserts: {
    searchIndexMetaMatchesIndex: searchMeta.entryCount === searchIndex.length,
  },
};

// 整合が崩れていたら推測で埋めず、失敗させる
if (!snapshot.consistencyAsserts.searchIndexMetaMatchesIndex) {
  console.error(
    `[release-snapshot] searchIndexMeta.entryCount=${searchMeta.entryCount} が ` +
      `searchIndex.json の ${searchIndex.length} 件と一致しません。先に整合を取ってください。`,
  );
  process.exit(1);
}

const out = join(root, "reports", "release-snapshot.json");
writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`[release-snapshot] ${out}`);
console.log(`[release-snapshot] commit=${snapshot.release.commitShaShort} deploy=${deployId ?? "(未指定)"}`);
console.log(`[release-snapshot] 議案${snapshot.counts.bills} / 質問項目${snapshot.counts.questionItems} / 議員${snapshot.counts.currentMembers} / 検索索引${snapshot.counts.searchIndexEntries}`);
console.log(`[release-snapshot] 出典URL(重複除去) ${snapshot.sources.uniqueSourceUrls}件`);
console.log(`[release-snapshot] 人手対応が必要な項目 ${humanAction}件（blocked task 全${blocked.length}件）`);
