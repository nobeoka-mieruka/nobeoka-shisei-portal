/**
 * 延岡市「令和N年度健全化判断比率等の公表」ページ（財政課、soshiki/18/*.html）の本文HTMLから、
 * 地方公共団体財政健全化法に基づく5指標（実質赤字比率・連結実質赤字比率・実質公債費比率・
 * 将来負担比率・資金不足比率）と、各指標の法定基準（早期健全化基準・財政再生基準・経営健全化基準）を
 * 構造化して取り出す。
 *
 * 【設計方針】
 * - ページの2つの表（健全化判断比率の表・資金不足比率の表）を「行ラベル」で読む。列位置や
 *   行順だけに頼らず、想定した行ラベル・見出しが見つからなければ errors に理由を積み、
 *   呼び出し側が「誤った数値を自動反映しない（要確認）」判断をできるようにする。
 * - 「―」は延岡市の表記どおり「該当なし（赤字・資金不足が生じていない／算定されない）」として
 *   status: "notApplicable", percent: null で返す。0%とはみなさない。
 * - 本文の定型文「…は8.7%で、前年度(8.6%)と比較すると…」から前年度値も読み、表の値との
 *   一致を検算する（表と本文で値が食い違う場合は errors に積む）。
 * - 本番データ（src/data/*.json）は読み書きしない純関数のみを提供する。
 *
 * scripts/auto-update/finance/update-finance.mjs（定期巡回）と
 * scripts/test-finance-soundness-ratios.mjs（回帰テスト）の両方から使う。
 */

const REIWA_ERA_OFFSET = 2018; // 令和1年 = 2019年

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cellText(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tableRows(tableHtml) {
  return [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((tr) =>
    [...tr[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => cellText(c[1])),
  );
}

/**
 * セル値を解析する。
 *  "8.7％" → { kind: "percent", value: 8.7 }
 *  "―" 等  → { kind: "dash" }（該当なし）
 *  ""      → { kind: "empty" }（基準が定められていない等）
 *  それ以外 → { kind: "unknown", raw }
 */
export function parseRatioCell(raw) {
  const s = (raw ?? "").replace(/\s+/g, "");
  if (s === "") return { kind: "empty" };
  if (/^[―—‐－\-ー–]+$/.test(s)) return { kind: "dash" };
  const m = s.match(/^(-?\d+(?:\.\d+)?)[%％]$/);
  if (m) return { kind: "percent", value: Number(m[1]) };
  return { kind: "unknown", raw };
}

const RATIO_ROWS = [
  { key: "actualDeficitRatio", label: "実質赤字比率", pattern: /^\(1\)\s*実質赤字比率$/ },
  { key: "consolidatedActualDeficitRatio", label: "連結実質赤字比率", pattern: /^\(2\)\s*連結実質赤字比率$/ },
  { key: "realDebtServiceRatio", label: "実質公債費比率", pattern: /^\(3\)\s*実質公債費比率$/ },
  { key: "futureBurdenRatio", label: "将来負担比率", pattern: /^\(4\)\s*将来負担比率$/ },
];

/**
 * 本文の「{label}は{値}%で、前年度({前年値}%)と比較すると」から当年値・前年値を読む。
 * 前年度が「該当なし」だった年は「{label}は4.0％です。」のように前年度比較の文が無い
 * （令和3年度ページで確認）ため、その場合は prior: null を返す。読む範囲は1文（「。」まで）に限る。
 */
export function extractRatioWithPriorYear(text, label) {
  const i = text.indexOf(`${label}は`);
  if (i === -1) return null;
  const end = text.indexOf("。", i);
  const sentence = text.slice(i, end === -1 ? i + 100 : end);
  const current = sentence.match(/は\s*([-0-9.]+)\s*[%％]/);
  if (!current) return null;
  const prior = sentence.match(/前年度\s*[(（]\s*([-0-9.]+)\s*[%％]?\s*[)）]/);
  return { current: Number(current[1]), prior: prior ? Number(prior[1]) : null };
}

function standardFromCell(cell, errors, where) {
  if (cell.kind === "percent") return cell.value;
  if (cell.kind === "empty") return null;
  errors.push(`${where}の基準値を数値として読めませんでした（${cell.raw ?? cell.kind}）`);
  return null;
}

/**
 * @param {string} html 個別年度ページのHTML全体
 * @returns {{
 *   fiscalYear: number | null,
 *   updatedDate: string | null,
 *   ratios: Record<string, { status: "reported" | "notApplicable", percent: number | null, earlyWarningStandardPercent: number | null, reconstructionStandardPercent: number | null }>,
 *   fundShortageRatios: Array<{ accountName: string, status: "reported" | "notApplicable", percent: number | null, managementSoundnessStandardPercent: number | null }>,
 *   priorYear: Record<string, number | null>,
 *   errors: string[],
 * }}
 */
export function parseSoundnessRatioPage(html) {
  const errors = [];
  const plain = decodeEntities(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  const yearMatch = plain.match(/令和(\d+)年度\s*決算の財政指標を公表/);
  const fiscalYear = yearMatch ? Number(yearMatch[1]) + REIWA_ERA_OFFSET : null;
  if (fiscalYear === null) errors.push("本文から対象年度（「令和N年度 決算の財政指標を公表」）を読み取れませんでした");

  const updatedMatch = plain.match(/更新日：(\d{4})年(\d{1,2})月(\d{1,2})日更新/);
  const updatedDate = updatedMatch
    ? `${updatedMatch[1]}-${updatedMatch[2].padStart(2, "0")}-${updatedMatch[3].padStart(2, "0")}`
    : null;

  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((t) => tableRows(t[1]));
  const ratioTable = tables.find((rows) => rows[0]?.some((c) => c.includes("健全化判断比率")) && rows[0]?.some((c) => c.includes("早期健全化基準")));
  const shortageTable = tables.find((rows) => rows[0]?.some((c) => c.includes("資金不足比率")) && rows[0]?.some((c) => c.includes("経営健全化基準")));

  const ratios = {};
  if (!ratioTable) {
    errors.push("健全化判断比率の表（見出し「健全化判断比率」「早期健全化基準」）が見つかりませんでした（ページ構造変化の可能性）");
  } else {
    const header = ratioTable[0];
    const valueCol = header.findIndex((c) => c === "健全化判断比率");
    const earlyCol = header.findIndex((c) => c.includes("早期健全化基準"));
    const reconCol = header.findIndex((c) => c.includes("財政再生基準"));
    if (valueCol === -1 || earlyCol === -1 || reconCol === -1) {
      errors.push(`健全化判断比率の表の見出しが想定と異なります（${header.join("／")}）`);
    }
    for (const def of RATIO_ROWS) {
      const row = ratioTable.find((r) => def.pattern.test(r[0] ?? ""));
      if (!row) {
        errors.push(`健全化判断比率の表に「${def.label}」の行が見つかりませんでした`);
        continue;
      }
      const value = parseRatioCell(row[valueCol]);
      if (value.kind !== "percent" && value.kind !== "dash") {
        errors.push(`${def.label}の値を読めませんでした（${row[valueCol] ?? "列なし"}）`);
        continue;
      }
      ratios[def.key] = {
        status: value.kind === "percent" ? "reported" : "notApplicable",
        percent: value.kind === "percent" ? value.value : null,
        earlyWarningStandardPercent: standardFromCell(parseRatioCell(row[earlyCol]), errors, `${def.label}（早期健全化基準）`),
        reconstructionStandardPercent: standardFromCell(parseRatioCell(row[reconCol]), errors, `${def.label}（財政再生基準）`),
      };
    }
  }

  const fundShortageRatios = [];
  if (!shortageTable) {
    errors.push("資金不足比率の表（見出し「資金不足比率」「経営健全化基準」）が見つかりませんでした（ページ構造変化の可能性）");
  } else {
    const header = shortageTable[0];
    const valueCol = header.findIndex((c) => c.includes("資金不足比率"));
    const stdCol = header.findIndex((c) => c.includes("経営健全化基準"));
    for (const row of shortageTable.slice(1)) {
      const accountName = row[0];
      if (!accountName) continue;
      const value = parseRatioCell(row[valueCol]);
      if (value.kind !== "percent" && value.kind !== "dash") {
        errors.push(`資金不足比率（${accountName}）の値を読めませんでした（${row[valueCol] ?? "列なし"}）`);
        continue;
      }
      fundShortageRatios.push({
        accountName,
        status: value.kind === "percent" ? "reported" : "notApplicable",
        percent: value.kind === "percent" ? value.value : null,
        managementSoundnessStandardPercent: standardFromCell(parseRatioCell(row[stdCol]), errors, `資金不足比率（${accountName}）の経営健全化基準`),
      });
    }
    if (fundShortageRatios.length === 0) errors.push("資金不足比率の表に会計の行が1件もありませんでした");
  }

  // 本文の定型文から前年度値を読み、表の当年値と突き合わせる。
  const priorYear = {};
  for (const def of RATIO_ROWS) {
    const ratio = ratios[def.key];
    if (!ratio || ratio.status !== "reported") {
      priorYear[def.key] = null;
      continue;
    }
    const sentence = extractRatioWithPriorYear(plain, def.label);
    if (!sentence) {
      priorYear[def.key] = null;
      errors.push(`本文から${def.label}の前年度比較（「…前年度(x%)と比較すると」）を読み取れませんでした`);
      continue;
    }
    if (sentence.current !== ratio.percent) {
      errors.push(`${def.label}の値が表（${ratio.percent}%）と本文（${sentence.current}%）で一致しません`);
    }
    priorYear[def.key] = sentence.prior;
  }

  return { fiscalYear, updatedDate, ratios, fundShortageRatios, priorYear, errors };
}
