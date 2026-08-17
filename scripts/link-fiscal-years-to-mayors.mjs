/**
 * TASK-081：archiveFiscalYears.json の各年度に mayorId／mayorTermId を機械的に紐付ける。
 *
 * 推測はしない。archiveMayorTerms.json（既に一次資料で確認済みの就任日・退任日）と、
 * 会計年度（4月1日〜翌年3月31日）の日付範囲が完全に一致する場合のみ紐付ける：
 *   - その年度の全期間が単一の市長の任期に含まれる場合 → mayorId を設定
 *   - さらに単一の任期（再選をまたがない）に完全に含まれる場合 → mayorTermId も設定
 *   - 年度途中で市長が交代した年度（例：FY2005＝首藤市長初当選、FY2017＝読谷山市長初当選、
 *     FY2025＝三浦市長初当選）は、どちらか一方に断定せず mayorId を設定しない
 *     （notesに両市長のtermIdを事実として記録するのみ）。
 *
 * 既存のmayorId／mayorTermIdが既に設定されている年度は上書きしない（手動確認済みの
 * 値を保護する）。職務代理（acting/temporaryActing）の任期は対象外（公選市長のみ）。
 *
 * 使い方：node scripts/link-fiscal-years-to-mayors.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const fyPath = join(root, "src", "data", "archiveFiscalYears.json");
const termsPath = join(root, "src", "data", "archiveMayorTerms.json");

const fiscalYears = JSON.parse(readFileSync(fyPath, "utf8"));
const terms = JSON.parse(readFileSync(termsPath, "utf8")).filter(
  (t) => t.mayorRole !== "acting" && t.mayorRole !== "temporaryActing",
);

function overlappingTerms(fiscalYear) {
  const fyStart = new Date(`${fiscalYear}-04-01`);
  const fyEnd = new Date(`${fiscalYear + 1}-03-31`);
  return terms.filter((t) => {
    const ts = new Date(t.termStart);
    const te = t.termEnd ? new Date(t.termEnd) : new Date("2100-01-01");
    return ts <= fyEnd && te >= fyStart;
  });
}

let linkedMayor = 0;
let linkedTerm = 0;
let transitionYears = [];
let skippedExisting = 0;

for (const fy of fiscalYears) {
  if (fy.mayorId) {
    skippedExisting++;
    continue;
  }
  const hits = overlappingTerms(fy.fiscalYear);
  const mayorIds = [...new Set(hits.map((h) => h.mayorId))];
  if (mayorIds.length === 1) {
    fy.mayorId = mayorIds[0];
    linkedMayor++;
    if (hits.length === 1) {
      fy.mayorTermId = hits[0].id;
      linkedTerm++;
    }
  } else if (mayorIds.length > 1) {
    transitionYears.push({ fiscalYear: fy.fiscalYear, terms: hits.map((h) => h.id) });
    const transitionNote = `年度途中に市長が交代したため単一のmayorIdは設定していません（該当任期：${hits.map((h) => h.id).join("、")}）。`;
    fy.notes = fy.notes ? `${fy.notes} ${transitionNote}` : transitionNote;
  }
}

writeFileSync(fyPath, JSON.stringify(fiscalYears, null, 2) + "\n");
console.log(
  `[link-fiscal-years-to-mayors] mayorId新規設定=${linkedMayor}件 / mayorTermId新規設定=${linkedTerm}件 / 交代年度（設定見送り）=${transitionYears.length}件 / 既存値保護=${skippedExisting}件`,
);
console.log("交代年度:", JSON.stringify(transitionYears));
