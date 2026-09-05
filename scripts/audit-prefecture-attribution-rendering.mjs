/**
 * Phase233：「宮崎県のもの」が「延岡市のもの」として画面に出ていないことを、
 * ビルド済みサイトの実レンダリングで確認する監査スクリプト。
 *
 * 背景：scripts/test-implementation-attribution.mjs はデータとソースコードを機械的に検査するが、
 * 「実際にブラウザで描画したときに市民がどう読むか」までは保証しない。Phase233では、
 * 県関連の出来事について実際の画面テキストを取得し、次を確認する。
 *
 *   1. 宮崎県が実施主体の出来事のカードに「実施主体：延岡市」「延岡市の事業」が出ていない
 *   2. 実施主体を確認済みの出来事には、確認済みの区分がそのとおり表示されている
 *   3. 実施主体が未確認の県関連の出来事に、実施主体の注記が描画されていない
 *      （未確認を「延岡市」で埋めていない＝任意フィールドのまま壊れずに描画される）
 *   4. 市政年表に「延岡市内で行われたことと、延岡市が実施したことは別です」の説明が出ている
 *   5. 財政・議案・一般質問のページに、宮崎県の予算・宮崎県議会の議決が表示されていない
 *   6. 対象ページでコンソールエラーが発生しない
 *
 * 使い方：
 *   npm run build
 *   node scripts/audit-prefecture-attribution-rendering.mjs
 *   node scripts/audit-prefecture-attribution-rendering.mjs --base-url=http://localhost:4173
 *
 * 出力：reports/phase233-prefecture-attribution-rendering.json
 *
 * 注意：本番サイトへはアクセスしない。常にローカルの dist/ を対象にする。
 * vite preview は末尾スラッシュ付きのURLで開く（プリレンダリング済みの
 * <path>/index.html を確実に配信させるため）。
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.length ? rest.join("=") : "true"];
  }),
);
const PORT = Number(args.get("port") ?? 4193);
const EXTERNAL_BASE_URL = args.get("base-url");

const readSrc = (rel) => readFileSync(join(root, rel), "utf8");
const readJson = (rel) => JSON.parse(readSrc(rel));

const events = readJson("src/data/civicTimelineEvents.json");
const labelSource = readSrc("src/lib/implementationAttribution.ts");

/** 表示ラベルは src/lib/implementationAttribution.ts の定義から読み取る（二重管理を避ける）。 */
function labelMap(constName) {
  const block = labelSource.match(new RegExp(`${constName}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!block) throw new Error(`${constName} の定義が見つかりません`);
  const map = {};
  for (const m of block[1].matchAll(/(\w+):\s*"([^"]+)"/g)) map[m[1]] = m[2];
  return map;
}
const BODY_LABEL = labelMap("IMPLEMENTING_BODY_LABEL");
const RELATION_LABEL = labelMap("NOBEOKA_RELATION_LABEL");

/** 県関連の出来事の抽出条件は test-implementation-attribution.mjs と同じ考え方で揃える。 */
const PREFECTURAL_TITLE_RE = /県立|県営|宮崎県|県主催/;
const PREFECTURAL_SUBJECT_RE = /宮崎県(（[^）]*）)?[がは]|宮崎県主催|県主催/;
const looksPrefectural = (ev) => PREFECTURAL_TITLE_RE.test(ev.title) || PREFECTURAL_SUBJECT_RE.test(ev.summary ?? "");

const attributed = events.filter((e) => e.implementation);
const prefectureRelated = events.filter(looksPrefectural);
const unclassifiedPrefectural = prefectureRelated.filter((e) => !e.implementation);

/**
 * 監査対象ページ。市政年表（全件）と、実施主体を確認済みの出来事を含む年別ページ、
 * 県の混入を確認したい財政・議案・一般質問のページを含める。末尾スラッシュ必須。
 */
const yearsWithAttribution = [...new Set(attributed.map((e) => e.year))].sort();
const PAGES = [
  { path: "/history/", kind: "timeline-all" },
  { path: "/timeline/", kind: "timeline-index" },
  ...yearsWithAttribution.map((y) => ({ path: `/timeline/${y}/`, kind: "timeline-year", year: y })),
  { path: "/finance/", kind: "finance" },
  { path: "/bills/", kind: "bills" },
  { path: "/questions/", kind: "questions" },
];

/** 画面に出てはならない表現（県の予算・県議会の議決が市のページに出ていないか）。 */
const FORBIDDEN_ON_CITY_PAGES = [
  { label: "宮崎県議会の議決", re: /宮崎県議会/ },
  { label: "宮崎県の当初予算", re: /宮崎県.{0,8}当初予算/ },
  { label: "宮崎県の補正予算", re: /宮崎県.{0,8}補正予算/ },
  { label: "宮崎県の一般会計", re: /宮崎県.{0,8}一般会計/ },
];

function waitForServer(url, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url, { method: "GET" });
        if (res.ok) return resolve(true);
      } catch {
        /* まだ起動していない */
      }
      if (Date.now() - started > timeoutMs) return reject(new Error(`サーバが起動しませんでした: ${url}`));
      setTimeout(tick, 400);
    };
    tick();
  });
}

/**
 * ページ内で、指定した見出し文字列を持つ出来事カードの表示テキストを集める。
 * ブラウザ側で実行するため、外部変数を参照しない。
 */
/* eslint-disable */
function collectCards(titles) {
  const result = {};
  const cards = Array.from(document.querySelectorAll("li, article, section"));
  for (const title of titles) {
    // その見出しを含む最小の要素を「その出来事のカード」とみなす。
    const matches = cards.filter((el) => (el.textContent || "").includes(title));
    if (matches.length === 0) {
      result[title] = null;
      continue;
    }
    matches.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    result[title] = (matches[0].innerText || matches[0].textContent || "").replace(/\s+/g, " ").trim();
  }
  return result;
}
/* eslint-enable */

async function main() {
  if (!existsSync(join(root, "dist", "index.html"))) {
    throw new Error("dist/index.html がありません。先に `npm run build` を実行してください。");
  }

  let server = null;
  let baseUrl = EXTERNAL_BASE_URL;
  if (!baseUrl) {
    baseUrl = `http://localhost:${PORT}`;
    console.log(`[phase233] vite preview を起動します (${baseUrl})`);
    server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
      cwd: root,
      shell: true,
      stdio: "ignore",
    });
    await waitForServer(`${baseUrl}/`);
  }

  const browser = await chromium.launch({ headless: true });
  const findings = [];
  const pageResults = [];
  let renderedPages = 0;
  let checkedCards = 0;

  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    for (const target of PAGES) {
      const consoleErrors = [];
      const onConsole = (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      };
      page.on("console", onConsole);
      const url = `${baseUrl}${target.path}`;
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(150);
      } catch (err) {
        findings.push({ path: target.path, type: "page-error", detail: String(err.message || err).split("\n")[0] });
        page.off("console", onConsole);
        continue;
      }
      renderedPages += 1;
      const bodyText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");

      // 出来事カードの検査は、出来事を一覧表示するページだけで行う。
      const isTimelineListing = target.kind === "timeline-all" || target.kind === "timeline-year";
      // 年別ページは会計年度で近似して対応付けるため（例：2013年3月の出来事は令和24年度＝2012年度側に出る）、
      // 「この年に出るはず」を断定しない。描画されたカードだけを検査し、全件の網羅は
      // 市政年表（/history/、全期間・全件）で担保する。
      const targetAttributed = isTimelineListing ? attributed : [];
      const targetUnclassified = isTimelineListing ? unclassifiedPrefectural : [];

      let cards = {};
      if (isTimelineListing) {
        const titles = [...targetAttributed, ...targetUnclassified].map((e) => e.title);
        cards = titles.length > 0 ? await page.evaluate(collectCards, titles) : {};
      }

      for (const ev of targetAttributed) {
        const card = cards[ev.title];
        if (card == null) {
          // 全件を並べる市政年表に出ていないのは不具合。年別ページでは正常な状態。
          if (target.kind === "timeline-all") {
            findings.push({ path: target.path, eventId: ev.id, type: "event-not-rendered", detail: ev.title });
          }
          continue;
        }
        checkedCards += 1;
        const bodyLabel = BODY_LABEL[ev.implementation.implementingBody];
        const relationLabel = RELATION_LABEL[ev.implementation.nobeokaRelation];
        if (!card.includes(`実施主体： ${bodyLabel}`) && !card.includes(`実施主体：${bodyLabel}`)) {
          findings.push({ path: target.path, eventId: ev.id, type: "body-label-missing", detail: bodyLabel });
        }
        if (!card.includes(`延岡市との関係： ${relationLabel}`) && !card.includes(`延岡市との関係：${relationLabel}`)) {
          findings.push({ path: target.path, eventId: ev.id, type: "relation-label-missing", detail: relationLabel });
        }
        if (ev.implementation.implementingBody !== "nobeokaCity") {
          // 県・国・共同の出来事が「延岡市の事業」として表示されていないこと。
          if (/実施主体：\s*延岡市(?![と・])/.test(card)) {
            findings.push({ path: target.path, eventId: ev.id, type: "shown-as-city-body", detail: card.slice(0, 160) });
          }
          if (/延岡市との関係：\s*延岡市の事業/.test(card)) {
            findings.push({ path: target.path, eventId: ev.id, type: "shown-as-city-project", detail: card.slice(0, 160) });
          }
        }
      }

      for (const ev of targetUnclassified) {
        const card = cards[ev.title];
        if (card == null) continue; // 年別ページには会計年度の対応付けにより出ないことがある
        checkedCards += 1;
        // 未確認の県関連案件に、実施主体の注記が勝手に付いていないこと。
        if (/実施主体：/.test(card)) {
          findings.push({ path: target.path, eventId: ev.id, type: "unclassified-has-attribution", detail: card.slice(0, 160) });
        }
      }

      if (target.kind === "timeline-all") {
        if (!bodyText.includes("延岡市内で行われたことと、延岡市が実施したことは別です")) {
          findings.push({ path: target.path, type: "venue-explanation-missing", detail: "開催地と実施主体の説明が画面に無い" });
        }
      }
      if (target.kind === "finance" || target.kind === "bills" || target.kind === "questions") {
        for (const f of FORBIDDEN_ON_CITY_PAGES) {
          if (f.re.test(bodyText)) {
            findings.push({ path: target.path, type: "prefectural-content-on-city-page", detail: f.label });
          }
        }
      }
      for (const e of consoleErrors) {
        findings.push({ path: target.path, type: "console-error", detail: e });
      }
      page.off("console", onConsole);
      pageResults.push({
        path: target.path,
        kind: target.kind,
        attributedEventsRendered: targetAttributed.filter((e) => cards[e.title] != null).length,
        unclassifiedPrefecturalRendered: targetUnclassified.filter((e) => cards[e.title] != null).length,
        consoleErrors: consoleErrors.length,
      });
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  const report = {
    phase: "Phase233",
    title: "県関連の実施主体表示の実レンダリング監査",
    generatedAt: new Date().toISOString().slice(0, 10),
    baseUrl,
    viewport: "390x844",
    totals: {
      pagesRendered: renderedPages,
      cardsChecked: checkedCards,
      attributedEvents: attributed.length,
      prefectureRelatedEvents: prefectureRelated.length,
      unclassifiedPrefectural: unclassifiedPrefectural.length,
      findings: findings.length,
    },
    pages: pageResults,
    findings,
  };
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(
    join(root, "reports", "phase233-prefecture-attribution-rendering.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `[phase233] ${renderedPages}ページ描画 / ${checkedCards}件のカードを確認 / 指摘 ${findings.length}件`,
  );
  for (const f of findings.slice(0, 20)) console.log(`  - ${f.path} ${f.type} ${f.eventId ?? ""} ${f.detail ?? ""}`);
  if (findings.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
