#!/usr/bin/env node
/**
 * Phase255：財政データの出典階層を検査する。
 *
 * 【何を検査し、何を検査しないか】
 * 守りたいのは「延岡市以外の団体の財政数値を、延岡市の財政として登録してしまう」ことの防止であり、
 * 「延岡市以外が発行した資料を使わない」ことではない。実データを確認したところ、
 *   - 宮崎県統計年鑑（宮崎県総務部統計課 編）… 昭和期の**延岡市の**歳入歳出が掲載された一次資料
 *   - 総務省 決算カード・財政状況資料集    … **延岡市が提出した**決算を国が集計・公表した資料
 * のように、発行者が市外でも中身が延岡市の数値である資料が正当に使われている。
 * したがって発行者名だけで弾かず、次の3点に絞って検査する。
 *
 *  1. 新聞・報道機関を財政数値の確定根拠にしていない。
 *  2. 「宮崎県自身の予算・決算」を延岡市の財政値の根拠にしていない（県の当初予算等）。
 *  3. 自動更新の財政監視が、延岡市公式ドメイン以外を見に行かない
 *     （監視の入口が市外へ広がると、県・国の数値を市の数値として取り込む事故が起きうる）。
 *
 * 既存の出典ドメインの妥当性（公的機関かどうか）は、既存の validate:sources が別途担当する。
 */
import { readFileSync } from "node:fs";

const CITY_HOSTS = new Set(["www.city.nobeoka.miyazaki.jp", "city.nobeoka.miyazaki.jp"]);

/** 報道機関。財政数値の確定根拠にしてはいけない。 */
const PRESS_ORGANIZATION_PATTERN = /新聞|通信社|放送|テレビ|日日|夕刊/;
const PRESS_HOST_PATTERN = /asahi\.com$|yomiuri\.co\.jp$|mainichi\.jp$|the-miyanichi\.co\.jp$|nikkei\.com$|sankei\.com$|nhk\.or\.jp$/;

/** 宮崎県“自身”の財政（県予算・県決算）を指すタイトル。延岡市の財政値の根拠にしない。 */
const PREFECTURE_OWN_BUDGET_PATTERN = /宮崎県(?:の)?(?:当初)?(?:予算|決算)(?:案|概要)?|県当初予算|県の予算/;

let checks = 0;
let failures = 0;
function ok(label, condition, detail) {
  checks++;
  if (!condition) {
    failures++;
    console.error(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function checkFinanceSource(label, source) {
  const url = source.url ?? source.sourceUrl ?? null;
  const org = source.organization ?? source.sourceOrganization ?? source.publisher ?? "";
  const title = source.title ?? source.sourceTitle ?? "";
  const host = url ? hostOf(url) : null;

  ok(`${label}: 発行主体が報道機関ではない`, !PRESS_ORGANIZATION_PATTERN.test(org), org);
  ok(`${label}: 出典タイトルが新聞記事ではない`, !PRESS_ORGANIZATION_PATTERN.test(title), title.slice(0, 60));
  if (host) ok(`${label}: 出典URLが報道機関のドメインではない`, !PRESS_HOST_PATTERN.test(host), host);
  ok(`${label}: 宮崎県自身の予算・決算を根拠にしていない`, !PREFECTURE_OWN_BUDGET_PATTERN.test(title), title.slice(0, 60));
}

console.log("[test-finance-source-hierarchy] 開始");

/* --- 1. financeDashboard.json：市民が最初に見る財政ダッシュボードの出典 --- */
const dashboard = JSON.parse(readFileSync("src/data/financeDashboard.json", "utf8"));
const dashboardSources = dashboard.sources ?? [];
ok("財政ダッシュボードに出典が登録されている", dashboardSources.length > 0);
dashboardSources.forEach((s, i) => {
  checkFinanceSource(`financeDashboard[${i}]`, s);
  // 最新年度のダッシュボードは延岡市自身の公表資料だけで構成する（県・国の集計値で代用しない）。
  const org = s.organization ?? s.sourceOrganization ?? s.publisher ?? "";
  ok(`financeDashboard[${i}]: 発行主体が延岡市`, org.includes("延岡市"), org);
  const url = s.url ?? s.sourceUrl ?? null;
  // サイト内に保管した公式PDF（/documents/... のサイト相対パス）は外部ホストを持たない。
  // これは延岡市の公式資料をアーカイブしたものなので、ホスト検査の対象外にする。
  if (url && !url.startsWith("/")) {
    const host = hostOf(url);
    ok(`financeDashboard[${i}]: 出典URLが延岡市公式ドメイン`, host !== null && CITY_HOSTS.has(host), String(host));
  }
});

/* --- 2. archiveFiscalYears.json：年度別財政データの出典（報道・県自身の財政の混入だけを見る） --- */
const fiscalYears = JSON.parse(readFileSync("src/data/archiveFiscalYears.json", "utf8"));
let fiscalRefCount = 0;
for (const year of fiscalYears) {
  for (const [metricKey, metric] of Object.entries(year)) {
    if (!metric || typeof metric !== "object" || !Array.isArray(metric.sourceRefs)) continue;
    metric.sourceRefs.forEach((ref, i) => {
      fiscalRefCount += 1;
      checkFinanceSource(`archiveFiscalYears[${year.year ?? year.fiscalYear}].${metricKey}[${i}]`, ref);
    });
  }
}
ok("年度別財政データに出典が登録されている", fiscalRefCount > 0, String(fiscalRefCount));

/* --- 3. 自動更新の財政監視が延岡市公式ページだけを見ている --- */
{
  const updater = readFileSync("scripts/auto-update/finance/update-finance.mjs", "utf8");
  const urls = [...updater.matchAll(/https?:\/\/[^"'\s`]+/g)].map((m) => m[0]);
  const externalUrls = urls.filter((u) => {
    const host = hostOf(u);
    return host && !CITY_HOSTS.has(host);
  });
  ok("財政監視の対象URLがすべて延岡市公式ドメイン", externalUrls.length === 0, externalUrls.join(", "));
  ok("財政監視の対象URLが登録されている", urls.length > 0);
}

/* --- 4. 人口監視も同様に延岡市公式ドメインだけを見ている（人口は財政ページにも表示されるため） --- */
{
  const resolver = readFileSync("scripts/auto-update/population/resolve-population-source.mjs", "utf8");
  const urls = [...resolver.matchAll(/https?:\/\/[^"'\s`]+/g)]
    .map((m) => m[0])
    // `https://${ALLOWED_HOST}` のようなテンプレートリテラルは実URLではないため除外する
    // （許可ホスト定数そのものは ALLOWED_HOST の値として別途固定されている）。
    .filter((u) => !u.includes("${"));
  const externalUrls = urls.filter((u) => {
    const host = hostOf(u);
    return host && !CITY_HOSTS.has(host);
  });
  ok("人口出典の解決先URLが登録されている", urls.length > 0);
  ok(
    "許可ホスト定数が延岡市公式ドメイン",
    /const ALLOWED_HOST = "www\.city\.nobeoka\.miyazaki\.jp"/.test(resolver),
  );
  ok("人口出典の解決先がすべて延岡市公式ドメイン", externalUrls.length === 0, externalUrls.join(", "));
}

console.log(`[test-finance-source-hierarchy] ${checks} checks, ${failures} failures`);
if (failures > 0) process.exit(1);
