/**
 * データ完全性メトリクス（収録率）の整合性検証。
 *
 * src/lib/completeness.ts（DataStatusPageと共通のロジック）を使って、主要データセットの
 * 収録率を再計算し、以下の不整合を検出する。
 *
 * error（明確な不整合）：
 *   - collected（収録数）が負の値
 *   - collectedがtotalKnown（母数）を超えている
 *   - coverageRateが0〜100の範囲外
 *   - confirmed_zeroなのにcollected > 0（矛盾）
 *
 * warning：
 *   - totalKnownが0未満（データ入力ミスの可能性）
 *
 * info：
 *   - 母数未確認（totalKnown=null）の項目一覧（母数不明を隠さず可視化する）
 *
 * 使い方：node scripts/validate-completeness.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { simpleCompleteness } from "../src/lib/completeness.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const readJson = (relPath) => JSON.parse(readFileSync(join(root, relPath), "utf8"));

const errors = [];
const warnings = [];
const info = [];

function checkMetric(label, collected, totalKnown) {
  if (collected < 0) {
    errors.push(`${label}: collected（収録数）が負の値です（${collected}）`);
    return;
  }
  if (totalKnown !== null && totalKnown < 0) {
    warnings.push(`${label}: totalKnown（母数）が負の値です（${totalKnown}）`);
    return;
  }
  if (totalKnown !== null && collected > totalKnown) {
    errors.push(`${label}: 収録数（${collected}）が確認済み母数（${totalKnown}）を超えています`);
    return;
  }

  const metric = simpleCompleteness(collected, totalKnown ?? 0);
  if (totalKnown === null) {
    info.push(`${label}: 母数未確認（収録${collected}件、収録率は算出不可）`);
    return;
  }
  if (metric.coverageRate !== null && (metric.coverageRate < 0 || metric.coverageRate > 100)) {
    errors.push(`${label}: coverageRateが0〜100の範囲外です（${metric.coverageRate}）`);
  }
  if (metric.status === "confirmed_zero" && collected > 0) {
    errors.push(`${label}: confirmed_zero（確認済み0件）のはずですが、収録数が${collected}件あります`);
  }
}

// --- 一般質問：現任期の対象会期のうち会議録収録済み ---
try {
  const status = readJson("src/data/questionCollectionStatus.json");
  const collected = status.sessions.filter((s) => s.transcriptAvailable).length;
  checkMetric("一般質問：対象会期の会議録収録率", collected, status.sessions.length);
} catch (e) {
  warnings.push(`一般質問の完全性チェック中にエラー: ${e.message}`);
}

// --- 議案：品質項目（提出者区分・採決方法・付託委員会） ---
try {
  const billVotes = readJson("src/data/billVotes.json");
  checkMetric("議案：提出者区分の確認率", billVotes.filter((b) => b.proposerType).length, billVotes.length);
  checkMetric("議案：採決方法の確認率", billVotes.filter((b) => b.voteMethod).length, billVotes.length);
  checkMetric("議案：付託委員会の確認率", billVotes.filter((b) => b.committee).length, billVotes.length);
} catch (e) {
  warnings.push(`議案の完全性チェック中にエラー: ${e.message}`);
}

// --- 政治資金団体：完全確認率 ---
try {
  const orgs = readJson("src/data/politicalFundOrganizations.json");
  const reports = readJson("src/data/politicalFundReports.json");
  const reportedOrgIds = new Set(reports.map((r) => r.organizationId));
  const fullyConfirmed = orgs.filter((o) => o.representativeName && o.treasurerName && reportedOrgIds.has(o.id)).length;
  checkMetric("政治資金団体：完全確認率", fullyConfirmed, orgs.length);
} catch (e) {
  warnings.push(`政治資金団体の完全性チェック中にエラー: ${e.message}`);
}

// --- 委員会：所管事項確認率 ---
try {
  const committees = readJson("src/data/committees.json");
  checkMetric("委員会：所管事項の確認率", committees.filter((c) => c.jurisdiction !== null).length, committees.length);
} catch (e) {
  warnings.push(`委員会の完全性チェック中にエラー: ${e.message}`);
}

// --- 歴代市長：任期の日単位確認率 ---
try {
  const terms = readJson("src/data/archiveMayorTerms.json");
  const dayPrecise = terms.filter((t) => (t.termStartPrecision ?? "day") === "day").length;
  checkMetric("歴代市長：任期の日単位確認率", dayPrecise, terms.length);
} catch (e) {
  warnings.push(`歴代市長の完全性チェック中にエラー: ${e.message}`);
}

// --- 現職議員：公式プロフィール文・公式サイト確認率 ---
try {
  const members = readJson("src/data/members.json");
  checkMetric("現職議員：公式プロフィール文の確認率", members.filter((m) => !!m.profile).length, members.length);
  checkMetric("現職議員：公式サイトの確認率", members.filter((m) => !!m.profileUrl).length, members.length);
} catch (e) {
  warnings.push(`現職議員の完全性チェック中にエラー: ${e.message}`);
}

for (const i of info) console.log(`[INFO] ${i}`);
for (const w of warnings) console.log(`[WARN] ${w}`);
for (const e of errors) console.error(`[ERR] ${e}`);

console.log(`[validate-completeness] errors=${errors.length} warnings=${warnings.length} info=${info.length}`);

if (errors.length > 0) process.exit(1);
