/**
 * Phase240：クエリ付きURLへ直接アクセスしたときの React ハイドレーション不一致を、
 * ビルド済みサイトの実レンダリングで検出する監査スクリプト。
 *
 * 背景：本サイトはビルド時にHTMLを書き出し（scripts/prerender.mjs）、ブラウザ側で
 * hydrateRoot する。静的ホスティング（Cloudflare Pages）はクエリ文字列を無視して
 * 同じHTMLを配信するため、プリレンダリング済みHTMLは常に「クエリなし」の内容になる。
 * ページ側がレンダリング中に useSearchParams() の値を使って表示を変えていると、
 * 初回クライアントレンダリングだけが絞り込み後の内容になり、サーバー出力と食い違って
 * React のハイドレーションエラー（本番ビルドでは Minified React error #418 等）になる。
 *
 * このスクリプトは実ブラウザで次を確認する。
 *   1. クエリなしURL・クエリ付きURL・リロードのいずれでもハイドレーションエラーが出ない
 *   2. 上記でコンソールエラーが出ない
 *   3. ハイドレーション完了後には、クエリの絞り込みが実際に反映されている
 *      （不一致を「クエリを無視する」ことで消していないかの確認）
 *   4. アクセス時のクエリが、条件をURLへ書き戻すページでも失われない
 *   5. 参考値として、プリレンダリング済みHTMLとハイドレーション後DOMの本文量を記録する
 *
 * 使い方：
 *   npm run build
 *   node scripts/audit-hydration.mjs
 *   node scripts/audit-hydration.mjs --base-url=http://localhost:4173
 *
 * 出力：reports/phase240-hydration.json
 *
 * 注意：本番サイトへはアクセスしない。常にローカルの dist/ を対象にする。
 * 検査対象URLのIDは src/data から実データを読んで組み立てる（件数・IDを直書きしない）。
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
const PORT = Number(args.get("port") ?? 4194);
const EXTERNAL_BASE_URL = args.get("base-url");

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

const archiveMayors = readJson("src/data/archiveMayors.json");
const archiveFiscalYears = readJson("src/data/archiveFiscalYears.json");
const archivePolicies = readJson("src/data/archivePolicies.json");
const members = readJson("src/data/members.json");
const billVotes = readJson("src/data/billVotes.json");
const factions = readJson("src/data/factions.json");
const generalQuestions = readJson("src/data/generalQuestions.json");
const civicTimelineEvents = readJson("src/data/civicTimelineEvents.json");
const archiveCouncilDocuments = readJson("src/data/archiveCouncilDocuments.json");

/** 先頭からn件のIDを取り出す（データが少ないときも壊れないようにする）。 */
const take = (arr, n, pick) => arr.slice(0, n).map(pick);

const mayorIds = take(archiveMayors, 2, (m) => m.id);
const memberSlugs = take(members, 2, (m) => `member-${m.id}`);
const yearIds = take([...archiveFiscalYears].reverse(), 2, (y) => String(y.fiscalYear));
const policyIds = take(archivePolicies, 2, (p) => p.id);
const billIds = take(billVotes, 2, (b) => b.id);
const factionId = factions[0]?.id ?? "";
const questionMemberId = generalQuestions[0]?.memberId ?? members[0]?.id ?? "";
const timelinePersonId =
  civicTimelineEvents.find((e) => Array.isArray(e.relatedPersonIds) && e.relatedPersonIds.length > 0)
    ?.relatedPersonIds[0] ?? mayorIds[0];
const billFiscalYear = billVotes[0]?.fiscalYear ?? "";
const peopleFactionId = members[0]?.factionId ?? "";

/** 議会文書アーカイブ（条例・請願・陳情）の絞り込みクエリを、実データから組み立てる。 */
function archiveDocQueries(documentType) {
  const doc = archiveCouncilDocuments.find((d) => d.documentType === documentType);
  if (!doc) return [];
  const queries = [`?fiscalYear=${encodeURIComponent(String(doc.fiscalYear))}`];
  if (doc.sessionId) queries.push(`?session=${encodeURIComponent(doc.sessionId)}`);
  if (doc.result) queries.push(`?result=${encodeURIComponent(doc.result)}`);
  return queries;
}

/**
 * 検査対象。path は必ず末尾スラッシュ付き（vite preview にプリレンダリング済みの
 * <path>/index.html を確実に配信させるため）。query は「?」以降。
 * expect は「クエリ → ハイドレーション完了後の本文に含まれているべき文字列の配列」
 * （＝クエリの絞り込みが機能していることの確認）。
 */
const TARGETS = [
  {
    path: "/compare/mayors/",
    queries: ["", `?items=${mayorIds[0]}`, `?items=${mayorIds.join(",")}`],
    // ハイドレーション完了後には、URLで指定された選択が実際に反映されていること。
    expect: {
      [`?items=${mayorIds[0]}`]: ["現在1件選択中"],
      [`?items=${mayorIds.join(",")}`]: ["現在2件選択中", "比較結果"],
    },
  },
  {
    path: "/compare/members/",
    queries: ["", `?items=${memberSlugs[0]}`, `?items=${memberSlugs.join(",")}`],
    expect: {
      [`?items=${memberSlugs[0]}`]: ["現在1件選択中"],
      [`?items=${memberSlugs.join(",")}`]: ["現在2件選択中", "比較結果"],
    },
  },
  { path: "/compare/finance/", queries: ["", `?years=${yearIds[0]}`, `?years=${yearIds.join(",")}`] },
  { path: "/compare/budget/", queries: ["", `?years=${yearIds[0]}`, `?years=${yearIds.join(",")}`] },
  { path: "/compare/debt/", queries: ["", `?years=${yearIds[0]}`, `?years=${yearIds.join(",")}`] },
  { path: "/compare/funds/", queries: ["", `?years=${yearIds[0]}`, `?years=${yearIds.join(",")}`] },
  { path: "/compare/population/", queries: ["", `?years=${yearIds[0]}`, `?years=${yearIds.join(",")}`] },
  { path: "/compare/policies/", queries: ["", `?items=${policyIds[0]}`, `?items=${policyIds.join(",")}`] },
  { path: "/compare/municipalities/", queries: [""] },
  { path: "/compare/similar-municipalities/", queries: [""] },
  { path: "/compare/", queries: [""] },
  {
    path: "/bills/compare/",
    queries: ["", `?left=${billIds[0]}`, `?left=${billIds[0]}&right=${billIds[1]}`],
    expect: { [`?left=${billIds[0]}&right=${billIds[1]}`]: ["本文の比較"] },
  },
  { path: "/bills/votes/", queries: ["", "?q=条例", `?year=${encodeURIComponent(billFiscalYear)}`, "?result=可決"] },
  { path: "/questions/", queries: ["", `?member=${questionMemberId}`] },
  { path: "/history/", queries: ["", `?person=${timelinePersonId}`] },
  { path: "/", queries: ["", `?faction=${factionId}`] },
  { path: "/policies/", queries: ["", "?ownerType=mayor", "?category=%E7%94%9F%E6%B4%BB"] },
  { path: "/people/", queries: ["", "?type=member", "?status=current", "?type=member&status=current", `?faction=${peopleFactionId}`, "?dataTier=full"] },
  { path: "/search/", queries: ["", "?q=議案", "?q=議案&type=bill"] },
  { path: "/council-activity/", queries: ["", `?compare=${members[0]?.id ?? ""}`] },
  { path: "/bills/", queries: ["", "?fiscalYear=" + encodeURIComponent(billFiscalYear)] },
  { path: "/ordinances/", queries: ["", ...archiveDocQueries("ordinance")] },
  { path: "/petitions/", queries: ["", ...archiveDocQueries("petition")] },
  { path: "/requests/", queries: ["", ...archiveDocQueries("request")] },
  { path: `/members/${members[0]?.id ?? ""}/`, queries: ["", "?questionTopic=%E9%98%B2%E7%81%BD"] },
];

/**
 * /people/?type=... は、本番（Cloudflare Pages）では functions/people/[[slug]].ts が
 * 事前生成済みのバリアントHTML（dist/_people-variants/type-<値>.html）へ差し替えて配信する。
 * vite preview は Pages Functions を実行しないため、そのままでは本番と違うHTML
 * （＝絞り込みなし版）が返り、本番には存在しない不一致を検出してしまう。
 * 監査では本番と同じ配信になるよう、同じ規則でバリアントHTMLを返す。
 */
const PEOPLE_TYPE_VARIANTS = new Set(["member", "former-member", "mayor"]);
function peopleVariantHtml(urlString) {
  const url = new URL(urlString);
  if (url.pathname.replace(/\/$/, "") !== "/people") return null;
  const type = url.searchParams.get("type");
  if (!type || !PEOPLE_TYPE_VARIANTS.has(type)) return null;
  const file = join(root, "dist", "_people-variants", `type-${type}.html`);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

/** ハイドレーション不一致に相当するメッセージか。React 本番ビルドは番号だけになる。 */
const HYDRATION_PATTERNS = [
  /Minified React error #(418|419|421|422|423|425)\b/i,
  /hydrat\w*\s+(failed|error|mismatch)/i,
  /did not match/i,
  /server (rendered )?html/i,
  /text content does not match/i,
];
const isHydrationMessage = (text) => HYDRATION_PATTERNS.some((re) => re.test(text));

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

/** <div id="root"> の中身だけを取り出し、空白差を無視した比較用テキストにする。 */
function rootText(html) {
  const start = html.indexOf('<div id="root">');
  if (start < 0) return "";
  const body = html.slice(start + '<div id="root">'.length);
  return body
    .replace(/<script[\s\S]*$/i, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  if (!existsSync(join(root, "dist", "index.html"))) {
    throw new Error("dist/index.html がありません。先に `npm run build` を実行してください。");
  }

  let server = null;
  let baseUrl = EXTERNAL_BASE_URL;
  if (!baseUrl) {
    baseUrl = `http://localhost:${PORT}`;
    console.log(`[phase240] vite preview を起動します (${baseUrl})`);
    server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
      cwd: root,
      shell: true,
      stdio: "ignore",
    });
    await waitForServer(`${baseUrl}/`);
  }

  const browser = await chromium.launch({ headless: true });
  const rows = [];
  const findings = [];

  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    // 本番の Pages Functions と同じ差し替えを再現する（上の peopleVariantHtml のコメント参照）。
    await page.route("**/people/**", async (route) => {
      const html = peopleVariantHtml(route.request().url());
      if (!html) return route.continue();
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    });

    for (const target of TARGETS) {
      for (const query of target.queries) {
        const url = `${baseUrl}${target.path}${query}`;
        const consoleErrors = [];
        const pageErrors = [];
        const onConsole = (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        };
        const onPageError = (err) => pageErrors.push(String(err?.message ?? err));
        page.on("console", onConsole);
        page.on("pageerror", onPageError);

        let prerenderText = "";
        try {
          // プリレンダリング済みHTML（JavaScript実行前）を直接取得する。
          const variant = peopleVariantHtml(url);
          prerenderText = rootText(variant ?? (await (await fetch(url)).text()));
        } catch (err) {
          findings.push({ url, type: "fetch-error", detail: String(err?.message ?? err) });
        }

        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
          await page.waitForTimeout(250);
        } catch (err) {
          findings.push({ url, type: "navigation-error", detail: String(err?.message ?? err).split("\n")[0] });
          page.off("console", onConsole);
          page.off("pageerror", onPageError);
          continue;
        }
        const hydratedText = (await page.evaluate(() => document.getElementById("root")?.innerText ?? ""))
          .replace(/\s+/g, " ")
          .trim();

        // ハイドレーション完了後に、URLのクエリが実際に反映されているか
        // （不一致を「クエリを無視する」ことで消していないかの確認）。
        for (const expected of target.expect?.[query] ?? []) {
          if (!hydratedText.includes(expected)) {
            findings.push({ url, type: "query-not-applied", detail: `「${expected}」が表示されていません` });
          }
        }

        // 絞り込み条件をURLへ書き戻すページで、アクセス時のクエリが消えていないか
        // （反映前に書き戻すと、共有されたURLの条件が失われる）。
        if (query) {
          const finalSearch = await page.evaluate(() => window.location.search);
          const finalParams = new URLSearchParams(finalSearch);
          for (const [key, value] of new URLSearchParams(query.replace(/^\?/, ""))) {
            if (finalParams.get(key) !== value) {
              findings.push({
                url,
                type: "query-not-applied",
                detail: `アクセス時の ${key}=${value} がURLから失われました（現在: ${finalSearch || "（なし）"}）`,
              });
            }
          }
        }

        // リロードでも同じ経路（プリレンダリング済みHTML＋hydrate）を通ることを確認する。
        try {
          await page.reload({ waitUntil: "networkidle", timeout: 45000 });
          await page.waitForTimeout(250);
        } catch (err) {
          findings.push({ url, type: "reload-error", detail: String(err?.message ?? err).split("\n")[0] });
        }

        page.off("console", onConsole);
        page.off("pageerror", onPageError);

        const allMessages = [...consoleErrors, ...pageErrors];
        const hydrationMessages = allMessages.filter(isHydrationMessage);
        const otherErrors = allMessages.filter((m) => !isHydrationMessage(m));

        for (const m of hydrationMessages) findings.push({ url, type: "hydration-error", detail: m });
        for (const m of otherErrors) findings.push({ url, type: "console-error", detail: m });

        rows.push({
          url,
          path: target.path,
          query,
          hydrationErrors: hydrationMessages.length,
          consoleErrors: otherErrors.length,
          prerenderChars: prerenderText.length,
          hydratedChars: hydratedText.length,
        });
        const mark = hydrationMessages.length > 0 ? "NG" : "ok";
        console.log(
          `[phase240] ${mark} ${target.path}${query} hydration=${hydrationMessages.length} console=${otherErrors.length}`,
        );
      }
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  const hydrationErrors = rows.reduce((a, r) => a + r.hydrationErrors, 0);
  const consoleErrors = rows.reduce((a, r) => a + r.consoleErrors, 0);
  const queryNotApplied = findings.filter((f) => f.type === "query-not-applied").length;
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    checkedUrls: rows.length,
    hydrationErrors,
    consoleErrors,
    queryNotApplied,
    rows,
    findings,
  };
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(join(root, "reports", "phase240-hydration.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(`\n[phase240] 検査URL: ${rows.length}`);
  console.log(`[phase240] ハイドレーションエラー: ${hydrationErrors}件`);
  console.log(`[phase240] その他のコンソールエラー: ${consoleErrors}件`);
  console.log(`[phase240] クエリが反映されていない箇所: ${queryNotApplied}件`);
  if (findings.length > 0) {
    console.log("--- 検出内容 ---");
    for (const f of findings.slice(0, 60)) console.log(`  [${f.type}] ${f.url}\n      ${f.detail}`);
    if (findings.length > 60) console.log(`  ...ほか${findings.length - 60}件`);
  }
  process.exit(hydrationErrors > 0 || consoleErrors > 0 || queryNotApplied > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
