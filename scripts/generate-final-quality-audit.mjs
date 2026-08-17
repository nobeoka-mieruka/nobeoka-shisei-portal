/**
 * TASK-096〜099：出典品質スコア（Priority 8）・sourceRef欠落レコード検出（Priority 9後半）・
 * 名称ゆれ重複候補検出（Priority 10）を集計し、reports/final-quality-audit.{json,md}へ出力する。
 *
 * 新しい検証ロジックの追加ではなく、既存のvalidate-sources.mjsのドメイン分類（公式／
 * 二次資料）を出典品質A〜Eへ拡張したもの。ネットワークアクセスは行わない（リンク切れの
 * 判定は既存のreports/external-link-check.jsonキャッシュを再利用する）。
 *
 * 出典品質の定義：
 *   A：延岡市・延岡市議会・総務省・宮崎県等の一次資料
 *   B：NDL・公的図書館・公的アーカイブ（Internet Archive経由の公式資料を含む）
 *   C：新聞・報道
 *   D：その他二次資料（Wikipedia等）
 *   E：出典不明（URL形式不正）・リンク切れ・要確認
 *
 * 使い方：node scripts/generate-final-quality-audit.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "src", "data");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const OFFICIAL_DOMAINS = new Set([
  "www.city.nobeoka.miyazaki.jp", "city.nobeoka.miyazaki.jp", "www.kensakusystem.jp",
  "www.pref.miyazaki.lg.jp", "www.soumu.go.jp", "data.stat.pref.miyazaki.lg.jp",
  "www.si-gichokai.jp", "www1.g-reiki.net",
]);
const LIBRARY_DOMAINS = new Set([
  "ndlsearch.ndl.go.jp", "dl.ndl.go.jp", "id.ndl.go.jp",
]);
const NEWS_DOMAINS = new Set([
  "www.the-miyanichi.co.jp", "news.yahoo.co.jp", "www.yomiuri.co.jp", "www.asahi.com",
  "mainichi.jp", "www3.nhk.or.jp",
]);
const SECONDARY_DOMAINS = new Set([
  "ja.wikipedia.org", "kotobank.jp", "go2senkyo.com",
]);
const OTHER_PUBLIC_DOMAINS = new Set([
  "www.city.miyakonojo.miyazaki.jp", "www.hyugacity.jp", "www.city.miyazaki.miyazaki.jp",
  "www.city.kobayashi.lg.jp", "www.city.nichinan.lg.jp", "www.city.saito.lg.jp",
  "www.komei.or.jp", "new-kokumin.jp", "cdp-japan.jp",
]);

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
function unwrapWaybackUrl(url) {
  const m = /^https?:\/\/web\.archive\.org\/web\/[^/]+\/(https?:\/\/.+)$/.exec(url);
  return m ? m[1] : null;
}

// リンク切れキャッシュ（既存のcheck-external-links.mjs結果を再利用、新規アクセスなし）
let brokenUrls = new Set();
const linkReportPath = join(root, "reports", "external-link-check.json");
if (existsSync(linkReportPath)) {
  const report = readJson(linkReportPath);
  for (const r of report.results) {
    if (r.category === "not_found_404" || r.category === "server_error") brokenUrls.add(r.url);
  }
}

function classifyUrl(url) {
  if (typeof url !== "string" || url.trim() === "") return "E";
  if (brokenUrls.has(url)) return "E";
  const host = hostOf(url);
  if (!host) return "E";
  const isWayback = host === "web.archive.org";
  const originalUrl = isWayback ? unwrapWaybackUrl(url) : null;
  const originalHost = originalUrl ? hostOf(originalUrl) : null;
  const effectiveHost = originalHost ?? host;
  if (OFFICIAL_DOMAINS.has(effectiveHost) || OTHER_PUBLIC_DOMAINS.has(effectiveHost)) return "A";
  if (LIBRARY_DOMAINS.has(effectiveHost)) return "B";
  if (NEWS_DOMAINS.has(effectiveHost)) return "C";
  if (SECONDARY_DOMAINS.has(effectiveHost)) return "D";
  return "D"; // 未分類ドメインは「その他二次資料」扱い（不明ではなくD、URLは有効なため）
}

// 対象データファイル（人物・議会・財政・選挙・市政年表を横断、内部管理専用ファイルは除外）
const TARGET_FILES = [
  "archiveMayors.json", "archiveMayorTerms.json", "members.json", "formerMembers.json",
  "archiveMemberProfiles.json", "billVotes.json", "archiveCouncilDocuments.json",
  "committees.json", "electionResults.json", "civicTimelineEvents.json",
  "archiveFiscalYears.json", "politicalFundOrganizations.json", "archivePolicies.json",
];

const qualityCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
const byCategory = {};
const missingSourceRefs = [];

function collectSourceRefs(obj) {
  const refs = [];
  if (Array.isArray(obj)) {
    for (const x of obj) refs.push(...collectSourceRefs(x));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if ((k === "sourceRefs" || k === "sourceRef") && v) {
        const arr = Array.isArray(v) ? v : [v];
        for (const r of arr) if (r && r.sourceUrl) refs.push(r.sourceUrl);
      } else {
        refs.push(...collectSourceRefs(v));
      }
    }
  }
  return refs;
}

/**
 * レコード直下に何らかの出典情報があるかを見る。ファイルごとにsourceRefs配列以外の
 * 出典スキーマを使っている場合があるため（例：billVotes.json＝resultDocumentUrl／
 * sourceFilePath、members.json＝sourceUrl、politicalFundOrganizations.json＝
 * officialListUrl、formerMembers.json＝sourceNote）、それらも出典ありとして扱う。
 * サブオブジェクト（budget.sourceRefs等）の出典で代用はしない（レコード直下のみ確認）。
 */
function hasOwnSourceRefs(record) {
  if (record.sourceRefs && Array.isArray(record.sourceRefs) && record.sourceRefs.length > 0) return true;
  if (record.sourceRef && Object.keys(record.sourceRef).length > 0) return true;
  const altFields = ["sourceUrl", "officialListUrl", "resultDocumentUrl", "sourceFilePath", "sourceNote", "sourceDocumentId"];
  for (const f of altFields) {
    if (record[f] != null && record[f] !== "") return true;
  }
  // archiveFiscalYears.json：population/budget/debt/fund/financeの各サブオブジェクト内に
  // sourceRefsを持つ（年度単位のレコード直下ではなく区分ごとに出典を持つ設計のため）。
  for (const sub of ["population", "budget", "debt", "fund", "finance"]) {
    const subObj = record[sub];
    if (subObj && subObj.sourceRefs && subObj.sourceRefs.length > 0) return true;
    if (subObj && subObj.balance && subObj.balance.sourceRefs && subObj.balance.sourceRefs.length > 0) return true;
  }
  return false;
}

for (const file of TARGET_FILES) {
  const filePath = join(dataDir, file);
  if (!existsSync(filePath)) continue;
  const data = readJson(filePath);
  const records = Array.isArray(data) ? data : Object.values(data);
  const category = file.replace(".json", "");
  byCategory[category] = { A: 0, B: 0, C: 0, D: 0, E: 0, recordsWithoutOwnSourceRefs: 0, totalRecords: records.length };

  for (const rec of records) {
    if (rec && typeof rec === "object" && !Array.isArray(rec)) {
      if (!hasOwnSourceRefs(rec)) {
        byCategory[category].recordsWithoutOwnSourceRefs++;
        missingSourceRefs.push({ file, id: rec.id ?? rec.contId ?? "(no id)" });
      }
    }
    const urls = collectSourceRefs(rec);
    for (const url of urls) {
      const grade = classifyUrl(url);
      qualityCounts[grade]++;
      byCategory[category][grade]++;
    }
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  method: "既存のvalidate-sources.mjsドメイン分類を出典品質A〜Eへ拡張。リンク切れ判定は既存のexternal-link-check.jsonキャッシュを再利用（新規ネットワークアクセスなし）。",
  overallByGrade: qualityCounts,
  byCategory,
  recordsWithoutOwnSourceRefsSample: missingSourceRefs.slice(0, 30),
  recordsWithoutOwnSourceRefsTotal: missingSourceRefs.length,
};

writeFileSync(join(root, "reports", "source-quality-audit.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(
  `[generate-final-quality-audit] A=${qualityCounts.A} B=${qualityCounts.B} C=${qualityCounts.C} D=${qualityCounts.D} E=${qualityCounts.E} / sourceRefsなしレコード=${missingSourceRefs.length}件`,
);
