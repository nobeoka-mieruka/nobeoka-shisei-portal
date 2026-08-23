// Phase76 全ルート自動監査スクリプト。dist/配下の全prerender済みHTMLを静的解析する。
// 一時的な監査ツールであり、npm scriptsには登録しない（scripts/ui-audit-scan.mjsとは別物、Phase31の後継）。
import fs from 'node:fs';
import path from 'node:path';

const DIST = './dist';
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.html')) files.push(p);
  }
}
walk(DIST);

const distAbs = path.resolve(DIST).replace(/\\/g, '/');
const routeOf = (filePath) => {
  const abs = path.resolve(filePath).replace(/\\/g, '/');
  let r = abs.startsWith(distAbs) ? abs.slice(distAbs.length) : abs;
  r = r.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  if (r === '') r = '/';
  return r;
};

const allRoutes = new Set(files.map(routeOf));
const existsRoute = (href) => {
  if (!href) return false;
  if (/^https?:\/\//.test(href)) return true; // external, skip
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return true;
  const clean = href.split('#')[0].split('?')[0];
  if (clean === '') return true;
  // non-HTML asset (PDF/image/etc.) — check the actual file on disk under dist/
  if (/\.[a-zA-Z0-9]{2,5}$/.test(clean) && !clean.endsWith('.html')) {
    return fs.existsSync(path.join(distAbs, clean));
  }
  // normalize: routes may or may not have trailing slash
  return allRoutes.has(clean) || allRoutes.has(clean + '/') || allRoutes.has(clean.replace(/\/$/, ''));
};

const findings = {
  generatedAt: new Date().toISOString(),
  totalRoutesAudited: files.length,
  summary: {},
  issues: [],
};

let emptyPageCount = 0;
let missingTitleCount = 0;
let missingDescriptionCount = 0;
let literalBadStringCount = 0;
let missingAltCount = 0;
let brokenInternalLinkCount = 0;
let duplicateH1Count = 0;
let longUnbrokenStringCount = 0;
let tableNoWrapCount = 0;

const brokenLinksSample = [];
const badStringSample = [];
const altSample = [];
const longStringSample = [];
const tableSample = [];

for (const f of files) {
  const route = routeOf(f);
  let html;
  try {
    html = fs.readFileSync(f, 'utf8');
  } catch {
    findings.issues.push({ route, severity: 'P0', category: 'read_error', detail: 'HTMLファイルを読み込めない' });
    continue;
  }

  if (html.trim().length < 200) {
    emptyPageCount++;
    findings.issues.push({ route, severity: 'P0', category: 'empty_page', detail: `HTML長=${html.length}` });
  }

  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  if (!titleMatch || titleMatch[1].trim() === '') {
    missingTitleCount++;
    findings.issues.push({ route, severity: 'P1', category: 'missing_title', detail: '' });
  }

  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/);
  if (!descMatch || descMatch[1].trim() === '') {
    missingDescriptionCount++;
    findings.issues.push({ route, severity: 'P2', category: 'missing_description', detail: '' });
  }

  // strip <script>...</script> blocks (JSON-LD etc legitimately contain "null")
  const bodyNoScript = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
  for (const bad of ['undefined', '[object Object]']) {
    if (bodyNoScript.includes(bad)) {
      literalBadStringCount++;
      if (badStringSample.length < 30) badStringSample.push({ route, bad });
    }
  }
  // "NaN" and bare "null" as visible text (word-boundary, not part of another word/attr)
  if (/>[^<]*\bNaN\b[^<]*</.test(bodyNoScript)) {
    literalBadStringCount++;
    if (badStringSample.length < 30) badStringSample.push({ route, bad: 'NaN' });
  }

  // images: alt missing/empty
  const imgTags = bodyNoScript.match(/<img\b[^>]*>/g) || [];
  for (const tag of imgTags) {
    const altM = tag.match(/alt="([^"]*)"/);
    if (!altM || altM[1].trim() === '') {
      missingAltCount++;
      if (altSample.length < 30) altSample.push({ route, tag: tag.slice(0, 120) });
    }
  }

  // internal links
  const hrefs = [...bodyNoScript.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  for (const href of hrefs) {
    if (href.startsWith('/') && !existsRoute(href)) {
      brokenInternalLinkCount++;
      if (brokenLinksSample.length < 50) brokenLinksSample.push({ route, href });
    }
  }

  // duplicate H1
  const h1s = [...bodyNoScript.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  if (h1s.length > 1) {
    duplicateH1Count++;
    findings.issues.push({ route, severity: 'P2', category: 'multiple_h1', detail: `count=${h1s.length}` });
  }

  // long unbroken strings (e.g. a run of 40+ non-space, non-Japanese-punctuation chars with no break char)
  // heuristic: look inside <td>/<span>/<p> text nodes for long digit/alnum runs (could overflow narrow cells)
  const longRun = bodyNoScript.match(/>([0-9A-Za-z,.-]{30,})</);
  if (longRun) {
    longUnbrokenStringCount++;
    if (longStringSample.length < 20) longStringSample.push({ route, sample: longRun[1].slice(0, 60) });
  }

  // table cells without whitespace-nowrap-ish protection: look for <table> present without any "whitespace-nowrap" in the whole doc's <style>-driven class list is unreliable statically (Tailwind classes are in the HTML as class="..."). Check for <td>/<th> content that's long Japanese text without break-words/whitespace-nowrap classes nearby.
  if (/<table/.test(bodyNoScript)) {
    const tableBlocks = bodyNoScript.match(/<table[\s\S]*?<\/table>/g) || [];
    for (const tb of tableBlocks) {
      const hasNoWrapClass = /whitespace-nowrap/.test(tb);
      const hasBreakWords = /break-words|whitespace-normal/.test(tb);
      if (!hasNoWrapClass && !hasBreakWords) {
        tableNoWrapCount++;
        if (tableSample.length < 30) tableSample.push({ route });
        break;
      }
    }
  }
}

findings.summary = {
  totalRoutesAudited: files.length,
  emptyPageCount,
  missingTitleCount,
  missingDescriptionCount,
  literalBadStringCount,
  missingAltCount,
  brokenInternalLinkCount,
  duplicateH1Count,
  longUnbrokenStringCount,
  tableNoWrapCount,
};
findings.samples = {
  badStrings: badStringSample,
  missingAlt: altSample,
  brokenLinks: brokenLinksSample,
  longStrings: longStringSample,
  tablesWithoutWrapProtection: tableSample,
};

fs.writeFileSync('./reports/ui-audit-phase76.json', JSON.stringify(findings, null, 2) + '\n', 'utf8');
console.log('[ui-audit-phase76] audited', files.length, 'routes');
console.log(JSON.stringify(findings.summary, null, 2));
