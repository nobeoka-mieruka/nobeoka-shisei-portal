/**
 * 政治資金団体・収支報告書（src/data/politicalFundOrganizations.json /
 * src/data/politicalFundReports.json）の年度横断・団体横断クロスチェック。
 *
 * scripts/validate-data.mjsが既にカバーしている基本検証（必須項目・重複ID・sourceRefs形式等、
 * もし存在すれば）は再実装しない。ここでは、単一レコードだけでは検出しづらい「金額の妥当性」
 * 「団体参照の整合性」「年度・出典の整合性」のみを対象とする。
 *
 * error（明確な矛盾・データ破損の疑い）：
 *   - totalIncome・totalExpenditure・carriedOverFromPreviousYear・carriedOverToNextYearの
 *     いずれかが負の値
 *   - 同一団体・同一年分（organizationId + fiscalYear）のレポートが重複登録されている
 *   - reportStatusが「確認済み」なのにsourceUrlが空（出典無しで確定値扱いにしている疑い）
 *   - fiscalYear（「令和N年分」）が本日時点の年より未来
 *   - organizationIdがpoliticalFundOrganizations.jsonに存在しない団体を参照している
 *
 * warning（要確認、必ずしも誤りとは限らない）：
 *   - carriedOverFromPreviousYear + totalIncome - totalExpenditure が
 *     carriedOverToNextYearと一致しない（両方が非nullの場合のみ判定。資産等の状況等、
 *     単純な収支計算だけでは説明できない調整項目が資料構造上存在しうるため、
 *     一致しない場合も一律に「誤り」とは判定せず、確認推奨のwarningにとどめる）
 *   - amountUnitが「円」以外（千円との取り違えの疑い）
 *   - 単一団体・単一年分の金額（income/expenditure/繰越）のいずれかが1億円を超える
 *     （個人後援会規模の政治資金団体としては桁違いの疑いがあるが、大規模団体の
 *     可能性もあるためerrorにはしない）
 *
 * info（参考情報、誤りではない）：
 *   - 収支・繰越の整合性が確認できた団体数
 *   - 収入・支出とも0円（活動実績なし、確認済み0件）の団体数
 *
 * 使い方：node --experimental-strip-types scripts/validate-political-funds.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const readJson = (relPath) => JSON.parse(readFileSync(join(root, relPath), "utf8"));

const errors = [];
const warnings = [];
const info = [];

const orgs = readJson("src/data/politicalFundOrganizations.json");
const reports = readJson("src/data/politicalFundReports.json");
const orgIds = new Set(orgs.map((o) => o.id));

const MAX_REASONABLE_YEN = 100_000_000; // 1億円

// 「令和6年分」→ 西暦6+2018=2024
function fiscalYearToSeireki(label) {
  const m = String(label).match(/令和(\d+)年分/);
  if (!m) return null;
  return Number(m[1]) + 2018;
}

const currentYear = new Date().getFullYear();
const seenOrgYear = new Set();
let consistentCount = 0;
let allZeroCount = 0;

for (const r of reports) {
  const tag = `politicalFundReports.json (${r.id ?? "id不明"})`;

  // --- 団体参照整合性 ---
  if (!orgIds.has(r.organizationId)) {
    errors.push(`${tag}: organizationIdが存在しない団体を参照しています: ${r.organizationId}`);
  }

  // --- 年度重複 ---
  const orgYearKey = `${r.organizationId}::${r.fiscalYear}`;
  if (seenOrgYear.has(orgYearKey)) {
    errors.push(`${tag}: 同一団体・同一年分のレポートが重複しています（${orgYearKey}）`);
  } else {
    seenOrgYear.add(orgYearKey);
  }

  // --- 未来年度 ---
  const seireki = fiscalYearToSeireki(r.fiscalYear);
  if (seireki !== null && seireki > currentYear) {
    errors.push(`${tag}: fiscalYear（${r.fiscalYear}）が本日時点（${currentYear}年）より未来です`);
  }

  // --- 金額の非負チェック ---
  const amountFields = [
    ["carriedOverFromPreviousYear", r.carriedOverFromPreviousYear],
    ["totalIncome", r.totalIncome],
    ["totalExpenditure", r.totalExpenditure],
    ["carriedOverToNextYear", r.carriedOverToNextYear],
  ];
  for (const [field, value] of amountFields) {
    if (typeof value === "number" && value < 0) {
      errors.push(`${tag}: ${field}が負の値です（${value}円）`);
    }
    if (typeof value === "number" && value > MAX_REASONABLE_YEN) {
      warnings.push(`${tag}: ${field}が1億円を超えています（${value}円、桁違いの疑いまたは大規模団体）`);
    }
  }

  // --- 単位チェック ---
  if (r.amountUnit && r.amountUnit !== "円") {
    warnings.push(`${tag}: amountUnitが「円」以外です（${r.amountUnit}）。千円等との取り違えの疑いがないか確認してください`);
  }

  // --- 出典無し確定値チェック ---
  if (r.reportStatus === "確認済み" && (!r.sourceUrl || r.sourceUrl.trim() === "")) {
    errors.push(`${tag}: reportStatusが「確認済み」ですがsourceUrlが空です（出典無しで確定値扱いにしないでください）`);
  }

  // --- 繰越・収支の整合性 ---
  if (
    typeof r.carriedOverFromPreviousYear === "number" &&
    typeof r.totalIncome === "number" &&
    typeof r.totalExpenditure === "number" &&
    typeof r.carriedOverToNextYear === "number"
  ) {
    const expected = r.carriedOverFromPreviousYear + r.totalIncome - r.totalExpenditure;
    if (expected === r.carriedOverToNextYear) {
      consistentCount++;
    } else {
      warnings.push(
        `${tag}: 前年繰越（${r.carriedOverFromPreviousYear}円）+収入（${r.totalIncome}円）-支出（${r.totalExpenditure}円）=${expected}円が、翌年繰越（${r.carriedOverToNextYear}円）と一致しません`,
      );
    }
  }

  if (r.totalIncome === 0 && r.totalExpenditure === 0) {
    allZeroCount++;
  }
}

info.push(`収支・繰越の整合性が確認できた団体・年分：${consistentCount}件`);
info.push(`収入・支出とも0円（活動実績なし、確認済み0件）の団体・年分：${allZeroCount}件`);

for (const i of info) console.log(`[INFO] ${i}`);
for (const w of warnings) console.log(`[WARN] ${w}`);
for (const e of errors) console.error(`[ERR] ${e}`);

console.log(`[validate-political-funds] errors=${errors.length} warnings=${warnings.length} info=${info.length}`);

if (errors.length > 0) process.exit(1);
