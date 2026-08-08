/**
 * src/data配下の全JSONファイルからhttp(s)で始まる文字列（外部リンク）を収集し、
 * 実際にアクセスして状態を分類するリンク監査スクリプト。
 *
 * 対象サーバーへの負荷に配慮し、
 * - 同一ホストへの同時接続数を制限（デフォルト2）
 * - リクエスト間に間隔を空ける
 * - 同一URLは1回だけ確認（重複除去）
 * - HEADを優先し、405/501等でHEADが使えない場合のみGET
 * - timeoutとretry回数の上限を設定
 * - 結果をreports/external-link-check.jsonへキャッシュし、次回実行時は
 *   --force指定が無い限り直近のキャッシュ日時から一定期間内の結果を再利用する
 *
 * 使い方：
 *   node scripts/check-external-links.mjs             会議録検索システム（kensakusystem.jp）以外の全URLを検査
 *   node scripts/check-external-links.mjs --sample-kensakusystem=50  kensakusystem.jpからも指定件数だけ無作為抽出して検査
 *   node scripts/check-external-links.mjs --force     キャッシュを無視して再検査
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "src", "data");
const reportPath = join(root, "reports", "external-link-check.json");

const args = process.argv.slice(2);
const force = args.includes("--force");
const sampleArg = args.find((a) => a.startsWith("--sample-kensakusystem="));
const sampleKensakusystemCount = sampleArg ? Number(sampleArg.split("=")[1]) : 0;

const CACHE_MAX_AGE_DAYS = 14;
const PER_HOST_CONCURRENCY = 2;
const DELAY_BETWEEN_REQUESTS_MS = 350;
const TIMEOUT_MS = 12000;
const MAX_RETRIES = 1;

const URL_RE = /^https?:\/\//;

function collectUrls() {
  const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  const urlToFiles = new Map();
  function walk(obj, file) {
    if (Array.isArray(obj)) {
      for (const x of obj) walk(x, file);
      return;
    }
    if (obj && typeof obj === "object") {
      for (const v of Object.values(obj)) {
        if (typeof v === "string" && URL_RE.test(v)) {
          if (!urlToFiles.has(v)) urlToFiles.set(v, new Set());
          urlToFiles.get(v).add(file);
        } else {
          walk(v, file);
        }
      }
    }
  }
  for (const f of files) {
    try {
      walk(JSON.parse(readFileSync(join(dataDir, f), "utf8")), f);
    } catch {
      // JSON以外・読み込み失敗はスキップ
    }
  }
  return urlToFiles;
}

function loadPreviousReport() {
  if (!existsSync(reportPath)) return new Map();
  try {
    const prev = JSON.parse(readFileSync(reportPath, "utf8"));
    const map = new Map();
    for (const entry of prev.results ?? []) map.set(entry.url, entry);
    return map;
  } catch {
    return new Map();
  }
}

function isFresh(entry) {
  if (!entry?.checkedAt) return false;
  const ageMs = Date.now() - new Date(entry.checkedAt).getTime();
  return ageMs < CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000 && entry.category !== "timeout" && entry.category !== "error";
}

function categorize(status, error) {
  if (error) {
    if (error.name === "AbortError") return "timeout";
    if (/certificate|SSL|TLS/i.test(error.message ?? "")) return "ssl_error";
    return "error";
  }
  if (status >= 200 && status < 300) return "ok";
  if (status >= 300 && status < 400) return "redirect";
  if (status === 403) return "forbidden_403";
  if (status === 404) return "not_found_404";
  if (status === 410) return "gone_410";
  if (status >= 400 && status < 500) return "client_error";
  if (status >= 500) return "server_error";
  return "unknown";
}

async function fetchOnce(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NobeokaMieruka-LinkAudit/1.0)" },
    });
    return { status: res.status, location: res.headers.get("location") };
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let result;
      try {
        result = await fetchOnce(url, "HEAD");
        if (result.status === 405 || result.status === 501) {
          result = await fetchOnce(url, "GET");
        }
      } catch {
        // HEAD自体が例外（一部サーバーはHEADで接続拒否）の場合のみGETへフォールバック
        result = await fetchOnce(url, "GET");
      }
      return { status: result.status, location: result.location, category: categorize(result.status), error: null };
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        return { status: null, location: null, category: categorize(null, err), error: String(err.message ?? err) };
      }
    }
  }
}

async function runWithHostConcurrency(urls, onResult) {
  const byHost = new Map();
  for (const url of urls) {
    let host;
    try {
      host = new URL(url).host;
    } catch {
      onResult(url, { status: null, location: null, category: "invalid_url", error: "URLとして解釈できません" });
      continue;
    }
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(url);
  }

  const hostRunners = [...byHost.entries()].map(async ([, hostUrls]) => {
    // ホストごとに直列＋間隔をあけて実行（同一ホストへの同時接続数を1に制限し、さらに間隔を空ける）
    for (const url of hostUrls) {
      const result = await checkUrl(url);
      onResult(url, result);
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
    }
  });

  // ホスト単位のグループを PER_HOST_CONCURRENCY 個ずつ並行実行
  const queue = [...hostRunners];
  const workers = [];
  for (let i = 0; i < PER_HOST_CONCURRENCY; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const job = queue.shift();
          if (job) await job;
        }
      })(),
    );
  }
  await Promise.all(workers);
}

async function main() {
  const urlToFiles = collectUrls();
  let targets = [...urlToFiles.keys()].filter((u) => !u.includes("kensakusystem.jp"));

  if (sampleKensakusystemCount > 0) {
    const kensakusystemUrls = [...urlToFiles.keys()].filter((u) => u.includes("kensakusystem.jp"));
    // 決定的な抽出（実行のたびに違うURLにならないよう、一定間隔で間引く）
    const step = Math.max(1, Math.floor(kensakusystemUrls.length / sampleKensakusystemCount));
    const sample = kensakusystemUrls.filter((_, i) => i % step === 0).slice(0, sampleKensakusystemCount);
    targets = [...targets, ...sample];
  }

  const previous = loadPreviousReport();
  const toCheck = force ? targets : targets.filter((u) => !isFresh(previous.get(u)));
  const reused = targets.length - toCheck.length;

  console.log(
    `[check-external-links] 対象URL=${targets.length}（うちキャッシュ再利用=${reused}、新規確認=${toCheck.length}）`,
  );

  const results = new Map(previous);
  let done = 0;
  await runWithHostConcurrency(toCheck, (url, result) => {
    results.set(url, {
      url,
      files: [...(urlToFiles.get(url) ?? [])],
      checkedAt: new Date().toISOString(),
      ...result,
    });
    done++;
    if (done % 25 === 0) console.log(`[check-external-links] ${done}/${toCheck.length}件確認済み`);
  });

  // targetsに含まれないURL（前回チェックしたが今回はkensakusystemサンプル対象外になった等）は
  // レポートから除外せずそのまま残す（履歴として有用なため）。ただしfilesは最新のurlToFilesで更新。
  for (const [url, entry] of results) {
    if (urlToFiles.has(url)) entry.files = [...urlToFiles.get(url)];
  }

  const summary = {};
  for (const url of targets) {
    const cat = results.get(url)?.category ?? "unknown";
    summary[cat] = (summary[cat] ?? 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    targetCount: targets.length,
    cacheReused: reused,
    newlyChecked: toCheck.length,
    summary,
    results: [...results.values()].sort((a, b) => a.url.localeCompare(b.url)),
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log("[check-external-links] 分類結果:", JSON.stringify(summary, null, 2));
  console.log(`[check-external-links] レポート: ${reportPath}`);
}

main().catch((err) => {
  console.error("[check-external-links] 失敗:", err);
  process.exit(1);
});
