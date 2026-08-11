/**
 * 財政データ（src/data/archiveFiscalYears.json）の年度横断クロスチェック。
 *
 * scripts/validate-data.mjsが既にカバーしている検証（年度重複・年度ギャップ・金額の非負・
 * 比率の0〜100範囲・sourceRefs形式・fiscalYear整合性等）は再実装しない。ここでは、
 * 単一年度・単一フィールドだけでは検出できない「年度をまたいだ」「異なるフィールド間の」
 * 論理矛盾のみを対象とする。
 *
 * error（明確な矛盾・データ破損の疑い）：
 *   - 人口が1万人未満または30万人超（延岡市の実態から明らかに桁違い）
 *   - 決算額（generalAccountSettlementYen）が設定されている年度が、本日時点の会計年度より未来
 *
 * warning（要確認、必ずしも誤りとは限らない）：
 *   - 予算・決算・市債・基金の金額が100万円未満（千円のまま円として登録した疑い）
 *   - 基金内訳（fiscalAdjustmentFundYen + otherSpecificPurposeFundsYen）の合計がtotalYenと
 *     一致しない（fiscalReserveFundYen・bondRedemptionFundYenはfiscalAdjustmentFundYenの
 *     内数のため合計に含めない）
 *   - 財政力指数が0または2.0超（延岡市規模の自治体として非現実的な値）
 *
 * info（参考情報、誤りではない）：
 *   - financeDashboard.jsonのdebtBalanceTrendとarchiveFiscalYears.jsonの
 *     debt.balance.ordinaryAccountLocalBondBalanceYenが重複する年度での一致状況
 *   - fiscalReserveFundYenが複数年度で同一値の場合（延岡市は実際に5年間同額のため、
 *     warningにすると恒久的な誤検知になる）
 *
 * 使い方：node --experimental-strip-types scripts/validate-finance.mjs
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

/** "2026-07-11"のようなISO日付から、日本の会計年度（4月始まり）の西暦を求める（src/config/site.tsのtoFiscalYearLabelと同じロジック）。 */
function fiscalYearOfIsoDate(iso) {
  const [year, month] = iso.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

const archiveFiscalYears = readJson("src/data/archiveFiscalYears.json");
const currentFiscalYear = fiscalYearOfIsoDate(new Date().toISOString().slice(0, 10));

const MIN_REASONABLE_POPULATION = 10_000;
const MAX_REASONABLE_POPULATION = 300_000;
const MIN_REASONABLE_YEN = 1_000_000; // 100万円

for (const y of archiveFiscalYears) {
  const tag = `archiveFiscalYears.json (FY${y.fiscalYear})`;

  // --- 人口の桁チェック ---
  const population = y.population?.population;
  if (typeof population === "number") {
    if (population < MIN_REASONABLE_POPULATION || population > MAX_REASONABLE_POPULATION) {
      errors.push(`${tag}: 人口が延岡市の実態から明らかに桁違いです（${population}人）`);
    }
  }

  // --- 未来年度の決算チェック ---
  if (typeof y.budget?.generalAccountSettlementYen === "number" && y.fiscalYear > currentFiscalYear) {
    errors.push(
      `${tag}: 決算額（generalAccountSettlementYen）が設定されていますが、年度（${y.fiscalYear}）が本日時点の会計年度（${currentFiscalYear}）より未来です`,
    );
  }

  // --- 金額の桁チェック（千円取り違えの疑い） ---
  const yenFieldsToCheck = [
    ["budget.totalRevenueYen", y.budget?.totalRevenueYen],
    ["budget.totalExpenditureYen", y.budget?.totalExpenditureYen],
    ["budget.generalAccountFinalBudgetYen", y.budget?.generalAccountFinalBudgetYen],
    ["debt.balance.ordinaryAccountLocalBondBalanceYen", y.debt?.balance?.ordinaryAccountLocalBondBalanceYen],
    ["fund.balance.fiscalReserveFundYen", y.fund?.balance?.fiscalReserveFundYen],
    ["fund.balance.totalYen", y.fund?.balance?.totalYen],
  ];
  for (const [fieldLabel, value] of yenFieldsToCheck) {
    if (typeof value === "number" && value > 0 && value < MIN_REASONABLE_YEN) {
      warnings.push(`${tag}: ${fieldLabel}が${value}円と極端に小さく、千円のまま円として登録した疑いがあります`);
    }
  }

  // --- 基金内訳 vs 総額 ---
  const fb = y.fund?.balance;
  if (fb && typeof fb.totalYen === "number" && typeof fb.fiscalAdjustmentFundYen === "number" && typeof fb.otherSpecificPurposeFundsYen === "number") {
    // fiscalReserveFundYen・bondRedemptionFundYenはfiscalAdjustmentFundYen（広義）の内数のため合算に含めない。
    const sum = fb.fiscalAdjustmentFundYen + fb.otherSpecificPurposeFundsYen;
    if (sum !== fb.totalYen) {
      warnings.push(
        `${tag}: fund.balance.totalYen（${fb.totalYen}）が、財源調整用基金＋その他特定目的基金の合計（${sum}）と一致しません`,
      );
    }
  }

  // --- 財政力指数の妥当性 ---
  const fsi = y.finance?.financialStrengthIndex;
  if (typeof fsi === "number") {
    if (fsi === 0 || fsi > 2.0) {
      warnings.push(`${tag}: 財政力指数（${fsi}）が延岡市規模の自治体として非現実的な値です。算定不能の場合はnullを検討してください`);
    }
  }
}

// --- 財政調整基金の値が複数年度で同一（infoのみ、警告にしない） ---
{
  const byValue = new Map();
  for (const y of archiveFiscalYears) {
    const v = y.fund?.balance?.fiscalReserveFundYen;
    if (typeof v !== "number") continue;
    if (!byValue.has(v)) byValue.set(v, []);
    byValue.get(v).push(y.fiscalYear);
  }
  for (const [value, years] of byValue) {
    if (years.length >= 2) {
      info.push(`財政調整基金（fiscalReserveFundYen）が${years.length}年度（FY${years.join(", ")}）で同一値（${value}円）です（据え置きの可能性、要目視確認）`);
    }
  }
}

// --- financeDashboard.jsonとの市債残高クロスチェック ---
try {
  const financeDashboard = readJson("src/data/financeDashboard.json");
  const trendByFiscalYear = new Map();
  for (const t of financeDashboard.debtBalanceTrend ?? []) {
    const m = t.fiscalYear.match(/(\d+)/); // "令和6年度末" -> 6
    if (!m) continue;
    const fy = Number(m[1]) + 2018; // 令和N年度 -> 西暦
    trendByFiscalYear.set(fy, t.amountThousandYen * 1000);
  }
  for (const y of archiveFiscalYears) {
    const archiveValue = y.debt?.balance?.ordinaryAccountLocalBondBalanceYen;
    const dashboardValue = trendByFiscalYear.get(y.fiscalYear);
    if (typeof archiveValue === "number" && typeof dashboardValue === "number") {
      if (archiveValue === dashboardValue) {
        info.push(`FY${y.fiscalYear}: archiveFiscalYears.jsonとfinanceDashboard.jsonの市債残高が一致（${archiveValue}円）`);
      } else {
        warnings.push(
          `FY${y.fiscalYear}: archiveFiscalYears.jsonの市債残高（${archiveValue}円）とfinanceDashboard.jsonのdebtBalanceTrend（${dashboardValue}円）が一致しません`,
        );
      }
    }
  }
} catch (e) {
  warnings.push(`financeDashboard.jsonとのクロスチェック中にエラー: ${e.message}`);
}

for (const i of info) console.log(`[INFO] ${i}`);
for (const w of warnings) console.log(`[WARN] ${w}`);
for (const e of errors) console.error(`[ERR] ${e}`);

console.log(`[validate-finance] errors=${errors.length} warnings=${warnings.length} info=${info.length}`);

if (errors.length > 0) process.exit(1);
