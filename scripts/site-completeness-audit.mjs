// Phase77 全ルート横断・状態語彙監査スクリプト。dist/配下の生成HTML（表示文言）と
// src/data配下のソースJSON（内部データ）を分けて集計する。一時的な監査ツール。
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('./dist');
const DATA_DIR = path.resolve('./src/data');

function walk(dir, ext) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, ext));
    else if (entry.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const htmlFiles = walk(DIST, '.html');
const dataFiles = walk(DATA_DIR, '.json');

// キーワード群：画面表示テキストとして露出してはいけない/要注意な語
const displayKeywords = [
  '未完成', '整備中', 'TBD', 'TODO', 'FIXME', 'placeholder', 'coming soon', 'Coming Soon',
  'undefined', 'NaN', '[object Object]', 'Lorem ipsum',
];
// 「確認中/未確認/調査中/未収録/出典未登録/0件/データなし/情報なし」は
// このサイトの正規語彙（src/lib/completeness.ts）に含まれる正当な表示のため、
// 「件数」を集計するにとどめ、即座に問題とはしない（後続の分類監査で判定）。
const statusWords = ['確認中', '未確認', '調査中', '未収録', '出典未登録', 'データなし', '情報なし'];

const displayFindings = {};
for (const kw of [...displayKeywords]) displayFindings[kw] = { count: 0, routes: [] };
const statusCounts = {};
for (const w of statusWords) statusCounts[w] = { count: 0, routes: new Set() };

let zeroKenLiteralCount = 0; // "0件" の生文字列出現数（表示上のみ、後で分類）
const zeroKenRoutes = new Set();

for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  const bodyNoScript = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
  const route = f.replace(DIST.replace(/\\/g, '/'), '').replace(/\\/g, '/');

  for (const kw of displayKeywords) {
    if (bodyNoScript.includes(kw)) {
      displayFindings[kw].count++;
      if (displayFindings[kw].routes.length < 10) displayFindings[kw].routes.push(route);
    }
  }
  for (const w of statusWords) {
    const n = (bodyNoScript.match(new RegExp(w, 'g')) || []).length;
    if (n > 0) {
      statusCounts[w].count += n;
      statusCounts[w].routes.add(route);
    }
  }
  const zeroMatches = bodyNoScript.match(/0件/g);
  if (zeroMatches) {
    zeroKenLiteralCount += zeroMatches.length;
    zeroKenRoutes.add(route);
  }
}

// データファイル側（内部データ）の同キーワード出現（値・note等に含まれる正当な語彙も多いため参考値として記録）
const dataFindings = {};
for (const kw of [...displayKeywords, 'null']) dataFindings[kw] = { count: 0, files: [] };
for (const f of dataFiles) {
  const raw = fs.readFileSync(f, 'utf8');
  for (const kw of [...displayKeywords, 'null']) {
    // "null" is extremely common and valid in JSON (means "not yet confirmed"); count occurrences of the literal JSON null value only
    const re = kw === 'null' ? /:\s*null\b/g : new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const n = (raw.match(re) || []).length;
    if (n > 0) {
      dataFindings[kw].count += n;
      if (dataFindings[kw].files.length < 15) dataFindings[kw].files.push({ file: path.basename(f), count: n });
    }
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  routesScanned: htmlFiles.length,
  dataFilesScanned: dataFiles.length,
  displayKeywordFindings: Object.fromEntries(
    Object.entries(displayFindings).map(([k, v]) => [k, { count: v.count, sampleRoutes: v.routes }])
  ),
  statusWordDisplayCounts: Object.fromEntries(
    Object.entries(statusCounts).map(([k, v]) => [k, { occurrences: v.count, routeCount: v.routes.size }])
  ),
  zeroKenLiteral: { occurrences: zeroKenLiteralCount, routeCount: zeroKenRoutes.size },
  dataFileNullAndKeywordCounts: Object.fromEntries(
    Object.entries(dataFindings).map(([k, v]) => [k, { count: v.count, sampleFiles: v.files }])
  ),
};

fs.writeFileSync('./reports/site-completeness-audit.json', JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('[site-completeness-audit]', JSON.stringify({
  routesScanned: out.routesScanned,
  displayKeywordFindings: Object.fromEntries(Object.entries(out.displayKeywordFindings).map(([k, v]) => [k, v.count])),
  statusWordDisplayCounts: Object.fromEntries(Object.entries(out.statusWordDisplayCounts).map(([k, v]) => [k, v.occurrences])),
  zeroKenLiteral: out.zeroKenLiteral,
}, null, 2));
