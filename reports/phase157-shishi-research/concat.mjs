// 抽出済みページテキストを連結するユーティリティ（TASK-175）
// 使い方: node concat.mjs <dir> <start> <end> <outFile>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const [dir, start, end, outFile] = process.argv.slice(2);
let out = "";
for (let i = Number(start); i <= Number(end); i++) {
  const p = `${dir}/page-${String(i).padStart(3, "0")}.txt`;
  out += `############ PDFpage-${String(i).padStart(3, "0")} ############\n`;
  out += existsSync(p) ? readFileSync(p, "utf8") : "(MISSING)";
  out += "\n\n";
}
writeFileSync(outFile, out, "utf8");
console.log(`wrote ${outFile} (${end - start + 1} pages)`);
