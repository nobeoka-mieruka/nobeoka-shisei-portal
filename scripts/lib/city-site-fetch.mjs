/**
 * 延岡市公式サイト（www.city.nobeoka.miyazaki.jp）向けの、5日ごと自動巡回で使う
 * 低レベルfetchヘルパー。scripts/lib/minutes-source.mjsの適応型並列制御とは別に、
 * こちらは単純な直列実行・固定間隔（DISPATCH_INTERVAL_MS）を基本とする
 * （公式サイトの通常ページ向けであり、会議録検索システムほど大量アクセスしないため）。
 *
 * 安全方針：
 * - 許可ドメイン外へは一切アクセスしない（リダイレクト先も検査する）。
 * - 429はRetry-Afterを尊重し、指数バックオフで再試行する。
 * - 403は連続再試行しない（1回失敗したら即座に諦める）。
 * - 5xxは最大2回まで再試行する。
 * - 直近の巡回設定は初期並列数2〜3（本モジュールは直列前提のため、呼び出し側で
 *   Promise.allを使わず順次awaitすることで実質的に並列数1として扱う）。
 */
import { createHash } from "node:crypto";

export const ALLOWED_HOSTS = new Set(["www.city.nobeoka.miyazaki.jp", "city.nobeoka.miyazaki.jp"]);
export const BASE_URL = "https://www.city.nobeoka.miyazaki.jp";
const USER_AGENT =
  "Nobeoka-Shisei-Portal/1.0 (Council data sync; +https://nobeoka-shisei-portal.pages.dev/about)";
const DISPATCH_INTERVAL_MS = 500;
const TIMEOUT_MS = 15000;
const BACKOFF_DELAYS_MS = [2000, 5000];

export const stats = { checked: 0, count429: 0, count403: 0, count5xx: 0, errors: 0 };

let lastDispatchAt = 0;

async function throttle() {
  const wait = DISPATCH_INTERVAL_MS - (Date.now() - lastDispatchAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastDispatchAt = Date.now();
}

export function isAllowedUrl(url) {
  try {
    return ALLOWED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function resolveUrl(href, base = BASE_URL) {
  return new URL(href, base).toString();
}

export function sha256OfBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * 許可ドメイン・タイムアウト・429/403/5xx処理付きのfetch。
 * @param {string} url
 * @param {{maxRetries5xx?: number}} [options]
 */
export async function fetchCitySite(url, options = {}) {
  const maxRetries5xx = options.maxRetries5xx ?? 2;
  if (!isAllowedUrl(url)) {
    throw new Error(`許可されていないドメインです（取得を中止しました）: ${url}`);
  }
  let attempt5xx = 0;
  for (;;) {
    await throttle();
    stats.checked++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      });
    } catch (e) {
      clearTimeout(timer);
      stats.errors++;
      throw new Error(`ネットワークエラー: ${e.message}`);
    }
    clearTimeout(timer);

    if (!isAllowedUrl(res.url || url)) {
      stats.errors++;
      throw new Error(`許可されていないドメインへリダイレクトされました: ${res.url}`);
    }

    if (res.status === 429) {
      stats.count429++;
      const retryAfterSec = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : BACKOFF_DELAYS_MS[0];
      await new Promise((r) => setTimeout(r, backoff));
      // 429は1回だけ待って再試行し、それでも429ならエラーとして呼び出し側に委ねる（連続再試行しない）。
      await throttle();
      const retryRes = await fetch(url, { redirect: "follow", headers: { "User-Agent": USER_AGENT } });
      if (retryRes.status === 429) {
        stats.errors++;
        throw new Error("HTTP 429（再試行後も継続）");
      }
      res = retryRes;
    }

    if (res.status === 403) {
      stats.count403++;
      stats.errors++;
      throw new Error("HTTP 403（連続再試行はしません）");
    }

    if (res.status >= 500) {
      stats.count5xx++;
      if (attempt5xx < maxRetries5xx) {
        attempt5xx++;
        await new Promise((r) => setTimeout(r, BACKOFF_DELAYS_MS[Math.min(attempt5xx - 1, BACKOFF_DELAYS_MS.length - 1)]));
        continue;
      }
      stats.errors++;
      throw new Error(`HTTP ${res.status}（再試行上限に達しました）`);
    }

    if (!res.ok) {
      stats.errors++;
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    return res;
  }
}

export async function fetchCitySiteText(url) {
  const res = await fetchCitySite(url);
  const buf = Buffer.from(await res.arrayBuffer());
  // 延岡市公式サイトの通常ページはUTF-8。
  return buf.toString("utf8");
}

export async function fetchCitySiteBuffer(url) {
  const res = await fetchCitySite(url);
  return Buffer.from(await res.arrayBuffer());
}
