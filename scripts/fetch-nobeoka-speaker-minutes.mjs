/**
 * 延岡市議会会議録検索システム（www.kensakusystem.jp/nobeoka）の会議録本文ページを
 * 1件取得し、生HTML・正規化テキスト・メタデータJSONを保存する試験用CLI。
 *
 * 対応するURL形式（2026年8月の調査で確認済み）：
 * - GetText3.exe（発言セグメント1件分。<FONT class="TEXT2">内に本文がある）
 * - SpkChoice3.exe（指定した発言者の、その本会議日における発言をすべてまとめたもの。
 *   <BODY>直下に「開催日：」「会議名：」に続けて本文がある）
 *
 * 使い方：
 *   node scripts/fetch-nobeoka-speaker-minutes.mjs --url="<SpkChoice3.exe または GetText3.exe のURL>" --output=data/minutes
 *
 * 安全対策：
 * - kensakusystem.jp ドメイン以外へはアクセスしない
 * - リクエスト間隔は2秒以上（scripts/lib/minutes-source.mjsのthrottleに準拠）
 * - 同一URLの出力ファイルが既に存在する場合は再取得しない（--forceで上書き可）
 * - 失敗時は有限回数のみ再試行（無限リトライしない）
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import iconv from "iconv-lite";
import { looksGarbled } from "./lib/minutes-source.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith("--url="))?.split("=").slice(1).join("=");
const outputDir = args.find((a) => a.startsWith("--output="))?.split("=")[1] ?? "data/minutes";
const force = args.includes("--force");

if (!url) {
  console.error('[fetch-nobeoka-speaker-minutes] --url="<会議録検索システムのURL>" を指定してください。');
  process.exit(1);
}

const ALLOWED_HOSTS = new Set(["www.kensakusystem.jp", "kensakusystem.jp"]);

function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`URLとして解釈できません: ${rawUrl}`);
  }
  if (parsed.protocol !== "https:") throw new Error(`httpsのみ許可します: ${rawUrl}`);
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`許可されていないドメインです（kensakusystem.jpのみ許可）: ${parsed.hostname}`);
  }
  // www無しはTLSハンドシェイクに失敗する環境があるため、www付きへ正規化する。
  if (parsed.hostname === "kensakusystem.jp") parsed.hostname = "www.kensakusystem.jp";
  return parsed;
}

function slugFromUrl(rawUrl) {
  return createHash("sha1").update(rawUrl).digest("hex").slice(0, 12);
}

/** GetText3.exe形式・SpkChoice3.exe形式の両方に対応する本文抽出。 */
function extractBody(html) {
  const textFontMatch = html.match(/<FONT class="TEXT2">([\s\S]*?)<\/FONT>/i);
  if (textFontMatch) return { raw: textFontMatch[1], format: "GetText3" };

  const bodyMatch = html.match(/<BODY[^>]*>([\s\S]*?)<\/BODY>/i);
  if (bodyMatch) return { raw: bodyMatch[1], format: "SpkChoice3-or-body" };

  return { raw: "", format: "unknown" };
}

function normalizeText(raw) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<BR\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/　+$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  const parsedUrl = validateUrl(url);
  const finalUrl = parsedUrl.toString();

  const slug = slugFromUrl(finalUrl);
  const rawDir = join(root, outputDir, "raw");
  const normalizedDir = join(root, outputDir, "normalized");
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(normalizedDir, { recursive: true });

  const rawPath = join(rawDir, `${slug}.html`);
  const normalizedPath = join(normalizedDir, `${slug}.txt`);
  const metaPath = join(normalizedDir, `${slug}.json`);

  if (!force && existsSync(rawPath) && existsSync(metaPath)) {
    console.log(`[fetch-nobeoka-speaker-minutes] 既に取得済みのためスキップします（--forceで再取得可）: ${rawPath}`);
    console.log(readFileSync(metaPath, "utf8"));
    return;
  }

  console.log(`[fetch-nobeoka-speaker-minutes] GET ${finalUrl}`);

  const maxRetries = 2;
  let lastError;
  let res;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      res = await fetch(finalUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NobeokaShiseiPortalBot/1.0; +https://nobeoka-shisei-portal.pages.dev/about)" },
      });
      break;
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        console.warn(`[fetch-nobeoka-speaker-minutes] 取得失敗（${attempt + 1}回目）。再試行します: ${e.message}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  if (!res) throw lastError;

  const status = res.status;
  const contentType = res.headers.get("content-type") ?? "";
  console.log(`[fetch-nobeoka-speaker-minutes] status=${status} content-type=${contentType}`);
  if (!res.ok) throw new Error(`HTTP ${status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  const html = iconv.decode(buf, "Shift_JIS");

  writeFileSync(rawPath, html, "utf8");
  console.log(`[fetch-nobeoka-speaker-minutes] 生HTML保存: ${rawPath}（${buf.length}バイト）`);

  const { raw, format } = extractBody(html);
  const text = normalizeText(raw);

  const garbled = looksGarbled(text);
  if (garbled) console.warn("[fetch-nobeoka-speaker-minutes] 警告: 文字化けの疑いがあります（日本語が検出できないか、置換文字が含まれています）。");

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const kaisaiMatch = text.match(/開催日[：:]\s*(\S+?\s*\d+年\s*\d+月\s*\d+日)/);
  const kaigimeiMatch = text.match(/会議名[：:]\s*(.+)/);

  writeFileSync(normalizedPath, text, "utf8");
  console.log(`[fetch-nobeoka-speaker-minutes] 正規化テキスト保存: ${normalizedPath}（${text.length}文字）`);

  const meta = {
    sourceUrl: finalUrl,
    fetchedAt: new Date().toISOString(),
    httpStatus: status,
    contentType,
    extractFormat: format,
    title,
    meetingDate: kaisaiMatch?.[1],
    meetingTitle: kaigimeiMatch?.[1],
    textLength: text.length,
    looksGarbled: garbled,
  };
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  console.log(`[fetch-nobeoka-speaker-minutes] メタデータ保存: ${metaPath}`);
  console.log(JSON.stringify(meta, null, 2));
}

await main();
