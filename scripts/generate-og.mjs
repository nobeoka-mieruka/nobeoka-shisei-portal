/**
 * 議員・議案ページ用のOGP画像を生成する（1200x630）。
 *
 * このスクリプトは Playwright を必要とするが、Cloudflare Pages のビルドを重く・不安定に
 * しないよう、package.json の依存関係には追加していない。ローカルで実行する前に
 * 一度だけ次を実行すること：
 *   npm install --no-save playwright
 *   npx playwright install chromium
 *
 * 生成した画像は public/og/members/{id}.png ・ public/og/bills/{id}.png に保存し、
 * 生成できたIDの一覧を src/data/ogManifest.json に書き出す。
 * このマニフェストに含まれないIDは、フロントエンド側で共通OGP画像へ自動的にフォールバックする。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function memberHtml({ name, factionName }) {
  return `<!doctype html><html><head><meta charset="UTF-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:1200px; height:630px; }
    body {
      font-family:"Noto Sans JP","Hiragino Sans",sans-serif;
      background:linear-gradient(135deg,#375ca8 0%,#24406f 100%);
      display:flex; flex-direction:column; justify-content:center;
      padding:90px; color:#fff; position:relative;
    }
    .badge { background:rgba(255,255,255,0.16); border:1px solid rgba(255,255,255,0.5);
      border-radius:999px; padding:8px 20px; font-size:22px; font-weight:500; margin-bottom:28px; width:fit-content; }
    h1 { font-size:60px; font-weight:700; line-height:1.3; margin-bottom:16px; }
    p { font-size:28px; color:rgba(255,255,255,0.88); }
    .footer { position:absolute; bottom:60px; left:90px; font-size:22px; color:rgba(255,255,255,0.75); }
  </style></head><body>
    <div class="badge">非公式・市民向け情報サイト</div>
    <h1>${escapeHtml(name)} 議員</h1>
    <p>延岡市議会議員${factionName ? `／${escapeHtml(factionName)}` : ""}</p>
    <div class="footer">延岡市政見える化ポータル</div>
  </body></html>`;
}

function billHtml({ billNumber, billTitle, result }) {
  return `<!doctype html><html><head><meta charset="UTF-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:1200px; height:630px; }
    body {
      font-family:"Noto Sans JP","Hiragino Sans",sans-serif;
      background:linear-gradient(135deg,#375ca8 0%,#24406f 100%);
      display:flex; flex-direction:column; justify-content:center;
      padding:90px; color:#fff; position:relative;
    }
    .badge { background:rgba(255,255,255,0.16); border:1px solid rgba(255,255,255,0.5);
      border-radius:999px; padding:8px 20px; font-size:22px; font-weight:500; margin-bottom:28px; width:fit-content; }
    h2 { font-size:26px; font-weight:500; margin-bottom:10px; color:rgba(255,255,255,0.85); }
    h1 { font-size:48px; font-weight:700; line-height:1.4; margin-bottom:20px;
      overflow-wrap:break-word; max-width:1020px; }
    .result { font-size:30px; font-weight:700; background:rgba(255,255,255,0.14);
      display:inline-block; padding:8px 20px; border-radius:12px; width:fit-content; }
    .footer { position:absolute; bottom:60px; left:90px; font-size:22px; color:rgba(255,255,255,0.75); }
  </style></head><body>
    <div class="badge">非公式・市民向け情報サイト</div>
    <h2>${escapeHtml(billNumber)}</h2>
    <h1>${escapeHtml(billTitle)}</h1>
    ${result ? `<div class="result">議決結果：${escapeHtml(result)}</div>` : ""}
    <div class="footer">延岡市政見える化ポータル</div>
  </body></html>`;
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "[generate-og] Playwrightが見つかりません。ローカルで一度だけ次を実行してください:\n" +
        "  npm install --no-save playwright\n  npx playwright install chromium\n" +
        "（この処理はCloudflare Pagesのビルドには含まれていません。共通OGP画像は影響を受けません。）",
    );
    process.exit(1);
  }

  const members = readJson("src/data/members.json");
  const factions = readJson("src/data/factions.json");
  const factionName = (id) => factions.find((f) => f.id === id)?.name ?? "";
  const billVotes = readJson("src/data/billVotes.json");

  const memberDir = join(root, "public", "og", "members");
  const billDir = join(root, "public", "og", "bills");
  mkdirSync(memberDir, { recursive: true });
  mkdirSync(billDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  const manifest = { members: [], bills: [] };

  for (const m of members) {
    try {
      await page.setContent(memberHtml({ name: m.name, factionName: factionName(m.factionId) }));
      await page.screenshot({ path: join(memberDir, `${m.id}.jpg`), type: "jpeg", quality: 85 });
      manifest.members.push(m.id);
    } catch (err) {
      console.warn(`[generate-og] 議員${m.id}のOGP画像生成に失敗しました: ${err.message}`);
    }
  }

  for (const b of billVotes) {
    try {
      await page.setContent(billHtml({ billNumber: b.billNumber, billTitle: b.billTitle, result: b.result }));
      await page.screenshot({ path: join(billDir, `${b.id}.jpg`), type: "jpeg", quality: 85 });
      manifest.bills.push(b.id);
    } catch (err) {
      console.warn(`[generate-og] 議案${b.id}のOGP画像生成に失敗しました: ${err.message}`);
    }
  }

  await browser.close();

  writeFileSync(join(root, "src", "data", "ogManifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    `[generate-og] 議員${manifest.members.length}件、議案${manifest.bills.length}件のOGP画像を生成しました。`,
  );
}

main();
