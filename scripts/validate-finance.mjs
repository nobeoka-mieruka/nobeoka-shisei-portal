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
 *   - 当初予算額・補正後予算額・決算額のうち2つ以上が非nullかつ完全に同一の値
 *     （当初予算と決算の取り違えの疑い。年度途中の暫定値がたまたま同額という可能性もあるため
 *     errorではなくwarning）
 *   - perCapitaYen（1人当たり残高、元資料に直接掲載されている値専用のフィールド）が設定されて
 *     いるのに、対応するsourceRefsのどこにも「1人当たり」「人当たり」という語が無い
 *     （当サイトの計算値を誤って直接保存した疑い。src/lib/archivePerCapita.tsの
 *     computePerCapitaYen()を使うべき値をperCapitaYenへ直接書いてしまうミスをPhase21で
 *     一度実際に起こしたため、再発防止のチェック）
 *   - debt自体が特定の年度だけ欠落している（前後の年度にdebtがあるのに、その年度だけ丸ごと
 *     無い場合。/finance/debtのUIはarchiveFiscalYears.filter((y) => y.debt)で絞り込むため、
 *     debtが無いと年度自体が一覧・グラフから消える。市債発行額が未確認の年度でも、
 *     municipalBondIssuanceStatus: "unconfirmed"としてdebtオブジェクト自体は残すこと）
 *
 * error（市債発行額まわり、TASK-XXX 市債発行額・残高の混同修正で追加）：
 *   - municipalBondIssuanceYenが、同一年度のdebt.balance内のいずれかの残高フィールドと
 *     完全に一致する（発行額＝フローと残高＝ストックを取り違えて登録した疑い。
 *     年度末残高をそのまま発行額として登録することは禁止）
 *   - municipalBondIssuanceStatusが未確定系（unconfirmed／sourcePendingPublication／
 *     sourceFoundValueUnextracted）なのに、municipalBondIssuanceYenが0（未確認値を
 *     0円として保存することは禁止。nullのまま残すこと）
 *   - municipalBondIssuanceValueTypeが"settlement"（決算）なのに、fiscalYearが本日時点の
 *     会計年度以上（年度が終わっていない＝決算が存在し得ない年度を決算扱いにしている）
 *   - municipalBondIssuanceStatusが"settlementConfirmed"または"budgetOnly"（値を確認済みと
 *     主張している）のに、municipalBondIssuanceSourceRefsが空（出典なしの確定値）
 *
 * warning（市債発行額まわり）：
 *   - municipalBondIssuanceYenが100万円未満（千円のまま円として登録した疑い。既存の
 *     yenFieldsToCheckに含めて検出）
 *
 * 「同年度重複」について：archiveFiscalYears.json配下の年度重複自体は
 * scripts/validate-data.mjsのcheckDuplicateYears()が既にfiscalYear単位でカバーしている
 * ため、このファイルでは再実装しない。
 *
 * 検討したが採用しなかったチェック：
 *   - sourceRefsのsourceTitle・notesに含まれる「令和N年度」表記とfiscalYearの一致検証
 *     （試作したところ、資料タイトルが正当に「令和3年度版〜令和6年度版」等の範囲表記や、
 *     別年度の資料から遡及的にこの年度の値を採用した旨の説明を含む場合が多く、
 *     既存の正しいデータに対して26件の誤検知が発生したため不採用とした）
 *   - municipalBondIssuanceYen < 残高であることをもって正しいと判定する（発行額が残高を
 *     下回っていること自体は正しさの証明にならないため、単独の判定条件としては採用しない。
 *     フィールド混同チェックは「完全一致」のみを見る）
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
// 年度は日本の会計年度（4月始まり、JST基準）のため、「今日」もJSTで判定する
// （UTCのままだと、年度境界の3/31〜4/1深夜（JST）に前年度と誤判定しうる。
// validate-freshness.mjsと同じ修正）。
const currentFiscalYear = fiscalYearOfIsoDate(new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10));

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
    ["debt.municipalBondIssuanceYen", y.debt?.municipalBondIssuanceYen],
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

  // --- 当初予算・補正後予算・決算の取り違えチェック ---
  {
    const b = y.budget;
    if (b) {
      const stages = [
        ["当初予算", b.generalAccountInitialBudgetYen],
        ["補正後予算", b.generalAccountFinalBudgetYen],
        ["決算", b.generalAccountSettlementYen],
      ].filter(([, v]) => typeof v === "number");
      for (let i = 0; i < stages.length; i++) {
        for (let j = i + 1; j < stages.length; j++) {
          if (stages[i][1] === stages[j][1]) {
            warnings.push(
              `${tag}: budget.${stages[i][0]}とbudget.${stages[j][0]}が完全に同一の値（${stages[i][1]}円）です。取り違えて登録していないか確認してください`,
            );
          }
        }
      }
    }
  }

  // --- perCapitaYenの直接保存チェック（元資料に明示掲載されている値専用のフィールド） ---
  for (const [fieldLabel, balance] of [
    ["debt.balance", y.debt?.balance],
    ["fund.balance", y.fund?.balance],
  ]) {
    if (typeof balance?.perCapitaYen === "number") {
      const mentionsPerCapita = (balance.sourceRefs ?? []).some(
        (s) => (s.sourceTitle ?? "").includes("人当たり") || (s.notes ?? "").includes("人当たり"),
      );
      if (!mentionsPerCapita) {
        warnings.push(
          `${tag}: ${fieldLabel}.perCapitaYenが設定されていますが、出典に「1人当たり」の記載が見当たりません。当サイトの計算値を直接保存していないか確認してください（算出値はcomputePerCapitaYen()を使い、専用フィールドには保存しない）`,
        );
      }
    }
  }

  // --- 市債発行額（フロー）と市債残高（ストック）のフィールド混同チェック ---
  if (y.debt) {
    const issuance = y.debt.municipalBondIssuanceYen;
    if (typeof issuance === "number") {
      const balanceFields = [
        ["balance.generalAccountBondBalanceYen", y.debt.balance?.generalAccountBondBalanceYen],
        ["balance.ordinaryAccountLocalBondBalanceYen", y.debt.balance?.ordinaryAccountLocalBondBalanceYen],
        ["balance.includingSpecialAccountsYen", y.debt.balance?.includingSpecialAccountsYen],
        ["balance.includingEnterpriseAccountsYen", y.debt.balance?.includingEnterpriseAccountsYen],
      ];
      for (const [balanceLabel, balanceValue] of balanceFields) {
        if (typeof balanceValue === "number" && balanceValue === issuance) {
          errors.push(
            `${tag}: debt.municipalBondIssuanceYen（発行額・フロー）とdebt.${balanceLabel}（残高・ストック）が同一の値（${issuance}円）です。年度末残高を発行額として誤登録していないか確認してください`,
          );
        }
      }
    }

    // --- 未確認値を0円として保存していないか ---
    const unconfirmedStatuses = ["unconfirmed", "sourcePendingPublication", "sourceFoundValueUnextracted"];
    if (unconfirmedStatuses.includes(y.debt.municipalBondIssuanceStatus) && issuance === 0) {
      errors.push(
        `${tag}: municipalBondIssuanceStatusが「${y.debt.municipalBondIssuanceStatus}」（未確認系）なのに、municipalBondIssuanceYenが0円として保存されています。未確認はnullのまま残してください`,
      );
    }

    // --- 決算未確定年度を決算扱いにしていないか ---
    if (y.debt.municipalBondIssuanceValueType === "settlement" && y.fiscalYear >= currentFiscalYear) {
      errors.push(
        `${tag}: 年度（${y.fiscalYear}）が本日時点の会計年度（${currentFiscalYear}）以上なのに、municipalBondIssuanceValueTypeが「決算」（settlement）になっています。年度が終わっていない決算は存在し得ません`,
      );
    }

    // --- 確定値を主張しているのに出典が無い ---
    const confirmedStatuses = ["settlementConfirmed", "budgetOnly"];
    if (confirmedStatuses.includes(y.debt.municipalBondIssuanceStatus) && (y.debt.municipalBondIssuanceSourceRefs ?? []).length === 0) {
      errors.push(
        `${tag}: municipalBondIssuanceStatusが「${y.debt.municipalBondIssuanceStatus}」（確認済み系）なのに、municipalBondIssuanceSourceRefsが空です。出典のない確定値は登録しないでください`,
      );
    }
  }
}

// --- debtオブジェクト自体が特定の年度だけ欠落していないか（前後の年度にdebtがある場合） ---
{
  const sorted = [...archiveFiscalYears].sort((a, b) => a.fiscalYear - b.fiscalYear);
  for (let i = 1; i < sorted.length - 1; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (!cur.debt && prev.debt && next.debt) {
      warnings.push(
        `archiveFiscalYears.json (FY${cur.fiscalYear}): 前後の年度（FY${prev.fiscalYear}, FY${next.fiscalYear}）にはdebtがありますが、この年度だけdebtが丸ごと欠落しています。/finance/debtの一覧・グラフからこの年度が消えます。市債発行額が未確認でも、municipalBondIssuanceStatus: "unconfirmed"としてdebtオブジェクト自体は登録してください`,
      );
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
