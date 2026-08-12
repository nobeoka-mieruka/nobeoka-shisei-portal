// @ts-nocheck
/**
 * 総務省「類似団体別職員数の状況」の付属資料「都道府県別類似団体区分一覧表」
 * （https://www.soumu.go.jp/main_sosiki/jichi_gyousei/c-gyousei/ruiji-dantai/index.html）
 * から、指定した類似団体区分コード（例："Ⅲ－３"）に該当する市区町村名を抽出する。
 *
 * このExcelは「類似団体別市町村財政指数表」（延岡市の区分コード「Ⅲ－３」の一次資料）
 * とは別の総務省資料体系（職員数調査）だが、分類基準（人口×産業構造の同一マトリクス）
 * ・区分コードの命名は共通であることをページ本文の記載で確認済み。
 *
 * 【重要な注意】
 * この一覧表による該当団体数は、「類似団体別市町村財政指数表」側が示す該当団体数
 * （例：令和5年度版で62団体）と厳密には一致しないことがある。これは資料の誤りではなく、
 * 基準時点（住民基本台帳人口・産業構造の更新タイミング）が資料ごとに異なるため、
 * 年度をまたいで一部の市町村が区分の境界（人口10万人・15万人等）をまたいで
 * 移動することがあるためと考えられる（本スクリプトの実行で令和6年4月1日時点と
 * 令和7年4月1日時点を比較したところ、実際に「伊勢原市」1件が令和6年→令和7年で
 * Ⅲ－３から外れていることを確認した）。
 *
 * 使い方:
 *   node --experimental-strip-types scripts/extract-similar-municipality-roster.mjs [区分コード] [xlsxのURL]
 *   例: node --experimental-strip-types scripts/extract-similar-municipality-roster.mjs "Ⅲ－３"
 *
 * 既定のURLは「令和6年4月1日時点」版（財政指数表 令和5年度版と時期が近いため既定とした）。
 */
import XLSX from "xlsx";

const DEFAULT_URL = "https://www.soumu.go.jp/main_content/000999891.xls";
const targetType = (process.argv[2] ?? "Ⅲ－３").trim();
const sourceUrl = process.argv[3] ?? DEFAULT_URL;

const res = await fetch(sourceUrl);
if (!res.ok) {
  console.error(`ダウンロード失敗: ${sourceUrl} (HTTP ${res.status})`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const wb = XLSX.read(buf, { type: "buffer" });

// セル値の「Ⅲ－３」等は全角数字・全角ダッシュで表記されている（例: U+2162 U+FF0D U+FF13）。
const typePattern = /^[ⅠⅡⅢⅣⅤ][－-][０-３0-3]$/;
const results = new Set();

for (const sheetName of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false });
  for (const row of rows) {
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell === "string" && typePattern.test(cell.trim()) && cell.trim() === targetType) {
        const name = row[c - 2];
        if (typeof name === "string" && name.trim()) results.add(name.trim());
      }
    }
  }
}

const sorted = [...results].sort((a, b) => a.localeCompare(b, "ja"));
console.log(`区分コード: ${targetType}`);
console.log(`出典: ${sourceUrl}`);
console.log(`該当団体数: ${sorted.length}`);
console.log(`延岡市を含むか: ${sorted.includes("延岡市")}`);
console.log(JSON.stringify(sorted, null, 2));
