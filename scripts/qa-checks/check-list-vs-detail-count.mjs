#!/usr/bin/env node
/**
 * completeness母数不整合チェック（一覧ページの件数 vs 生成された詳細ページ数）
 *
 * dist/（npm run build のprerender成果物）配下の実際に生成された詳細ページディレクトリ数と、
 * src/data配下の対応するJSONの母数（該当id集合）を突き合わせる。
 * 「データはあるのに詳細ページが生成されていない」「詳細ページはあるのにデータが無い（残骸）」を
 * 検出する。dist/が存在しない場合（buildを未実行）は、その旨を明示してスキップする。
 *
 * 【既存資産との重複回避】
 * scripts/ui-audit-phase76.mjsはdist内のリンク切れ・空ページ等をHTML単位で見ているが、
 * 「一覧側の母数」と「詳細ページ生成数」を突き合わせる視点は持っていない（新規）。
 * 読み取り専用。dist/への書き込みは行わない。
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, readJson } from "./_lib.mjs";

const DIST = join(ROOT, "dist");

function listDirNames(relDir) {
  const abs = join(DIST, relDir);
  if (!existsSync(abs)) return null;
  return readdirSync(abs).filter((name) => {
    const st = statSync(join(abs, name));
    return st.isDirectory();
  });
}

// ルートごとの設定。excludeは詳細ページではないサブディレクトリ（一覧内の機能別サブページ等）。
const ROUTE_CHECKS = [
  {
    label: "現職議員 (/members/*)",
    distDir: "members",
    exclude: new Set(["former", "history"]),
    filterDirNames: (names) => names.filter((n) => !n.startsWith("fm")),
    dataFile: "src/data/members.json",
    dataIds: (d) => d.map((x) => x.id),
  },
  {
    label: "元議員 (/members/former/*)",
    distDir: "members/former",
    exclude: new Set([]),
    dataFile: "src/data/formerMembers.json",
    dataIds: (d) => d.map((x) => x.id),
  },
  {
    label: "議案・採決 (/bills/votes/*)",
    distDir: "bills/votes",
    exclude: new Set([]),
    dataFile: "src/data/billVotes.json",
    dataIds: (d) => d.filter((x) => x.publicationStatus !== "rejected" && x.publicationStatus !== "error").map((x) => x.id),
  },
  {
    label: "一般質問 (/questions/*)",
    distDir: "questions",
    exclude: new Set([]),
    dataFile: "src/data/generalQuestions.json",
    dataIds: (d) => d.map((x) => x.id),
  },
  {
    label: "歴代市長 (/mayors/*)",
    distDir: "mayors",
    exclude: new Set([]),
    dataFile: "src/data/archiveMayors.json",
    dataIds: (d) => d.map((x) => x.slug ?? x.id),
  },
];

if (!existsSync(DIST)) {
  console.log("[check-list-vs-detail-count] dist/が見つかりません。npm run build 実行後に再度お試しください。");
  const findings = { generatedAt: new Date().toISOString(), skipped: true, reason: "dist/ not found" };
  writeFileSync(
    join(ROOT, "reports", "qa-checks", "_out-list-vs-detail-count.json"),
    JSON.stringify(findings, null, 2) + "\n",
    "utf8",
  );
  process.exit(0);
}

const results = [];
for (const r of ROUTE_CHECKS) {
  let dirNames = listDirNames(r.distDir);
  if (dirNames === null) {
    results.push({ label: r.label, skipped: true, reason: `dist/${r.distDir} が見つかりません` });
    continue;
  }
  dirNames = dirNames.filter((n) => !r.exclude.has(n));
  if (r.filterDirNames) dirNames = r.filterDirNames(dirNames);
  const distIdSet = new Set(dirNames);

  let data;
  try {
    data = readJson(r.dataFile);
  } catch (e) {
    results.push({ label: r.label, skipped: true, reason: `${r.dataFile}を読み込めません: ${e.message}` });
    continue;
  }
  const dataIdSet = new Set(r.dataIds(data));

  const missingDetailPages = [...dataIdSet].filter((id) => !distIdSet.has(id));
  const orphanDetailPages = [...distIdSet].filter((id) => !dataIdSet.has(id));

  results.push({
    label: r.label,
    distDir: r.distDir,
    dataCount: dataIdSet.size,
    distPageCount: distIdSet.size,
    missingDetailPageCount: missingDetailPages.length,
    missingDetailPages: missingDetailPages.slice(0, 20),
    orphanDetailPageCount: orphanDetailPages.length,
    orphanDetailPages: orphanDetailPages.slice(0, 20),
  });
}

const findings = {
  generatedAt: new Date().toISOString(),
  distFound: true,
  results,
  note:
    "missingDetailPagesは『データはあるがdist/に対応する詳細ページディレクトリが生成されていない』候補、" +
    "orphanDetailPagesは逆に『詳細ページはあるがデータ側にidが見当たらない』候補。" +
    "本チェックはビルド時点のdist/スナップショットに依存するため、最新の状態を見るには " +
    "npm run build 実行直後に再実行すること。",
};

const outPath = join(ROOT, "reports", "qa-checks", "_out-list-vs-detail-count.json");
writeFileSync(outPath, JSON.stringify(findings, null, 2) + "\n", "utf8");

console.log("[check-list-vs-detail-count]");
let anyMismatch = false;
for (const r of results) {
  if (r.skipped) {
    console.log(`  ${r.label}: SKIPPED (${r.reason})`);
    continue;
  }
  console.log(
    `  ${r.label}: data=${r.dataCount} distPages=${r.distPageCount} missing=${r.missingDetailPageCount} orphan=${r.orphanDetailPageCount}`,
  );
  if (r.missingDetailPageCount > 0 || r.orphanDetailPageCount > 0) anyMismatch = true;
}
process.exitCode = anyMismatch ? 1 : 0;
